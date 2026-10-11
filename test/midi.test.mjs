// Checks the MIDI reader on a small file built here, byte by byte, so every
// expected time can be worked out by hand.

import test from "node:test";
import assert from "node:assert";
import { readMidiFile } from "../tools/midi.mjs";

/** A chunk: four letters, a length, then the body. */
function chunk(kind, body) {
  const text = kind.split("").map((c) => c.charCodeAt(0));
  return [...text, (body.length >> 24) & 255, (body.length >> 16) & 255, (body.length >> 8) & 255, body.length & 255, ...body];
}

/** A format 1 file with the given track bodies, 96 ticks to the quarter. */
function file(tracks) {
  const header = chunk("MThd", [0, 1, 0, tracks.length, 0, 96]);
  const bodies = tracks.map((events) => chunk("MTrk", flatten(events)));
  return Uint8Array.from(bodies.reduce((all, body) => all.concat(body), header.slice()));
}

const TEMPO_120 = [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]; // 500000 us a quarter
const TIME_SIGNATURE_3_4 = [0xff, 0x58, 0x04, 3, 2, 24, 8]; // 3/4, as LilyPond writes it
const TEMPO_150 = [0xff, 0x51, 0x03, 0x06, 0x1a, 0x80]; // 400000 us a quarter
const END = [0xff, 0x2f, 0x00];

test("notes land where the tempo map says", () => {
  // Quarter = 96 ticks. Until tick 24 the quarter lasts 0.5 s, after it 0.4 s.
  // So tick 24 is 0.125 s, tick 42 is 0.2 s, tick 52 is 0.2417 s.
  const conductor = [[0, ...TEMPO_120], [24, ...TEMPO_150], [0, ...END]];
  const voice = [
    [0, 0xff, 0x03, 0x04, 0x48, 0x49, 0x47, 0x48], // track name "HIGH"
    [0, 0x90, 60, 100], // A4 on
    [24, 64, 90], // E5 on, with no status byte of its own (running status)
    [18, 0x80, 60, 0x40], // A4 off at tick 42
    [10, 0x40, 0x40], // E5 off at tick 52, again by running status
    [0, ...END],
  ];
  const song = readMidiFile(file([conductor, voice]));

  assert.strictEqual(song.ticksPerQuarter, 96);
  assert.strictEqual(song.notes.length, 2);

  const a = song.notes[0];
  const b = song.notes[1];
  assert.strictEqual(a.pitch, 60);
  assert.strictEqual(a.time, 0);
  assert.strictEqual(a.duration, 0.2);
  assert.strictEqual(a.velocity, 0.7874);

  assert.strictEqual(b.pitch, 64);
  assert.strictEqual(b.time, 0.125);
  assert.strictEqual(b.duration, 0.1167);
  assert.strictEqual(b.velocity, 0.7087);

  assert.strictEqual(song.duration, 0.2417);
  assert.deepStrictEqual(song.pitchRange, [60, 64]);
  assert.deepStrictEqual(song.tempoChanges.map((change) => [change.tick, change.seconds, change.bpm]), [
    [0, 0, 120],
    [24, 0.125, 150],
  ]);
  assert.strictEqual(song.tracks.length, 2);
  assert.strictEqual(song.tracks[1].name, "HIGH");
  assert.strictEqual(song.tracks[1].channel, 0);
});

function flatten(events) {
  const out = [];
  for (const event of events) {
    if (Array.isArray(event)) out.push(...event);
    else out.push(event);
  }
  return out;
}

test("the same tempo written twice is not two changes", () => {
  const conductor = [[0, ...TEMPO_120], [0, ...TEMPO_120], [0, ...TEMPO_150], [0, ...TEMPO_150], [0, ...END]];
  const voice = [[0, 0x90, 60, 100], [48, 0x80, 60, 0], [0, ...END]];
  const song = readMidiFile(file([conductor, voice]));
  assert.deepStrictEqual(song.tempoChanges.map((change) => change.bpm), [120, 150]);
});

test("a note still held when its track ends is not dropped", () => {
  const voice = [[0, 0x90, 60, 100], [96, ...END]]; // no note-off at all
  const song = readMidiFile(file([voice]));
  assert.strictEqual(song.notes.length, 1);
  assert.strictEqual(song.notes[0].duration, 0.5);
  assert.strictEqual(song.duration, 0.5);
});

test("the metre in the file says how long a bar is", () => {
  // 3/4 written the way LilyPond writes it: the denominator is a power, so 2
  // means quarter notes. At 120 bpm a quarter lasts 0.5 s, so a bar is 1.5 s.
  const conductor = [[0, ...TIME_SIGNATURE_3_4], [0, ...TEMPO_120], [0, ...END]];
  const second = [[0, ...TIME_SIGNATURE_3_4], [0, 0x90, 60, 100], [48, 0x80, 60, 0], [0, ...END]];
  const song = readMidiFile(file([conductor, second]));

  assert.strictEqual(song.timeSignatures.length, 1, "the same metre twice is not two changes of metre");
  const mark = song.timeSignatures[0];
  assert.deepStrictEqual([mark.beats, mark.beat, mark.tick, mark.seconds], [3, 4, 0, 0]);
  assert.strictEqual(mark.barTicks, 3 * 96);
  assert.strictEqual(song.toSeconds(3 * 96), 1.5);
  assert.strictEqual(song.toSeconds(6 * 96), 3);
});

test("the conductor track carries no notes", () => {
  const conductor = [[0, ...TEMPO_120], [0, ...END]];
  const song = readMidiFile(file([conductor]));
  assert.strictEqual(song.notes.length, 0);
  assert.strictEqual(song.duration, 0);
});
