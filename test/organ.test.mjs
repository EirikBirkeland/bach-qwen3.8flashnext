// The organ, checked by numbers. Nobody here can hear it, so every claim is a
// measurement instead: how high the loudest chord of each piece reaches, whether
// a note is a pile of partials rather than a beep, whether the line to follow
// stands out, whether a tutti is really louder than a solo. test/render.mjs is
// the model these measurements are made with - the same ranks and levels the page
// builds with Web Audio nodes.

import test from "node:test";
import assert from "node:assert";
import {
  loadPage,
  loadPieces,
  loadData,
  rolesFor,
  phraseFor,
  preparedNotes,
  heaviestMoment,
  bandSharesAcross,
  render,
  renderAcross,
  peak,
  rms,
  pipesOf,
  pipeCount,
  partials,
  partialsOfChord,
  bandShares,
  renderChime,
  together,
  hz,
  waveFor,
  soundingAt,
} from "./render.mjs";

const page = loadPage();
const spec = page.organSpec;
const pieces = loadPieces();
const RATE = 44100;

function prepared(piece) {
  const data = loadData(piece.slug);
  const roles = rolesFor(piece);
  const phrase = phraseFor(piece);
  return {
    data: data,
    notes: preparedNotes(data, roles, phrase),
    ready: page.createOrgan().prepare(data, roles, phrase),
  };
}

/** The full scale a chord would reach if every pipe peaked in the same instant. */
function worstCase(notes, gain) {
  return (
    notes.reduce((sum, note) => sum + spec.noteWeight(note, spec.registration), 0) * gain * spec.volume
  );
}

const loud = pieces.map((piece) => {
  const context = prepared(piece);
  const heaviest = heaviestMoment(context.notes, spec);
  const window = heaviest.notes.map((note) => ({ ...note, time: Math.max(0, note.time - heaviest.at) }));
  const samples = render(window, { spec, gain: context.ready.gain, seconds: 1.2 });
  const throughout = renderAcross(context.notes, {
    spec: spec,
    gain: context.ready.gain,
    seconds: context.data.duration,
    // Sixteen thousand instead of forty-four: the peak it finds is the same to a
    // hundredth and it takes a quarter of the doing.
    sampleRate: 16000,
  });
  // How big a bell this piece asks for when the player strikes along.
  const beats = page.beats(context.data);
  const touch = page.touch(context.notes, beats, page.beatGap(beats));
  return {
    piece: piece,
    context: context,
    heaviest: heaviest,
    samples: samples,
    throughout: throughout,
    touch: touch,
  };
});

test("the loudest chord of every piece stays under full scale", () => {
  const limiter = Math.pow(10, -3 / 20); // where the page's limiter starts to squeeze
  for (const one of loud) {
    const bound = worstCase(one.heaviest.notes, one.context.ready.gain);
    const reached = peak(one.samples);
    assert.ok(bound <= spec.ceiling * spec.volume + 1e-9, one.piece.slug + " is over the ceiling it set");
    assert.ok(bound < 1, one.piece.slug + " could reach full scale: " + bound.toFixed(3));
    // The bound is the whole truth about loudness: no pipe is ever louder than the
    // level it was given, so no moment can peak higher than the levels summed.
    assert.ok(
      bound < limiter,
      one.piece.slug + " could reach " + bound.toFixed(3) + ": the limiter would be working"
    );
    assert.ok(
      reached < 0.6,
      one.piece.slug + " renders a peak of " + reached.toFixed(3) + "; the room and the tremulant want headroom"
    );
    assert.ok(reached > 0.15, one.piece.slug + " renders only " + reached.toFixed(3) + ": that is a whisper");
    // The render and the plan have to agree: the chord may not go over the bound
    // the levels say, and it should not fall far under it either, or the piece is
    // being played at half loudness for no reason.
    assert.ok(
      reached > bound * 0.5,
      one.piece.slug + " reaches " + reached.toFixed(3) + " where the levels allow " + bound.toFixed(3) +
        ": the piece is being played far too quietly"
    );
  }
});

