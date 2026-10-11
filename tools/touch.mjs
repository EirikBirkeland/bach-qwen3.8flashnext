#!/usr/bin/env node
// How the bell a player strikes sits in each piece, worked out instead of guessed.
//
// The point is to decide "heavier or lighter, longer or shorter" by numbers rather
// than by taste, piece by piece. Three tables: what the bells land on, what one
// fixed bell makes of that, and what each piece's own bell (src/touch.js) makes.
//
//   beat      how long a beat usually is, and how many the piece has
//   music     how loud the piece itself is where the bells land, measured: the
//             middle of the loudest sample within a twelfth of a second either
//             side of every beat
//   thin      the same figure a quarter of the way down: the quiet moments a bell
//             is supposed to shine in
//   fullness  the same again in plain note weights, which is all a page can work
//             out without rendering sound - so this is what the rule uses
//   band      the register the bells actually ring in, and ("there") how much of
//             the piece's own sound already lies there: the competition up there
//   bell      what one ordinary bell reaches on its own
//   bell/music  how the two stand beside each other - the whole question
//   tail      how long the bell is still within 40 dB of its top, what an ear keeps
//             hearing, since the decay runs down to -80 dB
//   fills     that tail as a share of one beat: does a bell carry across the gap
//             between beats, or die well before the next one lands
//
//   node tools/touch.mjs [piece]

import {
  loadPage,
  loadPieces,
  loadData,
  rolesFor,

  phraseFor,
  preparedNotes,
  partialsOfChord,
  heaviestMoment,
  render,
  renderChime,
  peaksAt,
  peak,
  soundingAt,
  hz,
} from "../test/render.mjs";

const page = loadPage();
const organ = page.createOrgan();
const spec = page.organSpec;
const pieces = loadPieces();
const wanted = process.argv[2];
const LIMITER = Math.pow(10, -3 / 20); // where the page's limiter starts to squeeze

/** The share of a bell's own loudness left `t` seconds after it was struck. */
function rung(t, decay) {
  if (t < 0 || t > decay) return 0;
  if (t < spec.chime.attack) return t / spec.chime.attack;
  return Math.pow(0.0001, (t - spec.chime.attack) / (decay - spec.chime.attack));
}

/** How long a bell is still within 40 dB of its top: what an ear keeps hearing. */
function tail(decay) {
  let t = spec.chime.attack;
  while (t < decay && rung(t, decay) > 0.01) t += 0.001;
  return t;
}

function share(list, part) {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * part))] || 0;
}

const middle = (list) => share(list, 0.5);

/** A canvas that does nothing but keep the game from complaining. */
function fakeCanvas() {
  const noop = () => {};
  const gradient = { addColorStop: noop };
  return {
    width: 1280,
    height: 800,
    getContext: () => ({
      createRadialGradient: () => gradient,
      createLinearGradient: () => gradient,
      fillRect: noop,
      fillStyle: null,
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
    }),
  };
}

