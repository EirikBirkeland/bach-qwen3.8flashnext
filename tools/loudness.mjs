#!/usr/bin/env node
// How loud this organ actually is, worked out instead of guessed. For every
// piece it finds the moment where most pipes sound at once, renders it in plain
// numbers (test/render.mjs), and reports what it reaches.
//
//   node tools/loudness.mjs [piece]
//
// What the columns mean:
//   piece     the piece, and where (in seconds) it gets loudest
//   widest    how many notes sound at once at the busiest moment
//   weight    what those notes add up to, in pipes and breath
//   gain      how loud one pipe may be, so that moment still fits
//   bound     the worst case: every pipe of the chord peaking in one instant
//   peak      the loudest the whole piece really reaches, and after "+" the same
//             once the room and the tremulant are counted
//   rms       the widest chord, averaged: peak over rms is how spiky it is
//   pipes     how many oscillators the busiest moment opens
//   bell      the bell this piece asks for when the player strikes along: how loud
//             it is, and how long it hangs (src/touch.js, measured per piece)
//   chord+bell  that widest chord and the heaviest bell of the piece, together
//   bell alone  what one of those bells reaches on its own

import {
  loadPage,
  loadPieces,
  loadData,
  rolesFor,
  preparedNotes,
  heaviestMoment,
  render,
  renderAcross,
  renderChime,
  together,
  peak,
  rms,
  pipesOf,
  hz,
  partials,
  partialsOfChord,
  bandShares,
} from "../test/render.mjs";

const page = loadPage();
const spec = page.organSpec;
const pieces = loadPieces();
const wanted = process.argv[2];
const rows = [];

const limiter = Math.pow(10, -3 / 20); // where the page's limiter starts to squeeze

console.log("ceiling " + spec.ceiling + " of full scale, master volume " + spec.volume);
console.log("the limiter starts at " + limiter.toFixed(3) + "; full scale is 1.000\n");

const columns = [
  "piece",
  "loudest at",
  "widest",
  "weight",
  "gain",
  "bound",
  "peak + room",
  "rms",
  "crest",
  "pipes",
  "bell",
  "chord+bell",
  "bell alone",
];

for (const piece of pieces) {
  if (wanted && piece.slug.indexOf(wanted) < 0) continue;
  const data = loadData(piece.slug);
  const notes = preparedNotes(data, rolesFor(piece));
  const prepared = page.createOrgan().prepare(data, rolesFor(piece));
  const heaviest = heaviestMoment(notes, spec);

  const seconds = 1.2;
  const window = heaviest.notes
    .map((note) => ({ ...note, time: note.time - heaviest.at }))
    .filter((note) => note.time < seconds);
  const samples = render(window, { spec, gain: prepared.gain, seconds });

  // The whole piece, chunk by chunk: a pipe rings on for a tenth of a second
  // after its key is let go, so chords run into one another and the top of the
  // piece can be somewhere else than its widest chord.
  const throughout = renderAcross(notes, {
    spec,
    gain: prepared.gain,
    seconds: data.duration,
    sampleRate: 16000, // the peak is the same to a hundredth, a quarter sooner
  });

  const loudest = throughout.peak;
  const average = rms(samples);
  const pipes = heaviest.notes.reduce((sum, note) => sum + pipesOf(note, spec).length, 0);
  const room = loudest * (1 + 0.34 * 0.85) * (1 + 0.045 + 0.03); // the convolver, then the tremulant

  // Playing along rings a bell over the music: the heaviest one that this piece's
  // own touch allows, struck on top of the loudest chord, with both of its
  // strikes in phase with the pipes.
  const beats = page.beats(data);
  const touch = page.touch(notes, beats, page.beatGap(beats));
  const bell = renderChime(spec, 60, { weight: spec.chime.heaviest, touch: touch });
  const withBell = peak(together(samples, bell));

  rows.push([
    piece.slug.replace(/^bwv/, ""),
    throughout.at.toFixed(1) + "s",
    String(prepared.busiest),
    heaviest.weight.toFixed(2),
    prepared.gain.toFixed(4),
    (heaviest.weight * prepared.gain * spec.volume).toFixed(3),
    (loudest.toFixed(3) + " + " + room.toFixed(3)).toString(),
    average.toFixed(3),
    (loudest / Math.max(average, 1e-9)).toFixed(1),
    String(pipes),
    touch.level.toFixed(3) + " · " + touch.decay.toFixed(2) + "s",
    withBell.toFixed(3),
    peak(bell).toFixed(3),
  ]);
}

const width = columns.map((name, i) => Math.max(name.length, ...rows.map((row) => row[i].length)));
const line = (cells) => cells.map((cell, i) => cell.padEnd(width[i])).join("  ");
console.log(line(columns));
for (const row of rows) console.log(line(row));

// What one note sounds like, which is the other half of "does this sound like an
// organ": a single note has to be a pile of partials, not a beep.
console.log("\nwhere the widest chord's energy lies (body / middle / presence / fizz):");
for (const piece of pieces) {
  if (wanted && piece.slug.indexOf(wanted) < 0) continue;
  const data = loadData(piece.slug);
  const notes = preparedNotes(data, rolesFor(piece));
  const prepared = page.createOrgan().prepare(data, rolesFor(piece));
  const heaviest = heaviestMoment(notes, spec);
  const bands = bandShares(partialsOfChord(heaviest.notes, spec, prepared.gain));
  console.log(
    "  " +
      piece.slug.replace(/^bwv/, "").padEnd(30) +
      bands.map((band) => (band.share * 100).toFixed(0) + "%").join(" / ")
  );
}

console.log("\none note, middle C, as the melody:");
for (const role of ["melody", "inner", "pedal"]) {
  const note = { pitch: role === "pedal" ? 48 : 60, role, time: 0, length: 0.6, velocity: 0.7 };
  const drawn = pipesOf(note, spec);
  const samples = render([note], { spec, gain: 1, seconds: 0.9 });
  const found = partials(samples, hz(note.pitch), 44100, 16).filter((p) => p.relative > 0.01);
  console.log(
    "  " +
      role.padEnd(7) +
      " " +
      drawn.map((pipe) => pipe.name).join(" + ") +
      "\n          " +
      drawn.length +
      " pipes, peak " +
      peak(samples).toFixed(3) +
      ", " +
      found.length +
      " partials over a hundredth of the loudest: " +
      found.slice(0, 10).map((p) => p.harmonic).join(",")
  );
}
