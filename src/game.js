// Playing along: strike the pulse of the piece, and the room rings.
//
// The player's whole job is to be there when the beat arrives - click anywhere on
// the picture, or press Enter. Every beat of the piece is a chance and the player
// takes the ones they like; nothing fails and nothing stops, because the organ
// plays every note either way. "Just watch" is this same thing switched off.
//
// What a catch does: a bell rings, and its note is the lowest note *sounding* at
// that moment, two octaves up. So whatever the player strikes is a note of the
// harmony that is actually being played - the taps shimmer over the organ and
// pick out the chords, which is the whole reason for doing it.
//
// What is worth more: a beat the music itself is marking - the tune coming back,
// a line taken up again after ten seconds gone, a chord of five struck together.
// Those beats are gold on the ladder and ring louder.
//
// What is scored: a run, which is beats caught one after another. A beat that
// passes untouched ends it, and so does a click with no beat near it, which is
// what stops drumming on the mouse.
//
// What is drawn: one thing, low in the middle of the screen. A ladder of short
// bars falls onto a catch line; the next couple of beats only, however fast the
// piece is, because the ladder's pace comes from the piece's own beat. A caught
// beat is gone from the ladder and lights the line; a longer run makes it wider
// and brighter. Everything else on the screen belongs to the piece's own picture.

window.Bach = window.Bach || {};

