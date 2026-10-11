// Checks the shape tool: the bar lines it draws, the figures it says come back,
// and - the part that matters most - a few things about the real pieces that can
// be checked against the score. A figure the tool invents would send the whole
// look of a piece off the rails, so the claims below are the ones a person can
// verify by hand.

import test from "node:test";
import assert from "node:assert";
import {
  loadPiece,
  barTable,
  sectionsOf,
  boundaries,
  gapsIn,
  stepIndex,
  returningFigures,
  longestRepeat,
  mostOftenFigure,
  whereHeard,
  themeFigure,
} from "../tools/shape.mjs";

/** Quick notes from [pitch, time] pairs, the way the tool holds them. */
function tune(list) {
  return list.map((pitch, index) => ({ pitch, time: index, length: 0.5, end: index + 0.5 }));
}

test("a window of steps names exactly the steps it covers", () => {
  const index = stepIndex(tune([60, 62, 64, 62, 60]));
  assert.deepStrictEqual(index.steps, [2, 2, -2, -2]);
  assert.strictEqual(index.keyAt(0, 4), "2,2,-2,-2");
  assert.strictEqual(index.keyAt(0, 2), "2,2");
  assert.strictEqual(index.keyAt(1, 3), "2,-2,-2");
  assert.strictEqual(index.keyAt(2, 1), "-2");
});

test("a figure comes back even when it is at another pitch", () => {
  // The same four notes three times, each time a whole step higher.
  const index = stepIndex(tune([60, 64, 67, 64, 62, 66, 69, 66, 67, 71, 74, 71]));
  const found = returningFigures(index, 4);
  assert.ok(found.length >= 1);
  assert.strictEqual(found[0].steps.join(","), "4,3,-3");
  assert.deepStrictEqual(found[0].starts, [0, 4, 8]);
  assert.deepStrictEqual(found[0].times, [0, 4, 8]);
});

test("copies that run straight on are a sequence, not the theme coming back", () => {
  const index = stepIndex(tune([60, 64, 67, 64, 62, 66, 69, 66, 67, 71, 74, 71]));
  // The copies are four seconds apart, so ask for nine and only one is left.
  assert.strictEqual(returningFigures(index, 4, { minGap: 9 }).length, 0);
  assert.strictEqual(returningFigures(index, 4, { minGap: 4 }).length, 1);
});

test("a note hammered over and over is not a figure", () => {
  const index = stepIndex(tune([72, 72, 72, 72, 72, 72, 72, 72, 65, 65, 65, 65, 65, 65, 65, 65]));
  assert.strictEqual(returningFigures(index, 4).length, 0);
});

test("the longest figure that comes back is the longest", () => {
  // C-D-E twice, with a different note after each time so nothing longer matches.
  const found = longestRepeat(tune([60, 62, 64, 50, 60, 62, 64, 55]), { minNotes: 2 });
  assert.deepStrictEqual(found.steps, [2, 2]);
  assert.deepStrictEqual(found.starts, [0, 4]);
});

test("a longer figure that comes back nearly as often wins", () => {
  const long = [60, 64, 67, 69, 71, 74, 76, 79];
  const melody = [...long, 40, ...long, 41, ...long, 42, 60, 64, 67, 69, 43];
  const notes = tune(melody);
  // The four-note opening occurs four times, the eight-note tune only three times,
  // and three is near enough to four that the tune is what we want to be told.
  assert.strictEqual(returningFigures(stepIndex(notes), 4, {})[0].starts.length, 4);
  const found = mostOftenFigure(notes, { minNotes: 4, maxNotes: 12 });
  assert.strictEqual(found.steps.length + 1, 8);
});

test("a rest in a voice is found, and so is a silence in the piece", () => {
  const notes = [
    { pitch: 60, time: 0, end: 1 },
    { pitch: 62, time: 1.2, end: 1.7 },
    { pitch: 64, time: 3, end: 4 },
  ];
  assert.deepStrictEqual(gapsIn(notes, 0.2), [{ time: 1.7, length: 1.3 }]);
  assert.deepStrictEqual(gapsIn(notes, 2), []);
});

