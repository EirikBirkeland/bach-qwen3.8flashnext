// Every piece of converted music in data/ is checked against the MIDI file it
// came from: note for note, plus a few plain sanity checks. If a data file is
// edited by hand, or a MIDI file is swapped and not reconverted, this fails.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";
import { pictureScripts } from "./files.mjs";
import { readMidiFile } from "../tools/midi.mjs";
import { barLines } from "../tools/bars.mjs";
import { buildPieceData, jsonText, jsText } from "../tools/midi2json.mjs";

const root = new URL("..", import.meta.url); // this file sits in test/
const dataFiles = fs.readdirSync(new URL("data/", root)).filter((name) => name.endsWith(".json"));

function readData(name) {
  return JSON.parse(fs.readFileSync(new URL("data/" + name, root), "utf8"));
}

/** One note, told apart from another by its start, its pitch and its length. */
function key(time, pitch, duration) {
  return time + ":" + pitch + ":" + duration;
}

/** What src/pieces.js says the page can play. */
function piecesListed() {
  const source = fs.readFileSync(new URL("src/pieces.js", root), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.Bach.pieces;
}

/** The pictures the page has to offer, by name. */
function looksRegistered() {
  const sandbox = { window: {} };
  for (const file of pictureScripts()) {
    vm.runInNewContext(fs.readFileSync(new URL(file, root), "utf8"), sandbox);
  }
  return Object.keys(sandbox.window.Bach.looks);
}

test("there is converted music to play", () => {
  assert.ok(dataFiles.length > 0, "data/ holds no .json files");
});

for (const name of dataFiles) {
  const slug = name.replace(/\.json$/, "");
  const data = readData(name);

  test(slug + ": the JSON holds every note of its MIDI file", () => {
    const source = new URL(data.source, root);
    assert.ok(fs.existsSync(source), data.source + " is missing");
    const fresh = buildPieceData(readMidiFile(fs.readFileSync(source)), slug, data.source);
    assert.deepStrictEqual(fresh, data, "the notes in the JSON are not what the MIDI file says");
    assert.strictEqual(jsonText(data), fs.readFileSync(new URL("data/" + name, root), "utf8"), "run: node tools/midi2json.mjs");
  });

  test(slug + ": the .js the page loads carries the same notes", () => {
    assert.strictEqual(
      jsText(data, slug),
      fs.readFileSync(new URL("data/" + slug + ".js", root), "utf8"),
      "run: node tools/midi2json.mjs"
    );
  });

  test(slug + ": the bar lines are the edition's own", () => {
    assert.ok(data.bars.length > 1, "there are no bar lines");
    // The music may open part of a bar in - an anacrusis - and then the first bar
    // line sits that far past the first note. What it may not do is lose a bar, nor
    // end on a stump of one: see tools/bars.mjs for how the two are told apart.
    const bar = data.bars[1] - data.bars[0];
    assert.ok(
      data.bars[0] < bar,
      "the first bar line is " + data.bars[0] + " s in, which is more than a bar of " + bar.toFixed(2) + ": a bar is missing"
    );
    assert.ok(
      data.duration - data.bars[data.bars.length - 1] >= bar / 2,
      "the piece ends on a stump of a bar: only " + (data.duration - data.bars[data.bars.length - 1]).toFixed(2) + " s of one"
    );
    assert.ok(data.bars[data.bars.length - 1] < data.duration, "a bar line is after the last note");
    assert.ok(
      data.metre.beats >= 2 && data.metre.beats <= 12,
      "the metre " + data.metre.beats + "/" + data.metre.beat + " is not a metre anyone writes"
    );
    assert.ok(
      [1, 2, 4, 8, 16].indexOf(data.metre.beat) >= 0,
      "the metre " + data.metre.beats + "/" + data.metre.beat + " is not a metre anyone writes"
    );

    // A bar is as long as a bar is. The last one here is only twice as long as the
    // others because the editor slows down at the end.
    let previous = data.bars[0];
    for (const bar of data.bars.slice(1)) {
      assert.ok(bar > previous, "bar lines out of order at " + bar);
      assert.ok(bar - previous > 0.5, "a bar of " + (bar - previous).toFixed(2) + " s at " + bar + " s");
      assert.ok(bar - previous < 30, "a bar of " + (bar - previous).toFixed(2) + " s at " + bar + " s");
      previous = bar;
    }

    // The bar lines come out of the MIDI file, so so does this.
    const fresh = buildPieceData(readMidiFile(fs.readFileSync(new URL(data.source, root))), slug, data.source);
    assert.deepStrictEqual(fresh.bars, data.bars, "the bar lines are not what the MIDI file's metre says");
  });

  test(slug + ": nothing was invented, and nothing was dropped in silence", () => {
    const midi = readMidiFile(fs.readFileSync(new URL(data.source, root)));

    // Everything the MIDI file holds, counted, ready to be handed out.
    const pool = new Map(); // track -> key -> how often it appears
    for (const note of midi.notes) {
      if (!pool.has(note.track)) pool.set(note.track, new Map());
      const keys = pool.get(note.track);
      const k = key(note.time, note.pitch, note.duration);
      keys.set(k, (keys.get(k) || 0) + 1);
    }

    // Every note of the JSON came out of the MIDI file, from the voice it says.
    for (const [voice, pitch, time, duration] of data.notes) {
      const keys = pool.get(voice);
      const k = key(time, pitch, duration);
      const left = keys && keys.get(k);
      assert.ok(left, "the JSON plays a note the MIDI file does not have: track " + voice + " at " + k);
      keys.set(k, left - 1);
    }

    // Each copy the JSON admits to leaving out really is a copy: the whole track
    // is another track again, shifted by whole octaves.
    let notesLeftOut = 0;
    for (const copy of data.copies.octaveTracks) {
      const mine = midi.notes.filter((note) => note.track === copy.track);
      const followed = new Set(
        midi.notes
          .filter((note) => note.track === copy.follows)
          .map((note) => key(note.time, note.pitch, note.duration))
      );
      assert.strictEqual(mine.length, copy.notes, "track " + copy.track + " does not have the notes the JSON says");
      for (const note of mine) {
        assert.ok(
          followed.has(key(note.time, note.pitch - copy.octaves * 12, note.duration)),
          "track " +
            copy.track +
            " is said to be track " +
            copy.follows +
            " " +
            copy.octaves +
            " octaves up, but its " +
            note.pitch +
            " at " +
            note.time +
            " s is not there"
        );
      }
      notesLeftOut += mine.length;
    }

    // Whatever is still in the pool is either one of those copy tracks, whole,
    // or a note the same key struck twice over.
    const copyTracks = new Set(data.copies.octaveTracks.map((copy) => copy.track));
    let repeated = 0;
    for (const [track, keys] of pool) {
      if (copyTracks.has(track)) continue;
      for (const left of keys.values()) repeated += Math.max(0, left);
    }
    assert.strictEqual(repeated, data.copies.unisonNotes, "notes went missing that the JSON does not account for");
    assert.strictEqual(data.noteCount + notesLeftOut + data.copies.unisonNotes, data.sourceNoteCount);
    assert.strictEqual(data.sourceNoteCount, midi.notes.length, "the MIDI file and the stated count disagree");

    // And no note is struck twice in the result: one pitch, one moment, once.
    const once = new Set();
    for (const row of data.notes) {
      const k = row[1] + ":" + row[2] + ":" + row[3];
      assert.ok(!once.has(k), "the same note appears twice: " + k);
      once.add(k);
    }
  });

  test(slug + ": the notes are sane", () => {
    const notes = data.notes;
    assert.strictEqual(notes.length, data.noteCount);
    let counted = 0;
    for (const voice of data.voices) counted += voice.noteCount;
    assert.strictEqual(counted, notes.length, "the voices do not add up to all the notes");

    let low = 128;
    let high = 0;
    let previous = -1;
    for (const note of notes) {
      const [voice, pitch, time, length, velocity] = note;
      assert.ok(note.length === 5, "a note has " + note.length + " values, not five");
      assert.ok(data.voices.some((v) => v.index === voice), "a note is in voice " + voice + ", which is not listed");
      assert.ok(pitch >= 12 && pitch <= 108, "pitch " + pitch + " is off any keyboard");
      assert.ok(time >= previous, "the notes are not in time order at " + time);
      assert.ok(length > 0, "a note at " + time + " has no length");
      assert.ok(velocity > 0 && velocity <= 1, "loadness " + velocity + " is not between 0 and 1");
      previous = time;
      if (pitch < low) low = pitch;
      if (pitch > high) high = pitch;
    }
    assert.deepStrictEqual([low, high], data.pitchRange);

    let lastTempo = -1;
    for (const change of data.tempo) {
      assert.ok(change.time >= lastTempo, "the tempo marks are out of order");
      assert.ok(change.bpm > 0 && change.bpm < 400, "tempo " + change.bpm + " bpm is not believable");
      lastTempo = change.time;
    }

    const end = notes.reduce((longest, note) => Math.max(longest, note[2] + note[3]), 0);
    assert.ok(Math.abs(end - data.duration) < 0.001, "the stated length is not the length of the notes");
    const minutes = data.duration / 60;
    assert.ok(minutes > 1 && minutes < 60, "a piece of " + Math.round(minutes) + " minutes is not believable");

    // Two hands and two feet: nothing beyond this could be played, so a bigger
    // number would mean the same note got counted twice somewhere.
    const marks = [];
    for (const note of notes) {
      marks.push([note[2], 1]);
      // Four decimals, the precision the notes are written at, so a note that
      // ends exactly as another starts is not counted as sounding with it.
      marks.push([Math.round((note[2] + note[3]) * 10000) / 10000, -1]);
    }
    marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let sounding = 0;
    let widest = 0;
    for (const mark of marks) {
      sounding += mark[1];
      if (sounding > widest) widest = sounding;
    }
    assert.ok(widest <= 24, "widest sounding chord is " + widest + " notes: that is not playable");
  });
}

test("every converted piece has a place on the page, and every name on the page is real", () => {
  const pieces = [...piecesListed()];
  assert.deepStrictEqual(
    pieces.map((piece) => piece.slug).sort(),
    dataFiles.map((name) => name.replace(/\.json$/, "")).sort(),
    "the page and data/ do not hold the same pieces"
  );

  for (const piece of pieces) {
    assert.ok(piece.title, "a piece has no title");
    assert.ok(piece.subtitle, piece.slug + " has no subtitle");
    assert.strictEqual(piece.file, "data/" + piece.slug + ".js", piece.slug + " points at the wrong data file");
    assert.ok(fs.existsSync(new URL(piece.file, root)), piece.file + " is missing: run node tools/midi2json.mjs");

    const data = readData(piece.slug + ".json");
    const looks = looksRegistered();
    const wanted = (piece.look && piece.look.name) || "fall";
    assert.ok(
      looks.indexOf(wanted) >= 0,
      piece.slug + " asks to be drawn as " + wanted + ", which the page cannot do (it has " + looks.join(", ") + ")"
    );
    if (piece.look && piece.look.hint) {
      assert.ok(piece.look.hint.length < 90, "the line saying how to read " + piece.slug + " is too long to read at a glance");
    }
    const listed = new Set(Object.keys(piece.voices).map(Number));
    for (const voice of data.voices) {
      const known = piece.voices[voice.index];
      assert.ok(known && known.name, piece.slug + " voice " + voice.index + " has no name for the screen");
      assert.ok(
        /^#[0-9a-f]{6}$/.test(known.colour),
        piece.slug + " voice " + voice.index + ' colour "' + known.colour + '" is not a colour'
      );
      listed.delete(voice.index);
    }
    assert.strictEqual(
      listed.size,
      0,
      piece.slug + " names voices that are not in the data: " + [...listed].join(", ")
    );
  }
});

// --- the bar grid, and a piece that opens part of a bar in ------------------
//
// A MIDI file writes no bar lines: it writes a metre and counts ticks, so the bars
// follow by arithmetic from the first tick. An edition that opens with a pickup
// breaks that arithmetic - the music starts part of a bar in, and every bar line
// drawn from the first tick is that much too early. tools/bars.mjs reads the
// pickup off the end of the piece, because these editions end exactly on the line.

/** A song as tools/bars.mjs wants it: one metre, one tempo, ticks to seconds. */
function songOf(barSeconds) {
  const ticks = 384; // a quarter note, at 60 to the minute
  return {
    ticksPerQuarter: ticks,
    timeSignatures: [{ tick: 0, seconds: 0, beats: 4, beat: 4, barTicks: Math.round(barSeconds * ticks) }],
    toSeconds: (tick) => tick / ticks,
  };
}

test("a piece that ends exactly on the line is barred from its first note", () => {
  const lined = barLines(songOf(4), 572); // BWV 565: 143 bars of four seconds
  assert.strictEqual(lined.starts[0], 0);
  assert.strictEqual(lined.starts.length, 143);
});

test("a piece that opens with a pickup has its whole grid lifted by it", () => {
  // BWV 645: a four-second bar, a piece of 220.5 s. Left to the arithmetic the
  // last "bar" would be half a second long, which is the eighth note the piece
  // opened with, come round again at the end.
  const lined = barLines(songOf(4), 220.5);
  assert.strictEqual(lined.starts[0], 0.5, "the first bar line is a pickup in");
  assert.strictEqual(lined.starts.length, 55, "the piece is 55 whole bars and a pickup");
  assert.strictEqual(lined.starts[lined.starts.length - 1], 216.5);
  assert.ok(220.5 - lined.starts[lined.starts.length - 1] === 4, "the last bar is a whole one");
});

test("a last bar stretched by a slowing at the end is not a pickup", () => {
  // BWV 639 ends by slowing to a stop, which makes its last bar longer than a bar
  // - and a bar the music has more of than the metre says is nothing to do with a
  // pickup. The real file, because it takes a real ritardando to say so.
  const data = readData("bwv639-ich-ruf-zu-dir.json");
  const bar = data.bars[1] - data.bars[0];
  assert.strictEqual(data.bars[0], 0, "the grid stayed at the first note");
  assert.strictEqual(data.bars.length, 18);
  assert.ok(
    data.duration - data.bars[data.bars.length - 1] > bar,
    "the last bar should be longer than a bar of " + bar.toFixed(2) + " s, and it is not"
  );
});

test("BWV 582: its last bar is short, and is still not read as a pickup", () => {
  // The Passacaglia slows five times in its last two minutes, so its bars stretch
  // as it goes: the last one is shorter than the one before it, which a rule read
  // off the last gap would mistake for an anacrusis. The middle bar is what it
  // compares by, and the grid stays where the editor put it.
  const data = readData("bwv582-passacaglia-c-minor.json");
  const last = data.bars[data.bars.length - 1];
  const before = data.bars[data.bars.length - 2];
  assert.ok(last - before > 2.5, "its last-but-one bar is stretched by the slowing: " + (last - before).toFixed(2) + " s");
  assert.ok(data.duration - last < last - before, "and its last bar is shorter than that");
  assert.strictEqual(data.bars[0], 0, "so the grid stayed at the first note");
});

test("BWV 645: the chord that ends the piece fills the last bar", () => {
  const data = readData("bwv645-wachet-auf.json");
  const at = data.format.indexOf("time");
  const long = data.format.indexOf("duration");
  let last = 0;
  for (const row of data.notes) last = Math.max(last, row[at] + row[long]);
  assert.strictEqual(last, data.duration, "the piece ends with its last note");
  const struck = data.notes.filter((row) => row[at] + row[long] >= last).map((row) => row[at]);
  assert.strictEqual(Math.min(...struck), data.bars[data.bars.length - 1], "the final chord is struck on the last bar line");
  assert.ok(last - Math.min(...struck) > 3.5, "and it holds for a whole bar");
});

test("two bar lines cannot tell you anything, so nothing is lifted", () => {
  // The rule needs more than one gap to judge by. A piece this short is not a piece
  // anyone would play along to, but a rule with an untested edge is a rule that
  // quietly stops being one.
  const lined = barLines(songOf(4), 5);
  assert.deepStrictEqual(lined.starts, [0, 4]);
});