test("nothing in any piece, anywhere, reaches the limiter", () => {
  // The limiter in the page starts squeezing at -3 dB, a little under 0.71 of
  // full scale. Squeezing there would flatten the difference between a verse and
  // a tutti, so nothing may get there. This renders every second of every piece:
  // the widest chord is not always the loudest moment, because a pipe rings on
  // for a tenth of a second after its key lets go and chords run into each other.
  const limiter = Math.pow(10, -3 / 20);
  for (const one of loud) {
    assert.ok(
      one.throughout.peak < limiter,
      one.piece.slug + " peaks at " + one.throughout.peak.toFixed(3) + " of full scale, " + one.throughout.at.toFixed(1) +
        " s in: the limiter would be working"
    );
    assert.ok(
      one.throughout.peak > 0.15,
      one.piece.slug + " never gets above " + one.throughout.peak.toFixed(3) + ": that is a whisper"
    );
  }
});

test("the room and the tremulant still find headroom over the loudest moment", () => {
  // The convolver can add as much as it is sent (send 0.34 times wet 0.85), and
  // the tremulant lifts everything by a few per cent. Neither can make a chord
  // peak higher than this.
  const smear = 1 + 0.34 * 0.85;
  const tremulant = 1 + 0.045 + 0.03;
  for (const one of loud) {
    const worst = one.throughout.peak * smear * tremulant;
    assert.ok(
      worst < 1,
      one.piece.slug + " could reach " + worst.toFixed(3) + " of full scale once the room is counted"
    );
  }
});

test("a bell struck on the loudest moment of a piece still fits", () => {
  // Playing along rings a bell over whatever the organ is doing, so the bell has
  // to fit in the headroom the design already keeps. The worst case below is the
  // loudest chord of the piece with the heaviest bell anyone can ask for, both
  // strikes of it in phase with each other and with the pipes - which a struck
  // bell never is - and the room counted on top afterwards.
  const smear = 1 + 0.34 * 0.85;
  const tremulant = 1 + 0.045 + 0.03;
  const limiter = Math.pow(10, -3 / 20);
  for (const one of loud) {
    const bell = renderChime(spec, 60, { weight: spec.chime.heaviest, touch: one.touch });
    assert.ok(peak(bell) > 0.05, "a bell on its own is inaudible: " + peak(bell).toFixed(3));
    const struck = peak(together(one.samples, bell));
    assert.ok(
      struck < limiter,
      one.piece.slug + ": its loudest chord with a bell on it reaches " + struck.toFixed(3) + ", where the limiter starts at " + limiter.toFixed(3)
    );
    // ... and the worst case of all: the two of them topping out in the same
    // instant, however little chance a struck thing and a blowing one have of it.
    const both = peak(one.samples) + peak(bell);
    assert.ok(
      both < limiter,
      one.piece.slug + ": chord and bell topping out together would reach " + both.toFixed(3)
    );
    const worst = both * smear * tremulant;
    assert.ok(
      worst < 1,
      one.piece.slug + ": chord and bell could reach " + worst.toFixed(3) + " of full scale once the room is counted"
    );
  }
});

test("a bell is a struck thing, not a held one", () => {
  // It has to be gone again: a bell that rang on for five seconds would smear the
  // whole piece into noise, whatever its level. Every piece is asked with its own
  // bell, since src/touch.js gives each one a length of its own.
  for (const one of loud) {
    const bell = renderChime(spec, 60, { weight: 1, touch: one.touch });
    const first = peak(bell.slice(0, Math.round(0.25 * 44100)));
    const after = peak(bell.slice(Math.round((one.touch.decay - 0.05) * 44100)));
    assert.ok(first > 0, "nothing was struck");
    assert.ok(
      after < first * 0.01,
      one.piece.slug + ": its bell was still ringing at " + after.toFixed(4) + " against " + first.toFixed(3)
    );
    assert.ok(
      one.touch.decay < 2.2,
      one.piece.slug + ": a bell that rings for " + one.touch.decay + " s is a cymbal"
    );
  }
});

