// Every piece of converted music in data/ is checked against the MIDI file it
// came from: note for note, plus a few plain sanity checks. If a data file is
// edited by hand, or a MIDI file is swapped and not reconverted, this fails.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { readMidiFile } from "../tools/midi.mjs";
import { buildPieceData, jsonText, jsText } from "../tools/midi2json.mjs";

const root = new URL("..", import.meta.url); // this file sits in test/
const dataFiles = fs.readdirSync(new URL("data/", root)).filter((name) => name.endsWith(".json"));

function readData(name) {
  return JSON.parse(fs.readFileSync(new URL("data/" + name, root), "utf8"));
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
      marks.push([note[2] + note[3], -1]);
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