/** A little piece of three bars, all worked out by hand. */
function tinyPiece() {
  return {
    slug: "tiny",
    title: "Tiny",
    duration: 6,
    tempo: [{ time: 0, bpm: 60 }],
    metre: { beats: 4, beat: 4 },
    barSeconds: 2,
    copiedAfter: 4,
    bars: [0, 2, 4],
    voices: [
      { index: 1, name: "One", noteCount: 4, range: [60, 64] },
      { index: 2, name: "Two", noteCount: 2, range: [36, 36] },
    ],
    notes: [
      { voice: 1, pitch: 60, time: 0, length: 1, end: 1 },
      { voice: 1, pitch: 64, time: 1, length: 1.5, end: 2.5 },
      { voice: 2, pitch: 36, time: 2, length: 2, end: 4 },
      { voice: 1, pitch: 62, time: 4, length: 1, end: 5 },
      { voice: 1, pitch: 60, time: 5, length: 1, end: 6 },
    ].sort((a, b) => a.time - b.time),
  };
}

test("the bar table counts what is in each bar", () => {
  const rows = barTable(tinyPiece());
  assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual(rows.map((row) => row.starts), [2, 1, 2]);
  assert.deepStrictEqual(rows.map((row) => row.width), [1, 2, 1]);
  assert.deepStrictEqual(rows.map((row) => row.voices), [[1], [1, 2], [1]]);
  assert.strictEqual(rows[0].mean, 62);
  assert.strictEqual(rows[0].low, 60);
  assert.strictEqual(rows[0].high, 64);
});

test("sections cut the piece where the mix changes", () => {
  // Sixteen bars of hand-made numbers: the first eight soft and low, the last
  // eight loud and high. The only plain place to cut is between them.
  const row = (bar, starts, width, mean, voices) => ({
    bar,
    time: (bar - 1) * 2,
    starts,
    width,
    mean,
    voices: new Array(voices).fill(1),
  });
  const table = [];
  for (let bar = 1; bar <= 8; bar++) table.push(row(bar, 6, 2, 48, 2));
  for (let bar = 9; bar <= 16; bar++) table.push(row(bar, 30, 6, 72, 4));

  const cuts = boundaries(table, 4);
  assert.ok(cuts.length > 0, "the change is found");
  assert.strictEqual(cuts[0].bar, 9, "and it is the biggest change there is");

  const sections = sectionsOf(table, 4);
  assert.strictEqual(sections.length, 2);
  assert.strictEqual(sections[0].from, 1);
  assert.strictEqual(sections[1].to, 16);
  assert.strictEqual(sections.reduce((sum, part) => sum + part.bars, 0), 16);
});

// --------------------------------------------------------------- real pieces

const SLUGS = [
  "bwv565-toccata-and-fugue-d-minor",
  "bwv582-passacaglia-c-minor",
  "bwv639-ich-ruf-zu-dir",
  "bwv645-wachet-auf",
];

const pieces = {};
for (const slug of SLUGS) pieces[slug] = loadPiece(slug);

for (const slug of SLUGS) {
  test(slug + ": the bars run from the first note to the last", () => {
    const piece = pieces[slug];
    assert.ok(piece.bars[0] === 0, "the first bar starts at nought");
    assert.ok(piece.bars[piece.bars.length - 1] < piece.duration, "the last bar has room in it");
    assert.ok(piece.bars.every((value, index) => index === 0 || value > piece.bars[index - 1]), "bar lines in order");
  });

  test(slug + ": every bar belongs to exactly one section", () => {
    const table = barTable(pieces[slug]);
    const sections = sectionsOf(table, 4);
    assert.strictEqual(sections.reduce((sum, part) => sum + part.bars, 0), table.length);
    assert.strictEqual(sections[0].from, 1);
    assert.strictEqual(sections[sections.length - 1].to, table.length);
    for (let index = 1; index < sections.length; index++) {
      assert.strictEqual(sections[index].from, sections[index - 1].to + 1, "sections follow on");
    }
  });

  test(slug + ": every place a figure is heard really has those notes", () => {
    const piece = pieces[slug];
    const theme = themeFigure(piece, piece.copiedAfter);
    assert.ok(theme, "something in this piece comes back");
    for (const entry of whereHeard(piece, theme.found.steps)) {
      const struck = piece.notes.filter((note) => note.voice === entry.voiceIndex && note.time === entry.time);
      assert.ok(struck.length > 0, "a figure is said to start where nothing is struck");
      assert.ok(struck.some((note) => note.pitch === entry.pitch), "and at the pitch it says");
    }
  });
}

