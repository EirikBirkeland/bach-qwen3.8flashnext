// Which parts of a piece were already played, worked out from the notes. The
// picture marks a repeat, so this has to be right about the repeats it finds -
// and about the ones it must not invent.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url);

function loadEchoes() {
  const source = fs.readFileSync(new URL("src/echoes.js", root), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.Bach.phraseEchoes;
}

const phraseEchoes = loadEchoes();

/** A bar of `count` sixteenth notes going up the scale, in one voice. */
function line(voice, from, pitch) {
  const notes = [];
  for (let i = 0; i < 16; i++) {
    notes.push({ voice: voice, pitch: pitch + (i % 8), time: from + i * 0.25, length: 0.25 });
  }
  return notes;
}

function sorted(notes) {
  return notes.slice().sort((a, b) => a.time - b.time || a.pitch - b.pitch);
}

const BARS = [0, 1, 2, 3, 4, 5, 6, 7];

test("a phrase played again is recognised, ornament and all", () => {
  const first = [].concat(line(1, 0, 60), line(2, 0, 36));
  // The same thing again at bar 5, with one little ornament added to the top line.
  const again = [].concat(line(1, 4, 60), { voice: 1, pitch: 69, time: 4.125, length: 0.125 }, line(2, 4, 36));
  const found = phraseEchoes(sorted([].concat(first, again)), BARS, 4);
  assert.strictEqual(found.length, 1, "the repeat was not found");
  assert.strictEqual(found[0].phrase, 1);
  assert.strictEqual(found[0].again, 0);
  assert.ok(found[0].at === 4, "the repeat starts at " + found[0].at);
  assert.ok(found[0].matched > 0.9, "only " + found[0].matched + " of it matched");
});

test("a second phrase that is different is not called a repeat", () => {
  const first = [].concat(line(1, 0, 60), line(2, 0, 36));
  const other = [].concat(line(1, 4, 74), line(2, 4, 50));
  const found = phraseEchoes(sorted([].concat(first, other)), BARS, 4);
  assert.strictEqual(found.length, 0, "nothing here comes back: " + JSON.stringify(found));
});

test("the same thing an octave away is not the same thing", () => {
  const first = [].concat(line(1, 0, 60), line(2, 0, 36));
  const answer = [].concat(line(1, 4, 72), line(2, 4, 48));
  assert.strictEqual(phraseEchoes(sorted([].concat(first, answer)), BARS, 4).length, 0);
});

test("a handful of held notes is not a phrase", () => {
  const notes = [];
  for (const at of [0, 4]) {
    for (let i = 0; i < 4; i++) notes.push({ voice: 1, pitch: 60 + i, time: at, length: 4 });
  }
  assert.strictEqual(phraseEchoes(sorted(notes), BARS, 4).length, 0, "too few notes to mean anything");
});

test("nothing is called a repeat of something that comes later", () => {
  const later = [].concat(line(1, 4, 60), line(2, 4, 36));
  const first = [].concat(line(1, 0, 72), line(2, 0, 48));
  const found = phraseEchoes(sorted([].concat(first, later)), BARS, 4);
  assert.strictEqual(found.length, 0, "the first phrase cannot be a repeat of the second");
});

test("BWV 639: its picture finds the one thing it says twice", () => {
  const data = JSON.parse(fs.readFileSync(new URL("data/bwv639-ich-ruf-zu-dir.json", root), "utf8"));
  const notes = data.notes.map((row) => ({ voice: row[0], pitch: row[1], time: row[2], length: row[3] }));
  const found = phraseEchoes(notes, data.bars, 4);
  assert.strictEqual(found.length, 1, "expected the opening phrase to come back once, found " + JSON.stringify(found));
  assert.strictEqual(found[0].at, data.bars[4], "the repeat does not start where bar 5 does");
  assert.strictEqual(found[0].again, 0, "it is not a repeat of the opening phrase");
  assert.ok(found[0].matched >= 0.9, "only " + found[0].matched + " of the phrase came back");
});

test("BWV 582: an embellished variation is not a repeat", () => {
  // The Passacaglia's ground comes round twenty-one times, but always with the
  // music above it written anew - so a phrase of eight bars is never the same one
  // over again, and the picture should not claim that it is.
  const data = JSON.parse(fs.readFileSync(new URL("data/bwv582-passacaglia-c-minor.json", root), "utf8"));
  const notes = data.notes.map((row) => ({ voice: row[0], pitch: row[1], time: row[2], length: row[3] }));
  for (const phrase of [4, 8, 16]) {
    assert.strictEqual(phraseEchoes(notes, data.bars, phrase).length, 0, "at " + phrase + " bars a phrase is not a repeat");
  }
});
