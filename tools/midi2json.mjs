// Turns a MIDI file in music/ into plain note data the page can play.
//
//   node tools/midi2json.mjs                 # convert every music/*.mid
//   node tools/midi2json.mjs music/x.mid     # convert one file
//   node tools/midi2json.mjs --check         # say whether data/ is up to date
//
// For each music/<name>.mid it writes:
//   data/<name>.json  the notes: voice, pitch, start in seconds, length in
//                     seconds, loadness 0..1. This is the file to read and test.
//   data/<name>.js    the same data again, wrapped so a <script> tag can hand it
//                     to the page. Browsers will not let a page opened straight
//                     from disk read a .json file, so this copy is what loads.
//
// Copies are left out: a track that repeats another track at the octave is an
// octave coupler and a repeated note is one struck key. The JSON says what was
// left out, so nothing is lost quietly. See pickVoices below.
//
// The output is meant to be identical every time it is written, so a difference
// in git always means the music really changed.

import fs from "node:fs";
import path from "node:path";
import { readMidiFile } from "./midi.mjs";

const COLUMNS = ["voice", "pitch", "time", "duration", "velocity"];

function slugOf(file) {
  return path.basename(file).replace(/\.mid$/, "");
}

/** A MIDI voice name from an editor is often "RH:1" or empty. Clean it up a bit. */
function tidyVoiceName(name, index) {
  const cleaned = String(name || "")
    .replace(/[:\s]+$/g, "")
    .replace(/^\s+/g, "")
    .trim();
  if (!cleaned) return "Voice " + index;
  return cleaned;
}

// One note, told apart from another by when it starts, how high it is, and how
// long it holds.
function noteKey(time, pitch, duration) {
  return time + ":" + pitch + ":" + duration;
}

function lowestPitch(notes) {
  return notes.reduce((low, note) => Math.min(low, note.pitch), 128);
}

// A track of fewer notes than this is too short to call a copied line.
const MIN_COPY_NOTES = 8;

/**
 * Which tracks are a voice and which are a copy of one.
 *
 * Editions write the same line more than once. An organ score may hand a line
 * to the pedal and again, an octave up, to a manual stop; a keyboard reduction
 * may double a hand in octaves. A copy has exactly the notes of another track,
 * shifted by whole octaves and with the same lengths - one key struck once, not
 * two. The lowest copy is the one kept: it is the line as it sits on the manual
 * or the pedalboard. What was dropped is listed, so every note of the MIDI file
 * can still be accounted for.
 */
function pickVoices(song) {
  const byTrack = new Map();
  for (const note of song.notes) {
    if (!byTrack.has(note.track)) byTrack.set(note.track, []);
    byTrack.get(note.track).push(note);
  }

  const kept = [];
  const octaveTracks = [];
  const order = [...byTrack.keys()].sort(
    (a, b) => lowestPitch(byTrack.get(a)) - lowestPitch(byTrack.get(b)) || a - b
  );
  for (const track of order) {
    const notes = byTrack.get(track);
    const copy = findOctaveCopy(notes, kept, byTrack);
    if (copy) octaveTracks.push({ track, follows: copy.follows, octaves: copy.octaves, notes: notes.length });
    else kept.push(track);
  }
  return { kept, octaveTracks };
}

/** Is this whole track just a kept track again, some octaves higher? */
function findOctaveCopy(notes, keptTracks, byTrack) {
  // Two notes that happen to sit an octave above another line are music, not a
  // coupler, so a short track is never called a copy.
  if (notes.length < MIN_COPY_NOTES) return null;
  for (const keeper of keptTracks) {
    const keys = new Set(byTrack.get(keeper).map((note) => noteKey(note.time, note.pitch, note.duration)));
    for (const octaves of [1, 2, 3]) {
      const shift = octaves * 12;
      if (notes.every((note) => keys.has(noteKey(note.time, note.pitch - shift, note.duration)))) {
        return { follows: keeper, octaves };
      }
    }
  }
  return null;
}

/**
 * Take out the notes that are the same key struck twice: another staff writing
 * the same pitch at the same moment for the same length. The organ has one pipe
 * per note, so a copy would only make that one note louder.
 */
