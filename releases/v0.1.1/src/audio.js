// The organ. Sound is built here out of nothing but the browser's Web Audio:
// one or two oscillators per note, a stop-mix of harmonics, a little room, and
// a tremulant. Notes are handed over a moment before they are due, so the
// browser's own audio clock keeps the timing.
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

  // Notes are converted once from the data rows into objects, in time order.
  function toObjects(data) {
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
        };
      })
      .sort(function (a, b) {
        return a.time - b.time || a.pitch - b.pitch;
      });
  }

  // The most notes sounding at once anywhere in the piece. This sets how loud a
  // single pipe may be, so a full chord never clips.
  function busiestMoment(notes) {
    var marks = [];
    for (var i = 0; i < notes.length; i++) {
      marks.push([notes[i].time, 1]);
      marks.push([onTheGrid(notes[i].time + notes[i].length), -1]);
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
    return Math.max(1, peak);
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

  // A stop: the mix of harmonics one pipe speaks with. Slight random differences
  // between the mixes keep the sound from feeling like one big synthesiser.
  function makeWaves(ctx, count) {
    var waves = [];
    for (var w = 0; w < count; w++) {
      var real = [0];
      var imag = [0];
      for (var harmonic = 1; harmonic <= 8; harmonic++) {
        var voice = [1, 0.62, 0.36, 0.22, 0.12, 0.07, 0.04, 0.02][harmonic - 1];
        var jitter = 0.8 + Math.random() * 0.4;
        imag.push(voice * jitter);
        real.push(0);
      }
      waves.push(ctx.createPeriodicWave(real, imag));
    }
    return waves;
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
    var waves = [];
    var room = null;
    var playing = null; // the piece currently sounding, or null
    var startedAt = 0; // ctx time when playback began
    var offset = 0; // seconds into the piece when playback began
    var next = 0; // index of the next note to hand over
    var sounding = []; // pipes currently running, so they can be shut off

    function build() {
      if (ctx) return;
      var Context = window.AudioContext || window.webkitAudioContext;
      ctx = new Context();
      waves = makeWaves(ctx, 4);

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
      var tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 6200;
      tone.Q.value = 0.6;

      // The tremulant: a slow breath that moves the whole stop in and out.
      tremulant = ctx.createGain();
      tremulant.gain.value = 0.95;
      var breath = ctx.createOscillator();
      breath.frequency.value = 5.2;
      var breathDepth = ctx.createGain();
      breathDepth.gain.value = 0.045;
      breath.connect(breathDepth);
      breathDepth.connect(tremulant.gain);
      breath.start();

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

      tremulant.connect(tone);
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
     * How loud one note may be, so that the thickest chord in the piece still
     * fits. A note peaks at its level times about 1.3 (its second pipe), and a
     * wave is normalised to 1, so nine notes at 0.056 peak near 0.7 - and the
     * master volume puts that under the limiter, which only catches the odd
     * chord whose pipes line up in phase.
     */
    function noteLevel() {
      return 0.5 / Math.max(4, playing.busiest);
    }

    function pipe(pitch, when, length, level, wave) {
      var freq = frequency(pitch);
      var gain = ctx.createGain();

      var attack = 0.02 + Math.random() * 0.03;
      var release = 0.1;
      // Speak, settle a little, hold, then shut off. Every point is later than
      // the one before it, whatever the length of the note.
      var sagEnd = when + attack + Math.min(0.35, Math.max(0.05, length * 0.4));
      var gateEnd = Math.max(sagEnd, when + length);
      var releaseEnd = gateEnd + release;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(level, when + attack);
      gain.gain.linearRampToValueAtTime(level * 0.78, sagEnd);
      gain.gain.setValueAtTime(level * 0.78, gateEnd);
      gain.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

      var end = releaseEnd + 0.02;
      var pipes = [];

      var main = ctx.createOscillator();
      main.setPeriodicWave(wave);
      main.frequency.value = freq;
      main.detune.value = (Math.random() * 2 - 1) * 4;
      main.connect(gain);
      pipes.push(main);

      // A second, softer pipe a hair flat: the air around the note.
      var shadow = ctx.createOscillator();
      shadow.setPeriodicWave(waves[0]);
      shadow.frequency.value = freq;
      shadow.detune.value = -5 + (Math.random() * 2 - 1) * 3;
      var shadowLevel = ctx.createGain();
      shadowLevel.gain.value = 0.32;
      shadow.connect(shadowLevel);
      shadowLevel.connect(gain);
      pipes.push(shadow);

      for (var i = 0; i < pipes.length; i++) {
        pipes[i].start(when);
        pipes[i].stop(end);
      }
      gain.connect(tremulant);
      sounding.push({ gain: gain, pipes: pipes, endsAt: end });
    }

    /**
     * Hand one note to the pipes. `left` can be shorter than the note in the data,
     * for a note that was still held when playback was picked up again.
     */
    function speak(note, index, when, left) {
      var level = noteLevel() * (0.85 + 0.3 * note.velocity);
      var wave = waves[(note.pitch + index) % waves.length];
      pipe(note.pitch, when, left, level, wave);
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

    /** Quiet every pipe running, and keep the place in the piece we got to. */
    function quiet() {
      if (!ctx) return;
      var now = ctx.currentTime;
      for (var i = 0; i < sounding.length; i++) {
        try {
          sounding[i].gain.gain.cancelScheduledValues(now);
          sounding[i].gain.gain.setValueAtTime(Math.max(0.0001, sounding[i].gain.gain.value), now);
          sounding[i].gain.gain.linearRampToValueAtTime(0.0001, now + 0.07);
          for (var p = 0; p < sounding[i].pipes.length; p++) sounding[i].pipes[p].stop(now + 0.09);
        } catch (e) {
          /* a pipe already stopped is fine */
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

      prepare: function (data) {
        var notes = toObjects(data);
        return {
          notes: notes,
          busiest: busiestMoment(notes),
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
      isPlaying: function () {
        return playing !== null;
      },
    };
  }

  Bach.createOrgan = createOrgan;
})(window.Bach);
