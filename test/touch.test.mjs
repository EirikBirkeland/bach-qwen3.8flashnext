// The touch of a piece - how big a bell the player's strike rings - checked by
// numbers. Nobody can hear whether BWV 639's bell is too small for it, so what is
// claimed here is measured instead: how loud the piece itself is where the bells
// land, and how the bell stands beside that, piece by piece. The four claims about
// the real pieces are the ones tools/touch.mjs prints and src/touch.js is built to
// win; the hand-built pieces below pin the rules themselves, including the two that
// only show up on pieces this collection has not got yet.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";
import { gameScripts } from "./files.mjs";
import { loadPieces, loadData, rolesFor, preparedNotes, heaviestMoment, soundingAt } from "./render.mjs";

const root = new URL("..", import.meta.url);

const sandbox = vm.createContext({ window: {} });
for (const file of gameScripts()) {
  vm.runInContext(fs.readFileSync(new URL(file, root), "utf8"), sandbox, { filename: file });
}
const Bach = sandbox.window.Bach;
const spec = Bach.organSpec;
const rules = Bach.touchRules;

const plain = (list) => [...list];

const note = (pitch, time, length, role) => ({
  pitch: pitch,
  time: time,
  length: length,
  velocity: 0.7,
  role: role || "inner",
});

/** One bar a beat long, `length` bars of it: so every beat is a downbeat. */
function barsOf(beats, seconds) {
  const bars = [];
  for (let i = 0; i < beats; i++) bars.push(i * seconds);
  return { metre: { beats: 1, beat: 4 }, bars: bars, duration: beats * seconds };
}

const gapOf = (data) => Bach.beatGap(Bach.beats(data));

/** What the pipes weigh at one second: everything sounding, summed. */
function weightAt(notes, at) {
  let weight = 0;
  for (const one of soundingAt(notes, at)) weight += spec.noteWeight(one, spec.registration);
  return weight;
}