test("a chord is louder than one note, which is what dynamics mean", () => {
  for (const one of loud) {
    const gain = one.context.ready.gain;
    const solo = { pitch: 67, role: "melody", time: 0, length: 0.8, velocity: 0.7 };
    const alone = peak(render([solo], { spec: spec, gain: gain, seconds: 1 }));
    const together = peak(one.samples);
    const reached = together / alone;
    // Six decibels over a single note at least. It cannot be the full sum of the
    // notes: pipes at twelve different pitches do not reach the top together.
    assert.ok(
      reached > 2,
      one.piece.slug + ": " + one.heaviest.notes.length + " notes together reach only " + reached.toFixed(1) +
        " times one note - too little difference to hear"
    );
    // And the sound is not smashed flat: a chord has a shape to it.
    const crest = together / rms(one.samples);
    assert.ok(crest > 2, one.piece.slug + " peaks only " + crest.toFixed(1) + " times its average: no room to breathe");
  }
});

test("a piece is not played at one level all the way through", () => {
  for (const one of loud) {
    const notes = one.context.notes;
    const seconds = one.context.data.duration;
    let loudest = 0;
    let loudestAt = 0;
    let quietest = Infinity;
    let quietestAt = 0;
    for (let at = 0; at < seconds; at += 0.5) {
      const sounding = soundingAt(notes, at);
      if (sounding.length === 0) continue;
      const weight = sounding.reduce((sum, note) => sum + spec.noteWeight(note, spec.registration), 0);
      if (weight > loudest) {
        loudest = weight;
        loudestAt = at;
      }
      if (weight < quietest) {
        quietest = weight;
        quietestAt = at;
      }
    }
    const gain = one.context.ready.gain;
    const big = render(soundingAt(notes, loudestAt).map((n) => ({ ...n, time: 0 })), {
      spec: spec,
      gain: gain,
      seconds: 0.8,
    });
    const small = render(soundingAt(notes, quietestAt).map((n) => ({ ...n, time: 0 })), {
      spec: spec,
      gain: gain,
      seconds: 0.8,
    });
    const loudLevel = rms(big);
    const quietLevel = rms(small);
    assert.ok(
      quietest < loudest,
      one.piece.slug + " never thins out: its thinnest moment weighs as much as its fullest"
    );
    // A third over again, about four decibels, is heard. Two of these four
    // pieces give far more than that; BWV 639 has all three voices playing
    // almost all the way through, so its texture hardly thins at all and this is
    // as much as its own shape holds.
    assert.ok(
      loudLevel > quietLevel * 1.5,
      one.piece.slug + " sounds the same everywhere: " + loudLevel.toFixed(3) + " against " + quietLevel.toFixed(3)
    );
  }
});

test("the sound sits low, the way an organ in a room sits", () => {
  // Most of the energy of an organ in a room is in the pedals and the 8 foot
  // pipes, with the presence above that and hardly any fizz at the very top. If a
  // change ever makes this bright and thin, or dark and muddy, it shows up here.
  // It asks the middle of a chord every ten seconds, not one chord: how the stops
  // are drawn is a claim about a piece, and about the whole of a piece at that.
  for (const one of loud) {
    const bands = bandSharesAcross(one.context.notes, spec, one.context.ready.gain, 10);
    const said = bands.map((band) => (band.share * 100).toFixed(0) + "%").join(" / ");
    assert.ok(bands[0].share > 0.1, one.piece.slug + " has no body - " + said);
    assert.ok(
      bands[0].share + bands[1].share > 0.6,
      one.piece.slug + " is top-heavy: most of its sound is over a kilohertz - " + said
    );
    assert.ok(bands[3].share < 0.25, one.piece.slug + " is all fizz - " + said);
  }
});

