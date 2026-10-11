// How a piece is played, note by note: the tests for src/dynamics.js.
//
// The rule has three parts - the arch of a phrase, a thin moment played fuller than
// a full one, and a line brought out when it is taken up again - and each is asked
// here on its own, on hand-built pieces where the answer is known beforehand, and on
// the four real ones. The last sort of claim is the one worth keeping: "the bare
// middle of BWV 565 is played up and its finale held back" is a thing about the
// music, and it is the thing a future session must not break by accident.

import test from "node:test";
import assert from "node:assert/strict";
import { loadPage, loadPieces, loadData, rolesFor, phraseFor, preparedNotes, heaviestMoment } from "./render.mjs";

const Bach = loadPage();
const rules = Bach.dynamicsRules;
const shape = Bach.dynamicsShape;
const spec = Bach.organSpec;

const note = (pitch, time, length, voice) => ({
  pitch: pitch,
  time: time,
  length: length,
  voice: voice || 1,
  velocity: 0.7,
  role: "inner",
});

/** A piece barred every `bar` seconds, `count` bars, nothing else about it. */
function barGrid(bar, count) {
  const bars = [];
  for (let i = 0; i < count; i++) bars.push(i * bar);
  return { bars: bars, duration: count * bar };
}

/** The shaping of a hand-built piece, with no bar grid unless one is given. */
function shades(notes, grid, phrase) {
  return Bach.dynamics(
    notes.slice().sort((a, b) => a.time - b.time),
    { bars: grid ? grid.bars : null, duration: grid ? grid.duration : 0, phrase: phrase }
  );
}

const median = (list) => list.slice().sort((a, b) => a - b)[Math.floor(list.length / 2)];
const decibels = (ratio) => 20 * Math.log10(ratio);

// --- the arch of a phrase -------------------------------------------------------

test("a phrase begins held back, grows, and settles at its cadence", () => {
  const arch = shape.arch;
  assert.equal(arch(0), rules.arch.start, "a phrase opens at the lowest of its swell");
  assert.equal(arch(rules.arch.peakAt), rules.arch.peak, "and its high point is where the rule says");
  const rising = [0, 0.2, 0.4, rules.peakAt || 0.65];
  for (let i = 1; i < rising.length; i++) {
    assert.ok(arch(rising[i]) > arch(rising[i - 1]), "it grows up to its high point, at " + rising[i]);
  }
  for (const p of [0.8, 0.9, 0.99]) {
    assert.ok(arch(p) < rules.arch.peak, "and settles after it, at " + p);
  }
  assert.ok(
    decibels(rules.arch.peak / rules.arch.start) >= 1.9,
    "the swell is about 2 dB, or nobody hears it: " + decibels(rules.arch.peak / rules.arch.start).toFixed(2)
  );
  assert.ok(
    arch(0.99) > arch(0),
    "a cadence settles but does not collapse under where the phrase began"
  );
});

test("every phrase of a steady piece swells the same way", () => {
  // One line, hand over hand, eight bars four to a phrase: nothing but the arch.
  // Two of the notes sit where a phrase tops, a bar and two thirds in.
  const grid = barGrid(1, 8);
  const times = [0, 1, 2, 2.6, 3, 4, 5, 6, 6.6, 7];
  const notes = times.map((at, i) => {
    const next = i + 1 < times.length ? times[i + 1] : at + 1;
    return note(60, at, next - at, 1);
  });
  const levels = shades(notes, grid, 4);

  assert.equal(levels[0], rules.arch.start, "the piece opens held back");
  assert.equal(levels[5], levels[0], "the second phrase opens the same way");
  assert.equal(levels[3], rules.arch.peak, "the high point of a phrase is reached");
  assert.equal(levels[6], levels[1], "the same place in a phrase is played the same way");
  assert.ok(levels[3] > levels[4], "and it settles after the high point, inside the same phrase");
});

test("a piece nobody has barred is left alone by the arch", () => {
  const notes = [];
  for (let bar = 0; bar < 8; bar++) notes.push(note(60, bar, 1, 1));
  const levels = shades(notes, null);
  assert.ok(
    levels.every((one) => one === levels[0]),
    "with no bar lines there is no phrase, and no phrase means no swell: " + levels.join(", ")
  );
});

// --- a thin moment played fuller than a full one --------------------------------