function withoutUnisonCopies(notes) {
  const seen = new Set();
  const kept = [];
  let copies = 0;
  for (const note of notes) {
    const key = noteKey(note.time, note.pitch, note.duration);
    if (seen.has(key)) {
      copies++;
      continue;
    }
    seen.add(key);
    kept.push(note);
  }
  return { notes: kept, copies };
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

/** Convert one song (as returned by readMidiFile) into the data object. */
export function buildPieceData(song, slug, source) {
  const plan = pickVoices(song);
  const playable = new Set(plan.kept);
  const single = withoutUnisonCopies(song.notes.filter((note) => playable.has(note.track)));
  const notes = single.notes;
  const rows = notes.map((note) => [note.track, note.pitch, note.time, note.duration, note.velocity]);
  const ends = notes.reduce((latest, note) => Math.max(latest, note.time + note.duration), 0);

  return {
    slug,
    source,
    format: COLUMNS,
    duration: round(ends),
    noteCount: rows.length,
    // Every note of the MIDI file is either here or accounted for below.
    sourceNoteCount: song.notes.length,
    copies: { octaveTracks: plan.octaveTracks, unisonNotes: single.copies },
    pitchRange: rangeOf(notes),
    tempo: song.tempoChanges.map((change) => ({ time: change.seconds, bpm: change.bpm })),
    voices: song.tracks
      .filter((track) => track.notes > 0 && playable.has(track.index))
      .map((track) => ({
        index: track.index,
        channel: track.channel,
        name: tidyVoiceName(track.name, track.index),
        noteCount: notes.filter((note) => note.track === track.index).length,
        pitchRange: rangeOf(notes.filter((note) => note.track === track.index)),
      })),
    notes: rows,
  };
}

function rangeOf(notes) {
  if (notes.length === 0) return [0, 0];
  let low = 128;
  let high = 0;
  for (const note of notes) {
    if (note.pitch < low) low = note.pitch;
    if (note.pitch > high) high = note.pitch;
  }
  return [low, high];
}

/** The .json text: notes on one line each, so a diff shows the note that moved. */
export function jsonText(data) {
  const head = { ...data, notes: [] };
  const noteLines = data.notes.map((row) => "    " + JSON.stringify(row)).join(",\n");
  const headText = JSON.stringify(head, null, 2);
  // Put the notes array back into the object text, replacing the empty one.
  const place = headText.lastIndexOf('"notes": []');
  if (place < 0) throw new Error("cannot place the notes in the JSON");
  return headText.slice(0, place) + '"notes": [\n' + noteLines + "\n  ]" + headText.slice(place + '"notes": []'.length);
}

/** The .js text: the same JSON, handed to the page by a <script> tag. */
export function jsText(data, slug) {
  return (
    "// Generated from data/" +
    slug +
    ".json by tools/midi2json.mjs. Do not edit this file.\n" +
    "window.BachData = window.BachData || {};\n" +
    "window.BachData[" +
    JSON.stringify(slug) +
    "] = " +
    JSON.stringify(data) +
    ";\n"
  );
}

function convertOne(file, dryRun) {
  const slug = slugOf(file);
  const song = readMidiFile(fs.readFileSync(file));
  const data = buildPieceData(song, slug, "music/" + path.basename(file));
  const jsonPath = path.join("data", slug + ".json");
  const jsPath = path.join("data", slug + ".js");
  const json = jsonText(data);
  const js = jsText(data, slug);

  if (dryRun) {
    const stale = [];
    for (const [p, text] of [
      [jsonPath, json],
      [jsPath, js],
    ]) {
      if (!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== text) stale.push(p);
    }
    return { slug, stale, data };
  }

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(jsonPath, json);
  fs.writeFileSync(jsPath, js);
  return { slug, data, jsonPath, jsPath };
}

function main(argv) {
  const check = argv.includes("--check");
  const files = argv.filter((arg) => !arg.startsWith("--"));
  const list = files.length > 0 ? files : fs.readdirSync("music").filter((name) => name.endsWith(".mid")).map((name) => path.join("music", name));

  let problem = 0;
  for (const file of list) {
    const result = convertOne(file, check);
    const data = result.data;
    if (check) {
      if (result.stale.length > 0) {
        problem = 1;
        console.log(result.slug + ": out of date (" + result.stale.join(", ") + ")");
      } else {
        console.log(result.slug + ": up to date, " + data.noteCount + " notes, " + seconds(data.duration));
      }
    } else {
      const voices = data.voices.map((voice) => voice.name + " " + voice.noteCount).join(", ");
      console.log(
        result.slug +
          ": " +
          data.noteCount +
          " notes of " +
          data.sourceNoteCount +
          " (left out " +
          copiesSpoken(data) +
          "), " +
          seconds(data.duration) +
          " [" +
          voices +
          "]"
      );
    }
  }
  if (problem) {
    console.log("Run: node tools/midi2json.mjs");
    process.exit(1);
  }
}

/** What was left out of a piece, in a few words. */
function copiesSpoken(data) {
  return data.copies.octaveTracks.length + " octave copies, " + data.copies.unisonNotes + " repeated notes";
}

function seconds(total) {
  const m = Math.floor(total / 60);
  const s = Math.round(total - m * 60);
  return m + "m" + String(s).padStart(2, "0") + "s";
}

if (import.meta.url === "file://" + path.resolve(process.argv[1])) {
  main(process.argv.slice(2));
}
