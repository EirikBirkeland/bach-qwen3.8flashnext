// The tune that comes back, found by the page itself. src/theme.js is what tells
// BWV 565's picture which notes to make gold, so a tune it invents would put gold
// on the wrong music. The claims below about the real pieces are the ones a person
// can check against a score - and they are the same ones tools/shape.mjs makes,
// because the two finders were written from the same idea and must not drift.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url);

/** The page's own finder, loaded the way a browser loads it. */
function loadFinder() {
  const source = fs.readFileSync(new URL("src/theme.js", root), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.Bach.theme;
}

const theme = loadFinder();

/** The sandbox the page script is loaded in makes its own Array, so a list that
 *  came out of it has to be brought into this realm before a strict comparison
 *  will agree it is one. */
const plain = (list) => [...list];

/** A line of notes: one per `every` seconds, starting at `start`. */
function line(voice, list, every, start) {
  const step = every === undefined ? 1 : every;
  const from = start || 0;
  return list.map((pitch, index) => ({
    voice: voice,
    pitch: pitch,
    time: Math.round((from + index * step) * 1000) / 1000,
    length: step * 0.9,
  }));
}

// Eight notes is the shortest thing the finder will call a tune, so the lines
// below are built on one: C-E-G-A-B-D-E-G, and its fillers beside it.
const TUNE = [60, 64, 67, 69, 71, 74, 76, 79];
const lift = (list, by) => list.map((pitch) => pitch + by);

function dataOf(slug) {
  return JSON.parse(fs.readFileSync(new URL("data/" + slug + ".json", root), "utf8"));
}

/** The notes of a data file, as the page hands them to a picture. */
function notesOf(slug) {
  const data = dataOf(slug);
  const at = data.format.indexOf.bind(data.format);
  return data.notes.map((row) => ({
    voice: row[at("voice")],
    pitch: row[at("pitch")],
    time: row[at("time")],
    length: row[at("duration")],
  }));
}

function clock(seconds) {
  return Math.round(seconds * 10) / 10;
}

// ------------------------------------------------------------------ by hand

test("a tune is found whatever pitch it is sung at", () => {
  // The same eight notes three times, each time at another pitch, with unrelated
  // notes in between so nothing longer than the tune can match.
  const notes = line(1, [...TUNE, 50, 51, 52, ...lift(TUNE, 2), 53, 54, 55, ...lift(TUNE, -3), 56, 57, 58]);
  const found = theme(notes, { gap: 0 });
  assert.ok(found, "something comes back");
  assert.strictEqual(found.notes, 8, "the tune is the eight notes it is");
  assert.deepStrictEqual(plain(found.heard.map((one) => clock(one.time))), [0, 11, 22]);
  assert.deepStrictEqual(plain(found.heard.map((one) => one.pitch)), [60, 62, 57]);
});

test("a hearing hands back the notes themselves, so a picture can mark them", () => {
  const notes = line(1, [...TUNE, 50, 51, 52, ...lift(TUNE, 2), 53, 54, 55, ...lift(TUNE, -3), 56, 57, 58]);
  const found = theme(notes, { gap: 0 });
  const first = found.heard[0];
  assert.strictEqual(first.notes.length, 8, "as many notes as the tune is long");
  assert.strictEqual(first.notes[0], notes[0], "the very note the page is holding");
  assert.strictEqual(first.notes[7], notes[7]);
  assert.ok(
    found.heard.every((one) => one.notes.every((note) => note.voice === one.voice)),
    "a hearing wandered into another voice"
  );
  // `until` is where its last note lets go, which is what a glow has to last.
  assert.strictEqual(clock(first.until), clock(first.notes[7].time + first.notes[7].length));
});

test("one voice can hand the tune to another", () => {
  const notes = [
    ...line(1, [...TUNE, 50, 51, 52, ...lift(TUNE, 2)], 0.5, 0),
    ...line(2, lift(TUNE, 12), 0.5, 12), // the same tune, an octave up
  ];
  const found = theme(notes, { gap: 0 });
  assert.ok(found, "a tune heard twice in one voice and once in another");
  assert.strictEqual(found.heard.length, 3, "and all three tellings are found, in any voice");
  assert.deepStrictEqual(plain(found.heard.map((one) => one.voice)), [1, 1, 2]);
});

test("a copy that follows straight on is a sequence, not the tune coming back", () => {
  // One figure and then the same figure a tone higher, four seconds later - the
  // way a sequence runs on. A tune has to be heard, then come back after a while;
  // ask for five seconds between them and this has nothing to show.
  const runs = line(1, [...TUNE, ...lift(TUNE, 2)], 0.5, 0);
  assert.ok(theme(runs, { gap: 0 }), "with no gap the copy does count");
  assert.strictEqual(theme(runs, { gap: 5 }), null, "with a gap of five seconds nothing comes back");
});

test("a figure must wait two bars, when the bars are given", () => {
  // The copy is four seconds along, and a bar here is three seconds: two bars is
  // six, so it does not count as the tune coming back.
  const notes = line(1, [...TUNE, ...lift(TUNE, 3)], 0.5, 0);
  assert.ok(theme(notes, { gap: 0 }), "the eight notes do come back");
  assert.strictEqual(theme(notes, { bars: [0, 3, 6, 9, 12, 15, 18, 21] }), null, "but not a whole two bars later");
});

test("nothing is invented when nothing comes back", () => {
  const notes = line(1, [60, 62, 61, 64, 63, 67, 66, 69, 68, 71, 70, 74, 72, 76, 75, 73]);
  assert.strictEqual(theme(notes, { gap: 0 }), null);
});

test("the order the notes arrive in does not matter", () => {
  const notes = line(1, [...TUNE, 50, 51, 52, ...lift(TUNE, 2), 53, 54, 55, ...lift(TUNE, -3), 56, 57, 58]);
  const straight = theme(notes, { gap: 0 });
  const mixed = theme(notes.slice().reverse(), { gap: 0 });
  assert.deepStrictEqual(plain(mixed.heard.map((one) => clock(one.time))), plain(straight.heard.map((one) => clock(one.time))));
});

test("the finder is told about notes, not about a whole day of them", () => {
  // It works windows over every voice, so a piece twice as long is not four times
  // the work - and the picture has to be ready the moment a piece is clicked.
  const slugs = [
    "bwv565-toccata-and-fugue-d-minor",
    "bwv582-passacaglia-c-minor",
    "bwv639-ich-ruf-zu-dir",
    "bwv645-wachet-auf",
  ];
  const slowest = Math.max(
    ...slugs.map((slug) => {
      const notes = notesOf(slug);
      const at = Date.now();
      theme(notes, { bars: dataOf(slug).bars });
      return Date.now() - at;
    })
  );
  assert.ok(slowest < 900, "finding the tune took " + slowest + " ms for the longest piece: that is a hitch");
});

// --------------------------------------------------------------- real pieces

test("BWV 565: the fugue subject is found, and heard eight times", () => {
  const slug = "bwv565-toccata-and-fugue-d-minor";
  const found = theme(notesOf(slug), { bars: dataOf(slug).bars });
  assert.strictEqual(found.notes, 32, "the subject is thirty-two notes long");
  assert.strictEqual(found.heard.length, 8, "and it is heard eight times");
  assert.deepStrictEqual(plain(found.heard.map((one) => clock(one.time))), [118.3, 126.3, 154.3, 204.3, 342.3, 368.3, 418.3, 434.3]);

  // It is handed about: no one voice has more than three of the eight.
  const counts = {};
  for (const one of found.heard) counts[one.voice] = (counts[one.voice] || 0) + 1;
  assert.ok(Math.max(...Object.values(counts)) <= 3, "one voice has them all: " + JSON.stringify(counts));

  // None of it is in the toccata, which is over at about two minutes.
  assert.ok(found.heard[0].time > 110, "the subject arrives after the toccata, at " + found.heard[0].time);
});

test("BWV 565: three tellings are the pedal, each after it has been silent a long while", () => {
  const slug = "bwv565-toccata-and-fugue-d-minor";
  const notes = notesOf(slug);
  const found = theme(notes, { bars: dataOf(slug).bars });
  const pedal = notes.filter((note) => note.voice === 3).sort((a, b) => a.time - b.time);
  const entries = found.heard.filter((one) => one.voice === 3);
  assert.strictEqual(entries.length, 3, "the pedal takes the subject three times");
  for (const entry of entries) {
    let last = 0;
    for (const note of pedal) {
      if (note.time >= entry.time) break;
      last = Math.max(last, note.time + note.length);
    }
    assert.ok(
      entry.time - last >= 40,
      "the pedal's subject at " + clock(entry.time) + " s came after only " + clock(entry.time - last) + " s of silence"
    );
  }
});

test("BWV 582: the ground bass is found, and heard thirteen times in the pedal", () => {
  const slug = "bwv582-passacaglia-c-minor";
  const data = dataOf(slug);
  const found = theme(notesOf(slug), { bars: data.bars });
  assert.strictEqual(found.notes, 15, "fifteen notes, which is one round of the ground");
  assert.strictEqual(found.heard.length, 13, "heard in the pedal thirteen times");
  assert.ok(found.heard.every((one) => one.voice === 6), "every one of them in the pedal");
  for (let i = 1; i < 4; i++) {
    const apart = found.heard[i].time - found.heard[i - 1].time;
    assert.ok(Math.abs(apart - 20) < 0.2, "the first rounds follow one another eight bars later, not " + apart);
  }
});

test("BWV 639: the chorale's opening phrase is heard twice", () => {
  const slug = "bwv639-ich-ruf-zu-dir";
  const data = dataOf(slug);
  const found = theme(notesOf(slug), { bars: data.bars });
  assert.strictEqual(found.heard.length, 2, "the Stollen, heard twice as the bar form says");
  assert.ok(found.heard.every((one) => one.voice === 1), "and it is the chorale that sings it");
  const apart = found.heard[1].time - found.heard[0].time;
  assert.ok(Math.abs(apart - 4 * (data.bars[1] - data.bars[0])) < 0.2, "the second one is four bars along, at " + apart);
});

test("BWV 645: the opening ritornello comes back once, far along", () => {
  const slug = "bwv645-wachet-auf";
  const data = dataOf(slug);
  const found = theme(notesOf(slug), { bars: data.bars });
  assert.strictEqual(found.heard.length, 2, "once, and once again");
  const back = found.heard[1].time;
  assert.ok(Math.abs(back - data.bars[23]) < 1, "it is back at bar 24 (" + data.bars[23] + " s), said it was at " + back);
});

test("the same question about the same notes is answered once", () => {
  // A picture and the game both ask, and the longest piece takes a fifth of a
  // second to answer. They are handed the same list, so it must be the same work.
  const notes = notesOf("bwv639-ich-ruf-zu-dir");
  const bars = dataOf("bwv639-ich-ruf-zu-dir").bars;
  const once = theme(notes, { bars: bars });
  const twice = theme(notes, { bars: bars });
  assert.strictEqual(once, twice, "the finder went through the piece again");
  // ... and a different question is not answered with the old answer.
  assert.notStrictEqual(theme(notes, { bars: bars, gap: 1 }), once);
});