test("no rank sounds below the note it breaks at", () => {
  // A mutation pipe (a twelfth, a seventeenth) under a low fundamental only
  // thickens the mud, so those ranks are broken out below a certain note, the
  // way a mixture is.
  for (const one of loud) {
    for (const note of one.context.notes) {
      for (const pipe of pipesOf(note, spec)) {
        const ratio = pipe.freq / hz(note.pitch);
        const whole = Math.abs(ratio - Math.round(ratio)) < 1e-6;
        if (whole) continue;
        const stop = spec.registration[note.role].stops.find(
          (candidate) => spec.ranks[candidate.rank] === spec.ranks[pipe.rank] && candidate.ratio === ratio
        );
        assert.ok(stop && stop.from !== undefined, "a " + pipe.name + " sounded on " + note.pitch + " unbroken");
        assert.ok(note.pitch >= stop.from, pipe.name + " sounded on " + note.pitch + ", below its break at " + stop.from);
      }
    }
  }
});

test("a note is a pile of partials, not a beep", () => {
  for (const role of ["melody", "inner", "pedal"]) {
    const pitch = role === "pedal" ? 48 : 60;
    const note = { pitch: pitch, role: role, time: 0, length: 0.6, velocity: 0.7 };
    const samples = render([note], { spec: spec, gain: 1, seconds: 0.9 });
    const found = partials(samples, hz(pitch), RATE, 16).filter((p) => p.relative > 0.01);
    assert.ok(found.length >= 8, "a " + role + " note has only " + found.length + " audible partials");
    // The loudest of them is low down: an organ pipe is led by its fundamental,
    // not by some shrill upper partial.
    const loudest = found.reduce((best, one) => (one.share > best.share ? one : best));
    assert.ok(loudest.harmonic <= 2, "a " + role + " note is led by harmonic " + loudest.harmonic);
    // ... and none of them is so loud that the rest disappear under it.
    const sorted = found.slice().sort((a, b) => b.share - a.share);
    const second = sorted[1] ? sorted[1].relative : 0;
    assert.ok(second > 0.05, "everything but the loudest partial is under a twentieth of it");
  }
});

test("two pipes on the same note never sound alike", () => {
  // Two ranks drawn on the same key at the same pitch would be one rank, so the
  // three 8 foot pipes of the melody - open, stopped, and a celeste - have to
  // sound differently from each other. Ranks an octave apart may share a mix:
  // that is what an octave rank is.
  for (const role in spec.registration) {
    if (!Object.prototype.hasOwnProperty.call(spec.registration, role)) continue;
    const stops = spec.registration[role].stops;
    for (const one of stops) {
      for (const other of stops) {
        if (one === other || one.ratio !== other.ratio) continue;
        assert.notStrictEqual(
          spec.ranks[one.rank].mix,
          spec.ranks[other.rank].mix,
          role + ": " + spec.ranks[one.rank].name + " and " + spec.ranks[other.rank].name +
            " sound on the same note with the same mix"
        );
      }
    }
  }

  const seen = {};
  for (const name in spec.ranks) {
    if (!Object.prototype.hasOwnProperty.call(spec.ranks, name)) continue;
    const mix = spec.mixes[spec.ranks[name].mix];
    seen[spec.ranks[name].mix] = spec.ranks[name].name;
    const wave = waveFor(mix);
    let top = 0;
    for (const value of wave) top = Math.max(top, Math.abs(value));
    assert.ok(Math.abs(top - 1) < 1e-9, spec.ranks[name].name + "'s wave is not normalised");
    assert.ok(mix.length >= 4, spec.ranks[name].name + " has too few harmonics to be a pipe");
  }
  assert.ok(Object.keys(seen).length >= 4, "the instrument has only " + Object.keys(seen).length + " different sounds");
});

test("the line to follow is drawn louder than an inner line", () => {
  function drawn(role, pitch) {
    return spec
      .pipesFor(spec.registration[role].stops, pitch)
      .reduce((sum, stop) => sum + stop.level, 0);
  }
  const high = 67;
  assert.ok(
    drawn("melody", high) > drawn("inner", high) * 1.2,
    "the melody is barely louder than an inner voice: " + drawn("melody", high) + " against " + drawn("inner", high)
  );
  assert.ok(drawn("pedal", 48) >= drawn("inner", high) * 0.8, "the pedals are drawn too quietly to carry a piece");
});

