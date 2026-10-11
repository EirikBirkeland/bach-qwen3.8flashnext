// A small MIDI file reader, written for this project. No libraries.
//
// It reads a standard MIDI file (format 0 or 1) and gives back the notes of
// each track with real times in seconds, using the tempo changes found in the
// file. Nothing musical beyond that is kept: no control changes, no pitch bend.
// That is all a page that plays Bach back needs.
//
// Usage:
//   import { readMidiFile } from "./midi.mjs";
//   const song = readMidiFile(fs.readFileSync("song.mid"));

/** A MIDI variable-length quantity, as used for deltas and lengths. */
function readVarLen(bytes, pos) {
  let value = 0;
  let p = pos;
  for (let i = 0; i < 4; i++) {
    const byte = bytes[p++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: p };
  }
  throw new Error("bad variable-length value at byte " + pos);
}

function readText(bytes, start, end) {
  let out = "";
  for (let i = start; i < end; i++) {
    const c = bytes[i];
    if (c >= 32 && c < 127) out += String.fromCharCode(c);
  }
  return out.trim();
}

function str(bytes, from, to) {
  let out = "";
  for (let i = from; i < to; i++) out += String.fromCharCode(bytes[i]);
  return out;
}

function u16(bytes, at) {
  return (bytes[at] << 8) | bytes[at + 1];
}

