// Every piece of converted music in data/ is checked against the MIDI file it
// came from: note for note, plus a few plain sanity checks. If a data file is
// edited by hand, or a MIDI file is swapped and not reconverted, this fails.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";
import { readMidiFile } from "../tools/midi.mjs";
import { buildPieceData, jsonText, jsText } from "../tools/midi2json.mjs";

const root = new URL("..", import.meta.url); // this file sits in test/
const dataFiles = fs.readdirSync(new URL("data/", root)).filter((name) => name.endsWith(".json"));

function readData(name) {
  return JSON.parse(fs.readFileSync(new URL("data/" + name, root), "utf8"));
}

/** One note, told apart from another by its start, its pitch and its length. */
function key(time, pitch, duration) {
  return time + ":" + pitch + ":" + duration;
}

/** What src/pieces.js says the page can play. */
function piecesListed() {
  const source = fs.readFileSync(new URL("src/pieces.js", root), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.Bach.pieces;
}

test("there is converted music to play", () => {
  assert.ok(dataFiles.length > 0, "data/ holds no .json files");
});

for (const name of dataFiles) {
  const slug = name.replace(/\.json$/, "");
  const data = readData(name);

  test(slug + ": the JSON holds every note of its MIDI file", () => {
    const source = new URL(data.source, root);
    assert.ok(fs.existsSync(source), data.source + " is missing");
    const fresh = buildPieceData(readMidiFile(fs.readFileSync(source)), slug, data.source);
    assert.deepStrictEqual(fresh, data, "the notes in the JSON are not what the MIDI file says");
    assert.strictEqual(jsonText(data), fs.readFileSync(new URL("data/" + name, root), "utf8"), "run: node tools/midi2json.mjs");
  });

  test(slug + ": the .js the page loads carries the same notes", () => {
    assert.strictEqual(
      jsText(data, slug),
      fs.readFileSync(new URL("data/" + slug + ".js", root), "utf8"),
      "run: node tools/midi2json.mjs"
    );
  });

  test(slug + ": nothing was invented, and nothing was dropped in silence", () => {
    const midi = readMidiFile(fs.readFileSync(new URL(data.source, root)));

    // Everything the MIDI file holds, counted, ready to be handed out.
    const pool = new Map(); // track -> key -> how often it appears
    for (const note of midi.notes) {
      if (!pool.has(note.track)) pool.set(note.track, new Map());
      const keys = pool.get(note.track);
      const k = key(note.time, note.pitch, note.duration);
      keys.set(k, (keys.get(k) || 0) + 1);
    }

    // Every note of the JSON came out of the MIDI file, from the voice it says.
    for (const [voice, pitch, time, duration] of data.notes) {
      const keys = pool.get(voice);
      const k = key(time, pitch, duration);
      const left = keys && keys.get(k);
      assert.ok(left, "the JSON plays a note the MIDI file does not have: track " + voice + " at " + k);
      keys.set(k, left - 1);
    }

    // Each copy the JSON admits to leaving out really is a copy: the whole track
    // is another track again, shifted by whole octaves.
    let notesLeftOut = 0;
    for (const copy of data.copies.octaveTracks) {
      const mine = midi.notes.filter((note) => note.track === copy.track);
      const followed = new Set(
        midi.notes
          .filter((note) => note.track === copy.follows)
          .map((note) => key(note.time, note.pitch, note.duration))
      );
      assert.strictEqual(mine.length, copy.notes, "track " + copy.track + " does not have the notes the JSON says");
      for (const note of mine) {
        assert.ok(
          followed.has(key(note.time, note.pitch - copy.octaves * 12, note.duration)),
          "track " +
            copy.track +
            " is said to be track " +
            copy.follows +
            " " +
            copy.octaves +
            " octaves up, but its " +
            note.pitch +
            " at " +
            note.time +
            " s is not there"
        );
      }
      notesLeftOut += mine.length;
    }

    // Whatever is still in the pool is either one of those copy tracks, whole,
    // or a note the same key struck twice over.
    const copyTracks = new Set(data.copies.octaveTracks.map((copy) => copy.track));
    let repeated = 0;
    for (const [track, keys] of pool) {
      if (copyTracks.has(track)) continue;
      for (const left of keys.values()) repeated += Math.max(0, left);
    }
    assert.strictEqual(repeated, data.copies.unisonNotes, "notes went missing that the JSON does not account for");
    assert.strictEqual(data.noteCount + notesLeftOut + data.copies.unisonNotes, data.sourceNoteCount);
    assert.strictEqual(data.sourceNoteCount, midi.notes.length, "the MIDI file and the stated count disagree");

    // And no note is struck twice in the result: one pitch, one moment, once.
    const once = new Set();
    for (const row of data.notes) {
      const k = row[1] + ":" + row[2] + ":" + row[3];
      assert.ok(!once.has(k), "the same note appears twice: " + k);
      once.add(k);
    }
  });

  test(slug + ": the notes are sane", () => {
    const notes = data.notes;
    assert.strictEqual(notes.length, data.noteCount);
    let counted = 0;
    for (const voice of data.voices) counted += voice.noteCount;
    assert.strictEqual(counted, notes.length, "the voices do not add up to all the notes");

    let low = 128;
    let high = 0;
    let previous = -1;
    for (const note of notes) {
      const [voice, pitch, time, length, velocity] = note;
      assert.ok(note.length === 5, "a note has " + note.length + " values, not five");
      assert.ok(data.voices.some((v) => v.index === voice), "a note is in voice " + voice + ", which is not listed");
      assert.ok(pitch >= 12 && pitch <= 108, "pitch " + pitch + " is off any keyboard");
      assert.ok(time >= previous, "the notes are not in time order at " + time);
      assert.ok(length > 0, "a note at " + time + " has no length");
      assert.ok(velocity > 0 && velocity <= 1, "loadness " + velocity + " is not between 0 and 1");
      previous = time;
      if (pitch < low) low = pitch;
      if (pitch > high) high = pitch;
    }
    assert.deepStrictEqual([low, high], data.pitchRange);

    let lastTempo = -1;
    for (const change of data.tempo) {
      assert.ok(change.time >= lastTempo, "the tempo marks are out of order");
      assert.ok(change.bpm > 0 && change.bpm < 400, "tempo " + change.bpm + " bpm is not believable");
      lastTempo = change.time;
    }

    const end = notes.reduce((longest, note) => Math.max(longest, note[2] + note[3]), 0);
    assert.ok(Math.abs(end - data.duration) < 0.001, "the stated length is not the length of the notes");
    const minutes = data.duration / 60;
    assert.ok(minutes > 1 && minutes < 60, "a piece of " + Math.round(minutes) + " minutes is not believable");

    // Two hands and two feet: nothing beyond this could be played, so a bigger
    // number would mean the same note got counted twice somewhere.
    const marks = [];
    for (const note of notes) {
      marks.push([note[2], 1]);
      // Four decimals, the precision the notes are written at, so a note that
      // ends exactly as another starts is not counted as sounding with it.
      marks.push([Math.round((note[2] + note[3]) * 10000) / 10000, -1]);
    }
    marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let sounding = 0;
    let widest = 0;
    for (const mark of marks) {
      sounding += mark[1];
      if (sounding > widest) widest = sounding;
    }
    assert.ok(widest <= 24, "widest sounding chord is " + widest + " notes: that is not playable");
  });
}

test("every converted piece has a place on the page, and every name on the page is real", () => {
  const pieces = [...piecesListed()];
  assert.deepStrictEqual(
    pieces.map((piece) => piece.slug).sort(),
    dataFiles.map((name) => name.replace(/\.json$/, "")).sort(),
    "the page and data/ do not hold the same pieces"
  );

  for (const piece of pieces) {
    assert.ok(piece.title, "a piece has no title");
    assert.ok(piece.subtitle, piece.slug + " has no subtitle");
    assert.strictEqual(piece.file, "data/" + piece.slug + ".js", piece.slug + " points at the wrong data file");
    assert.ok(fs.existsSync(new URL(piece.file, root)), piece.file + " is missing: run node tools/midi2json.mjs");

    const data = readData(piece.slug + ".json");
    const listed = new Set(Object.keys(piece.voices).map(Number));
    for (const voice of data.voices) {
      const known = piece.voices[voice.index];
      assert.ok(known && known.name, piece.slug + " voice " + voice.index + " has no name for the screen");
      assert.ok(
        /^#[0-9a-f]{6}$/.test(known.colour),
        piece.slug + " voice " + voice.index + ' colour "' + known.colour + '" is not a colour'
      );
      listed.delete(voice.index);
    }
    assert.strictEqual(
      listed.size,
      0,
      piece.slug + " names voices that are not in the data: " + [...listed].join(", ")
    );
  }
});