test("a single line is played up and a tutti held back", () => {
  const body = shape.body;
  assert.equal(body(4, 4), 1, "a piece at its usual fullness is not touched");
  assert.ok(body(1, 4) > 1, "one line on its own is played up");
  assert.ok(body(16, 4) < 1, "and sixteen notes together held back");
  assert.ok(body(1, 4) <= rules.thinnest, "but never past the thinnest playing allowed: " + body(1, 4));
  assert.ok(body(999, 4) >= rules.fullest, "and never past the fullest: " + body(999, 4));
  assert.equal(body(0, 4), 1, "nothing sounding is nothing to shape");
  assert.ok(
    decibels(rules.thinnest) < 2 && decibels(rules.fullest) > -1,
    "and the whole rule is under 2 dB either way, so the music still gets louder when more plays"
  );
});

test("the usual fullness is the middle of the piece, not its loudest moment", () => {
  // Four voices for two bars, then one line alone for four: the reference is what
  // the piece usually has going, so the solo lines come up and the chords stay.
  const notes = [];
  for (let t = 0; t < 2; t++) for (const voice of [1, 2, 3, 4]) notes.push(note(50 + voice, t, 1, voice));
  for (let t = 2; t < 6; t++) notes.push(note(60, t, 1, 1));
  const levels = shades(notes, null);
  const solo = levels.slice(8);
  const chord = levels.slice(0, 8);
  assert.ok(Math.min(...solo) > Math.max(...chord), "every solo note is played above every chord note");
  assert.ok(median(chord) === 1, "the chords, being the usual thing, are left as they are");
});

// --- a line taken up again ------------------------------------------------------

test("an entry is a line coming back into something", () => {
  const notes = [
    note(48, 0, 10, 1), // one line, all the way through
    note(72, 5, 0.5, 2), // a second line: its first note is only a start
    note(72, 5.6, 0.4, 2), // ... and its last for a while
    note(74, 8, 0.5, 2), // back after two seconds gone, into the first line
    note(75, 9.1, 0.4, 2), // six tenths along the ease: half of it left
    note(76, 10.4, 0.4, 2), // and one well after the entry has eased off
  ];
  const lift = shape.entries(notes);
  assert.equal(lift[1], 1, "a line's first note is not a homecoming");
  assert.equal(lift[2], 1, "a note a moment after the first is not either");
  assert.equal(lift[3], rules.entry, "the return is struck firmer");
  assert.ok(lift[4] > 1 && lift[4] < rules.entry, "the line keeps a little of it, then less");
  assert.ok(
    Math.abs(lift[4] - (1 + (rules.entry - 1) * 0.5)) < 1e-9,
    "and it lets go of the lift evenly: " + lift[4]
  );
  assert.equal(lift[5], 1, "and gives it up entirely after the ease is up");
});

test("a whole ensemble arriving out of a silence is not an entry", () => {
  // Three lines go quiet at four seconds and all three come back together at six.
  // Nobody joined anything: that is a chord, not a homecoming, and the toccata of
  // BWV 565 is nothing but these - lifting them would only make the piece quieter.
  const notes = [];
  for (const voice of [1, 2, 3]) {
    notes.push(note(60 + voice, 2, 2, voice));
    notes.push(note(60 + voice, 6, 2, voice));
  }
  const lift = shape.entries(notes);
  assert.ok(
    lift.every((one) => one === 1),
    "not one of them was lifted: " + lift.join(", ")
  );
});

test("a gap shorter than a second is nobody's entry", () => {
  const short = [note(48, 0, 12, 1), note(72, 1, 5.6, 2), note(74, 6.7, 0.5, 2)];
  assert.equal(shape.entries(short)[2], 1, "a line that breathed is not a line that returned");
  const longer = [note(48, 0, 12, 1), note(72, 1, 5.6, 2), note(74, 6.6 + rules.retake, 0.5, 2)];
  assert.equal(shape.entries(longer)[2], rules.entry, "and a moment later it is");
});

// --- the guard, which the three rules together can reach ------------------------

