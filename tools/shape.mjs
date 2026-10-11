// The shape of a piece, in numbers: its bars, where its themes enter, where it
// is thick and where it rests. Written to be read by a person deciding what a
// piece should look like (see milestone 2 in PLAN.md) - nothing in the page
// reads this.
//
//   node tools/shape.mjs                    # every piece, the short report
//   node tools/shape.mjs bwv639             # one piece
//   node tools/shape.mjs bwv582 --bars      # add the bar-by-bar table
//   node tools/shape.mjs bwv582 --json      # the same numbers as JSON
//
// Everything here is measured from the notes: bars come from the metre written
// in the MIDI file, themes are found by looking for a melody that turns up more
// than once (allowed to be at another pitch, the way a fugue subject is), and a
// rest is where a voice stops for a beat or more - these editions write
// everything else legato, so there are not many.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { readMidiFile } from "./midi.mjs";

// Everything is read from this folder's parent, the project, so the tool works
// however it is started.
const root = new URL("..", import.meta.url);
const at = (where) => fileURLToPath(new URL(where, root));

const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SHAPE = " .:-=+*#%@";

function noteName(pitch) {
  return NAMES[pitch % 12] + (Math.floor(pitch / 12) - 1);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function clockText(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
}

/** Put a list of numbers into a row of characters, darkest = biggest. */
function sparkline(values, scale) {
  const high = scale || Math.max(...values, 0.0001);
  return values
    .map((value) => SHAPE[Math.min(SHAPE.length - 1, Math.round((value / high) * (SHAPE.length - 1)))])
    .join("");
}

// ---------------------------------------------------------------- piece data

/** One piece: its notes as objects, its voice names, and its bar lines. */
export function loadPiece(slug) {
  const data = JSON.parse(fs.readFileSync(at("data/" + slug + ".json"), "utf8"));
  const pageSource = fs.readFileSync(at("src/pieces.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(pageSource, sandbox);
  const listed = sandbox.window.Bach.pieces.find((piece) => piece.slug === slug) || { voices: {} };

  const names = new Map();
  for (const voice of data.voices) {
    const known = listed.voices[voice.index];
    names.set(voice.index, (known && known.name) || voice.name);
  }

  const format = data.format;
  const notes = data.notes
    .map((row) => ({
      voice: row[format.indexOf("voice")],
      pitch: row[format.indexOf("pitch")],
      time: row[format.indexOf("time")],
      length: row[format.indexOf("duration")],
    }))
    .map((note) => ({ ...note, end: Math.round((note.time + note.length) * 10000) / 10000 }))
    .sort((a, b) => a.time - b.time || a.pitch - b.pitch);

  const metre = barsOf(data.source, data.duration);
  const barSeconds = metre.starts.length > 1 ? round(metre.starts[1] - metre.starts[0]) : 0;
  return {
    slug,
    title: listed.title || slug,
    duration: data.duration,
    tempo: data.tempo,
    notes,
    voices: data.voices.map((voice) => ({
      index: voice.index,
      name: names.get(voice.index),
      noteCount: voice.noteCount,
      range: voice.pitchRange,
    })),
    bars: metre.starts,
    metre: metre.metre,
    barSeconds,
    // How long a copy of a figure has to wait to count as the figure coming back,
    // rather than as the same bar again at another pitch (which is a sequence).
    copiedAfter: round(barSeconds * 2),
  };
}

/**
 * Where the bars start, in seconds, from the metre written in the MIDI file.
 * These are the bar lines of the edition that made the file: the editor put that
 * metre there. BWV 582 is written 3/4 there and its ground bass is eight bars
 * long, which is how the reading of the denominator was checked.
 */
function barsOf(source, duration) {
  const song = readMidiFile(fs.readFileSync(at(source)));
  const marks =
    song.timeSignatures.length > 0
      ? song.timeSignatures
      : [{ tick: 0, seconds: 0, beats: 4, beat: 4, barTicks: song.ticksPerQuarter * 4 }];
  const starts = [];
  for (const mark of marks) {
    let tick = mark.tick;
    // Walk back to the last bar line before this change of metre, so the new
    // metre starts a bar rather than landing in the middle of one.
    while (tick - mark.barTicks >= marks[0].tick) tick -= mark.barTicks;
    for (; ; tick += mark.barTicks) {
      const seconds = song.toSeconds(tick);
      // A bar line with no music after it is not worth a bar: many of these
      // editions end exactly on the line.
      if (seconds > duration - 0.05) break;
      if (seconds >= (starts.length > 0 ? starts[starts.length - 1] : -1)) starts.push(round(seconds));
    }
  }
  starts.sort((a, b) => a - b);
  return {
    starts: starts.filter((value, index) => index === 0 || value > starts[index - 1] + 0.001),
    metre: { beats: marks[0].beats, beat: marks[0].beat },
  };
}

// ------------------------------------------------------------------ measures

/** How many notes sound at once, at its most, inside one stretch of time. */
function widestInside(notes) {
  const marks = [];
  for (const note of notes) {
    marks.push([note.time, 1], [note.end, -1]);
  }
  marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let sounding = 0;
  let widest = 0;
  for (const mark of marks) {
    sounding = Math.max(0, sounding + mark[1]);
    widest = Math.max(widest, sounding);
  }
  return widest;
}

/**
 * One line per bar: how many notes start in it, how thick it gets, how high it
 * sits, and which voices take part.
 */
export function barTable(piece) {
  const rows = [];
  const starts = piece.bars;
  for (let index = 0; index < starts.length; index++) {
    const from = starts[index];
    const to = index + 1 < starts.length ? starts[index + 1] : piece.duration + 0.001;
    const inside = piece.notes.filter((note) => note.time < to && note.end > from);
    const begun = inside.filter((note) => note.time >= from);
    const sounding = piece.voices
      .filter((voice) => inside.some((note) => note.voice === voice.index))
      .map((voice) => voice.index);
    const pitches = inside.map((note) => note.pitch);
    rows.push({
      bar: index + 1,
      time: from,
      starts: begun.length,
      width: inside.length > 0 ? widestInside(inside) : 0,
      mean: pitches.length > 0 ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 0,
      low: pitches.length > 0 ? Math.min(...pitches) : 0,
      high: pitches.length > 0 ? Math.max(...pitches) : 0,
      voices: sounding,
    });
  }
  return rows;
}

/**
 * Places where the music plainly changes: the mix of the bars before is unlike
 * the mix of the bars after. A passacaglia variation is a change too, so this
 * is a list of candidates to check against the music, not a verdict.
 */
export function boundaries(table, after) {
  if (table.length < after * 2 + 1) return [];
  const featureOf = (row) => [row.starts, row.width, row.mean, row.voices.length];
  const all = table.map(featureOf);
  const spread = featureOf(table[0]).map((_, column) => {
    const values = all.map((feature) => feature[column]);
    return Math.max(1, Math.max(...values) - Math.min(...values));
  });
  const meanOf = (rows) => featureOf(rows[0]).map((_, column) => rows.reduce((sum, row) => sum + featureOf(row)[column], 0) / rows.length);

  const found = [];
  for (let index = after; index <= table.length - after; index++) {
    const before = meanOf(table.slice(index - after, index));
    const afterMeans = meanOf(table.slice(index, index + after));
    const distance = before.reduce(
      (sum, value, column) => sum + Math.abs(value - afterMeans[column]) / spread[column],
      0
    );
    found.push({ bar: table[index].bar, time: table[index].time, distance: round(distance) });
  }
  const mean = found.reduce((sum, item) => sum + item.distance, 0) / found.length;
  return found.filter((item) => item.distance >= mean + 0.35).sort((a, b) => b.distance - a.distance);
}

// -------------------------------------------------------------------- themes

/**
 * A voice's melody as steps between one note and the next, so a figure can be
 * recognised whatever pitch it is played at - which is how a fugue answer on the
 * dominant, or a ground bass an octave up, counts as the same tune.
 *
 * Takes the voice's notes (pitch and time) and hands back its steps, its times,
 * and a way to name the window of steps from anywhere.
 */
export function stepIndex(notes) {
  const pitches = notes.map((note) => note.pitch);
  const times = notes.map((note) => note.time);
  const steps = pitches.slice(1).map((pitch, index) => pitch - pitches[index]);
  // One long string of all the steps, so the key of any window is a slice of it.
  const text = steps.join(",");
  const offset = [0];
  for (const step of steps) offset.push(offset[offset.length - 1] + String(step).length + 1);
  return {
    steps,
    times,
    // The window of `length` steps from `start`. offset points at the start of
    // each step, so the window ends one before the next step's start - that is
    // where the comma between them sits.
    keyAt: (start, length) => text.slice(offset[start], offset[start + length] - 1),
  };
}

/**
 * Every figure of `notes` notes that comes back in this voice: a list of
 * { steps, starts }, most copies first. Copies on top of one another count once,
 * and a figure that is one note hammered over and over is not a figure.
 *
 * Give `minGap` and a copy must wait that many seconds since the last one was
 * counted - otherwise a sequence, where the same figure runs on and on, looks
 * like a theme coming back when it is only the same bar again at another pitch.
 */
export function returningFigures(index, notes, { minGap = 0 } = {}) {
  const span = notes - 1; // the steps between the notes
  if (span < 1) return [];
  const places = new Map();
  for (let start = 0; start + span <= index.steps.length; start++) {
    const key = index.keyAt(start, span);
    if (!places.has(key)) places.set(key, []);
    places.get(key).push(start);
  }
  const found = [];
  for (const [key, starts] of places) {
    if (/^0(,0)*$/.test(key)) continue;
    const apart = [];
    for (const start of starts) {
      const last = apart[apart.length - 1];
      if (last === undefined) apart.push(start);
      else if (start >= last + span && index.times[start] >= index.times[last] + minGap) apart.push(start);
    }
    if (apart.length >= 2) {
      found.push({
        steps: key.split(",").map(Number),
        starts: apart,
        times: apart.map((start) => index.times[start]),
      });
    }
  }
  return found.sort((a, b) => b.starts.length - a.starts.length || a.starts[0] - b.starts[0]);
}

/**
 * The longest figure in this voice that comes back at least twice.
 * A figure that repeats at length L repeats at L - 1 too, so the longest one is
 * worth looking for by halving rather than by trying every length.
 */
export function longestRepeat(notes, { minNotes = 8 } = {}) {
  const index = stepIndex(notes);
  let low = minNotes;
  let high = index.steps.length + 1;
  let best = null;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const found = returningFigures(index, middle);
    if (found.length > 0) {
      best = found[0];
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

/**
 * The figure this voice brings back most often, which is the tune of the piece:
 * a fugue subject or a ground bass. Short figures are allowed, so a subject of
 * eight notes is found even when a longer passage of sequence also comes back.
 *
 * A theme usually comes back whole, so once the most frequent length is known the
 * longest figure that comes back nearly as often is taken instead - otherwise a
 * theme is reported as its first few notes.
 */
export function mostOftenFigure(voiceNotes, { minNotes = 8, maxNotes = 40, minGap = 0, nearly = 0.75 } = {}) {
  const index = stepIndex(voiceNotes);
  const longest = Math.min(maxNotes, index.steps.length + 1);
  let best = null;
  let bestCopies = 0;
  for (let length = minNotes; length <= longest; length++) {
    const found = returningFigures(index, length, { minGap })[0];
    if (!found) continue;
    const copies = found.starts.length;
    if (copies > bestCopies) {
      best = found;
      bestCopies = copies;
    } else if (copies >= bestCopies * nearly && found.steps.length > best.steps.length) {
      best = found;
    }
  }
  return best;
}

/**
 * Every place a figure is heard, in any voice.
 */
export function whereHeard(piece, pattern) {
  const entries = [];
  for (const voice of piece.voices) {
    const mine = piece.notes.filter((note) => note.voice === voice.index);
    const index = stepIndex(mine);
    const wanted = pattern.join(",");
    for (let start = 0; start + pattern.length <= index.steps.length; start++) {
      if (index.keyAt(start, pattern.length) === wanted) {
        entries.push({ voice: voice.name, voiceIndex: voice.index, time: mine[start].time, pitch: mine[start].pitch, notes: pattern.length + 1 });
      }
    }
  }
  return entries.sort((a, b) => a.time - b.time);
}

// -------------------------------------------------------------- gaps in notes

/**
 * Stretches of at least `shortest` seconds in which nothing in this list of notes
 * sounds - the rests. Longest first. These editions mark few of them: they write
 * everything legato, so a voice that seems to breathe usually does not.
 */
export function gapsIn(notes, shortest) {
  const rests = [];
  let until = 0;
  for (const note of notes) {
    if (note.time - until >= shortest) rests.push({ time: until, length: round(note.time - until) });
    until = Math.max(until, note.end);
  }
  return rests.sort((a, b) => b.length - a.length);
}

/** One voice's own rests, a beat or longer. */
function breathsOf(notes, beat) {
  return gapsIn(notes, beat);
}

/** Moments when no voice at all is sounding. */
function silences(notes) {
  return gapsIn(notes, 0.4);
}

// -------------------------------------------------------------------- report

/** The average of a list of bars, for describing a whole section in one line. */
function average(rows) {
  const mean = (pick) => rows.reduce((sum, row) => sum + pick(row), 0) / rows.length;
  return {
    starts: Math.round(mean((row) => row.starts) * 10) / 10,
    width: Math.round(mean((row) => row.width) * 10) / 10,
    mean: mean((row) => row.mean),
    voices: Math.round(mean((row) => row.voices.length) * 10) / 10,
  };
}

/**
 * Cut the piece into sections at the bars where the mix of the music changes, and
 * describe each one. The cuts are a reading of the numbers, not a verdict: for a
 * piece built on a repeated theme every variation is a change of mix.
 */
export function sectionsOf(table, shortest) {
  const cuts = boundaries(table, shortest)
    .map((item) => item.bar)
    .sort((a, b) => a - b);
  const parts = [];
  let start = 0;
  for (const bar of cuts) {
    const index = bar - 1;
    if (index - start < shortest) continue;
    parts.push(table.slice(start, index));
    start = index;
  }
  parts.push(table.slice(start));
  return parts
    .filter((rows) => rows.length > 0)
    .map((rows) => ({
      from: rows[0].bar,
      to: rows[rows.length - 1].bar,
      time: rows[0].time,
      end: rows[rows.length - 1].time,
      length: round(rows[rows.length - 1].time - rows[0].time),
      bars: rows.length,
      ...average(rows),
    }));
}

function describe(piece, options) {
  const out = [];
  const table = barTable(piece);
  const barSeconds = piece.barSeconds;
  const beatSeconds = barSeconds > 0 ? round(barSeconds / piece.metre.beats) : 0;
  const widest = Math.max(1, ...table.map((row) => row.width));
  const busiest = Math.max(1, ...table.map((row) => row.starts));
  const pitchLow = Math.min(...table.filter((row) => row.mean > 0).map((row) => row.mean));
  const pitchHigh = Math.max(...table.map((row) => row.mean));

  out.push(piece.slug);
  out.push("  " + piece.title + " - " + clockText(piece.duration) + ", " + piece.notes.length + " notes");
  out.push(
    "  metre " +
      piece.metre.beats +
      "/" +
      piece.metre.beat +
      ": " +
      table.length +
      " bars of " +
      barSeconds +
      "s, a beat of " +
      beatSeconds +
      "s at the start. " +
      piece.tempo.length +
      " tempo mark" +
      (piece.tempo.length === 1 ? "" : "s") +
      ": " +
      piece.tempo.map((mark) => clockText(mark.time) + " at " + Math.round(mark.bpm)).join(", ")
  );
  out.push(
    "  voices: " +
      piece.voices
        .map((voice) => voice.name + " " + voice.noteCount + " [" + noteName(voice.range[0]) + "-" + noteName(voice.range[1]) + "]")
        .join(", ")
  );

  out.push("  where it is thick and where it thins (starts, sounding, pitch)");
  const per = Math.max(1, Math.ceil(table.length / 40));
  for (let index = 0; index < table.length; index += per) {
    const block = table.slice(index, index + per);
    out.push(
      "    bar " +
        String(block[0].bar).padStart(3) +
        " " +
        clockText(block[0].time) +
        "  " +
        sparkline(block.map((row) => row.starts), busiest) +
        " " +
        sparkline(block.map((row) => row.width), widest) +
        " " +
        sparkline(block.map((row) => row.mean - pitchLow), Math.max(1, pitchHigh - pitchLow)) +
        " " +
        block.map((row) => row.voices.length).join("")
    );
  }

  const sections = sectionsOf(table, 4);
  out.push("  sections, where the mix of the music changes");
  for (const [index, section] of sections.entries()) {
    out.push(
      "    " +
        String(index + 1) +
        ". bars " +
        section.from +
        "-" +
        section.to +
        "  " +
        clockText(section.time) +
        "-" +
        clockText(section.end) +
        " (" +
        section.length +
        "s)  " +
        section.starts +
        " notes a bar, " +
        section.width +
        " sounding, about " +
        noteName(Math.round(section.mean)) +
        ", " +
        section.voices +
        " voices"
    );
  }

  const still = silences(piece.notes);
  out.push(
    "  nothing at all sounds: " +
      (still.length === 0
        ? "never, one note or another is on"
        : still.length + " times, longest " + still.slice(0, 5).map((gap) => clockText(gap.time) + " (" + gap.length + "s)").join(", "))
  );
  out.push("  each voice's own rests, a beat or longer");
  for (const voice of piece.voices) {
    const mine = piece.notes.filter((note) => note.voice === voice.index);
    const rests = breathsOf(mine, beatSeconds);
    out.push(
      "    " +
        voice.name +
        ": " +
        (rests.length === 0
          ? "never stops once it starts"
          : rests.length + " rests, longest " + rests.slice(0, 4).map((rest) => clockText(rest.time) + " (" + rest.length + "s)").join(", "))
    );
  }
  const going = table.filter((row) => row.starts > 0);
  const thinnest = [...going].sort((a, b) => a.starts - b.starts || a.width - b.width).slice(0, 5);
  out.push("  thinnest bars with notes in them: " + thinnest.map((row) => "bar " + row.bar + " " + row.starts + " starts/" + row.width + " sounding").join(", "));
  const fullest = [...table].sort((a, b) => b.width * 4 + b.starts - (a.width * 4 + a.starts)).slice(0, 5);
  out.push("  fullest bars: " + fullest.map((row) => "bar " + row.bar + " " + row.starts + " starts/" + row.width + " sounding").join(", "));

  out.push("  figures that come back (matched at any pitch, eight notes or more)");
  for (const voice of piece.voices) {
    const mine = piece.notes.filter((note) => note.voice === voice.index);
    const found = longestRepeat(mine);
    if (!found) {
      out.push("    " + voice.name + ": nothing of eight notes or more comes back");
      continue;
    }
    out.push(
      "    longest - " +
        voice.name +
        ": " +
        (found.steps.length + 1) +
        " notes, " +
        found.starts.length +
        " times - " +
        found.starts.map((start) => noteName(mine[start].pitch) + " at " + clockText(mine[start].time)).join(", ")
    );
  }
  out.push(
    "  the figure each voice brings back most often (" +
      piece.copiedAfter +
      "s or more between copies, so a sequence does not count)");
  for (const voice of piece.voices) {
    const mine = piece.notes.filter((note) => note.voice === voice.index);
    const found = mostOftenFigure(mine, { minGap: piece.copiedAfter });
    if (!found) {
      out.push("    " + voice.name + ": nothing of eight notes or more comes back");
      continue;
    }
    const first = mine[found.starts[0]].time;
    const last = mine[found.starts[found.starts.length - 1]].time;
    const apart = found.starts.length > 1 ? Math.round((last - first) / (found.starts.length - 1)) : 0;
    out.push(
      "    " +
        voice.name +
        ": " +
        (found.steps.length + 1) +
        " notes, " +
        found.starts.length +
        " times, first copy at " +
        clockText(first) +
        ", about " +
        apart +
        "s apart, last at " +
        clockText(last) +
        " - " +
        found.starts
          .slice(0, 14)
          .map((start) => noteName(mine[start].pitch) + " at " + clockText(mine[start].time))
          .join(", ") +
        (found.starts.length > 14 ? " …" : "")
    );
  }

  const theme = themeFigure(piece, piece.copiedAfter);
  if (theme) {
    const heard = whereHeard(piece, theme.found.steps);
    out.push(
      "  the figure that comes back most (" +
        (theme.found.steps.length + 1) +
        " notes, first heard in " +
        theme.voice.name +
        ") is heard " +
        heard.length +
        " times over the whole piece, in any voice:"
    );
    out.push("    " + heard.map((entry) => entry.voice + " " + noteName(entry.pitch) + " at " + clockText(entry.time)).join(" | "));
  }

  if (options.bars) {
    out.push("  every bar");
    for (const row of table) {
      out.push(
        "    bar " +
          String(row.bar).padStart(3) +
          " " +
          clockText(row.time) +
          "  starts " +
          String(row.starts).padStart(2) +
          "  sounding " +
          String(row.width).padStart(2) +
          "  " +
          noteName(row.low) +
          "-" +
          noteName(row.high) +
          "  voices " +
          row.voices.join(",")
      );
    }
  }
  return out.join("\n");
}

/**
 * The theme of the piece: whichever voice brings a figure back most often, and
 * that figure. For a passacaglia this is the ground bass; for a fugue, the subject.
 *
 * Weighed by copies times length, so a whole theme that returns a dozen times
 * beats a short figure that returns a dozen and a half.
 */
export function themeFigure(piece, minGap = 0) {
  const found = piece.voices
    .map((voice) => {
      const mine = piece.notes.filter((note) => note.voice === voice.index);
      const repeat = mostOftenFigure(mine, { minGap });
      if (!repeat) return null;
      return { voice, found: repeat, copies: repeat.starts.length, weight: repeat.starts.length * (repeat.steps.length + 1) };
    })
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight);
  return found.length > 0 ? found[0] : null;
}

/**
 * Every voice's standout figure: the longest one that comes back, or the one that
 * comes back most often.
 */
function figuresOf(piece, which, minGap = 0) {
  return piece.voices
    .map((voice) => {
      const mine = piece.notes.filter((note) => note.voice === voice.index);
      const found = which === "mostOften" ? mostOftenFigure(mine, { minGap }) : longestRepeat(mine);
      if (!found) return null;
      return {
        voice: voice.name,
        notes: found.steps.length + 1,
        steps: found.steps,
        times: found.starts.map((start) => mine[start].time),
        pitches: found.starts.map((start) => mine[start].pitch),
      };
    })
    .filter(Boolean);
}

function asJson(piece) {
  const table = barTable(piece);
  const best = themeFigure(piece, piece.copiedAfter);
  return JSON.stringify(
    {
      slug: piece.slug,
      duration: piece.duration,
      metre: piece.metre,
      bars: piece.bars,
      barsStarts: table.map((row) => row.starts),
      barsWidth: table.map((row) => row.width),
      barsMeanPitch: table.map((row) => round(row.mean)),
      sections: sectionsOf(table, 4),
      longestFigures: figuresOf(piece, "longest"),
      returningFigures: figuresOf(piece, "mostOften", piece.copiedAfter),
      entries: best ? whereHeard(piece, best.found.steps) : [],
      silences: silences(piece.notes),
    },
    null,
    1
  );
}

function main(argv) {
  const options = { bars: argv.includes("--bars"), json: argv.includes("--json") };
  const wanted = argv.filter((arg) => !arg.startsWith("--"));
  const slugs = fs
    .readdirSync(at("data"))
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .filter((slug) => wanted.length === 0 || wanted.some((name) => slug.includes(name)));

  for (const slug of slugs) {
    const piece = loadPiece(slug);
    console.log(options.json ? asJson(piece) : describe(piece, options));
  }
}

if (import.meta.url === "file://" + path.resolve(process.argv[1])) {
  main(process.argv.slice(2));
}
