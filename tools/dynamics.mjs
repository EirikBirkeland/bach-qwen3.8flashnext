// How loud a piece actually is, bar by bar, with the shaping of src/dynamics.js and
// without it - the numbers behind "the organ plays a whole chorale at one level".
//
//   node tools/dynamics.mjs [bwv639]
//
// Every bar of every piece is rendered twice, at 16 kHz, out of the page's own
// engine (test/render.mjs): once as the file has it - every key struck the same -
// and once as the organ plays it. Each bar keeps the loudness of its own middle, and
// both are given in decibels under the piece's loudest bar, so the two columns can be
// read against each other. Then the three things the rule claims, measured:
//
//   the arch - the gap between the top of a phrase and where it began;
//   the thin and the full - what the thinnest bars of the piece and the fullest now
//   sound like against each other;
//   the entry - how much louder a line is where it is taken up again.
//
// The top of the piece is printed twice over because it is a limit, not a level: the
// loudest moment is meant to land at the ceiling the organ sets itself, and everything
// else is meant to be under it.

import {
  loadPage,
  loadPieces,
  loadData,
  rolesFor,
  phraseFor,
  preparedNotes,
  render,
  peak,
  rms,
} from "../test/render.mjs";

const RATE = 16000;
const CHUNK = 20; // seconds rendered at a time
const page = loadPage();
const spec = page.organSpec;
const wanted = process.argv[2] || "";

/** decibels under `top`, or nothing at all for silence. */
function db(level, top) {
  if (!(level > 0) || !(top > 0)) return null;
  return 20 * Math.log10(level / top);
}

function dBText(value) {
  return value === null ? "   -  " : (value >= 0 ? "+" : "") + value.toFixed(1);
}

/**
 * One number for every bar: how loud the middle of that bar is. Rendered a chunk of
 * twenty seconds at a time, because a quarter of an hour of sound will not all fit
 * in memory at once.
 */
function barLevels(notes, gain, bars, duration) {
  const levels = new Array(bars.length).fill(null);
  for (let start = 0; start < duration; start += CHUNK) {
    const stop = Math.min(duration, start + CHUNK);
    const here = notes
      .filter((note) => note.time < stop && note.time + note.length + 0.3 > start)
      .map((note) => ({ ...note, time: note.time - start }));
    if (here.length === 0) continue;
    const samples = render(here, { spec, gain, seconds: stop - start, sampleRate: RATE });
    for (let b = 0; b < bars.length; b++) {
      const from = Math.max(bars[b], start);
      const to = b + 1 < bars.length ? Math.min(bars[b + 1], stop) : stop;
      if (!(to > start) || !(to > from)) continue;
      const cut = samples.subarray(Math.round((from - start) * RATE), Math.round((to - start) * RATE));
      // The middle of the bar, with its edges off: a pipe from the bar before rings
      // on for a tenth of a second, and the bar line is not where the sound stops.
      const edge = Math.round(Math.min(cut.length * 0.2, 0.12 * RATE));
      const middle = cut.subarray(edge, Math.max(edge, cut.length - edge));
      const level = rms(middle);
      if (levels[b] === null || level > levels[b]) levels[b] = level;
    }
  }
  return levels;
}

/** The middle of a list, ignoring the silence. */
function middle(list) {
  const kept = list.filter((one) => one !== null);
  if (kept.length === 0) return null;
  kept.sort((a, b) => a - b);
  return kept[Math.floor(kept.length / 2)];
}

function mean(list) {
  const kept = list.filter((one) => one !== null);
  if (kept.length === 0) return null;
  return kept.reduce((sum, one) => sum + one, 0) / kept.length;
}

const title = (piece) => piece.title + ", " + piece.subtitle;