function u32(bytes, at) {
  return bytes[at] * 0x1000000 + bytes[at + 1] * 0x10000 + bytes[at + 2] * 0x100 + bytes[at + 3];
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

/**
 * Turn the bytes of a MIDI file into a song:
 *
 *   ticksPerQuarter  division of the file
 *   tempoChanges     [{ tick, seconds, bpm }]
 *   tracks           [{ index, name, channel, notes, endSeconds }]
 *   notes            one flat list, sorted by start time, each with
 *                    track, channel, pitch, time, duration, velocity
 *   duration         when the last note ends, in seconds
 *   pitchRange       the lowest and highest note in the file
 */
export function readMidiFile(bytes) {
  if (bytes.length < 14 || str(bytes, 0, 4) !== "MThd") {
    throw new Error("not a MIDI file: no MThd header");
  }
  const headerLength = u32(bytes, 4);
  const division = u16(bytes, 12);
  if (division & 0x8000) {
    throw new Error("SMPTE time division is not supported here");
  }
  const ticksPerQuarter = division;

  // Walk every track chunk, collecting raw events measured in ticks.
  const rawTracks = [];
  let pos = 8 + headerLength;
  while (pos + 8 <= bytes.length) {
    const kind = str(bytes, pos, pos + 4);
    const length = u32(bytes, pos + 4);
    const body = pos + 8;
    if (kind === "MTrk") rawTracks.push(readTrackEvents(bytes, body, body + length));
    pos = body + length;
  }
  if (rawTracks.length === 0) throw new Error("no track chunks in the MIDI file");

  // The tempo map: every tempo change anywhere in the file, in tick order.
  // Editors often write the same tempo again and again; a change that repeats
  // the tempo already in force is not a change, so it is dropped.
  const seen = [];
  for (const track of rawTracks) {
    for (const event of track.events) {
      if (event.type === "tempo") {
        seen.push({ tick: event.tick, microsecondsPerQuarter: event.microsecondsPerQuarter });
      }
    }
  }
  seen.sort((a, b) => a.tick - b.tick); // stable: marks at one tick keep their order
  const tempoChanges = [];
  if (seen.length === 0 || seen[0].tick !== 0) {
    tempoChanges.push({ tick: 0, microsecondsPerQuarter: 500000 }); // the MIDI default: quarter = 120 bpm
  }
  for (const change of seen) {
    const last = tempoChanges[tempoChanges.length - 1];
    if (last && last.microsecondsPerQuarter === change.microsecondsPerQuarter) continue;
    tempoChanges.push(change);
  }

  /** Seconds from the start of the piece to a tick, following the tempo map. */
  function tickToSeconds(tick) {
    let seconds = 0;
    let previous = tempoChanges[0];
    for (const change of tempoChanges) {
      if (change.tick > tick) break;
      seconds += ((change.tick - previous.tick) / ticksPerQuarter) * (previous.microsecondsPerQuarter / 1e6);
      previous = change;
    }
    return seconds + ((tick - previous.tick) / ticksPerQuarter) * (previous.microsecondsPerQuarter / 1e6);
  }

  const notes = [];
  const tracks = [];
  rawTracks.forEach((track, trackIndex) => {
    const open = new Map(); // "channel:pitch" -> notes still sounding, oldest first
    let heldTo = 0; // the tick this track stopped holding notes

    function close(channel, pitch, atTick) {
      const waiting = open.get(channel + ":" + pitch);
      if (!waiting || waiting.length === 0) return;
      const note = waiting.shift();
      note.duration = round(Math.max(0, tickToSeconds(atTick) - note.time));
    }

    for (const event of track.events) {
      const tick = event.tick;
      heldTo = tick;
      if (event.type === "noteOn") {
        if (event.velocity === 0) {
          close(event.channel, event.pitch, tick);
          continue;
        }
        const key = event.channel + ":" + event.pitch;
        const note = {
          track: trackIndex,
          channel: event.channel,
          pitch: event.pitch,
          time: round(tickToSeconds(tick)),
          duration: 0,
          velocity: round(event.velocity / 127),
        };
        const waiting = open.get(key) || [];
        waiting.push(note);
        open.set(key, waiting);
        notes.push(note);
      } else if (event.type === "noteOff") {
        close(event.channel, event.pitch, tick);
      } else if (event.type === "endOfTrack") {
        break;
      }
    }

    // A note still held when its track ends sounds until that track ends.
    const endSeconds = tickToSeconds(heldTo);
    for (const waiting of open.values()) {
      for (const note of waiting) {
        note.duration = round(Math.max(0, endSeconds - note.time));
      }
    }
    tracks.push({
      index: trackIndex,
      name: track.name,
      channel: track.channel,
      endSeconds: round(endSeconds),
    });
  });

  notes.sort((a, b) => a.time - b.time || a.pitch - b.pitch);
  const duration = round(notes.reduce((longest, note) => Math.max(longest, note.time + note.duration), 0));
  const pitchRange = notes.length > 0 ? [notes[0].pitch, notes[0].pitch] : [0, 0];
  for (const note of notes) {
    if (note.pitch < pitchRange[0]) pitchRange[0] = note.pitch;
    if (note.pitch > pitchRange[1]) pitchRange[1] = note.pitch;
  }
  for (const track of tracks) {
    track.notes = notes.filter((note) => note.track === track.index).length;
  }

  return {
    ticksPerQuarter,
    tempoChanges: tempoChanges.map((change) => ({
      tick: change.tick,
      seconds: round(tickToSeconds(change.tick)),
      bpm: Math.round((60e6 / change.microsecondsPerQuarter) * 100) / 100,
    })),
    tracks,
    notes,
    duration,
    pitchRange,
  };
}

/** One track chunk, turned into events with absolute tick positions. */
function readTrackEvents(bytes, start, end) {
  const events = [];
  let pos = start;
  let tick = 0;
  let runningStatus = 0;
  let name = "";
  let firstChannel = null;

  while (pos < end) {
    const delta = readVarLen(bytes, pos);
    pos = delta.next;
    tick += delta.value;

    let status = bytes[pos];
    if (status < 0x80) {
      status = runningStatus; // running status: this byte is data, the status carries over
    } else {
      pos++;
      runningStatus = status;
    }

    const kind = status & 0xf0;
    const channel = status & 0x0f;

    if (status === 0xff) {
      const type = bytes[pos++];
      const length = readVarLen(bytes, pos);
      pos = length.next;
      const dataStart = pos;
      pos += length.value;
      if (type === 0x51) {
        events.push({
          tick,
          type: "tempo",
          microsecondsPerQuarter: (bytes[dataStart] << 16) | (bytes[dataStart + 1] << 8) | bytes[dataStart + 2],
        });
      } else if (type === 0x03) {
        const text = readText(bytes, dataStart, dataStart + length.value);
        if (text) name = text;
      } else if (type === 0x2f) {
        events.push({ tick, type: "endOfTrack" });
        pos = end;
      }
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      const length = readVarLen(bytes, pos);
      pos = length.next + length.value;
      continue;
    }

    if (kind === 0x90) {
      const pitch = bytes[pos++];
      const velocity = bytes[pos++];
      if (firstChannel === null) firstChannel = channel;
      events.push({ tick, type: "noteOn", channel, pitch, velocity });
    } else if (kind === 0x80) {
      const pitch = bytes[pos++];
      pos++;
      events.push({ tick, type: "noteOff", channel, pitch });
    } else if (kind === 0xa0 || kind === 0xb0 || kind === 0xe0) {
      pos += 2;
    } else if (kind === 0xc0 || kind === 0xd0) {
      pos += 1;
    } else {
      throw new Error("unexpected MIDI status byte 0x" + status.toString(16) + " near byte " + pos);
    }
  }

  return { events, name, channel: firstChannel };
}
