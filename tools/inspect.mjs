// Sums a converted piece up in numbers, for checking the music without ears.
//
//   node tools/inspect.mjs                       # a line about every piece
//   node tools/inspect.mjs bwv639                # only the piece with that in
//   node tools/inspect.mjs bwv639 0 30 end       # what sounds at those seconds
//
// "end" means the last moment of the piece. Every second given is answered with
// the notes sounding then, by voice, so a chord can be read like a bar of the
// score. Voice names come from src/pieces.js, so the report reads like the page.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/** MIDI note number to the name an organist would say: 60 is middle C, C4. */
function noteName(pitch) {
  return NAMES[pitch % 12] + (Math.floor(pitch / 12) - 1);
}

/** The data for every piece in data/, and the voice names the page uses. */
function loadPieces() {
  const pageSource = fs.readFileSync("src/pieces.js", "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(pageSource, sandbox);
  const listed = {};
  for (const piece of sandbox.window.Bach.pieces) listed[piece.slug] = piece;

  return fs
    .readdirSync("data")
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const data = JSON.parse(fs.readFileSync(path.join("data", name), "utf8"));
      const piece = listed[data.slug];
      data.voices.forEach((voice) => {
        const known = piece && piece.voices ? piece.voices[voice.index] : null;
        if (known) voice.name = known.name;
      });
      return data;
    });
}

function column(data, name) {
  return data.format.indexOf(name);
}

/** The notes sounding at one second, grouped by voice, lowest note first. */
function soundingAt(data, at) {
  const time = column(data, "time");
  const length = column(data, "duration");
  const pitch = column(data, "pitch");
  const voice = column(data, "voice");
  const rows = data.notes
    .filter((note) => note[time] <= at && at < Math.round((note[time] + note[length]) * 10000) / 10000)
    .sort((a, b) => a[pitch] - b[pitch]);

  const byVoice = new Map();
  for (const note of rows) {
    const known = data.voices.find((candidate) => candidate.index === note[voice]);
    const name = known ? known.name : "voice " + note[voice];
    if (!byVoice.has(name)) byVoice.set(name, []);
    byVoice.get(name).push(noteName(note[pitch]));
  }
  return { count: rows.length, byVoice };
}

/** How many notes sound at once, and where the thickest moment is. */
function widestChord(data) {
  const time = column(data, "time");
  const length = column(data, "duration");
  const marks = [];
  for (const note of data.notes) {
    marks.push([note[time], 1]);
    // Back to four decimals, the precision the notes are written at, so a note
    // that hands over exactly is not counted as sounding with the next.
    marks.push([Math.round((note[time] + note[length]) * 10000) / 10000, -1]);
  }
  marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let sounding = 0;
  let widest = 0;
  let at = 0;
  for (const mark of marks) {
    sounding += mark[1];
    if (sounding > widest) {
      widest = sounding;
      at = mark[0];
    }
  }
  return { widest, at };
}

function rangeOf(voice) {
  return noteName(voice.pitchRange[0]) + "-" + noteName(voice.pitchRange[1]);
}

function describe(data) {
  const thick = widestChord(data);
  const minutes = Math.floor(data.duration / 60);
  const seconds = Math.round(data.duration - minutes * 60);
  const left = data.copies.octaveTracks.length + data.copies.unisonNotes;
  const lines = [
    data.slug,
    "  " +
      data.noteCount +
      " notes in " +
      minutes +
      "m" +
      String(seconds).padStart(2, "0") +
      "s, " +
      (data.noteCount / data.duration).toFixed(1) +
      " a second",
    "  widest chord " + thick.widest + " notes at " + thick.at.toFixed(1) + "s",
    "  " + data.tempo.length + " tempo mark" + (data.tempo.length === 1 ? "" : "s") + ", " + left + " copies left out",
    "  " + data.voices.map((voice) => voice.name + " " + voice.noteCount + " [" + rangeOf(voice) + "]").join(", "),
  ];
  return lines.join("\n");
}

function main(argv) {
  const isMoment = (arg) => arg === "end" || !Number.isNaN(Number(arg));
  const moments = argv.filter(isMoment).map((arg) => (arg === "end" ? "end" : Number(arg)));
  const wanted = argv.filter((arg) => !isMoment(arg));
  const pieces = loadPieces().filter(
    (data) => wanted.length === 0 || wanted.some((name) => data.slug.includes(name))
  );
  if (pieces.length === 0) {
    console.log("nothing in data/ matches " + argv.join(" "));
    return;
  }

  for (const data of pieces) {
    console.log(describe(data));
    for (const moment of moments) {
      const at = moment === "end" ? Math.max(0, data.duration - 0.2) : moment;
      const heard = soundingAt(data, at);
      const parts = [...heard.byVoice].map(([voice, notes]) => voice + ": " + notes.join(" "));
      console.log("  at " + at.toFixed(2) + "s, " + heard.count + " sounding - " + parts.join(" | "));
    }
  }
}

main(process.argv.slice(2));
