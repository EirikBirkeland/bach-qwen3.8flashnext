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
  return sandbox.window.Bach.echoes;
}

const echoes = loadEchoes();

/** One bar of eight notes, following the shape given, a bar to the second. */
function bar(voice, at, shape) {
  const notes = [];
  for (let i = 0; i < shape.length; i++) {
    notes.push({ voice: voice, pitch: 60 + shape[i], time: at + i * 0.125, length: 0.125 });
  }
  return notes;
}

// Four bars that go somewhere different each time. Bars that were all the same
// note would match each other, and then everything would be a repeat.
const SHAPE = [
  [0, 4, 7, 4, 2, 6, 9, 2],
  [0, 3, 7, 10, 9, 7, 5, 3],
  [2, 5, 9, 7, 5, 2, 7, 9],
  [0, 5, 8, 12, 11, 8, 4, 0],
];
const FILLER = [
  [12, 1, 14, 3, 15, 5, 17, 7],
  [13, 2, 16, 4, 18, 6, 20, 8],
  [11, 0, 13, 1, 15, 2, 17, 3],
];

/** `b` bars of one-second length, starting at zero. */
function barsOf(b) {
  const bars = [];
  for (let i = 0; i < b; i++) bars.push(i);
  return bars;
}

/** The four-bar theme, in two voices, starting at the bar that begins at `at`. */
function theme(at) {
  const notes = [];
  for (let i = 0; i < 4; i++) {
    notes.push.apply(notes, bar(1, at + i, SHAPE[i]));
    notes.push.apply(notes, bar(2, at + i, SHAPE[i].map((step) => step - 24)));
  }
  return notes;
}

function sorted(notes) {
  return notes.slice().sort((a, b) => a.time - b.time || a.pitch - b.pitch);
}

test("four bars played again are recognised, ornament and all", () => {
  // The same theme again straight after it, with one little curl added on top.
  const again = theme(4).concat({ voice: 1, pitch: 95, time: 4.25, length: 0.25 });
  const found = echoes(sorted(theme(0).concat(again)), barsOf(8), { minBars: 4 });
  assert.strictEqual(found.length, 1, "the repeat was not found: " + JSON.stringify(found));
  assert.strictEqual(found[0].at, 4, "the repeat starts at " + found[0].at);
  assert.strictEqual(found[0].again, 0, "it is not a repeat of the opening");
  assert.strictEqual(found[0].bars, 4, "it is " + found[0].bars + " bars long, not four");
  assert.ok(found[0].matched > 0.9, "only " + found[0].matched + " of it matched");
});

test("a repeat that begins between the phrases is still found", () => {
  // The whole point of sliding the window instead of tiling the piece into phrases
  // from bar 1: the music is taken here in four-bar phrases, and this return
  // begins five bars along - nowhere a four-bar phrase beginning at bar 1 puts a
  // line. That is how BWV 645's ritornello comes back, nineteen bars along.
  const notes = [].concat(
    theme(0),
    bar(1, 4, FILLER[0]),
    theme(5),
    bar(1, 9, FILLER[1]),
    bar(1, 10, FILLER[2])
  );
  const found = echoes(sorted(notes), barsOf(11), { minBars: 4 });
  assert.strictEqual(found.length, 1, "expected the one repeat, found " + JSON.stringify(found));
  assert.strictEqual(found[0].at, 5, "the repeat begins at " + found[0].at + ", not five bars along");
  assert.strictEqual(found[0].again, 0, "it is not a repeat of the opening");
  assert.strictEqual(found[0].bars, 4, "it is " + found[0].bars + " bars long");
  assert.strictEqual(found[0].until, 9, "it lasts until bar 10, not " + found[0].until);
});

test("one bar agreeing with another is a figure, not a repeat", () => {
  const notes = [].concat(
    theme(0),
    bar(1, 4, FILLER[0]),
    bar(1, 5, SHAPE[0]), // one bar of the theme, on its own
    bar(2, 5, SHAPE[0].map((step) => step - 24)),
    bar(1, 6, FILLER[1]),
    bar(1, 7, FILLER[2])
  );
  assert.strictEqual(echoes(sorted(notes), barsOf(8), { minBars: 3 }).length, 0, "a single bar is not the music coming back");
});

test("a second phrase that is different is not called a repeat", () => {
  const other = [].concat(bar(1, 4, FILLER[0]), bar(1, 5, FILLER[1]), bar(1, 6, FILLER[2]), bar(1, 7, FILLER[0]));
  assert.strictEqual(echoes(sorted(theme(0).concat(other)), barsOf(8), { minBars: 4 }).length, 0);
});

