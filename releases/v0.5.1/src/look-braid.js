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
//  - the pulse, when someone is playing along. The game would lay its ladder of
//    falling beats across the middle of this picture, at right angles to a piece
//    whose time runs sideways; the braid takes it instead, as a ruler of beats
//    along the top and bottom of the music - see `pulse` below.

window.Bach = window.Bach || {};

(function (Bach) {
  var GOLD = "#ffd47a"; // a phrase you have already heard
  var COOL = "#bcd0f0"; // a bar line, and the line of sound when nothing is repeated
  var TRAIL = 0.3; // how fast the last frame is veiled: less = a longer trail
  var FADE = 3.2; // seconds a note takes to go dark after it stops sounding
  var FLASH = 0.6; // how long a struck note flares on the line of sound
  var SPEED_FLOOR = 12; // pixels a second, however long the bars are
  var SPEED_CEILING = 150;
  var MARK = "#e8f1ff"; // a beat of the player's pulse, stood on the ruler. Never
  // gold: on this piece gold is the chorale, and a phrase the music says again.
  var CLEAR = 10; // the gap a beat keeps from the music, which is brighter than it
  var TICK = 22; // how tall a beat stands when it is due and worth every pixel
  var NEAR = 4; // beats over which one reaches its full height
  var RULER = 16; // how wide the ruler is when a long run lights it

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
      echoes = Bach.echoes(notes, bars, { minBars: phraseBars });
      warmLines = {};
      for (var i = 0; i < echoes.length; i++) warmLines[String(echoes[i].at)] = true;
      from = 0;
      to = 0;
      lastNow = -1;
      screen.wipe();
    }

    /** How far the music is kept from either edge of the screen. Nothing of the
     *  piece is ever drawn outside that band, which is what the beat ruler stands
     *  in: the two rows of it hug the music from above and below. */
    function pitchMargin(height) {
      return Math.min(150, height * 0.16);
    }

    function yFor(pitch) {
      var height = screen.height();
      var margin = pitchMargin(height);
      var span = Math.max(1, pitchHigh - pitchLow);
      return height - margin - ((pitch - pitchLow) / span) * (height - margin * 2);
    }

    // Where the line of sound is, how fast the music crosses the screen, and where
    // the two rows of the beat ruler stand: `crown` is the top edge of the music's
    // band, `base` the bottom of it, and `tall` the tallest a beat may stand there.
    var ruler = { lineX: 0, speed: 1, crown: 1, base: 1, tall: TICK };

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

    /**
     * A beat stood on the ruler: a mark `tall` growing towards the music from the
     * edge of its band it stands on, with a soft light behind it so a far-off beat
     * is still something the eye can catch.
     */
    function stand(x, edge, tall, wide, strength, upwards) {
      if (tall <= 0 || strength <= 0.004) return;
      var top = upwards ? edge - tall : edge;
      ctx.fillStyle = MARK;
      ctx.globalAlpha = strength * 0.22;
      ctx.fillRect(x - 4, top, 8, tall);
      ctx.globalAlpha = strength;
      ctx.fillRect(x - wide / 2, top, wide, tall);
    }

    /**
     * A ring of light round the place a beat arrived, contracting as it fades and
     * empty in the middle. A note is usually being struck on that very beat, and its
     * own core is already blazing where the line of sound is: two full lights on one
     * spot are white rather than louder, which is the same reason the wheel of BWV
     * 582 lays its lights as rings rather than blobs. Same reason, same device.
     */
    function ring(x, y, size, colour, strength) {
      if (size <= 0 || strength <= 0.01) return;
      var round = ctx.createRadialGradient(x, y, 0, x, y, size);
      round.addColorStop(0, "rgba(0,0,0,0)");
      round.addColorStop(0.55, "rgba(0,0,0,0)");
      round.addColorStop(0.82, colour);
      round.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = strength;
      ctx.fillStyle = round;
      var left = Math.max(0, x - size);
      var top = Math.max(0, y - size);
      ctx.fillRect(left, top, Math.min(screen.width(), x + size) - left, Math.min(screen.height(), y + size) - top);
    }

    /**
     * The player's pulse, stood on the ruler the braid is woven on.
     *
     * The game could lay its ladder of falling beats over this picture, and does
     * for the pieces that have nowhere else to put a beat. The braid has: its time
     * runs sideways, so a beat has a place of its own here - one screen is a whole
     * phrase, sixteen beats, and they walk into the line of sound at the pace the
     * music itself goes. A ladder two beats tall shows a player the next three
     * seconds of a twenty-six second picture; the ruler shows the phrase, and the
     * ritardando at the end of it, which is the last thing to be caught with.
     *
     * So each beat stands at its own x, growing towards the music as it comes:
     * the bar's openings taller than the beats between them, so four make a bar,
     * and taller and brighter still a beat the piece is marking for itself - the
     * phrase said again at 0:26 is a whole screen away, and already on this one.
     * What the player strikes is lit on the line of sound, where the beat has got
     * to, in a ring contracting round it, and a long run lights the ruler itself -
     * this picture's version of the ladder's line getting wider.
     *
     * The shot comes from src/game.js and is only read here: this draws the pulse,
     * it does not judge it.
     */
    function pulse(shot) {
      var width = screen.width();
      var gap = shot.gap > 0 ? shot.gap : 1;
      var pace = ruler.speed;

      ctx.globalCompositeOperation = "lighter";

      // A long run lights the ruler and the line of sound it is crossed by.
      if (shot.run > 0.02) {
        var top = ruler.crown - CLEAR - ruler.tall;
        var drop = ruler.base + CLEAR + ruler.tall - top;
        ctx.fillStyle = MARK;
        ctx.globalAlpha = 0.008 + 0.02 * shot.run;
        ctx.fillRect(ruler.lineX - RULER / 2, top, RULER, drop);
        ctx.globalAlpha = 0.04 + 0.16 * shot.run;
        ctx.fillRect(ruler.lineX - 1, top, 2, drop);
      }

      // The beats, from the one a strike can still be judged against up to the
      // further edge of the phrase on the screen.
      for (var i = shot.pointer; i < shot.beats.length; i++) {
        var beat = shot.beats[i];
        var away = beat.time - shot.now;
        var x = ruler.lineX + away * pace;
        if (x > width + 14) break;
        if (beat.taken) continue; // that one is light on the line of sound now
        var near = Math.max(0, 1 - Math.max(0, away) / (NEAR * gap));
        // A bar's opening stands taller than the beats inside it, so the four of
        // them read as one bar; and a beat the piece is marking for itself taller
        // and brighter still, however far off - the phrase said again at 0:26 is a
        // whole screen away, and it is already on this screen.
        var rank = beat.bright ? 1 : beat.bar ? 0.6 : 0.42;
        var tall = ruler.tall * rank * (0.5 + 0.5 * near);
        var strength =
          (beat.bright ? 0.15 : beat.bar ? 0.09 : 0.055) + (beat.bright ? 0.2 : 0.15) * near;
        var wide = beat.bright ? 2 : 1.5;
        stand(x, ruler.crown - CLEAR, tall, wide, strength, true);
        stand(x, ruler.base + CLEAR, tall, wide, strength, false);
      }

      // What the player struck, on the line of sound at both edges of the music.
      for (var s = 0; s < shot.strikes.length; s++) {
        var one = shot.strikes[s];
        var faded = Math.max(0, 1 - (shot.now - one.at) / shot.fade);
        if (faded <= 0.01) continue;
        if (one.when === null || one.when === undefined) {
          // A click with no beat near it: a dull flick at either hand.
          ctx.fillStyle = MARK;
          ctx.globalAlpha = 0.05 * faded;
          ctx.fillRect(ruler.lineX - 9, ruler.crown - CLEAR - 1, 18, 2);
          ctx.fillRect(ruler.lineX - 9, ruler.base + CLEAR - 1, 18, 2);
          continue;
        }
        var reach = (one.truest ? 30 : 20) + 70 * faded * faded + 26 * shot.run;
        ring(ruler.lineX, ruler.crown - CLEAR, reach, MARK, (one.truest ? 0.12 : 0.08) * faded);
        ring(ruler.lineX, ruler.base + CLEAR, reach, MARK, (one.truest ? 0.12 : 0.08) * faded);
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      var width = screen.width();
      var height = screen.height();
      var lineX = Math.round(width * 0.26);
      var speed = speedFor(width);
      var behind = lineX / speed; // seconds of music already played, still on screen
      var ahead = (width - lineX) / speed; // seconds still to come

      var margin = pitchMargin(height);
      ruler.lineX = lineX;
      ruler.speed = speed;
      ruler.tall = Math.max(6, Math.min(TICK, margin - CLEAR * 2));
      ruler.crown = margin;
      ruler.base = height - margin;

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

    return { reset: reset, frame: frame, pulse: pulse };
  }

  Bach.looks.braid = createBraidLook;
})(window.Bach);