test("the three rules together cannot say something silly", () => {
  // A single line coming back at the top of a phrase, where the piece has four
  // notes going: swell, thinness and entry all say "more", and the guard says no.
  const crowd = [];
  for (let t = 0; t < 8; t++) for (const voice of [1, 2, 3, 4]) crowd.push(note(50 + voice, t, 1, voice));
  // One line holds alone from twelve seconds to 14.6, and another arrives exactly as
  // it lets go: one note on its own, coming back into something, two thirds along
  // a phrase - and four notes is what this piece usually has going.
  const big = crowd.concat([
    note(84, 0, 0.5, 6), // a line that then goes away for fourteen seconds
    note(48, 12, 2.6, 5), // one line, alone, holding to 14.6
    note(84, 14.6, 0.5, 6), // ... and comes back exactly as it lets go
  ]);
  const levels = shades(big, barGrid(1, 16), 4);
  const returning = levels[levels.length - 1];
  assert.ok(
    returning === rules.largest,
    "the firmest note a piece can ask for stops at the guard: " + returning
  );

  // And the other end: twelve lines arriving together on a phrase's opening bar,
  // where the arch is at its lowest and the tutti is held back as well.
  const few = [];
  for (let t = 0; t < 8; t++) for (const voice of [1, 2, 3, 4]) few.push(note(50 + voice, t, 1, voice));
  const tutti = [];
  for (let pitch = 60; pitch < 72; pitch++) tutti.push(note(pitch, 8, 1, 10 + pitch));
  const low = shades(few.concat(tutti), barGrid(1, 9), 4);
  const arrivals = low.slice(few.length);
  assert.ok(
    arrivals.every((one) => one === rules.smallest),
    "the quietest a chord may be played stops at the guard: " + arrivals.join(", ")
  );
});

// --- what the organ does with it ------------------------------------------------

test("the shaping is in the weight the organ keeps its ceiling by", () => {
  const plain = note(60, 0, 1, 1);
  const light = { ...plain, shade: 1 };
  const heavy = { ...plain, shade: 2 };
  assert.ok(
    spec.noteWeight(heavy, spec.registration) > spec.noteWeight(light, spec.registration) * 1.99,
    "a note played twice as loud weighs twice as much"
  );
  assert.equal(spec.shadeOf({}), 1, "a note nobody shaped is played as it stands");
  assert.equal(spec.shadeOf({ shade: -3 }), 1, "and a nonsense shaping is no shaping");
  assert.equal(spec.shadeOf({ shade: 1.5 }), 1.5);
});

test("every piece still lands exactly on the ceiling it set itself", () => {
  for (const piece of loadPieces()) {
    const data = loadData(piece.slug);
    const prepared = Bach.createOrgan().prepare(data, rolesFor(piece), phraseFor(piece));
    const weight = spec.heaviestChord(prepared.notes, spec.registration);
    // The gain is the ceiling over whatever the organ counts as the piece's loudest
    // moment - and that moment is now weighed with the shaping in it, which is the
    // only reason the shaping cannot make a piece louder than it planned to be.
    const counted = Math.max(spec.minChord, weight);
    assert.ok(
      Math.abs(counted * prepared.gain - spec.ceiling) < 1e-9,
      piece.slug + ": its loudest moment weighs " + weight + " and reaches " + counted * prepared.gain
    );
    assert.ok(weight * prepared.gain <= spec.ceiling + 1e-9, piece.slug + ": something can go over the ceiling");
    for (const one of prepared.notes) {
      assert.ok(
        one.shade >= rules.smallest && one.shade <= rules.largest && Number.isFinite(one.shade),
        piece.slug + ": a note was shaped to " + one.shade
      );
    }
  }
});

test("every piece swells between where a phrase begins and where it tops", () => {
  // Measured over the notes themselves, phrase by phrase, in the four real pieces:
  // the whole point of the arch is that a phrase is not played flat.
  for (const piece of loadPieces()) {
    const data = loadData(piece.slug);
    const roles = rolesFor(piece);
    const phrase = phraseFor(piece) || rules.defaultPhrase;
    const notes = preparedNotes(data, roles, phrase);
    const places = shape.places(notes, data.bars, data.duration, phrase);
    const share = (from, to) =>
      notes.filter((one, i) => places[i] / phrase >= from && places[i] / phrase < to).map((one) => one.shade);
    const begins = share(0, 0.05);
    const tops = share(0.62, 0.68);
    const mean = (list) => list.reduce((sum, one) => sum + one, 0) / list.length;
    assert.ok(begins.length > 25 && tops.length > 25, piece.slug + ": barely any notes to compare");
    const swell = decibels(mean(tops) / mean(begins));
    assert.ok(swell > 1.5, piece.slug + ": a phrase's high point stands only " + swell.toFixed(2) + " dB over its opening");
  }
});

