// The woven look: three slow lines crossing the screen from right to left.
//
// This is the picture for a slow chorale prelude - BWV 639, where a bar takes six
// and a half seconds and three voices go without a break from one end to the other.
// Falling notes would be no use there: a bar of that music is most of the height of
// a screen, and nothing would ever be visible at once. So time runs sideways, and
// one phrase - four bars, twenty-six seconds - is exactly as wide as the screen.
// The whole shape of a phrase is in front of you while it is played.
//
// What is drawn, and where each of it comes from:
//  - one bar of light per note, as long as the note is and as high as it is. These
//    editions are legato, so a voice reads as one unbroken braid of light and the
//    three of them weave. The line to follow is the stoutest and an inner voice the
//    thinnest - the same order the organ plays them in - and the piece sinks as it
//    goes, because its notes do.
//  - the line of sound. A note is a thin, faint thing until it is struck; from the
//    moment it is, it is lit along the part that has sounded and flares where it
//    crossed, then fades on its way out to the left.
//  - a line at every bar, a stronger one where a phrase begins. Twenty-six seconds
//    pass between those: they are the breath of this picture.
//  - the music says some things twice - the opening four bars come back whole at
//    bar 5 - and a phrase that was already heard is warm instead of cool, so the
//    repeat is something you can see. src/echoes.js works that out from the notes.

window.Bach = window.Bach || {};