test("BWV 582: a bar of three quarter notes, and the ground bass is eight bars long", () => {
  const piece = pieces["bwv582-passacaglia-c-minor"];
  assert.deepStrictEqual(piece.metre, { beats: 3, beat: 4 });
  assert.strictEqual(piece.barSeconds, 2.5); // three quarters at 72 to the minute

  const theme = themeFigure(piece, piece.copiedAfter);
  assert.strictEqual(theme.voice.name, "Pedal");
  assert.strictEqual(theme.found.steps.length + 1, 15, "the ground bass is fifteen notes long");
  assert.ok(theme.copies >= 12, "it comes back through the whole passacaglia, found " + theme.copies + " times");
  // Each statement is eight bars: eight times 2.5 s. The first statements follow
  // straight on; later ones are further apart, because in some variations the
  // theme is not in the pedal at all.
  const gaps = [];
  for (let index = 1; index <= 4; index++) gaps.push(Math.round((theme.found.times[index] - theme.found.times[index - 1]) * 100) / 100);
  assert.deepStrictEqual(gaps, [20, 20, 20, 40], "the statements are eight bars apart");
});

test("BWV 582: the theme is played alone before the variations begin", () => {
  const rows = barTable(pieces["bwv582-passacaglia-c-minor"]);
  const first = rows.slice(0, 8);
  assert.ok(first.every((row) => row.voices.length === 1), "only one voice for the first eight bars");
  assert.ok(first.every((row) => row.width === 1), "one note at a time");
  assert.ok(rows[8].voices.length >= 3, "the next variation is a full texture");
});

test("BWV 639: the opening four bars come back again, unchanged", () => {
  const piece = pieces["bwv639-ich-ruf-zu-dir"];
  const chorale = piece.notes.filter((note) => note.voice === 1);
  const found = mostOftenFigure(chorale, { minGap: piece.copiedAfter });
  assert.ok(found.starts.length >= 2, "the first phrase of the chorale returns");
  const fourBars = 4 * piece.barSeconds;
  assert.ok(Math.abs(found.times[1] - fourBars) < 0.25, "it returns at bar 5, " + found.times[1] + "s");
  assert.strictEqual(found.times[0], 0);
});

test("BWV 645: the chorale waits while the opening plays", () => {
  const piece = pieces["bwv645-wachet-auf"];
  const chorale = piece.notes.filter((note) => note.voice === 2);
  assert.ok(chorale[0].time > 45 && chorale[0].time < 55, "the chorale melody is heard at about 50s");
  const rows = barTable(piece);
  assert.ok(Math.max(...rows.map((row) => row.width)) <= 4, "three voices never make a wide chord");
});

test("BWV 565: there is a long stretch where one note at a time is sounding", () => {
  const rows = barTable(pieces["bwv565-toccata-and-fugue-d-minor"]);
  let run = [];
  let longest = [];
  for (const row of rows.concat([{ width: 9 }])) {
    if (row.width === 1) run.push(row);
    else {
      if (run.length > longest.length) longest = run;
      run = [];
    }
  }
  assert.ok(longest.length >= 8, "eight bars in a row with one note at a time, found " + longest.length);
  assert.ok(longest[0].time > 240 && longest[0].time < 400, "that stretch is in the middle of the piece");
});
