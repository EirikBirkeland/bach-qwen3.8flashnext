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
// pick out the chords, which is the whole reason for doing it. How big that bell
// is, and how long it hangs, belongs to the music rather than to the game:
// src/touch.js measures both out of the notes and the game hands them over with
// every strike - the piece gets a bell of its own, and every beat of it gets a
// share of that bell sized for how much is sounding under it.
//
// What is worth more: a beat the music itself is marking - the tune coming back,
// a line taken up again after ten seconds gone, a chord of five struck together.
// Those beats are gold on the ladder and ring louder.
//
// What is scored: a run, which is beats caught one after another. A beat that
// passes untouched ends it, and so does a click with no beat near it, which is
// what stops drumming on the mouse.
//
// What is drawn, by default: one thing, low in the middle of the screen. A ladder
// of short bars falls onto a catch line; the next couple of beats only, however
// fast the piece is, because the ladder's pace comes from the piece's own beat. A
// caught beat is gone from the ladder and lights the line; a longer run makes it
// wider and brighter. Everything else on the screen belongs to the piece's own
// picture. A picture may take the pulse off the game's hands and draw it in its
// own world instead - `paint` is how it says so. The wheel of BWV 582 does: a
// picture whose time already goes round has no use for a straight ladder laid
// over the top of it.

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
  var RUN = 16; // a run this long lights as fully as it ever gets

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
    var bell = null; // how big a bell this piece asks for: src/touch.js says
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
    var lit = []; // the light laid by recent strikes: { at, when, kind, truest }
    var painter = null; // who draws the pulse: null is the ladder, or the piece's own picture

    /**
     * The piece being played. The notes are the organ's own, in time order, and
     * the data is the file's, for its bar lines and its metre.
     */
    function open(notes, data) {
      beats = Bach.beats(data);
      gap = Bach.beatGap(beats);
      speed = LADDER / (AHEAD * gap);
      look = AHEAD * gap;
      bell = Bach.touch(notes, beats, gap); // how big a bell this piece can carry
      for (var s = 0; s < beats.length; s++) beats[s].bell = bell.sizes[s]; // ... and each beat its own
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
        lit.push({ at: now, when: null, kind: "stray" });
        return { kind: "stray" };
      }

      pick.taken = true;
      caught++;
      chain++;
      if (chain > best) best = chain;
      var struckTrue = Math.abs(off) <= TRUE;
      if (struckTrue) truest++;
      var weight = (pick.bright ? BRIGHT : 1) * (struckTrue ? TRUEST : 0.85);
      organ.chime(pick.pitch, null, weight, pick.bell || bell);
      lit.push({ at: now, when: pick.time, kind: pick.bright ? "gold" : "cool", truest: struckTrue });
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
      var was = lastNow;
      var jumped = was < 0 || now < was - 0.001 || now - was > 0.5;
      var back = jumped && was >= 0 && now < was;
      lastNow = now;
      if (!on || beats.length === 0) return;

      if (jumped) {
        retarget(now); // moved somewhere else: no run is broken by a jump
        // Travelling back leaves the light you struck behind you, where it was.
        // Travelling on does not: a strike is still fading on its own clock.
        if (back) lit = [];
      } else {
        while (pointer < beats.length && beats[pointer].time + NEAR < now) {
          if (!beats[pointer].taken) chain = 0; // letting a beat go ends the run
          pointer++;
        }
      }

      lit = lit.filter(function (one) {
        return now - one.at < FADE;
      });

      var shot = shotOf(now);
      if (painter) painter(shot);
      else draw(shot);
    }

    /**
     * A piece's own world, taking the pulse: `what` is a function the picture
     * hands over, and it is given the shot below every frame instead of the
     * ladder being drawn. Hand nothing back and the ladder comes home.
     */
    function paint(what) {
      painter = typeof what === "function" ? what : null;
    }

    /**
     * What the piece's picture is handed to draw the pulse with: the beats and
     * which of them are still in play, how long a beat is and how much of them a
     * straight ladder would show, the run, and what the player struck lately.
     * A picture that draws the pulse draws it; it judges nothing.
     */
    function shotOf(now) {
      return {
        now: now,
        beats: beats,
        pointer: pointer, // the first beat a strike can still be judged against
        gap: gap, // how long a beat usually is, in this piece
        ahead: look, // ... and how many seconds of them are coming
        speed: speed,
        fade: FADE, // how long the light of a strike lasts
        chain: chain,
        best: best,
        caught: caught,
        run: Math.min(1, chain / RUN), // 0 just started, 1 once the run is a long one
        strikes: lit, // each one { at, when, kind, truest }: when is the beat's own second
      };
    }

    function draw(shot) {
      var now = shot.now;
      var width = Math.max(320, window.innerWidth || 320);
      var height = Math.max(240, window.innerHeight || 240);
      var middle = Math.round(width / 2);
      var sound = height - ABOVE; // where a caught beat lands
      var run = shot.run;
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
      for (var i = shot.pointer; i < shot.beats.length; i++) {
        var beat = shot.beats[i];
        var away = beat.time - now;
        if (away > shot.ahead) break;
        if (beat.taken) continue;
        var y = Math.round(sound - away * shot.speed);
        var near = 1 - away / shot.ahead; // 0 when it is far above, 1 when it is due
        var wide = half * (0.55 + 0.45 * near);
        ctx.globalAlpha = 0.06 + 0.3 * near;
        ctx.fillStyle = beat.bright ? GOLD : COOL;
        ctx.fillRect(middle - wide, y - (beat.bar ? 1 : 0.5), wide * 2, beat.bar ? 2 : 1);
      }

      // The strikes: light laid on the line, and fading.
      for (var s = 0; s < shot.strikes.length; s++) {
        var one = shot.strikes[s];
        var aged = (now - one.at) / shot.fade;
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
      paint: paint,
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
      // Whether the piece's own picture is drawing the pulse instead of the ladder.
      painted: function () {
        return painter !== null;
      },
      // How big a bell this piece gets: src/touch.js works it out of the music.
      touch: function () {
        return bell;
      },
      bell: bellPitch,
    };
  }

  Bach.createGame = createGame;
})(window.Bach);