(function (Bach) {
  var TRUE = 0.11; // within this of a beat and it was struck true
  var NEAR = 0.3; // within this it still counts as caught
  var BRIGHT = 1.3; // how much harder a bell rings on a beat the music was marking
  var TRUEST = 1.15; // ... and on one struck right on the money, which together with
  // BRIGHT comes to the loudest bell the organ allows: see Bach.organSpec.chime

  var LADDER = 190; // how tall the ladder of beats is, in pixels
  var AHEAD = 2.2; // ... and how many beats' worth of them are shown
  var ABOVE = 96; // the catch line sits this far above the bottom of the screen
  var BEAM = 190; // how wide a beat is drawn, at its widest
  var FADE = 0.9; // seconds the light of a caught beat lasts

  var GOLD = "#ffd47a"; // a beat the music was marking
  var COOL = "#bcd0f0"; // an ordinary one

  /**
   * The bell's note for a beat: two octaves above the lowest note sounding, kept
   * in the register where a bell rings rather than rumbles.
   */
  function bellPitch(pitch) {
    var up = pitch + 24;
    while (up > 91) up -= 12;
    while (up < 60) up += 12;
    return up;
  }

  function createGame(canvas, organ) {
    var ctx = canvas.getContext("2d");
    var beats = [];
    var gap = 1; // how long a beat usually is, in this piece
    var speed = LADDER / AHEAD; // pixels a second of music takes down the ladder
    var look = LADDER / speed; // seconds of music the ladder shows

    var on = false;
    var pointer = 0; // the earliest beat a strike can still be judged against
    var lastNow = -1;
    var chain = 0;
    var best = 0;
    var caught = 0;
    var truest = 0; // ... and how many of those were struck right on the second
    var strikes = 0;
    var lit = []; // the light laid by recent strikes: { at, kind }

    /**
     * The piece being played. The notes are the organ's own, in time order, and
     * the data is the file's, for its bar lines and its metre.
     */
    function open(notes, data) {
      beats = Bach.beats(data);
      gap = Bach.beatGap(beats);
      speed = LADDER / (AHEAD * gap);
      look = AHEAD * gap;
      markTheLandmarks(Bach.landmarks(notes, { bars: data.bars }));
      pitchEveryBeat(notes);
      close();
    }

    /** Which beats the music itself is marking, and so which are gold. */
    function markTheLandmarks(landmarks) {
      if (landmarks.length === 0) return;
      var within = Math.min(0.2, gap / 3);
      var at = 0;
      for (var i = 0; i < beats.length; i++) {
        while (at < landmarks.length && landmarks[at].time < beats[i].time - within) at++;
        if (at < landmarks.length && Math.abs(landmarks[at].time - beats[i].time) <= within) {
          beats[i].bright = landmarks[at].kind;
        }
      }
    }

    /**
     * What note each beat will ring: the lowest note sounding then, two octaves
     * up. Where nothing sounds, the next note to come.
     */
    function pitchEveryBeat(notes) {
      var live = [];
      var next = 0;
      for (var i = 0; i < beats.length; i++) {
        var at = beats[i].time;
        while (next < notes.length && notes[next].time <= at) {
          live.push(notes[next]);
          next++;
        }
        var kept = [];
        var low = null;
        for (var l = 0; l < live.length; l++) {
          var note = live[l];
          if (note.time + note.length <= at) continue;
          kept.push(note);
          if (low === null || note.pitch < low.pitch) low = note;
        }
        live = kept;
        if (low === null) low = next < notes.length ? notes[next] : notes[notes.length - 1];
        beats[i].pitch = low === undefined ? 60 : bellPitch(low.pitch);
      }
    }

    /** Start the run again, and stand where the music is now. */
    function close() {
      chain = 0;
      best = 0;
      caught = 0;
      truest = 0;
      strikes = 0;
      lit = [];
      pointer = 0;
      lastNow = -1;
    }

    /** The first beat that could still be struck, after a jump or a start. */
    function retarget(now) {
      while (pointer < beats.length && beats[pointer].time + NEAR < now) pointer++;
    }

    function enabled() {
      return on;
    }

    /** Switch between playing along and just watching. Either way the piece goes on. */
    function enable(what) {
      if (on === what) return on;
      on = what;
      close(); // a fresh start, whichever way it is going
      return on;
    }

    function toggle() {
      return enable(!on);
    }

    /**
     * The player struck something at this second in the piece. Hands back what it
     * counted for - "true", "near", "stray" - or nothing at all when the game is
     * off and nobody is asked to do anything.
     */
    function hit(now) {
      if (!on || beats.length === 0) return null;
      if (lastNow < 0) retarget(now);
      strikes++;

      var pick = null;
      var off = 0;
      for (var i = pointer; i < beats.length; i++) {
        var beat = beats[i];
        if (beat.time - now > NEAR) break;
        if (beat.taken) continue;
        var by = now - beat.time;
        if (Math.abs(by) > NEAR) continue;
        if (pick === null || Math.abs(by) < Math.abs(off)) {
          pick = beat;
          off = by;
        }
      }

      if (pick === null) {
        chain = 0;
        lit.push({ at: now, kind: "stray" });
        return { kind: "stray" };
      }

      pick.taken = true;
      caught++;
      chain++;
      if (chain > best) best = chain;
      var struckTrue = Math.abs(off) <= TRUE;
      if (struckTrue) truest++;
      var weight = (pick.bright ? BRIGHT : 1) * (struckTrue ? TRUEST : 0.85);
      organ.chime(pick.pitch, null, weight);
      lit.push({ at: now, kind: pick.bright ? "gold" : "cool", truest: struckTrue });
      return { kind: struckTrue ? "true" : "near", bright: pick.bright || null, off: off };
    }

    function numbers() {
      return {
        chain: chain,
        best: best,
        caught: caught,
        truest: truest,
        strikes: strikes,
        beats: beats.length,
        enabled: on,
      };
    }

    /** The short line of words by the clock, or nothing while nobody is playing. */
    function line() {
      if (!on || beats.length === 0) return "";
      return chain + " in a row · best " + best + " · " + caught + " of " + beats.length;
    }

    /** The sentence for when the piece is over, or nothing if nothing was played. */
    function summary() {
      if (caught === 0) return "";
      var said = "You were there for " + caught + " of " + beats.length + " beats · longest run " + best;
      if (truest > 0) said += " · " + truest + " of them struck true";
      return said + ".";
    }

    /** A round glow, as every look draws one: only the part on the screen is asked for. */
    function bloom(x, y, size, colour, strength) {
      if (size <= 0 || strength <= 0.01) return;
      var width = Math.max(320, window.innerWidth || 320);
      var height = Math.max(240, window.innerHeight || 240);
      var glow = ctx.createRadialGradient(x, y, 0, x, y, size);
      glow.addColorStop(0, colour);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = strength;
      ctx.fillStyle = glow;
      var left = Math.max(0, x - size);
      var top = Math.max(0, y - size);
      ctx.fillRect(
        left,
        top,
        Math.min(width, x + size) - left,
        Math.min(height, y + size) - top
      );
    }

    /**
     * One frame of the ladder. `now` is where the piece is, in seconds; while the
     * piece is rested it does not move, so nothing here moves either.
     */
    function frame(now) {
      var jumped = lastNow < 0 || now < lastNow - 0.001 || now - lastNow > 0.5;
      lastNow = now;
      if (!on || beats.length === 0) return;

      if (jumped) {
        retarget(now); // moved somewhere else: no run is broken by a jump
      } else {
        while (pointer < beats.length && beats[pointer].time + NEAR < now) {
          if (!beats[pointer].taken) chain = 0; // letting a beat go ends the run
          pointer++;
        }
      }

      lit = lit.filter(function (one) {
        return now - one.at < FADE;
      });
      draw(now);
    }

    function draw(now) {
      var width = Math.max(320, window.innerWidth || 320);
      var height = Math.max(240, window.innerHeight || 240);
      var middle = Math.round(width / 2);
      var sound = height - ABOVE; // where a caught beat lands
      var run = Math.min(1, chain / 16);
      var half = BEAM / 2;

      ctx.globalCompositeOperation = "lighter";

      // The run, as light: a glow behind the line of sound that a longer run makes
      // fuller, and the line itself wider.
      bloom(middle, sound, 70 + 130 * run, "#5f7fb8", 0.03 + 0.07 * run);
      var reach = half + 60 * run;
      ctx.globalAlpha = 0.08 + 0.14 * run;
      ctx.fillStyle = run > 0.02 ? GOLD : COOL;
      ctx.fillRect(middle - reach, sound - 1, reach * 2, 2);

      // The beats still to come: the next couple of them, no matter how fast the
      // piece is, arriving on the line from above.
      for (var i = pointer; i < beats.length; i++) {
        var beat = beats[i];
        var away = beat.time - now;
        if (away > look) break;
        if (beat.taken) continue;
        var y = Math.round(sound - away * speed);
        var near = 1 - away / look; // 0 when it is far above, 1 when it is due
        var wide = half * (0.55 + 0.45 * near);
        ctx.globalAlpha = 0.06 + 0.3 * near;
        ctx.fillStyle = beat.bright ? GOLD : COOL;
        ctx.fillRect(middle - wide, y - (beat.bar ? 1 : 0.5), wide * 2, beat.bar ? 2 : 1);
      }

      // The strikes: light laid on the line, and fading.
      for (var s = 0; s < lit.length; s++) {
        var one = lit[s];
        var aged = (now - one.at) / FADE;
        var faded = Math.max(0, 1 - aged);
        if (one.kind === "stray") {
          ctx.globalAlpha = 0.06 * faded;
          ctx.fillStyle = COOL;
          ctx.fillRect(middle - half - 26, sound - 1, 18, 2);
          ctx.fillRect(middle + half + 8, sound - 1, 18, 2);
          continue;
        }
        var size = (one.truest ? 90 : 55) + 150 * faded * faded;
        bloom(middle, sound, size, one.kind === "gold" ? GOLD : "#dfe9ff", (one.truest ? 0.3 : 0.18) * faded);
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    return {
      open: open,
      enable: enable,
      toggle: toggle,
      enabled: enabled,
      hit: hit,
      frame: frame,
      line: line,
      summary: summary,
      numbers: numbers,
      beats: function () {
        return beats;
      },
      // Where the ladder is drawn, so a test can ask whether a beat is where it
      // should be. A picture that cannot say where a thing is drawn cannot say
      // it was drawn.
      place: function (beat, now) {
        var height = Math.max(240, window.innerHeight || 240);
        return { x: Math.round(Math.max(320, window.innerWidth || 320) / 2), y: Math.round(height - ABOVE - (beat.time - now) * speed) };
      },
      pace: function () {
        return { speed: speed, look: look, gap: gap };
      },
      bell: bellPitch,
    };
  }

  Bach.createGame = createGame;
})(window.Bach);