// --- the four real pieces -------------------------------------------------------

test("every line taken up after a long silence is brought out", () => {
  // These are the moments the pictures already mark: the pedal of BWV 565 coming
  // back twice after waiting a minute and a half, the chorale of BWV 645 coming
  // home twice after twenty-nine seconds of waiting for it, and so on.
  for (const piece of loadPieces()) {
    const data = loadData(piece.slug);
    const notes = preparedNotes(data, rolesFor(piece), phraseFor(piece));
    const lift = shape.entries(notes);
    for (const one of Bach.returns(notes)) {
      const i = notes.indexOf(one);
      assert.ok(i >= 0, piece.slug + ": a return was not one of its own notes");
      assert.equal(
        lift[i],
        rules.entry,
        piece.slug + ": the line back at " + one.time.toFixed(1) + " s was not struck firmer"
      );
    }
  }
});

test("BWV 565 plays its bare middle up and its finale down", () => {
  const piece = loadPieces().find((one) => one.slug.indexOf("bwv565") >= 0);
  const data = loadData(piece.slug);
  const notes = preparedNotes(data, rolesFor(piece), phraseFor(piece));
  const inSpan = (from, to) => notes.filter((one) => one.time >= from && one.time < to).map((one) => one.shade);
  const bare = median(inSpan(292, 332)); // eleven bars of exactly one note at a time
  const full = median(inSpan(430, 500)); // the last stretch, three voices flat out
  assert.ok(bare > 1.1, "the middle, one line at a time, is played up: " + bare);
  assert.ok(full < 1, "and the crowded end held back: " + full);
  assert.ok(
    decibels(bare / full) > 1.5,
    "the two are " + decibels(bare / full).toFixed(1) + " dB apart, which is heard"
  );
});

test("BWV 582 holds its fugue down against its variations", () => {
  const piece = loadPieces().find((one) => one.slug.indexOf("bwv582") >= 0);
  const data = loadData(piece.slug);
  const notes = preparedNotes(data, rolesFor(piece), phraseFor(piece));
  const inSpan = (from, to) => notes.filter((one) => one.time >= from && one.time < to).map((one) => one.shade);
  assert.ok(
    median(inSpan(440, 600)) < median(inSpan(100, 300)),
    "seven parts going at once is not played as full as three"
  );
});

test("the legato pieces have almost nothing to bring back", () => {
  // These editions tie every phrase of BWV 639: no line ever stops for a breath.
  // So the entry rule should hardly touch that piece at all, and the swell and the
  // thinness should be doing the work there instead.
  const piece = loadPieces().find((one) => one.slug.indexOf("bwv639") >= 0);
  const data = loadData(piece.slug);
  const notes = preparedNotes(data, rolesFor(piece), phraseFor(piece));
  const lifted = shape.entries(notes).filter((one) => one > 1).length;
  assert.ok(
    lifted < notes.length / 20,
    lifted + " of " + notes.length + " notes were an entry in a piece that never stops"
  );
  assert.ok(Math.abs(median(notes.map((one) => one.shade)) - 1) < 0.15, "and the piece as a whole is not moved up or down");
});

test("the shaping moves the level about without moving the piece's own top", () => {
  // The loudest chord of each piece, weighed the way the organ weighs it, is the
  // same with the shaping as without it - because that is what the gain is divided
  // by. What changes is everything underneath it.
  for (const piece of loadPieces()) {
    const data = loadData(piece.slug);
    const roles = rolesFor(piece);
    const phrase = phraseFor(piece);
    const shaped = preparedNotes(data, roles, phrase);
    const plain = shaped.map((one) => ({ ...one, shade: 1 }));
    const organ = Bach.createOrgan().prepare(data, roles, phrase);
    const planned = heaviestMoment(shaped, spec).weight * organ.gain;
    assert.ok(planned <= spec.ceiling + 1e-9, piece.slug + ": its loudest chord is over the ceiling");
    assert.ok(
      spec.heaviestChord(plain, spec.registration) > 0 && planned > 0,
      piece.slug + ": nothing was weighed at all"
    );
  }
});
