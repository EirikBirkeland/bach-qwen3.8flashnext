// The organ. Sound is built here out of nothing but the browser's Web Audio:
// every note speaks through several pipes at once - a rank of the instrument -
// drawn the way an organist draws stops, with the breath of the pipe as the key
// opens, a little room, and a tremulant. Notes are handed over a moment before
// they are due, so the browser's own audio clock keeps the timing.
//
// Depends on nothing but window; see index.html for the load order.

window.Bach = window.Bach || {};

(function (Bach) {
  // How far ahead of the audio clock notes are queued. Long enough to be safe
  // when the browser is busy for a moment, short enough that pressing stop does
  // not leave a third of a second of music still waiting to be silenced.
  var LOOKAHEAD = 0.35;

  // How loud the whole organ is, before the limiter that guards the speakers.
  var VOLUME = 0.8;

  // How high the loudest chord of a piece is allowed to peak, in parts of full
  // scale. It is a worst-case figure: every pipe of every note of the chord
  // reaching its top in the same instant. Detuning, the breath, and the room
  // seen after it make the real peak lower than this.
  var CEILING = 0.7;

  // How a pipe speaks: it takes a moment to come up, settles back a little,
  // holds while the key is down, and stops when the key is let go.
  var ENVELOPE = {
    attack: 0.025, // seconds to full voice
    jitter: 0.02, // no key opens at exactly the same moment
    sagTo: 0.86, // the pipe settles to this share of its level
    release: 0.09, // the wind takes that long to die away
  };

  // How long the breath of a pipe lasts; how loud it is beside the note it
  // belongs to is part of the registration, and the pedals breathe harder.
  var BREATH_SECONDS = 0.16;

  // The smallest chord a piece is played as if. A piece that only ever has two
  // notes going is not played as if it were a tutti: its own loudest moment is
  // measured as at least this many notes, so a thin piece is not blown out of the
  // speakers just because nothing thick ever happens in it.
  var MIN_CHORD = 3;

  // The bell the player strikes when playing along. It is struck, not held, so it
  // has an envelope of its own, and it is deliberately small beside the pipes: the
  // heaviest chord of a piece is allowed to reach `ceiling`, and a bell landing on
  // top of it must not push that over full scale. What it sounds through is the
  // same room the pipes do.
  //
  // What is here is the plain bell. How big a bell a particular piece asks for is
  // src/touch.js's business: it hands a level and a length with every strike, and
  // `bellLevel` and `bellDecay` below are where one is preferred over these.
  var CHIME = {
    level: 0.07, // the whole bell, before the master volume and the two strikes
    heaviest: 1.5, // the most a struck-true, on a moment when the music moved, may make it
    attack: 0.006, // a struck thing is there at once
    decay: 1.2, // ... and gone to nothing about a second and a bit later
    mix: [1, 0.45, 0.24, 0.1, 0.05], // unison, octave, twelfth, and the thin notes above
  };

  // The harmonic content of the pipes, as far as the ear can tell them apart.
  // A large open flue puts most of its sound in the unison and the octave above
  // and loses the rest little by little; a stopped pipe is poor in the even
  // harmonics; a big pedal pipe is nearly all fundamental; a small pipe is
  // nearly a flute. Each set is normalised by the browser to peak at 1.
  var MIXES = {
    principal: [1, 0.5, 0.32, 0.2, 0.1, 0.06, 0.04, 0.03],
    stopped: [1, 0.12, 0.35, 0.06, 0.14, 0.03, 0.06, 0.02],
    celeste: [1, 0.34, 0.2, 0.1, 0.05, 0.02],
    octave: [1, 0.55, 0.4, 0.22, 0.12, 0.07, 0.04, 0.03],
    small: [1, 0.28, 0.14, 0.06, 0.02],
    wood: [1, 0.22, 0.1, 0.05, 0.02, 0.01],
  };

  // The ranks the instrument is built from. `cents` is how far apart two pipes
  // of the same rank are scaled, which is what keeps a chord from sounding like
  // one large synthesiser.
  var RANKS = {
    principal: { name: "Principal 8′", mix: "principal", cents: 4 },
    gedackt: { name: "Gedackt 8′", mix: "stopped", cents: 3 },
    celeste: { name: "Voix céleste 8′", mix: "celeste", cents: 3 },
    octava: { name: "Octava 4′", mix: "octave", cents: 4 },
    nassat: { name: "Nassat 2⅔′", mix: "small", cents: 3 },
    subbass: { name: "Subbass 16′", mix: "wood", cents: 2 },
    octavbass: { name: "Octavbass 8′", mix: "octave", cents: 3 },
    mixtur: { name: "Mixtur 4′", mix: "octave", cents: 7 },
  };

  // Which stops are drawn for each kind of line. A note adds up its own pipes,
  // so the line to follow (gold on screen) speaks about half as loud again as
  // an inner voice, and the pedals carry the bottom of the instrument.
  // `ratio` is the pipe's pitch beside the key: 2 is the octave above.
  // `from` breaks a rank out below that note, the way a mixture does, because a
  // mutation pipe under a low fundamental only thickens the mud.
  var REGISTRATION = {
    melody: {
      breath: 0.06,
      stops: [
        { rank: "principal", ratio: 1, level: 0.3 },
        { rank: "gedackt", ratio: 1, level: 0.13 },
        { rank: "celeste", ratio: 1, level: 0.11, detune: 7, from: 50 },
        { rank: "octava", ratio: 2, level: 0.13 },
        { rank: "nassat", ratio: 3, level: 0.05, from: 55 },
      ],
    },
    inner: {
      breath: 0.05,
      stops: [
        { rank: "principal", ratio: 1, level: 0.27 },
        { rank: "gedackt", ratio: 1, level: 0.11 },
        { rank: "celeste", ratio: 1, level: 0.09, detune: 7, from: 53 },
        { rank: "octava", ratio: 2, level: 0.09 },
      ],
    },
    pedal: {
      breath: 0.1,
      stops: [
        { rank: "subbass", ratio: 1, level: 0.36 },
        { rank: "octavbass", ratio: 2, level: 0.15 },
        { rank: "mixtur", ratio: 4, level: 0.04 },
      ],
    },
  };

  var WAVE_VARIANTS = 4;

  // Notes are converted once from the data rows into objects, in time order.
  // `roles` says which voice is which (see src/pieces.js); a voice nobody named
  // is an inner voice.
  function toObjects(data, roles) {
    var format = data.format;
    var iVoice = format.indexOf("voice");
    var iPitch = format.indexOf("pitch");
    var iTime = format.indexOf("time");
    var iLength = format.indexOf("duration");
    var iVelocity = format.indexOf("velocity");
    return data.notes
      .map(function (row) {
        return {
          voice: row[iVoice],
          pitch: row[iPitch],
          time: row[iTime],
          length: row[iLength],
          velocity: row[iVelocity],
          role: (roles && roles[String(row[iVoice])]) || "inner",
        };
      })
      .sort(function (a, b) {
        return a.time - b.time || a.pitch - b.pitch;
      });
  }

  // The most notes sounding at once anywhere in the piece.
  function widestChord(notes) {
    return Math.max(
      1,
      Math.round(
        sweep(notes, function () {
          return 1;
        })
      )
    );
  }

  /**
   * Walks the piece once, adding something for every note that starts and taking
   * it away again when that note ends, and keeps the highest running total it
   * met. `weightOf` says what a note is worth.
   */
  function sweep(notes, weightOf) {
    var marks = [];
    for (var i = 0; i < notes.length; i++) {
      var weight = weightOf(notes[i]);
      marks.push([notes[i].time, weight]);
      marks.push([onTheGrid(notes[i].time + notes[i].length), -weight]);
    }
    marks.sort(function (a, b) {
      return a[0] - b[0] || a[1] - b[1];
    });
    var now = 0;
    var peak = 0;
    for (var j = 0; j < marks.length; j++) {
      now += marks[j][1];
      if (now > peak) peak = now;
    }
    return peak;
  }

  // Note times come in rounded to four decimals, but adding a length can give a
  // fifth one, and then a note that ends at the very moment another starts looks
  // like it ends a hair later. That counts one note too many, so an end is put
  // back on the same grid as the starts - to four decimals a note that hands
  // over exactly is not sounding any more.
  function onTheGrid(seconds) {
    return Math.round(seconds * 10000) / 10000;
  }

  function frequency(pitch) {
    return 440 * Math.pow(2, (pitch - 69) / 12);
  }

  /**
   * One set of waves per rank, several voices each: the same stop, but no two
   * pipes of it sounding exactly alike.
   */
  function buildVoices(ctx) {
    var built = {};
    for (var name in RANKS) {
      if (!Object.prototype.hasOwnProperty.call(RANKS, name)) continue;
      var mix = MIXES[RANKS[name].mix];
      var waves = [];
      for (var v = 0; v < WAVE_VARIANTS; v++) {
        var real = [0];
        var imag = [0];
        for (var harmonic = 1; harmonic <= mix.length; harmonic++) {
          imag.push(mix[harmonic - 1] * (0.85 + Math.random() * 0.3));
          real.push(0);
        }
        waves.push(ctx.createPeriodicWave(real, imag));
      }
      built[name] = waves;
    }
    return built;
  }

  /**
   * One wave for the bell, made once: a struck thing is mostly unison and octave
   * with a twelfth over it, which is what makes it ring like metal and not like a
   * flute.
   */
  function makeBell(ctx) {
    var real = [0];
    var imag = [0];
    for (var harmonic = 1; harmonic <= CHIME.mix.length; harmonic++) {
      imag.push(CHIME.mix[harmonic - 1]);
      real.push(0);
    }
    return ctx.createPeriodicWave(real, imag);
  }

  /**
   * How loud a bell is in a piece, and how long it hangs there. `touch` comes from
   * src/touch.js and says both; a bell handed no touch is the plain one above.
   */
  function bellLevel(touch) {
    return touch && typeof touch.level === "number" && touch.level > 0 ? touch.level : CHIME.level;
  }

  function bellDecay(touch) {
    var hangs = touch && typeof touch.decay === "number" ? touch.decay : CHIME.decay;
    // A bell shorter than its own attack, or near enough, would be a click and not
    // a strike, so such a touch is left to ring the plain length.
    return hangs > CHIME.attack + 0.04 ? hangs : CHIME.decay;
  }

  /**
   * The stops drawn for a line of the music.
   */
  function stopsFor(registration, role) {
    return registration[role] || registration.inner;
  }

  /**
   * The pipes that actually speak for one note: the stops drawn for its line,
   * less any that break out below it.
   */
  function pipesFor(stops, pitch) {
    var speaking = [];
    for (var i = 0; i < stops.length; i++) {
      if (stops[i].from === undefined || pitch >= stops[i].from) speaking.push(stops[i]);
    }
    return speaking;
  }

  // These files carry no dynamics at all - every key was struck the same - so
  // velocity only nudges the level. The shaping of a piece is src/dynamics.js's
  // business, and it arrives on each note as its `shade`.
  function struck(velocity) {
    return 0.85 + 0.3 * velocity;
  }

  /** The shaping of one note: how loud it is played within its piece. */
  function shadeOf(note) {
    return note && typeof note.shade === "number" && note.shade > 0 ? note.shade : 1;
  }

  /**
   * What one note adds to the loudest moment: all the pipes that speak for it,
   * their breath, and how hard the key came down. Summed over a chord this is
   * how high that chord can peak, since every wave is normalised to 1.
   */
  function noteWeight(note, registration) {
    var drawn = stopsFor(registration, note.role);
    var stops = pipesFor(drawn.stops, note.pitch);
    var total = drawn.breath;
    for (var i = 0; i < stops.length; i++) total += stops[i].level;
    return total * struck(note.velocity) * shadeOf(note);
  }

  /**
   * The heaviest chord of a piece: the sum of the pipes sounding at once,
   * at the moment where there are most of them. This is what sets how loud one
   * pipe may be, so that nothing in the piece can distort.
   */
  function heaviestChord(notes, registration) {
    return sweep(notes, function (note) {
      return noteWeight(note, registration);
    });
  }

  /**
   * The breath of a pipe as the key opens: wind against the lip for a moment
   * before the note stands up. Its shape is baked into one short buffer, so a
   * note needs no more than a source and a level to breathe.
   */
  function makeBreath(ctx) {
    var length = Math.floor(ctx.sampleRate * BREATH_SECONDS);
    var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    var samples = buffer.getChannelData(0);
    var smooth = 0;
    for (var i = 0; i < length; i++) {
      var second = i / ctx.sampleRate;
      // Roughly one octave of hiss, quickly dying: a pipe speaks, it does not hiss.
      smooth = smooth * 0.5 + (Math.random() * 2 - 1) * 0.5;
      var shape = Math.min(1, second / 0.004) * Math.exp(-second / 0.028);
      samples[i] = smooth * shape;
    }
    return buffer;
  }

  // The two groups of stops a player would name: what is drawn on the manuals,
  // and what on the pedals.
  var STOP_GROUPS = [
    { line: "Manuals", roles: ["melody", "inner"] },
    { line: "Pedals", roles: ["pedal"] },
  ];

  /**
   * The stops this piece will actually sound, in those two groups: everything
   * drawn for a line the piece has, less any rank broken out above the whole
   * piece, since no note there is high enough to call it. So the page can say
   * what the organ is doing.
   */
  function stopsDrawn(notes) {
    var highest = 0;
    var lines = {};
    for (var i = 0; i < notes.length; i++) {
      if (notes[i].pitch > highest) highest = notes[i].pitch;
      lines[notes[i].role] = true;
    }
    var groups = [];
    for (var g = 0; g < STOP_GROUPS.length; g++) {
      var group = STOP_GROUPS[g];
      var drawn = [];
      for (var r = 0; r < group.roles.length; r++) {
        var role = group.roles[r];
        if (!lines[role]) continue;
        var stops = stopsFor(REGISTRATION, role).stops;
        for (var s = 0; s < stops.length; s++) {
          if (stops[s].from !== undefined && highest < stops[s].from) continue;
          var name = RANKS[stops[s].rank].name;
          if (drawn.indexOf(name) < 0) drawn.push(name);
        }
      }
      if (drawn.length > 0) groups.push({ line: group.line, stops: drawn });
    }
    return groups;
  }

  // A short impulse response of a stone room: noise that dies away, a few early
  // reflections in front of it. Two seconds of it is enough for a church.
  function makeRoom(ctx, seconds) {
    var length = Math.floor(ctx.sampleRate * seconds);
    var buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (var channel = 0; channel < 2; channel++) {
      var samples = buffer.getChannelData(channel);
      for (var i = 0; i < length; i++) {
        var position = i / length;
        samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - position, 2.6);
      }
      samples[Math.floor(ctx.sampleRate * 0.021)] += 0.6;
      samples[Math.floor(ctx.sampleRate * 0.037)] -= 0.4;
      samples[Math.floor(ctx.sampleRate * 0.053)] += 0.3;
    }
    return buffer;
  }

  function createOrgan() {
    var ctx = null;
    var master = null;
    var tremulant = null;
    var voices = {}; // the waves of each rank, made once
    var bell = null; // the wave of the bell the player strikes, made once
    var wind = null; // the breath of a pipe, as a short buffer
    var windFilter = null; // ... and the one band it is heard through
    var room = null;
    var tone = null; // the master lowpass, which the bells go through as well
    var playing = null; // the piece currently sounding, or null
    var startedAt = 0; // ctx time when playback began
    var offset = 0; // seconds into the piece when playback began
    var next = 0; // index of the next note to hand over
    var sounding = []; // everything running, so it can be shut off

    function build() {
      if (ctx) return;
      var Context = window.AudioContext || window.webkitAudioContext;
      ctx = new Context();
      voices = buildVoices(ctx);
      bell = makeBell(ctx);
      wind = makeBreath(ctx);

      master = ctx.createGain();
      master.gain.value = VOLUME;

      var limiter = ctx.createDynamicsCompressor();
      // Only there to catch the rare chord whose pipes all line up in phase,
      // so it sits well above the level a full chord normally reaches: squeezing
      // here would flatten the difference between a soft verse and a tutti.
      limiter.threshold.value = -3;
      limiter.knee.value = 4;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;

      // Keep the very top off: an organ in a room never has all its fizz.
      tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 6200;
      tone.Q.value = 0.6;

      // The tremulant: a slow breath that moves the whole stop in and out.
      tremulant = ctx.createGain();
      tremulant.gain.value = 0.95;
      var waver = ctx.createOscillator();
      waver.frequency.value = 5.2;
      var breathDepth = ctx.createGain();
      breathDepth.gain.value = 0.045;
      waver.connect(breathDepth);
      breathDepth.connect(tremulant.gain);
      waver.start();

      var slowAir = ctx.createOscillator();
      slowAir.frequency.value = 0.19;
      var slowAirDepth = ctx.createGain();
      slowAirDepth.gain.value = 0.03;
      slowAir.connect(slowAirDepth);
      slowAirDepth.connect(tremulant.gain);
      slowAir.start();

      var dry = ctx.createGain();
      dry.gain.value = 1;
      var send = ctx.createGain();
      send.gain.value = 0.34;
      var wet = ctx.createGain();
      wet.gain.value = 0.85;
      room = ctx.createConvolver();
      room.buffer = makeRoom(ctx, 2.2);

      // All the pipes breathe through the one band: the wind of a wind chest is
      // one sound, not one per pipe.
      windFilter = ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.value = 1600;
      windFilter.Q.value = 0.7;

      tremulant.connect(tone);
      windFilter.connect(tremulant);
      tone.connect(dry);
      tone.connect(send);
      send.connect(room);
      room.connect(wet);
      wet.connect(master);
      dry.connect(master);
      master.connect(limiter);
      limiter.connect(ctx.destination);
    }

    /**
     * The shape of one pipe's voice: come up, settle back a little, hold while
     * the key is down, shut off after it. Every time handed back is later than
     * the one before it, whatever the length of the note.
     */
    function envelope(when, length) {
      var attack = ENVELOPE.attack + Math.random() * ENVELOPE.jitter;
      var attackEnd = when + attack;
      // The settle takes two fifths of the note, never under a twentieth of a
      // second nor over a third of one.
      var sagEnd = attackEnd + Math.min(0.35, Math.max(0.05, length * 0.4));
      var gateEnd = Math.max(sagEnd, when + length);
      var releaseEnd = gateEnd + ENVELOPE.release;
      return {
        attackEnd: attackEnd,
        sagEnd: sagEnd,
        gateEnd: gateEnd,
        releaseEnd: releaseEnd,
        end: releaseEnd + 0.02,
      };
    }

    /**
     * One pipe of one rank, speaking for `length` seconds. `level` is its share
     * of the note and is never gone beyond, which is what makes the loudest
     * moment of a piece predictable; the pipes are never louder than the plan
     * says, only ever a little quieter.
     */
    function pipe(freq, when, length, level, wave, cents) {
      var gain = ctx.createGain();
      var shape = envelope(when, length);
      var sustain = level * (0.9 + Math.random() * 0.1) * ENVELOPE.sagTo;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(level, shape.attackEnd);
      gain.gain.linearRampToValueAtTime(sustain, shape.sagEnd);
      gain.gain.setValueAtTime(sustain, shape.gateEnd);
      gain.gain.exponentialRampToValueAtTime(0.0001, shape.releaseEnd);

      var oscillator = ctx.createOscillator();
      oscillator.setPeriodicWave(wave);
      oscillator.frequency.value = freq;
      oscillator.detune.value = cents;
      oscillator.connect(gain);
      oscillator.start(when);
      oscillator.stop(shape.end);

      gain.connect(tremulant);
      sounding.push({ gain: gain, pipes: [oscillator], endsAt: shape.end });
    }

    /**
     * The breath of one key: wind against the lip, then nothing. It is started
     * with the note and needs no envelope of its own, the shape is in the buffer.
     */
    function breath(when, level) {
      var gain = ctx.createGain();
      gain.gain.value = level;
      var source = ctx.createBufferSource();
      source.buffer = wind;
      source.playbackRate.value = 0.85 + Math.random() * 0.5;
      source.connect(gain);
      gain.connect(windFilter);
      source.start(when);
      source.stop(when + BREATH_SECONDS);
      sounding.push({ gain: gain, air: source, endsAt: when + BREATH_SECONDS + 0.02 });
    }

    /**
     * Hand one note to the instrument: every stop drawn for its line gets a
     * pipe, and the key breathes as it opens. `left` can be shorter than the
     * note in the data, for a note that was still held when playback was picked
     * up again.
     */
    function speak(note, index, when, left) {
      var drawn = stopsFor(playing.registration, note.role);
      var base = playing.gain * struck(note.velocity) * shadeOf(note);
      var stops = pipesFor(drawn.stops, note.pitch);
      for (var i = 0; i < stops.length; i++) {
        var stop = stops[i];
        var rank = RANKS[stop.rank];
        pipe(
          frequency(note.pitch) * stop.ratio,
          when,
          left,
          base * stop.level,
          voices[stop.rank][(index + i) % voices[stop.rank].length],
          (stop.detune || 0) + (Math.random() * 2 - 1) * rank.cents
        );
      }
      breath(when, base * drawn.breath);
    }

    /**
     * Strike the bell: one note, at once, ringing away. `weight` is how hard it
     * was struck, from the game: 1 for a beat caught, more for one that the music
     * itself was marking. `touch` is the piece's own sizing of its bell - how loud,
     * and how long it hangs - which src/touch.js works out of the music. It goes
     * past the tremulant - a bell is not a pipe - but through the same lowpass and
     * the same room, so it sits in the same building as the organ. With no time
     * given it rings now, which is what the player means.
     */
    function chime(pitch, when, weight, touch) {
      if (!ctx) return;
      var at = typeof when === "number" ? when : ctx.currentTime;
      var level = bellLevel(touch) * Math.min(CHIME.heaviest, Math.max(0.2, weight || 1));
      var hangs = bellDecay(touch);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.linearRampToValueAtTime(level, at + CHIME.attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + hangs);

      // Two strikes a few cents apart, so the ring moves instead of humming.
      var pipes = [];
      for (var i = 0; i < 2; i++) {
        var oscillator = ctx.createOscillator();
        oscillator.setPeriodicWave(bell);
        oscillator.frequency.value = frequency(pitch);
        oscillator.detune.value = i === 0 ? -3 : 3;
        oscillator.connect(gain);
        oscillator.start(at);
        oscillator.stop(at + hangs + 0.02);
        pipes.push(oscillator);
      }

      gain.connect(tone);
      sounding.push({ gain: gain, pipes: pipes, endsAt: at + hangs + 0.03 });
    }

    function pump() {
      if (!playing) return;
      var now = time();
      while (next < playing.notes.length && playing.notes[next].time < now + LOOKAHEAD) {
        var note = playing.notes[next];
        var when = startedAt + (note.time - offset);
        var jitter = Math.random() * 0.005;
        speak(note, next, when + jitter, note.length);
        next++;
      }
      var cutoff = ctx.currentTime;
      sounding = sounding.filter(function (item) {
        if (item.endsAt > cutoff) return true;
        try {
          item.gain.disconnect();
        } catch (e) {
          /* already gone */
        }
        return false;
      });
    }

    function time() {
      if (!playing) return offset;
      return Math.max(0, ctx.currentTime - startedAt + offset);
    }

    /** Quiet every pipe and every breath running, and keep the place in the piece
     *  we got to. */
    function quiet() {
      if (!ctx) return;
      var now = ctx.currentTime;
      for (var i = 0; i < sounding.length; i++) {
        var item = sounding[i];
        try {
          if (item.air) {
            item.air.stop(now + 0.09);
          } else {
            item.gain.gain.cancelScheduledValues(now);
            item.gain.gain.setValueAtTime(Math.max(0.0001, item.gain.gain.value), now);
            item.gain.gain.linearRampToValueAtTime(0.0001, now + 0.07);
            for (var p = 0; p < item.pipes.length; p++) item.pipes[p].stop(now + 0.09);
          }
        } catch (e) {
          /* a pipe already stopped is fine */
        }
        try {
          item.gain.disconnect();
        } catch (e) {
          /* already gone */
        }
      }
      sounding = [];
      offset = time();
      playing = null;
    }

    return {
      /** Must be called from a click: browsers keep audio asleep until then. */
      open: function () {
        build();
        if (ctx.state === "suspended") ctx.resume();
        return ctx;
      },

      /**
       * Read a piece of note data over: put the notes in order, work out which
       * stops each line draws (`roles`), how each of its notes is played
       * (`src/dynamics.js`, which needs to know how many bars make a phrase there),
       * and how loud one pipe may be so that the heaviest chord in the whole piece
       * still fits.
       */
      prepare: function (data, roles, phrase) {
        var notes = toObjects(data, roles);
        var shades = Bach.dynamics
          ? Bach.dynamics(notes, { bars: data.bars, duration: data.duration, phrase: phrase })
          : null;
        for (var i = 0; i < notes.length; i++) notes[i].shade = shades ? shades[i] : 1;
        var heaviest = heaviestChord(notes, REGISTRATION);
        return {
          notes: notes,
          busiest: widestChord(notes),
          registration: REGISTRATION,
          stops: stopsDrawn(notes),
          // A piece with only a couple of notes at a time is not played as if it
          // were a tutti, so the weight is never taken under MIN_CHORD.
          gain: CEILING / Math.max(MIN_CHORD, heaviest),
          duration: data.duration,
        };
      },

      /**
       * Start the prepared piece from a point in seconds. Anything still sounding
       * is quieted first, and a note that is still held at that point is taken up
       * again for whatever is left of it, so the harmony is whole right away.
       */
      play: function (piece, from) {
        quiet();
        playing = piece;
        offset = from || 0;
        startedAt = ctx.currentTime + 0.06;
        next = 0;
        while (next < piece.notes.length && piece.notes[next].time < offset) {
          var held = piece.notes[next];
          var ends = onTheGrid(held.time + held.length);
          if (ends > offset) speak(held, next, startedAt, ends - offset);
          next++;
        }
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(VOLUME, ctx.currentTime);
      },

      /**
       * Stop the sound. Where in the piece you are stays where you got to, unless
       * `at` says otherwise; that place is handed back, in seconds.
       */
      stop: function (at) {
        quiet();
        if (typeof at === "number") offset = Math.max(0, at);
        return offset;
      },

      time: time,
      pump: pump,
      chime: chime,
      isPlaying: function () {
        return playing !== null;
      },
    };
  }

  Bach.createOrgan = createOrgan;
  // What the instrument is built from, for the tools and the tests that measure
  // it: the ranks, what is drawn for each line, how loud it is all allowed to be,
  // and the rules that go with them, so that a measurement uses the engine's own
  // numbers and not a copy of them. Changing these changes the sound; the numbers
  // are checked in test/organ.test.mjs.
  Bach.organSpec = {
    ranks: RANKS,
    mixes: MIXES,
    registration: REGISTRATION,
    stopGroups: STOP_GROUPS,
    ceiling: CEILING,
    minChord: MIN_CHORD,
    volume: VOLUME,
    envelope: ENVELOPE,
    breathSeconds: BREATH_SECONDS,
    chime: CHIME,
    bellLevel: bellLevel,
    bellDecay: bellDecay,
    stopsFor: stopsFor,
    pipesFor: pipesFor,
    struck: struck,
    shadeOf: shadeOf,
    noteWeight: noteWeight,
    heaviestChord: heaviestChord,
    stopsDrawn: stopsDrawn,
  };
})(window.Bach);
