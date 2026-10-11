// The organ, in plain numbers. src/audio.js builds the instrument out of Web
// Audio nodes, which nothing in here can hear; this builds the same thing out of
// arrays instead - the same ranks, the same levels, the same way a pipe comes up
// and lets go - so the loudness can be measured rather than hoped for.
//
// What it leaves out, and why that is honest: the room (a convolution spreads
// sound over time instead of piling it into one instant), the tremulant (which
// moves the level by a few per cent slowly), and the limiter (which is only
// there for what gets through). Those make a chord a little louder and a lot
// longer, never higher.

import fs from "node:fs";
import vm from "node:vm";
import { gameScripts } from "./files.mjs";

const root = new URL("..", import.meta.url);

/** The page's own organ module, loaded the way a browser would load it. */
export function loadOrgan() {
  const source = fs.readFileSync(new URL("src/audio.js", root), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.Bach;
}

/** What pieces.js says the page can play. */
export function loadPieces() {
  const source = fs.readFileSync(new URL("src/pieces.js", root), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.Bach.pieces;
}

export function loadData(slug) {
  return JSON.parse(fs.readFileSync(new URL("data/" + slug + ".json", root), "utf8"));
}

/**
 * Everything the page needs to play along - the organ, the beat grid, the touch of
 * a piece, the game - loaded in a bare window, so a tool or a test can ask the
 * page's own code the same questions a browser asks it.
 */
export function loadPage() {
  const sandbox = vm.createContext({ window: {} });
  for (const file of gameScripts()) {
    vm.runInContext(fs.readFileSync(new URL(file, root), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window.Bach;
}

export function hz(pitch) {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

const PERIOD = 4096; // samples of one period of a wave

/**
 * One period of a rank's wave, normalised to peak at 1 - which is what the
 * browser does with the harmonics handed to createPeriodicWave.
 */
export function waveFor(mix) {
  const samples = new Float64Array(PERIOD);
  let top = 0;
  for (let i = 0; i < PERIOD; i++) {
    let value = 0;
    for (let harmonic = 1; harmonic <= mix.length; harmonic++) {
      value += mix[harmonic - 1] * Math.sin((2 * Math.PI * harmonic * i) / PERIOD);
    }
    samples[i] = value;
    top = Math.max(top, Math.abs(value));
  }
  if (top > 0) for (let i = 0; i < PERIOD; i++) samples[i] /= top;
  return samples;
}

const waves = {};
function waveOf(spec, rank) {
  const name = spec.ranks[rank].mix;
  if (!waves[name]) waves[name] = waveFor(spec.mixes[name]);
  return waves[name];
}

/** How loud the loudest harmonic of a wave is after the wave is normalised. */
function wavePeak(mix) {
  let top = 0;
  for (let i = 0; i < PERIOD; i++) {
    let value = 0;
    for (let harmonic = 1; harmonic <= mix.length; harmonic++) {
      value += mix[harmonic - 1] * Math.sin((2 * Math.PI * harmonic * i) / PERIOD);
    }
    top = Math.max(top, Math.abs(value));
  }
  return top || 1;
}

// The master lowpass: an organ in a room never has all of its fizz.
const TONE = 6200;
function rolledOff(freq) {
  const ratio = freq / TONE;
  return 1 / Math.sqrt(1 + ratio * ratio * ratio * ratio);
}

/**
 * What share of full scale a pipe reaches `t` seconds after its key went down,
 * for a note `length` seconds long: up, settle, hold, gone. The same shape the
 * engine schedules, without the random jitter in when the key opens.
 */
export function envelope(t, length, spec) {
  const attack = spec.envelope.attack;
  const sagEnd = attack + Math.min(0.35, Math.max(0.05, length * 0.4));
  const gateEnd = Math.max(sagEnd, length);
  const releaseEnd = gateEnd + spec.envelope.release;
  if (t <= 0) return 0;
  if (t < attack) return t / attack;
  if (t < sagEnd) return 1 - (1 - spec.envelope.sagTo) * ((t - attack) / (sagEnd - attack));
  if (t < gateEnd) return spec.envelope.sagTo;
  if (t < releaseEnd) {
    const from = spec.envelope.sagTo;
    return from * Math.pow(0.0001 / from, (t - gateEnd) / (releaseEnd - gateEnd));
  }
  return 0;
}

/** Every pipe one note opens, as the engine would open it. */
export function pipesOf(note, spec) {
  const drawn = spec.stopsFor(spec.registration, note.role);
  const base = spec.struck(note.velocity);
  const out = [];
  for (const stop of spec.pipesFor(drawn.stops, note.pitch)) {
    out.push({
      rank: stop.rank,
      name: spec.ranks[stop.rank].name,
      freq: hz(note.pitch) * stop.ratio,
      level: base * stop.level,
      wave: waveOf(spec, stop.rank),
    });
  }
  return out;
}

/** How many pipes a note opens. */
export function pipeCount(note, spec) {
  return pipesOf(note, spec).length;
}

/**
 * Render notes into seconds of sound. Each note needs pitch, role, time, length
 * and velocity, as the organ's own prepared notes do; `gain` is what the organ
 * worked out for the piece. Notes are rendered without detuning, which lines the
 * pipes up more neatly than they ever are in a real instrument - so what comes
 * out is if anything louder than the organ will be.
 */
export function render(notes, options) {
  const spec = options.spec;
  const rate = options.sampleRate || 44100;
  const seconds = options.seconds;
  const out = new Float64Array(Math.round(seconds * rate));
  const horizon = out.length;

  for (const note of notes) {
    const when = note.time - (options.from || 0);
    const length = note.length;
    const base = options.gain * spec.struck(note.velocity);
    for (const pipe of pipesOf(note, spec)) {
      const first = Math.max(0, Math.floor(when * rate));
      const last = Math.min(horizon, Math.ceil((when + length + spec.envelope.release + 0.03) * rate));
      for (let i = first; i < last; i++) {
        const t = i / rate - when;
        const share = envelope(t, length, spec);
        if (share === 0) continue;
        let phase = (pipe.freq * t) % 1;
        if (phase < 0) phase += 1;
        out[i] += base * pipe.level * share * pipe.wave[Math.floor(phase * PERIOD)];
      }
    }
  }

  for (let i = 0; i < horizon; i++) out[i] *= spec.volume;
  return out;
}

export function peak(samples) {
  let top = 0;
  for (let i = 0; i < samples.length; i++) top = Math.max(top, Math.abs(samples[i]));
  return top;
}

/**
 * The loudest the whole piece really gets, chunk by chunk: a pipe rings on for a
 * tenth of a second after its key lets go, so one chord overlaps the next and
 * the top of a piece can be higher than any single chord in it. Renders a stretch
 * at a time, because a quarter of an hour of sound will not fit in memory.
 */
export function renderAcross(notes, options) {
  const chunk = options.chunk || 20;
  const rate = options.sampleRate || 44100;
  const spec = options.spec;
  let top = 0;
  let at = 0;
  for (let start = 0; start < options.seconds; start += chunk) {
    const here = notes
      .filter((note) => note.time < start + chunk && note.time + note.length + 0.3 > start)
      .map((note) => ({ ...note, time: note.time - start }));
    const samples = render(here, { spec, gain: options.gain, seconds: chunk + 0.3, sampleRate: rate });
    const reached = peak(samples);
    if (reached > top) {
      top = reached;
      at = start + peakIndexOf(samples) / rate;
    }
  }
  return { peak: top, at: at };
}

function peakIndexOf(samples) {
  let top = 0;
  let where = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > top) {
      top = Math.abs(samples[i]);
      where = i;
    }
  }
  return where;
}

export function rms(samples) {
  let sum = 0;
  let counted = 0;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] === 0) continue;
    sum += samples[i] * samples[i];
    counted++;
  }
  return counted ? Math.sqrt(sum / counted) : 0;
}

/**
 * How loud the piece actually is at the moments a player would be striking.
 * The whole piece is rendered once, a chunk at a time, and each moment keeps the
 * loudest sample within `half` seconds either side of it. `moments` in seconds,
 * in any order; hands back one peak per moment, in the order they were given.
 */
export function peaksAt(notes, moments, options) {
  const spec = options.spec;
  const rate = options.sampleRate || 16000;
  const chunk = options.chunk || 20;
  const half = options.half === undefined ? 0.12 : options.half;
  const out = moments.map(() => 0);
  for (let start = 0; start < options.seconds; start += chunk) {
    const shift = start - half;
    const stop = start + chunk + half;
    const here = moments
      .map((at, index) => ({ at: at, index: index }))
      .filter((one) => one.at >= start - half && one.at < start + chunk + half);
    if (here.length === 0) continue;
    const sounding = notes
      .filter((note) => note.time < stop && note.time + note.length + 0.3 > shift)
      .map((note) => ({ ...note, time: note.time - shift }));
    const samples = render(sounding, {
      spec: spec,
      gain: options.gain,
      seconds: chunk + 2 * half,
      sampleRate: rate,
    });
    for (const one of here) {
      const from = Math.max(0, Math.round((one.at - half - shift) * rate));
      const to = Math.min(samples.length, Math.round((one.at + half - shift) * rate));
      let top = 0;
      for (let i = from; i < to; i++) top = Math.max(top, Math.abs(samples[i]));
      out[one.index] = top;
    }
  }
  return out;
}

/** How much of the sound lies at a given frequency, by Goertzel's filter. */
export function energyAt(samples, freq, rate) {
  const k = (2 * Math.PI * freq) / rate;
  const coeff = 2 * Math.cos(k);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
  return Math.sqrt(Math.max(0, power)) / samples.length;
}

/**
 * The partials of a note: how much sounds at the fundamental and above it, as a
 * share of the loudest of them. A beep has one; an organ pipe has a dozen.
 */
export function partials(samples, freq, rate, upTo) {
  const found = [];
  let top = 0;
  for (let harmonic = 1; harmonic <= (upTo || 20); harmonic++) {
    const value = energyAt(samples, freq * harmonic, rate);
    found.push({ harmonic: harmonic, share: value });
    top = Math.max(top, value);
  }
  for (const one of found) one.relative = top > 0 ? one.share / top : 0;
  return found;
}

/**
 * The notes sounding at a moment. A note that lets go at exactly that moment has
 * stopped sounding - the hand-over to the next chord is one chord, not two -
 * which is the same rule the organ uses when it works out how loud it may be.
 */
export function soundingAt(notes, at) {
  const on = Math.round(at * 10000) / 10000;
  return notes.filter((note) => note.time <= on && Math.round((note.time + note.length) * 10000) / 10000 > on);
}

/**
 * Every partial a chord sounds, and how loud each one is: each pipe's harmonics,
 * at the level the engine will give them, after the master lowpass. Exact, since
 * the sound is a sum of sine waves by construction.
 */
export function partialsOfChord(notes, spec, gain) {
  const found = [];
  for (const note of notes) {
    const base = gain * spec.struck(note.velocity);
    for (const pipe of pipesOf(note, spec)) {
      const mix = spec.mixes[spec.ranks[pipe.rank].mix];
      const peak = wavePeak(mix);
      for (let harmonic = 1; harmonic <= mix.length; harmonic++) {
        const freq = pipe.freq * harmonic;
        found.push({ freq: freq, amp: (base * pipe.level * mix[harmonic - 1]) / peak * rolledOff(freq) });
      }
    }
  }
  return found;
}

/**
 * Where the sound lies, roughly: how much of it is in four bands, from the bottom
 * of the pedals to the fizz at the top.
 */
export function bandShares(partials) {
  const bands = [
    [40, 250],
    [250, 1000],
    [1000, 4000],
    [4000, 20000],
  ];
  const total = partials.reduce(function (sum, one) {
    return sum + one.amp * one.amp;
  }, 0);
  return bands.map(function (band) {
    let inBand = 0;
    for (const one of partials) {
      if (one.freq >= band[0] && one.freq < band[1]) inBand += one.amp * one.amp;
    }
    return { low: band[0], high: band[1], share: total > 0 ? inBand / total : 0 };
  });
}

/**
 * The heaviest moment of a piece: where the pipes sounding at once add up to
 * most. That moment is what the whole piece is played quietly enough for.
 */
export function heaviestMoment(notes, spec) {
  const marks = [];
  for (const note of notes) {
    const weight = spec.noteWeight(note, spec.registration);
    marks.push([note.time, weight, note]);
    marks.push([Math.round((note.time + note.length) * 10000) / 10000, -weight, note]);
  }
  marks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let peak = 0;
  let at = 0;
  for (const mark of marks) {
    now += mark[1];
    if (now > peak) {
      peak = now;
      at = mark[0];
    }
  }
  const sounding = soundingAt(notes, at);
  return { at: at, weight: peak, notes: sounding };
}

/** The rows of a data file, as the organ sees them, with a role from pieces.js. */
export function preparedNotes(data, roles) {
  const format = data.format;
  return data.notes
    .map((row) => ({
      voice: row[format.indexOf("voice")],
      pitch: row[format.indexOf("pitch")],
      time: row[format.indexOf("time")],
      length: row[format.indexOf("duration")],
      velocity: row[format.indexOf("velocity")],
      role: (roles && roles[String(row[format.indexOf("voice")])]) || "inner",
    }))
    .sort((a, b) => a.time - b.time || a.pitch - b.pitch);
}

export function rolesFor(piece) {
  const roles = {};
  for (const index in piece.voices) {
    if (Object.prototype.hasOwnProperty.call(piece.voices, index)) {
      roles[index] = piece.voices[index].role || "inner";
    }
  }
  return roles;
}

/**
 * The bell the player strikes when playing along, in the same plain numbers: the
 * bell's own mix, its own envelope, and the two strikes a few cents apart that
 * make the ring move. Like `render`, this lines the strikes up in phase with the
 * pipes, which a real bell never is - so what comes out is louder than the truth.
 * `touch`, when it is given, is the piece's own sizing of its bell (src/touch.js):
 * how loud it is there, and how long it hangs. The engine's own rules are used
 * rather than a copy of them, so a measurement cannot drift from the sound.
 */
export function renderChime(spec, pitch, options) {
  const settings = options || {};
  const rate = settings.sampleRate || 44100;
  const at = settings.at || 0;
  const touch = settings.touch || null;
  const level = spec.bellLevel(touch) * Math.min(spec.chime.heaviest, settings.weight || 1);
  const hangs = spec.bellDecay(touch);
  const wave = waveFor(spec.chime.mix);
  const out = new Float64Array(Math.round((at + hangs + 0.05) * rate));
  const from = Math.round(at * rate);
  for (const cents of [-3, 3]) {
    const freq = hz(pitch) * Math.pow(2, cents / 1200);
    for (let i = from; i < out.length; i++) {
      const t = i / rate - at;
      let share;
      if (t < spec.chime.attack) share = t / spec.chime.attack;
      else share = Math.pow(0.0001, (t - spec.chime.attack) / (hangs - spec.chime.attack));
      if (share <= 0) continue;
      let phase = (freq * t) % 1;
      if (phase < 0) phase += 1;
      out[i] += level * share * wave[Math.floor(phase * PERIOD)];
    }
  }
  for (let i = 0; i < out.length; i++) out[i] *= spec.volume;
  return out;
}

/** Two sounds laid on each other. */
export function together(first, second) {
  const out = new Float64Array(Math.max(first.length, second.length));
  for (let i = 0; i < out.length; i++) out[i] = (first[i] || 0) + (second[i] || 0);
  return out;
}