function middle(list) {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** The share of full scale a piece's own level sits at, over its beats. */
function musicLevel(notes, beats, gain) {
  return middle(beats.map((beat) => weightAt(notes, beat.time))) * gain * spec.volume;
}

/** ... and the share a bell reaches on its own: both strikes in phase. */
function bellLevel(touch) {
  return (touch ? touch.level : spec.chime.level) * spec.volume * 2;
}

/**
 * Everything the page would know about one of its pieces: the beats, the touch the
 * rule gives it, and how the two compare with the music.
 */
function survey(piece) {
  const data = loadData(piece.slug);
  const roles = rolesFor(piece);
  const notes = preparedNotes(data, roles);
  const beats = plain(Bach.beats(data));
  const touch = Bach.touch(notes, beats, Bach.beatGap(beats));
  const organ = Bach.createOrgan().prepare(data, roles);
  const plainTouch = { level: spec.chime.level, decay: spec.chime.decay };
  const music = musicLevel(notes, beats, organ.gain);
  return {
    slug: piece.slug,
    gap: Bach.beatGap(beats),
    gain: organ.gain,
    heaviest: heaviestMoment(notes, spec).weight,
    touch: touch,
    music: music,
    asNow: bellLevel(plainTouch) / music,
    asSuch: bellLevel(touch) / music,
  };
}

const four = loadPieces().map(survey);
const by = (slug) => four.find((one) => one.slug.indexOf(slug) >= 0);

test("a piece running full on every beat gets the whole bell", () => {
  // Six lines going all the way through: more than the organ counts as a tutti, so
  // the middle of its beats is as loud as it ever gets.
  const data = barsOf(8, 4);
  const notes = [];
  for (const pitch of [36, 48, 60, 67, 72, 79]) notes.push(note(pitch, 0, 32, "melody"));
  const beats = plain(Bach.beats(data));
  const one = Bach.touch(notes, beats, gapOf(data));
  assert.ok(Math.abs(one.fullness - 1) < 1e-9, "a piece always at its loudest: " + one.fullness);
  assert.ok(Math.abs(one.level - rules.full) < 1e-9, "and that earns the whole bell: " + one.level);
});

test("a piece on one line at a time gets a small one", () => {
  const data = barsOf(8, 4);
  const notes = [note(60, 0, 32, "melody")];
  const beats = plain(Bach.beats(data));
  const one = Bach.touch(notes, beats, gapOf(data));
  assert.ok(one.fullness < 0.34, "one line is a third of a tutti at most: " + one.fullness);
  assert.ok(
    one.level < rules.full * 0.6,
    "so its bell is well under the full one: " + one.level.toFixed(3) + " against " + rules.full
  );
  assert.ok(one.level >= rules.smallest, "and never smaller than the least bell: " + one.level);
});

test("a longer beat buys a longer bell, and only so far", () => {
  assert.strictEqual(Bach.touch([], [], 1.5).decay, rules.ring * 1.5, "a middle-paced piece");
  assert.strictEqual(Bach.touch([], [], 4).decay, rules.longest, "a very slow one stops at the longest bell");
  assert.strictEqual(Bach.touch([], [], 0.4).decay, rules.shortest, "a very quick one at the shortest");
  assert.ok(rules.longest < 2.5, "and the longest bell is still a bell, not a cymbal: " + rules.longest);
});

test("a note let go exactly as a beat lands has stopped sounding", () => {
  // The same rule the game uses for the note of a bell, and for the same reason:
  // the hand over to the next chord is one moment, not two.
  const beats = plain(Bach.beats(barsOf(4, 4))); // beats at 0, 4, 8, 12
  const held = note(60, 0, 16, "melody");
  const alone = Bach.touchFullness([held], beats, spec);
  // Three short lines, each letting go exactly as a beat lands.
  const onTheBeat = [note(72, 2, 2), note(72, 6, 2), note(72, 10, 2)];
  // The same three, each letting go a moment early.
  const justBefore = [note(72, 2, 1.5), note(72, 6, 1.5), note(72, 10, 1.5)];
  // And three that are still sounding when a beat lands.
  const across = [note(72, 3, 2), note(72, 7, 2), note(72, 11, 2)];

  const exactly = Bach.touchFullness([held].concat(onTheBeat), beats, spec);
  assert.ok(Math.abs(exactly - alone) < 1e-9, "a line let go exactly as a beat lands is not sounding for it: " + exactly + " against " + alone);
  const early = Bach.touchFullness([held].concat(justBefore), beats, spec);
  assert.ok(Math.abs(exactly - early) < 1e-9, "letting go exactly on a beat and a moment before it are the same thing");
  const spanning = Bach.touchFullness([held].concat(across), beats, spec);
  assert.ok(spanning > exactly, "a line still sounding when a beat lands does count: " + spanning + " against " + exactly);
});

test("a piece with no beats, or no notes, still answers", () => {
  const empty = Bach.touch([], [], 1);
  assert.ok(Number.isFinite(empty.level) && empty.level >= rules.smallest, "an empty piece: " + empty.level);
  assert.ok(Number.isFinite(empty.decay) && empty.decay > 0, "and its bell: " + empty.decay);
  const noNotes = Bach.touch([], plain(Bach.beats(barsOf(4, 4))), 4);
  assert.strictEqual(noNotes.fullness, 0, "nothing sounding is nothing to ring over");
  // A piece that is mostly silence would be sized against nothing at all, if the
  // smallest bell were not a floor under it.
  const quiet = Bach.touch([note(60, 1, 1)], plain(Bach.beats(barsOf(8, 4))), 4);
  assert.strictEqual(quiet.level, rules.smallest, "a piece mostly silence still gets a bell you can hear");
});

test("the four pieces get bells of four different sizes", () => {
  const chorale = by("bwv639");
  const toccata = by("bwv565");
  const passacaglia = by("bwv582");
  const vigil = by("bwv645");

  assert.ok(
    chorale.touch.level > passacaglia.touch.level && passacaglia.touch.level > vigil.touch.level,
    "the fullest piece gets the biggest bell, then the busiest: " +
      chorale.touch.level.toFixed(3) +
      ", " +
      passacaglia.touch.level.toFixed(3) +
      ", " +
      vigil.touch.level.toFixed(3)
  );
  assert.ok(
    vigil.touch.level > toccata.touch.level,
    "and the piece that spends its time on one line at a time gets the smallest: " + toccata.touch.level.toFixed(3)
  );
  assert.ok(toccata.touch.fullness < 0.3, "BWV 565 is thin on most beats: " + toccata.touch.fullness);
  assert.ok(chorale.touch.fullness > 0.7, "BWV 639 is not: " + chorale.touch.fullness);
});

test("each bell hangs about as long as the piece's own beat", () => {
  for (const one of four) {
    assert.ok(
      one.touch.decay > one.gap,
      one.slug + ": a bell shorter than a beat is a tick, not a bell: " + one.touch.decay + " against " + one.gap
    );
    assert.ok(
      one.touch.decay < one.gap * 1.3,
      one.slug + ": and one much longer than a beat smears the next one: " + one.touch.decay
    );
  }
  // Measured where it matters: the slow chorale carries, the quick passacaglia does not.
  assert.ok(by("bwv639").touch.decay > 1.9, "BWV 639's bell hangs right across its 1.6 s beat");
  assert.ok(by("bwv582").touch.decay < 1.1, "BWV 582's is gone inside its 0.83 s one");
});

test("no two bells are audible at once, in any piece", () => {
  // A bell's decay runs to -80 dB, so what an ear keeps hearing is about half of
  // it - and half of a bell that hangs 1.2 beats is well inside the beat before
  // the next strike. This is what stops a run of taps turning into a wash.
  for (const one of four) {
    const audible = halfOfAudible(one.touch.decay);
    assert.ok(
      audible < one.gap,
      one.slug + ": its bell is still audible " + audible.toFixed(2) + " s on, over a beat every " + one.gap.toFixed(2) + " s"
    );
  }
});

/** How long a bell is within 40 dB of its own top. */
function halfOfAudible(decay) {
  let t = spec.chime.attack;
  while (t < decay && ringLeft(t, decay) > 0.01) t += 0.001;
  return t;
}

function ringLeft(t, decay) {
  if (t < 0 || t > decay) return 0;
  if (t < spec.chime.attack) return t / spec.chime.attack;
  return Math.pow(0.0001, (t - spec.chime.attack) / (decay - spec.chime.attack));
}

test("every piece's bell sits about the same way under its own music", () => {
  // The whole point of the touch. One fixed bell put these ratios between 0.26 and
  // 0.87 - a factor of more than three - which is why one bell for all four was
  // dropped. Both figures are worst-case bounds in the organ's own units.
  const asNow = four.map((one) => one.asNow);
  const asSuch = four.map((one) => one.asSuch);
  const spread = (list) => Math.max(...list) / Math.min(...list);
  assert.ok(spread(asNow) > 3, "one fixed bell was spread by " + spread(asNow).toFixed(2) + " to 1");
  assert.ok(spread(asSuch) < 2, "these four are spread by " + spread(asSuch).toFixed(2) + " to 1");
  for (const one of four) {
    assert.ok(
      one.asSuch < 0.5,
      one.slug + ": its bell would sit within 6 dB of the music it is struck over: " + one.asSuch.toFixed(2)
    );
    assert.ok(
      one.asSuch > 0.22,
      one.slug + ": and its bell would be more than 13 dB under, which is nobody hearing anything: " + one.asSuch.toFixed(2)
    );
  }
});

test("the biggest bell of the four still leaves the loudest chord room", () => {
  const limiter = Math.pow(10, -3 / 20);
  for (const one of four) {
    const chord = one.heaviest * one.gain * spec.volume;
    const heaviest = one.touch.level * spec.chime.heaviest * spec.volume * 2;
    assert.ok(
      chord + heaviest < limiter,
      one.slug + ": its widest chord with the heaviest bell of its own size reaches " + (chord + heaviest).toFixed(3)
    );
  }
});
