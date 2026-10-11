// The pulse of a piece, and the moments in it that are worth marking.
//
// src/pulse.js is what playing along is judged against, so a beat in the wrong
// place is a beat the player missed for no reason. The claims about the real
// pieces below are the ones the design in PLAN.md rests on: that the beat of all
// four pieces sits at a rate a hand can keep, that a downbeat lands on the bar
// line the picture draws, and that where the player slows down the beat slows.
//
// src/landmarks.js is what a beat is worth more for, so the same claims say what
// it finds in each piece - and what it must not find.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";
import { gameScripts } from "./files.mjs";

const root = new URL("..", import.meta.url);

/** The page's beat grid and landmark finder, loaded the way a browser loads them. */
function loadPage() {
  const sandbox = vm.createContext({ window: {} });
  for (const file of gameScripts()) {
    vm.runInContext(fs.readFileSync(new URL(file, root), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window.Bach;
}

const Bach = loadPage();

const plain = (list) => [...list];

function dataOf(slug) {
  return JSON.parse(fs.readFileSync(new URL("data/" + slug + ".json", root), "utf8"));
}

/** The notes of a data file, as the page hands them to the game. */
function notesOf(slug) {
  const data = dataOf(slug);
  const at = data.format.indexOf.bind(data.format);
  return data.notes
    .map((row) => ({
      voice: row[at("voice")],
      pitch: row[at("pitch")],
      time: row[at("time")],
      length: row[at("duration")],
    }))
    .sort((a, b) => a.time - b.time || a.pitch - b.pitch);
}

function beatsPerMinute(beats, duration) {
  return (beats.length / duration) * 60;
}

// --- the beat grid, on pieces built for the purpose -------------------------

test("a bar of four is four beats, and they are level", () => {
  const beats = plain(Bach.beats({ metre: { beats: 4, beat: 4 }, bars: [0, 4, 8], duration: 12 }));
  assert.strictEqual(beats.length, 12, "three bars of four");
  assert.strictEqual(beats[0].time, 0);
  assert.strictEqual(beats[1].time, 1);
  assert.strictEqual(beats[4].time, 4);
  assert.strictEqual(beats[0].bar, true, "the first beat of a bar knows it is one");
  assert.strictEqual(beats[1].bar, false);
});

test("a bar of three is three beats", () => {
  const beats = plain(Bach.beats({ metre: { beats: 3, beat: 4 }, bars: [0, 2.5, 5], duration: 7 }));
  assert.strictEqual(beats.length, 9);
  assert.strictEqual(beats[3].time, 2.5);
  assert.strictEqual(beats[3].bar, true);
});

test("where the player slows down, the beats stretch with the bar", () => {
  // The second bar here is six seconds long instead of four, which is what a
  // ritardando does to the bar lines the data file holds.
  const beats = plain(Bach.beats({ metre: { beats: 4, beat: 4 }, bars: [0, 4, 10], duration: 12 }));
  assert.strictEqual(beats[4].time, 4);
  assert.strictEqual(beats[5].time, 5.5, "a beat in a stretched bar is a quarter of it, not a quarter of the old bar");
  assert.strictEqual(beats[6].time, 7);
  assert.strictEqual(beats[7].time, 8.5);
});

test("the last bar of a piece may be a part of one", () => {
  const beats = plain(Bach.beats({ metre: { beats: 4, beat: 4 }, bars: [0, 4, 8], duration: 10 }));
  assert.strictEqual(beats.length, 12, "the part-bar at the end still has its four beats");
  assert.ok(beats[beats.length - 1].time < 10, "no beat is past the end of the piece");
});

test("no beat is asked for past the end, even if the bar lines are longer than the piece", () => {
  // A file whose last bar line sits past its own end: the grid stops at the music.
  const beats = plain(Bach.beats({ metre: { beats: 4, beat: 4 }, bars: [0, 4, 8], duration: 5 }));
  for (const beat of beats) {
    assert.ok(beat.time < 5, "a beat was asked for at " + beat.time + " in a piece of 5 seconds");
  }
});

test("a beat gap is measured, not assumed", () => {
  const beats = plain(Bach.beats({ metre: { beats: 4, beat: 4 }, bars: [0, 4, 8], duration: 9 }));
  assert.strictEqual(Bach.beatGap(beats), 1);
});

// --- and on the four pieces themselves --------------------------------------

const PIECES = ["bwv565-toccata-and-fugue-d-minor", "bwv582-passacaglia-c-minor", "bwv639-ich-ruf-zu-dir", "bwv645-wachet-auf"];

for (const slug of PIECES) {
  test(`${slug}: the beat sits at a rate a hand can keep`, () => {
    const data = dataOf(slug);
    const beats = plain(Bach.beats(data));
    const perMinute = beatsPerMinute(beats, data.duration);
    assert.ok(perMinute >= 33 && perMinute <= 75, `${perMinute.toFixed(0)} beats a minute is not a rate to play along to`);
    assert.strictEqual(beats[0].time, 0);
    for (let i = 1; i < beats.length; i++) {
      assert.ok(beats[i].time > beats[i - 1].time, "beats have to come one after another");
    }
    assert.ok(beats[beats.length - 1].time < data.duration);
  });

  test(`${slug}: a downbeat is on the bar line the picture draws`, () => {
    const data = dataOf(slug);
    const beats = plain(Bach.beats(data));
    const perBar = data.metre.beats;
    for (let b = 0; b < data.bars.length - 1; b++) {
      const beat = beats[b * perBar];
      assert.ok(Math.abs(beat.time - data.bars[b]) < 0.001, `bar ${b} opens at ${data.bars[b]}, the beat says ${beat.time}`);
      assert.strictEqual(beat.bar, true);
    }
  });
}

test("BWV 582: three to a bar, eight hundred and seventy-nine of them, and slower where the player slows", () => {
  const data = dataOf("bwv582-passacaglia-c-minor");
  const beats = plain(Bach.beats(data));
  assert.strictEqual(beats.length, 293 * 3);
  const usual = Bach.beatGap(beats);
  assert.strictEqual(usual, 2.5 / 3);
  let widest = 0;
  for (let i = 1; i < beats.length; i++) widest = Math.max(widest, beats[i].time - beats[i - 1].time);
  assert.ok(
    widest > usual * 2,
    "the piece slows five times before it ends; the widest beat gap was only " + widest.toFixed(2) + " against " + usual.toFixed(2)
  );
});

test("BWV 565: one beat a second, five hundred and seventy-two of them", () => {
  const data = dataOf("bwv565-toccata-and-fugue-d-minor");
  const beats = plain(Bach.beats(data));
  assert.strictEqual(beats.length, 143 * 4);
  assert.strictEqual(Bach.beatGap(beats), 1);
});

test("BWV 639: a slow piece is a slow beat, not a hurried one", () => {
  const data = dataOf("bwv639-ich-ruf-zu-dir");
  const beats = plain(Bach.beats(data));
  assert.strictEqual(beats.length, 18 * 4);
  assert.ok(Math.abs(Bach.beatGap(beats) - 6.4865 / 4) < 0.001);
});

// --- the moments worth marking ----------------------------------------------

/** One note, spelled out, so there is no guessing at what a test built. */
function note(voice, pitch, time, length) {
  return { voice: voice, pitch: pitch, time: time, length: length };
}

// Both hands speak at the start, and then the second is quiet for fourteen
// seconds before it is taken up again at 15.
const COMING_BACK = [note(1, 60, 0, 0.9), note(1, 62, 1, 0.9), note(1, 64, 2, 0.9), note(2, 48, 0, 0.9), note(2, 50, 15, 0.9)];
const NEVER_GONE = [note(1, 60, 0, 0.9), note(1, 62, 1, 0.9), note(2, 48, 0, 0.9), note(2, 50, 5, 0.9)];

test("a line coming back after a long silence is a moment", () => {
  const back = plain(Bach.returns(COMING_BACK, 10));
  assert.strictEqual(back.length, 1, "the second hand comes back once, and only once");
  assert.strictEqual(back[0].time, 15);
  assert.strictEqual(back[0].voice, 2);
});

test("a silence shorter than that is nothing", () => {
  assert.strictEqual(plain(Bach.returns(NEVER_GONE, 10)).length, 0);
});

test("four notes struck together are four notes, five are a chord", () => {
  const four = [0, 1, 2, 3].map((i) => ({ voice: 1, pitch: 60 + i, time: 4, length: 1 }));
  assert.strictEqual(plain(Bach.struckTogether(four, 5)).length, 0);
  const five = four.concat([{ voice: 2, pitch: 64, time: 4.01, length: 1 }]);
  const chords = plain(Bach.struckTogether(five, 5));
  assert.strictEqual(chords.length, 1);
  assert.strictEqual(chords[0].notes, 5);
  assert.strictEqual(chords[0].low, 60);
  assert.strictEqual(chords[0].high, 64);
});

// A chord of five struck together at 20, and a line taken up again at 40: two
// kinds of moment, found in one order and needing to be handed back in the other.
const TWO_KINDS = [
  note(1, 60, 20, 1),
  note(2, 64, 20, 1),
  note(3, 67, 20, 1),
  note(4, 72, 20, 1),
  note(5, 76, 20, 1),
  note(9, 48, 0, 1),
  note(9, 50, 40, 1),
];

test("the moments come back in time order, whatever kind they are", () => {
  const found = plain(Bach.landmarks(TWO_KINDS, { tune: false }));
  assert.strictEqual(found.length, 2, "a chord and a homecoming were to be found");
  assert.strictEqual(found[0].kind, "chord", "the chord is at 20 and comes first");
  assert.strictEqual(found[1].kind, "return", "the line back at 40 comes after it");
  for (let i = 1; i < found.length; i++) assert.ok(found[i].time >= found[i - 1].time);
});

test("a finder that is not asked for a tune does not go looking", () => {
  const kinds = plain(Bach.landmarks(COMING_BACK, { tune: false })).map((one) => one.kind);
  assert.ok(kinds.length > 0);
  assert.strictEqual(kinds.indexOf("tune"), -1);
});

test("BWV 565: the chords are the toccata and the end, and not the fugue", () => {
  const chords = plain(Bach.struckTogether(notesOf("bwv565-toccata-and-fugue-d-minor"), 5));
  assert.ok(chords.length > 20, "the toccata is built of chords; none were found");
  assert.ok(chords.some((chord) => chord.time < 40), "the opening should have one");
  const inFugue = chords.filter((chord) => chord.time > 130 && chord.time < 500);
  assert.strictEqual(inFugue.length, 0, "nothing in the fugue reaches five struck together");
});

test("BWV 565: the pedal comes back twice after waiting more than a minute", () => {
  const back = plain(Bach.returns(notesOf("bwv565-toccata-and-fugue-d-minor"), 10)).filter((note) => note.voice === 3);
  assert.ok(back.length >= 3, "found " + back.length + " returns of the pedal");
  assert.ok(back.some((note) => note.time > 100 && note.time < 250));
});

test("BWV 645: the chorale is taken up again after its two long waits", () => {
  const back = plain(Bach.returns(notesOf("bwv645-wachet-auf"), 10)).filter((note) => note.voice === 2);
  assert.strictEqual(back.length, 2, "the chorale stops for 29 seconds and for 23, and for nothing else that long");
  assert.ok(Math.abs(back[0].time - 122.6) < 1, "the first is about 2:03, found " + back[0].time);
  assert.ok(Math.abs(back[1].time - 172.7) < 1, "the second is about 2:53, found " + back[1].time);
});

test("BWV 582: the ground is a moment thirteen times over", () => {
  const found = plain(Bach.landmarks(notesOf("bwv582-passacaglia-c-minor"), { bars: dataOf("bwv582-passacaglia-c-minor").bars }));
  const tellings = found.filter((one) => one.kind === "tune");
  assert.strictEqual(tellings.length, 13);
});