test("every rank drawn speaks once, and not twice", () => {
  const note = { pitch: 67, role: "melody", time: 0, length: 0.4, velocity: 0.7 };
  const drawn = spec.registration.melody.stops;
  assert.strictEqual(
    pipeCount(note, spec),
    drawn.length,
    "a melody note high enough for everything drew " + pipeCount(note, spec) + " pipes, not " + drawn.length
  );
  // A note under a rank's break loses that rank, and nothing else.
  const low = { pitch: 40, role: "melody", time: 0, length: 0.4, velocity: 0.7 };
  const lost = drawn.filter((stop) => stop.from !== undefined && 40 < stop.from).length;
  assert.strictEqual(pipeCount(low, spec), drawn.length - lost, "a low note did not lose exactly the ranks that break");
  // And the levels of a note add up to what the loudness plan thinks they do.
  const summed = pipesOf(note, spec).reduce((sum, pipe) => sum + pipe.level, 0);
  const breath = spec.registration.melody.breath * spec.struck(note.velocity);
  const planned = spec.noteWeight(note, spec.registration);
  assert.ok(
    Math.abs(summed + breath - planned) < 1e-12,
    "the pipes of a note add to " + summed + " plus " + breath + " of breath, the plan says " + planned
  );
});

test("the busiest moment does not open more pipes than a browser can keep up with", () => {
  for (const one of loud) {
    let pipes = 0;
    for (const note of one.heaviest.notes) pipes += pipeCount(note, spec);
    assert.ok(pipes >= one.heaviest.notes.length * 2, "a note still speaks through one pipe only");
    assert.ok(
      pipes <= 140,
      one.piece.slug + " opens " + pipes + " oscillators at once; that is asking too much of a frame"
    );
  }
});

test("the stops the page names are the ones the piece really sounds", () => {
  // The line on the screen has to be the registration, not a decoration: what is
  // drawn on the manuals, what is drawn on the pedals, and nothing that no note
  // of the piece is high enough to call.
  for (const piece of pieces) {
    const context = prepared(piece);
    const groups = context.ready.stops;
    const named = {};
    for (const group of groups) {
      assert.ok(["Manuals", "Pedals"].indexOf(group.line) >= 0, piece.slug + " names a group nobody plays: " + group.line);
      for (const name of group.stops) {
        assert.ok(!(name in named), piece.slug + " names " + name + " twice on the screen");
        named[name] = group.line;
      }
    }
    assert.strictEqual(named["Subbass 16′"], "Pedals", piece.slug + " put its big pipes on the manuals");
    assert.strictEqual(named["Principal 8′"], "Manuals", piece.slug + " put its principal on the pedals");

    // Every rank named must actually speak somewhere in the piece.
    const speaking = {};
    for (const note of context.notes) {
      for (const pipe of pipesOf(note, spec)) speaking[pipe.name] = true;
    }
    for (const name in named) {
      assert.ok(speaking[name], piece.slug + " names " + name + " on the screen, but no note ever plays it");
    }
    for (const name in speaking) {
      assert.ok(name in named, piece.slug + " plays a " + name + " the screen never mentions");
    }
  }
});

test("every voice of every piece is told what it is", () => {
  for (const piece of pieces) {
    const data = loadData(piece.slug);
    const roles = rolesFor(piece);
    let melody = 0;
    let pedal = 0;
    for (const voice of data.voices) {
      const role = roles[String(voice.index)];
      assert.ok(role, piece.slug + " voice " + voice.index + " has no role, so the organ cannot register it");
      assert.ok(
        ["melody", "inner", "pedal"].indexOf(role) >= 0,
        piece.slug + " voice " + voice.index + " has a role the organ does not know: " + role
      );
      if (role === "melody") melody++;
      if (role === "pedal") pedal++;
    }
    assert.strictEqual(melody, 1, piece.slug + " has " + melody + " lines to follow");
    assert.strictEqual(pedal, 1, piece.slug + " has " + pedal + " pedal lines");
  }
});