test("a thin echo of a full stretch is not the music coming back", () => {
  // The second telling has only one of the two voices. Every one of its notes was
  // heard before, but half the music is missing, and that is an echo of a few
  // notes, not the piece saying the same thing again.
  const thin = [];
  for (let i = 0; i < 4; i++) thin.push.apply(thin, bar(1, 4 + i, SHAPE[i]));
  const found = echoes(sorted(theme(0).concat(thin)), barsOf(8), { minBars: 4 });
  assert.strictEqual(found.length, 0, "half the texture was called a repeat: " + JSON.stringify(found));
});

test("the same thing an octave away is not the same thing", () => {
  const answer = theme(4).map((note) => ({ voice: note.voice, pitch: note.pitch + 12, time: note.time, length: note.length }));
  assert.strictEqual(echoes(sorted(theme(0).concat(answer)), barsOf(8), { minBars: 4 }).length, 0);
});

test("a handful of held notes is not a phrase", () => {
  // Every bar here agrees with every other bar, but there is nothing in them: two
  // held chords a bar is not music coming back, and a bar that thin is never
  // counted.
  const notes = [];
  for (const at of [0, 1, 2, 3, 4, 5, 6, 7]) {
    notes.push({ voice: 1, pitch: 60, time: at, length: 1 });
    notes.push({ voice: 1, pitch: 64, time: at, length: 1 });
  }
  assert.strictEqual(
    echoes(sorted(notes), barsOf(8), { minBars: 4 }).length,
    0,
    "two held notes a bar were called the music coming back"
  );
});

test("nothing is called a repeat of something that comes later", () => {
  const later = theme(4);
  const first = theme(0).map((note) => ({ voice: note.voice, pitch: note.pitch + 5, time: note.time, length: note.length }));
  const found = echoes(sorted(first.concat(later)), barsOf(8), { minBars: 4 });
  assert.strictEqual(found.length, 0, "the opening cannot be a repeat of what comes after it");
});

test("BWV 639: its picture finds the one thing it says twice", () => {
  const data = JSON.parse(fs.readFileSync(new URL("data/bwv639-ich-ruf-zu-dir.json", root), "utf8"));
  const notes = data.notes.map((row) => ({ voice: row[0], pitch: row[1], time: row[2], length: row[3] }));
  const found = echoes(notes, data.bars, { minBars: 4 });
  assert.strictEqual(found.length, 1, "expected the opening phrase to come back once, found " + JSON.stringify(found));
  assert.strictEqual(found[0].at, data.bars[4], "the repeat does not start where bar 5 does");
  assert.strictEqual(found[0].again, 0, "it is not a repeat of the opening phrase");
  assert.strictEqual(found[0].bars, 4, "it is " + found[0].bars + " bars, not the four of a phrase");
  assert.ok(found[0].matched >= 0.9, "only " + found[0].matched + " of the phrase came back");
});

test("BWV 645: the ritornello comes back whole, nineteen bars along", () => {
  // This is the repeat the tiling finder could never see. The opening of the piece
  // is played again from bar 24, and nineteen - the gap between the two - has no
  // divisors at all, so no phrase length put a line at both of them.
  const data = JSON.parse(fs.readFileSync(new URL("data/bwv645-wachet-auf.json", root), "utf8"));
  const notes = data.notes.map((row) => ({ voice: row[0], pitch: row[1], time: row[2], length: row[3] }));
  const found = echoes(notes, data.bars, { minBars: 4 });
  assert.strictEqual(found.length, 1, "expected the ritornello and nothing else, found " + JSON.stringify(found));
  assert.strictEqual(found[0].at, data.bars[23], "the ritornello comes back at " + found[0].at + " s, not at bar 24");
  assert.strictEqual(found[0].again, data.bars[4], "it is not a repeat of what was heard at bar 5");
  assert.ok(found[0].bars >= 6, "it is only " + found[0].bars + " bars of the telling");
  assert.ok(found[0].matched >= 0.9, "only " + found[0].matched + " of it came back");
});

test("BWV 582: an embellished variation is not a repeat", () => {
  // The Passacaglia's ground comes round twenty-one times, but always with the
  // music above it written anew - so no stretch of bars is ever the same one over
  // again, and the picture should not claim that it is.
  const data = JSON.parse(fs.readFileSync(new URL("data/bwv582-passacaglia-c-minor.json", root), "utf8"));
  const notes = data.notes.map((row) => ({ voice: row[0], pitch: row[1], time: row[2], length: row[3] }));
  for (const minBars of [2, 4, 8, 16]) {
    assert.strictEqual(echoes(notes, data.bars, { minBars: minBars }).length, 0, "at " + minBars + " bars there is no repeat to find");
  }
});