function table(title, columns, rows) {
  const width = columns.map((name, i) => Math.max(name.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => cells.map((cell, i) => cell.padEnd(width[i])).join("  ");
  console.log("\n" + title);
  console.log(line(columns));
  for (const row of rows) console.log(line(row));
}

const facts = [];

for (const piece of pieces) {
  if (wanted && piece.slug.indexOf(wanted) < 0) continue;
  const data = loadData(piece.slug);
  const notes = preparedNotes(data, rolesFor(piece), phraseFor(piece));
  const prepared = organ.prepare(data, rolesFor(piece), phraseFor(piece));
  // The game itself, so the beats, their length and the note each would ring come
  // from the page's own code and not from a copy of it here.
  const game = page.createGame(fakeCanvas(), organ);
  game.open(notes, data);
  const beats = game.beats();
  const gap = game.pace().gap;
  const touch = page.touch(notes, beats, gap);

  const levels = peaksAt(notes, beats.map((beat) => beat.time), {
    spec: spec,
    gain: prepared.gain,
    seconds: data.duration,
    sampleRate: 16000,
  });

  const pitches = beats.map((beat) => beat.pitch);
  const low = Math.min(...pitches);
  const high = Math.max(...pitches) + 12; // the octave above the bell's own top
  let inBand = 0;
  let everything = 0;
  const step = Math.max(1, Math.floor(beats.length / 120));
  for (let i = 0; i < beats.length; i += step) {
    for (const one of partialsOfChord(soundingAt(notes, beats[i].time), spec, prepared.gain)) {
      const power = one.amp * one.amp;
      everything += power;
      if (one.freq >= hz(low) && one.freq <= hz(high)) inBand += power;
    }
  }

  // The loudest chord of the piece, to ask what a bigger bell would cost.
  const heaviest = heaviestMoment(notes, spec);
  const chord = render(
    heaviest.notes.map((note) => ({ ...note, time: Math.max(0, note.time - heaviest.at) })),
    { spec: spec, gain: prepared.gain, seconds: 1.2 }
  );

  facts.push({
    slug: piece.slug.replace(/^bwv/, ""),
    gap: gap,
    beats: beats.length,
    music: middle(levels),
    thin: share(levels, 0.25),
    fullness: touch.fullness,
    band: hz(low).toFixed(0) + "–" + hz(high).toFixed(0) + "Hz",
    there: everything > 0 ? ((100 * inBand) / everything).toFixed(0) + "%" : "–",
    chord: peak(chord),
    touch: touch,
  });
}

const plain = (weight) => peak(renderChime(spec, 60, { weight: weight || 1 }));

table(
  "what a bell lands on, measured over the beats themselves:",
  ["piece", "beat", "bpm", "beats", "music", "thin", "fullness", "band", "there"],
  facts.map((one) => [
    one.slug,
    one.gap.toFixed(2) + "s",
    (60 / one.gap).toFixed(0),
    String(one.beats),
    one.music.toFixed(3),
    one.thin.toFixed(3),
    one.fullness.toFixed(2),
    one.band,
    one.there,
  ])
);

const before = facts.map((one) => plain(1) / one.music);
table(
  "one bell for all four (level " + spec.chime.level + ", decay " + spec.chime.decay + "s):",
  ["piece", "bell", "bell/music", "tail", "fills"],
  facts.map((one, i) => [
    one.slug,
    plain(1).toFixed(3),
    before[i].toFixed(2),
    tail(spec.chime.decay).toFixed(2) + "s",
    ((100 * tail(spec.chime.decay)) / one.gap).toFixed(0) + "%",
  ])
);

const after = facts.map((one) => peak(renderChime(spec, 60, { weight: 1, touch: one.touch })) / one.music);
table(
  "each piece's own bell, as src/touch.js sizes it:",
  ["piece", "level", "decay", "bell", "bell/music", "tail", "fills"],
  facts.map((one, i) => [
    one.slug,
    one.touch.level.toFixed(3),
    one.touch.decay.toFixed(2) + "s",
    peak(renderChime(spec, 60, { weight: 1, touch: one.touch })).toFixed(3),
    after[i].toFixed(2),
    tail(one.touch.decay).toFixed(2) + "s",
    ((100 * tail(one.touch.decay)) / one.gap).toFixed(0) + "%",
  ])
);

const spread = (list) => Math.max(...list) / Math.min(...list);
console.log(
  "\nspread of bell/music: " +
    spread(before).toFixed(1) +
    " to " +
    spread(after).toFixed(1) +
    " (in dB: " +
    (20 * Math.log10(Math.min(...before))).toFixed(1) +
    " to " +
    (20 * Math.log10(Math.max(...before))).toFixed(1) +
    " before, " +
    (20 * Math.log10(Math.min(...after))).toFixed(1) +
    " to " +
    (20 * Math.log10(Math.max(...after))).toFixed(1) +
    " now)"
);

// The rule that was refused, and why. A bell always at the same share of its own
// music is the tidy answer: it makes the four ratios equal to the decimal point.
// It is refused on headroom and on sense: the pieces that run at full stretch on
// nearly every beat are the ones that get the biggest bells, and they are the ones
// with least room for one - their own level never drops, so a bell sized against
// it is a big bell on top of a chord that is already as loud as the piece ever gets.
const TARGET = middle(after);
const room = 1 + 0.34 * 0.85; // the convolver's send, heard after it
const tremulant = 1 + 0.045 + 0.03; // ... and the wind moving the whole stop
const refused = facts.map((one) => {
  const level = (TARGET * one.music) / (spec.volume * 2);
  const both = one.chord + level * spec.chime.heaviest * spec.volume * 2;
  return { one: one, level: level, both: both, worst: both * room * tremulant };
});
const chosen = facts.map((one) => {
  const both = one.chord + peak(renderChime(spec, 60, { weight: spec.chime.heaviest, touch: one.touch }));
  return { one: one, both: both, worst: both * room * tremulant };
});
const costliest = refused.reduce(
  (top, one, i) =>
    one.worst - chosen[i].worst > top.by
      ? { by: one.worst - chosen[i].worst, slug: one.one.slug, refused: one.worst, chosen: chosen[i].worst }
      : top,
  { by: -1, slug: "", refused: 0, chosen: 0 }
);
table(
  "the rule that was refused - a bell at " + TARGET.toFixed(2) + " of its music everywhere - beside the one that was chosen:",
  ["piece", "level", "chord+bell", "with the room", "|", "level now", "chord+bell", "with the room"],
  facts.map((one, i) => [
    one.slug,
    refused[i].level.toFixed(3),
    refused[i].both.toFixed(3),
    refused[i].worst.toFixed(3),
    "|",
    one.touch.level.toFixed(3),
    chosen[i].both.toFixed(3),
    chosen[i].worst.toFixed(3),
  ])
);
console.log(
  "\nwhere it costs most: " +
    costliest.slug +
    ", whose widest chord with the heaviest bell and the room counted would be " +
    costliest.refused.toFixed(3) +
    " of full scale instead of " +
    costliest.chosen.toFixed(3) +
    ". That is the piece that runs at full stretch on nearly every beat, so a bell sized against its own level is a big bell laid on a chord that is already as loud as the piece ever gets."
);
console.log(
  "the limiter starts at " +
    LIMITER.toFixed(3) +
    " and full scale is 1.000. Both rules fit; the chosen one just leaves more room where the music is already loud."
);