for (const piece of loadPieces()) {
  if (wanted && piece.slug.indexOf(wanted) < 0) continue;
  const data = loadData(piece.slug);
  const roles = rolesFor(piece);
  const phrase = phraseFor(piece);
  const shaped = preparedNotes(data, roles, phrase);
  const plain = shaped.map((one) => ({ ...one, shade: 1 }));
  const prepared = page.createOrgan().prepare(data, roles, phrase);
  const plainGain = spec.ceiling / Math.max(spec.minChord, spec.heaviestChord(plain, spec.registration));

  const bars = data.bars;
  const before = barLevels(plain, plainGain, bars, data.duration);
  const after = barLevels(shaped, prepared.gain, bars, data.duration);
  const topBefore = Math.max(...before.filter((one) => one !== null));
  const topAfter = Math.max(...after.filter((one) => one !== null));
  const dB = (levels, top) => levels.map((one) => db(one, top));
  const was = dB(before, topBefore);
  const now = dB(after, topAfter);

  console.log("\n" + title(piece) + " — " + bars.length + " bars, " + (phrase || 4) + " to a phrase");
  console.log(
    "  loudest bar, steady level: was " + topBefore.toFixed(3) + ", now " + topAfter.toFixed(3) +
      " of full scale (the loudest chord is planned to reach " + (spec.ceiling * spec.volume).toFixed(2) + ")"
  );
  console.log("  one bar per mark, before the shaping then after: " + scale(was, now));

  // --- the arch: how much a phrase's high point stands over the bar it began on,
  //     measured inside each version, since that is the claim worth making.
  const per = phrase || 4;
  const span = (list) => {
    const steps = [];
    for (let b = 0; b + per <= bars.length; b += per) {
      const begin = list[b];
      const high = mean([list[b + Math.round(per * 0.5)], list[b + Math.round(per * 0.65)]]);
      if (begin === null || begin === undefined || high === null) continue;
      steps.push(high - begin);
    }
    return mean(steps);
  };

  // --- the thin against the full: the fullest tenth of the bars over the thinnest,
  //     again inside each version. The shaping narrows this gap a little and should
  //     not close it - a tutti is meant to be louder than one line.
  const counts = bars.map((at) => soundingCount(shaped, at));
  const thinnest = pick(bars, counts, (a, b) => a - b);
  const fullest = pick(bars, counts, (a, b) => b - a);
  const levelOf = (list, which) => mean(which.map((b) => list[b]));
  const gap = (list) => {
    const full = levelOf(list, fullest);
    const thin = levelOf(list, thinnest);
    return full === null || thin === null ? null : full - thin;
  };

  console.log(
    "  the arch: a phrase stood " + dBText(span(was)) + " dB over the bar it began on, now " + dBText(span(now)) + " dB"
  );
  console.log(
    "  the fullest " + fullest.length + " bars over the thinnest " + thinnest.length + ": was " +
      dBText(gap(was)) + " dB, now " + dBText(gap(now)) + " dB"
  );

  // --- the entries: a line taken up again, against the same line a moment later
  const lift = page.dynamicsShape.entries(shaped);
  const entering = shaped.filter((one, i) => lift[i] > 1.01);
  const firmest = entering.reduce((best, one) => (one.shade > (best ? best.shade : 0) ? one : best), null);
  console.log(
    "  " + entering.length + " of " + shaped.length + " notes are an entry or the second after one" +
      (firmest ? "; the firmest is at " + firmest.time.toFixed(1) + " s, x" + firmest.shade.toFixed(2) : "")
  );
  const shades = shaped.map((one) => one.shade).sort((a, b) => a - b);
  console.log(
    "  a note's level: " + shades[0].toFixed(2) + " / " + middle(shades).toFixed(2) + " / " +
      shades[shades.length - 1].toFixed(2) + " of plain (guard " + page.dynamicsRules.smallest + " to " + page.dynamicsRules.largest + ")"
  );
}

/** How many notes are sounding at a second. */
function soundingCount(notes, at) {
  const on = Math.round(at * 10000) / 10000;
  let count = 0;
  for (const one of notes) {
    if (one.time <= on && Math.round((one.time + one.length) * 10000) / 10000 > on) count++;
  }
  return count;
}

/** Which bars the given order puts first: the tenth of them that counts least (or
 *  most, with the order turned round). */
function pick(bars, counts, order) {
  const index = bars.map((at, i) => i);
  index.sort((a, b) => order(counts[a], counts[b]) || a - b);
  return index.slice(0, Math.max(1, Math.round(bars.length / 10)));
}

/** One character per bar, for the before and the after side by side. */
function scale(was, now) {
  const ramp = " .:-=+*#%@";
  const low = -24;
  const cell = (value) => (value === null ? " " : ramp[Math.max(1, Math.min(9, Math.round(9 * (1 + value / -low))))]);
  return was.map(cell).join("") + "  |  " + now.map(cell).join("");
}