(function (Bach) {
  var GOLD = "#ffd47a"; // a phrase you have already heard
  var COOL = "#bcd0f0"; // a bar line, and the line of sound when nothing is repeated
  var TRAIL = 0.3; // how fast the last frame is veiled: less = a longer trail
  var FADE = 3.2; // seconds a note takes to go dark after it stops sounding
  var FLASH = 0.6; // how long a struck note flares on the line of sound
  var SPEED_FLOOR = 12; // pixels a second, however long the bars are
  var SPEED_CEILING = 150;

  function createBraidLook(canvas) {
    var screen = Bach.createScreen(canvas);
    var ctx = screen.ctx;
    var notes = [];
    var pick = Bach.colourPicker({});
    var bars = [0];
    var phraseBars = 4;
    var barSeconds = 4;
    var pitchLow = 0;
    var pitchHigh = 0;
    var echoes = []; // when a phrase is a repeat: [{ at, until }]
    var warmLines = {}; // the bar lines that begin such a phrase, by their second
    var from = 0;
    var to = 0;
    var lastNow = -1;
    var time = 0;

    screen.onResize(function () {
      lastNow = -1;
    });

    function reset(list, look) {
      notes = list;
      pick = Bach.colourPicker(look.colours);
      bars = look.bars && look.bars.length > 1 ? look.bars : [0];
      barSeconds = bars.length > 1 ? bars[1] - bars[0] : 4;
      phraseBars = Math.max(1, look.phrase || 4);
      pitchLow = look.pitchLow;
      pitchHigh = look.pitchHigh;
      echoes = Bach.phraseEchoes(notes, bars, phraseBars);
      warmLines = {};
      for (var i = 0; i < echoes.length; i++) warmLines[String(echoes[i].at)] = true;
      from = 0;
      to = 0;
      lastNow = -1;
      screen.wipe();
    }

    function yFor(pitch) {
      var height = screen.height();
      var margin = Math.min(150, height * 0.16);
      var span = Math.max(1, pitchHigh - pitchLow);
      return height - margin - ((pitch - pitchLow) / span) * (height - margin * 2);
    }

    /** Is this note part of a phrase the music has already played? */
    function isEcho(note) {
      for (var i = 0; i < echoes.length; i++) {
        if (note.time >= echoes[i].at && note.time < echoes[i].until) return true;
      }
      return false;
    }

    /** How thick a voice's line is: the melody to follow is the stoutest. */
    function weightOf(note) {
      if (note.role === "melody") return 5.5;
      if (note.role === "pedal") return 4.5;
      return 3;
    }

    /** The one rule for how fast the music crosses the screen: a phrase to a screen. */
    function speedFor(width) {
      var speed = width / (phraseBars * barSeconds);
      return Math.max(SPEED_FLOOR, Math.min(SPEED_CEILING, speed));
    }

    /** A soft, faint line for what is still to come. */
    function coming(from_, until, y, colour, weight, strength) {
      if (until <= from_) return;
      ctx.globalAlpha = strength;
      ctx.fillStyle = colour;
      ctx.fillRect(from_, y - weight * 0.3, until - from_, weight * 0.6);
    }

    /** The part of a note that has been played: a soft glow, a body, a bright core. */
    function played(from_, until, y, colour, weight, strength) {
      if (until <= from_) return;
      ctx.globalAlpha = 0.09 * strength;
      ctx.fillStyle = colour;
      ctx.fillRect(from_, y - weight * 2, until - from_, weight * 4);
      ctx.globalAlpha = 0.46 * strength;
      ctx.fillRect(from_, y - weight * 0.5, until - from_, weight);
      ctx.globalAlpha = Math.min(1, 0.9 * strength);
      ctx.fillRect(from_, y - 0.8, until - from_, 1.6);
    }

    function frame(now) {
      var width = screen.width();
      var height = screen.height();
      var lineX = Math.round(width * 0.26);
      var speed = speedFor(width);
      var behind = lineX / speed; // seconds of music already played, still on screen
      var ahead = (width - lineX) / speed; // seconds still to come

      var jumped = lastNow >= 0 && (now < lastNow - 0.001 || now > lastNow + 2);
      var elapsed = now - lastNow;
      if (lastNow < 0 || elapsed < 0 || elapsed > 0.5) elapsed = 1 / 60;
      time += elapsed;
      lastNow = now;

      if (jumped) {
        from = 0;
        to = 0;
        screen.wipe();
      } else {
        screen.veil(TRAIL);
      }

      if (from > to) to = from;
      while (from < notes.length && notes[from].time + notes[from].length < now - behind - 0.1) from++;
      while (to < notes.length && notes[to].time < now + ahead + 0.1) to++;

      // Where the music is, on average, right now: the light behind everything
      // gathers there.
      var sounding = 0;
      var depth = 0;
      for (var i = from; i < to; i++) {
        if (notes[i].time <= now && notes[i].time + notes[i].length >= now) {
          sounding++;
          depth += yFor(notes[i].pitch);
        }
      }
      var centre = sounding > 0 ? depth / sounding : height / 2;

      ctx.globalCompositeOperation = "lighter";

      // A slow breath of light, grown by how much is sounding.
      var breathe = 0.5 + 0.5 * Math.sin(time * 0.17);
      var radius = (0.3 + 0.1 * breathe + 0.02 * sounding) * Math.max(width, height);
      var halo = ctx.createRadialGradient(lineX, centre, 0, lineX, centre, radius);
      halo.addColorStop(0, "rgba(46,66,112," + (0.03 + 0.008 * sounding).toFixed(3) + ")");
      halo.addColorStop(1, "rgba(6,8,16,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      // The pitch of the music: a faint line at every C, so the eye can tell how
      // high it is and watch the piece sink.
      ctx.fillStyle = COOL;
      for (var pitch = Math.ceil(pitchLow / 12) * 12; pitch <= pitchHigh; pitch += 12) {
        ctx.globalAlpha = 0.05;
        ctx.fillRect(0, yFor(pitch) - 0.5, width, 1);
      }

      // The bar lines, and a warmer, stronger one where a phrase begins - warmer
      // still when that phrase is one the player has already heard.
      for (var b = 0; b < bars.length; b++) {
        var barX = lineX + (bars[b] - now) * speed;
        if (barX < -14 || barX > width + 14) continue;
        var phraseLine = b % phraseBars === 0;
        var warm = warmLines[String(bars[b])] === true;
        ctx.fillStyle = warm ? GOLD : COOL;
        if (phraseLine) {
          ctx.globalAlpha = warm ? 0.07 : 0.035;
          ctx.fillRect(barX - 12, 0, 24, height);
        }
        ctx.globalAlpha = warm ? 0.26 : phraseLine ? 0.13 : 0.045;
        ctx.fillRect(barX - (phraseLine ? 1 : 0.5), 0, phraseLine ? 2 : 1, height);
      }

      // The notes.
      for (var n = from; n < to; n++) {
        var note = notes[n];
        var weight = weightOf(note);
        var colour = pick(note.voice, n);
        var warmNote = isEcho(note);
        var y = yFor(note.pitch);
        var start = lineX + (note.time - now) * speed;
        var end = lineX + (note.time + note.length - now) * speed;

        var wait = Math.max(0, note.time - now);
        var dim = (warmNote ? 0.3 : 0.15) * Math.max(0.3, 1 - wait / ahead);
        coming(Math.max(start, lineX), end, y, warmNote ? GOLD : colour, weight, dim);

        if (note.time <= now) {
          var age = now - (note.time + note.length);
          var strength = age <= 0 ? 1 : Math.max(0, 1 - age / FADE);
          played(start, Math.min(end, lineX), y, colour, weight, strength * (warmNote ? 1.25 : 1));
        }

        // The moment it was struck: a flare on the line of sound.
        if (note.time <= now && now - note.time < FLASH) {
          var faded = 1 - (now - note.time) / FLASH;
          var size = 5 + 15 * faded;
          var glow = ctx.createRadialGradient(lineX, y, 0, lineX, y, size);
          glow.addColorStop(0, colour);
          glow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = 0.4 * faded * faded;
          ctx.fillStyle = glow;
          ctx.fillRect(lineX - size, y - size, size * 2, size * 2);
        }
      }

      // The line of sound: where notes are struck. Warmer while a repeat is being
      // played, so you can see the music looking back at itself.
      var inRepeat = false;
      for (var e = 0; e < echoes.length; e++) {
        if (now >= echoes[e].at && now < echoes[e].until) inRepeat = true;
      }
      var warmth = Math.min(1, sounding / 5);
      var lineColour = inRepeat ? GOLD : COOL;
      ctx.fillStyle = lineColour;
      ctx.globalAlpha = 0.045 + 0.05 * warmth;
      ctx.fillRect(lineX - 16, 0, 32, height);
      ctx.globalAlpha = 0.1 + 0.1 * warmth;
      ctx.fillRect(lineX - 4, 0, 8, height);
      ctx.globalAlpha = 0.3 + 0.25 * warmth;
      ctx.fillRect(lineX - 0.5, 0, 1, height);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    return { reset: reset, frame: frame };
  }

  Bach.looks.braid = createBraidLook;
})(window.Bach);
