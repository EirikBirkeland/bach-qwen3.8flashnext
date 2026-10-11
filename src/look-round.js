// The wheel: one turn is one telling of the ground, and then the ground is gone.
//
// This is the picture for BWV 582. Its first seven minutes are one 15-note ground
// bass in the pedal, said again and again eight bars apart while everything above
// it is written new each time. Falling notes cannot show that: the repeating is the
// piece, and it happens over twenty seconds at a stretch. So here time goes round
// instead of down. One turn of the wheel is one telling of the ground, and the
// wheel's period is not chosen - src/theme.js finds the ground in the notes and
// measures how far apart its tellings are, which here is eight bars to the turn.
//
//  - angle is time: a note is drawn where its own second falls within the turn, so
//    the ground is traced in the same place every time it is played, and the
//    variation above it is a shape that has never been on the screen before.
//  - radius is pitch, as sideways always is here: the pedal's C1 sits near the
//    middle, the manuals' top C out near the rim. The low register is given room,
//    since near the middle the angles are crowded.
//  - gold is the ground bass, whoever is playing it, and nothing else is gold.
//  - the hand is the line of sound: it goes round once a turn, and what it has
//    passed is lit and what is coming is a faint shape you can see the whole of.
//  - the rim keeps count. One mark per turn taken, gold for the turns that carried
//    the ground and cool for the ones after it - so the rim says both how far into
//    the piece you are and where the ground stopped.
//  - when the player is playing along, the rim grows a tooth per beat, just inside
//    those marks: this picture has no straight line anywhere, so the pulse is
//    marked on the wheel instead of being laid over it in a ladder. See src/game.js.
//  - at the hinge the ground stops coming back, and the wheel has nothing left to
//    fold along: the fugue is a hand sweeping a dark disc with a few seconds of
//    light on it, which is what a fugue with no ground feels like after seven
//    minutes of mandala.

window.Bach = window.Bach || {};

(function (Bach) {
  var HUB = 0.055; // how far from the middle the lowest note of the piece sits
  var RIM = 0.42; // ... and the highest, as a share of the screen's shorter side
  var BEND = 0.85; // under 1 gives the low register room at the middle, where angles crowd
  var TAIL = 3.6; // seconds a struck note takes to go dark
  var AHEAD = 4.2; // seconds shown before they are struck, once there is no whole turn to show
  var UNWIND = 10; // seconds the wheel takes to come apart when the ground stops
  var TRAIL = 0.2; // how fast the last frame is veiled: less = a longer trail
  var WAKE = 10; // seconds a voice has to be gone for before its return is a homecoming
  var WAKE_BLOOM = 2.4; // seconds a returning voice glows for
  var GROUND_BLOOM = 2.6; // seconds a fresh telling of the ground glows for
  var FUGUE_BLOOM = 5; // seconds the fugue's first note is a scene for
  var FALL_BACK_BAR = 2.5; // only used if a piece arrives without bar lines
  var GOLD = "#ffd47a"; // the ground bass, and nothing else
  var COOL = "#bcd0f0"; // the clock face, the pitch rings, the hand, the rim
  var MARK = "#e8f1ff"; // a beat of the piece, marked on the rim for the player to
  // strike. It needs a colour of its own because gold is taken: on this wheel the
  // ground is the one thing that is gold, and a beat cannot take that meaning away.
  var TOP = -0.25; // so a turn begins at the top of the screen and winds clockwise
  var TAU = Math.PI * 2;

  function createRoundLook(canvas) {
    var screen = Bach.createScreen(canvas);
    var ctx = screen.ctx;
    var notes = [];
    var pick = Bach.colourPicker({});
    var bars = [0];
    var clock = barClock(bars);
    var pitchLow = 0;
    var pitchHigh = 0;
    var ground = null; // what src/theme.js says comes back, when it says anything
    var groundKeys = {}; // every note of every telling of it, by its own name
    var periodBars = 8; // how many bars to a turn of the wheel
    var anchorBar = 0; // where a telling of the ground begins, in bars
    var groundTurns = 0; // how many turns carry the ground, before the fugue
    var turns = 1; // how many turns the whole piece takes
    var hingeTime = 0; // the second the ground stops coming back
    var fugueFrom = 0; // the second the fugue is properly under way, once the ground's last note has let go
    var wakes = []; // where a voice comes back after a long silence
    var opening = null; // the fugue's first note, struck once the ground has let go
    var groundFrom = null; // the note list the above was worked out from
    var from = 0;
    var to = 0;
    var lastNow = -1;
    var time = 0;
    // Filled in at the top of every frame, so the helpers know the size of things.
    var view = { width: 1, height: 1, cx: 0, cy: 0, inner: 1, outer: 1, ahead: 4, hand: 0 };

    screen.onResize(function () {
      lastNow = -1;
    });

    /**
     * The piece's own bar lines, asked backwards and forwards: what bar a second
     * falls on (counting into the bar), and what second a bar falls on. Folding
     * time by bars rather than by seconds is what keeps the wheel in step when the
     * player slows down, as this one does five times in the last two minutes.
     */
    function barClock(lines) {
      var count = lines.length;
      if (count < 2) {
        return {
          at: function (seconds) {
            return seconds / FALL_BACK_BAR;
          },
          time: function (position) {
            return position * FALL_BACK_BAR;
          },
          count: 1,
        };
      }
      var last = count - 1;
      var step = lines[1] - lines[0];
      return {
        at: function (seconds) {
          var low = 0;
          var high = last;
          while (low < high) {
            var middle = (low + high + 1) >> 1;
            if (lines[middle] <= seconds) low = middle;
            else high = middle - 1;
          }
          if (lines[low] > seconds) return (seconds - lines[0]) / step;
          if (low >= last) return last + (seconds - lines[last]) / step;
          var length = lines[low + 1] - lines[low];
          return low + (length > 0 ? (seconds - lines[low]) / length : 0);
        },
        time: function (position) {
          var whole = Math.floor(position);
          var part = position - whole;
          if (whole >= last) return lines[last] + part * step;
          if (whole < 0) return lines[0] + position * step;
          return lines[whole] + part * (lines[whole + 1] - lines[whole]);
        },
        count: count,
      };
    }

    /**
     * A note's own name. Nothing plays the same note twice at the same moment -
     * the converter left doubled notes out for that reason - so voice, pitch and
     * second together pick out exactly one note.
     */
    function keyOf(note) {
      return note.voice + ":" + note.pitch + ":" + note.time;
    }

    /** How far apart the tellings of the ground are, in bars. */
    function spacing(heard) {
      var apart = [];
      for (var i = 1; i < heard.length; i++) {
        apart.push(clock.at(heard[i].time) - clock.at(heard[i - 1].time));
      }
      apart.sort(function (a, b) {
        return a - b;
      });
      var middle = apart.length === 0 ? 0 : apart[Math.floor(apart.length / 2)];
      return Math.max(2, Math.round(middle));
    }

    function reset(list, look) {
      notes = list;
      pick = Bach.colourPicker(look.colours);
      bars = look.bars && look.bars.length > 1 ? look.bars : [0];
      clock = barClock(bars);
      pitchLow = look.pitchLow;
      pitchHigh = look.pitchHigh;

      // Finding the ground is the one expensive part, and it is the same every
      // time, so it is only done again for a different piece.
      if (groundFrom !== list) {
        groundFrom = list;
        ground = Bach.theme ? Bach.theme(list, { bars: bars }) : null;
        groundKeys = {};
        wakes = returns(list);
        if (ground && ground.heard.length >= 3) {
          var heard = ground.heard;
          for (var h = 0; h < heard.length; h++) {
            var telling = heard[h].notes;
            for (var i = 0; i < telling.length; i++) groundKeys[keyOf(telling[i])] = true;
          }
          periodBars = spacing(heard);
          anchorBar = clock.at(heard[0].time);
          groundTurns = Math.max(1, Math.ceil((clock.at(heard[heard.length - 1].until) - anchorBar) / periodBars));
        } else {
          // Nothing comes back, so there is no wheel to speak of: every turn is
          // its own music and none of it is gold.
          ground = null;
          periodBars = Math.max(2, look.phrase || 4);
          anchorBar = 0;
          groundTurns = 0;
        }
        hingeTime = clock.time(anchorBar + groundTurns * periodBars);
        fugueFrom = ground ? ground.heard[ground.heard.length - 1].until : hingeTime;
        turns = Math.max(1, Math.ceil((clock.count - anchorBar) / periodBars));
        opening = firstWord(list, fugueFrom);
      }

      from = 0;
      to = 0;
      lastNow = -1;
      screen.wipe();
    }

    /**
     * Where a voice comes back after having been gone WAKE seconds or more. Not
     * the first time it speaks - that is only it starting.
     */
    function returns(list) {
      var ended = {};
      var found = [];
      for (var i = 0; i < list.length; i++) {
        var note = list[i];
        var line = String(note.voice);
        var end = note.time + note.length;
        if (ended[line] === undefined) {
          ended[line] = end;
          continue;
        }
        if (note.time - ended[line] >= WAKE) found.push(note);
        if (end > ended[line]) ended[line] = end;
      }
      return found;
    }

    /**
     * The first note struck once the ground has gone for good. Seven minutes of
     * one repeating bass, and then the repeating stops and a fugue starts: that
     * one note is the hinge of the piece, so it gets its own light.
     */
    function firstWord(list, after) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].time >= after) return list[i];
      }
      return null;
    }

    /** Where a second falls in the turn: 0 at a telling of the ground, 1 at the next. */
    function phase(seconds) {
      var part = (clock.at(seconds) - anchorBar) / periodBars;
      return part - Math.floor(part);
    }

    function angleAt(seconds) {
      return (phase(seconds) + TOP) * TAU;
    }

    /** Which turn of the wheel a second is in, counting from the ground's first one. */
    function turnOf(seconds) {
      return Math.floor((clock.at(seconds) - anchorBar) / periodBars);
    }

    /** How much longer this turn has to run. */
    function untilTurnEnd(seconds) {
      return clock.time((turnOf(seconds) + 1) * periodBars + anchorBar) - seconds;
    }

    /** How far out from the middle a pitch is drawn. */
    function radiusFor(pitch) {
      var span = Math.max(1, pitchHigh - pitchLow);
      var share = Math.max(0, Math.min(1, (pitch - pitchLow) / span));
      return view.inner + (view.outer - view.inner) * Math.pow(share, BEND);
    }

    /** How big a note's light is: the line to follow is the biggest, in the same
     *  order the organ plays them, and the ground a touch bigger than any of them. */
    function weightOf(note, gold) {
      var size = note.role === "melody" ? 3 : note.role === "pedal" ? 2.7 : 2.3;
      return gold ? size + 1 : size;
    }

    function point(radius, angle) {
      return { x: view.cx + Math.cos(angle) * radius, y: view.cy + Math.sin(angle) * radius };
    }

    /** A square of light, and nothing else: a note, a mark on the rim. */
    function dot(x, y, size, colour, strength) {
      if (size <= 0 || strength <= 0.01) return;
      ctx.globalAlpha = strength;
      ctx.fillStyle = colour;
      ctx.fillRect(x - size, y - size, size * 2, size * 2);
    }

    /** A round glow, only the part of it on the screen asked for. */
    function bloom(x, y, size, colour, strength) {
      if (size <= 0 || strength <= 0.01) return;
      var left = Math.max(0, x - size);
      var top = Math.max(0, y - size);
      var glow = ctx.createRadialGradient(x, y, 0, x, y, size);
      glow.addColorStop(0, colour);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = strength;
      ctx.fillStyle = glow;
      ctx.fillRect(left, top, Math.min(view.width, x + size) - left, Math.min(view.height, y + size) - top);
    }

    /** A ring of light round a point: what a note's own brightness throws out.
     *  The middle is left empty, because the note's own dot is going there, and
     *  two full lights on top of one another is how a picture burns out white. */
    function glow(x, y, size, colour, strength) {
      if (size <= 0 || strength <= 0.01) return;
      var left = Math.max(0, x - size);
      var top = Math.max(0, y - size);
      var ringOf = ctx.createRadialGradient(x, y, 0, x, y, size);
      ringOf.addColorStop(0, "rgba(0,0,0,0)");
      ringOf.addColorStop(0.4, colour);
      ringOf.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = strength;
      ctx.fillStyle = ringOf;
      ctx.fillRect(left, top, Math.min(view.width, x + size) - left, Math.min(view.height, y + size) - top);
    }

    /** A whole circle of light at one radius: the ruler the pitches are read on. */
    function ring(radius, width, colour, strength) {
      if (radius <= 0 || strength <= 0.01) return;
      var total = radius + width * 3;
      var band = ctx.createRadialGradient(view.cx, view.cy, 0, view.cx, view.cy, total);
      band.addColorStop(0, "rgba(0,0,0,0)");
      band.addColorStop(Math.max(0.02, (radius - width) / total), "rgba(0,0,0,0)");
      band.addColorStop(radius / total, colour);
      band.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = strength;
      ctx.fillStyle = band;
      ctx.fillRect(
        Math.max(0, view.cx - total),
        Math.max(0, view.cy - total),
        Math.min(view.width, view.cx + total) - Math.max(0, view.cx - total),
        Math.min(view.height, view.cy + total) - Math.max(0, view.cy - total)
      );
    }

    /** The hand: the line of sound, bent round. It goes once round a turn. */
    function hand(angle, strength) {
      var step = Math.max(6, view.outer / 40);
      for (var radius = view.inner * 0.5; radius <= view.outer; radius += step) {
        var here = point(radius, angle);
        var outward = radius / view.outer;
        dot(here.x, here.y, 1 + outward, COOL, strength * (0.05 + 0.2 * outward));
      }
      var tip = point(view.outer, angle);
      bloom(tip.x, tip.y, view.outer * 0.1, COOL, strength * 0.16);
    }

    /**
     * A tooth of the rim: a short tick pointing inwards at one bearing, longer and
     * brighter the nearer its beat is to the hand. The rim already carries the bars
     * of the turn and the tally of the turns, so a beat lives just inside all that,
     * and three teeth to a bar is the metre, written on the wheel.
     */
    function tooth(angle, length, colour, strength) {
      if (length <= 0 || strength <= 0.01) return;
      for (var depth = 0; depth <= length; depth += 3) {
        var inward = 1 - depth / (length + 3); // the far end of a tooth is its soft end
        var here = point(view.outer - 3 - depth, angle);
        dot(here.x, here.y, 0.6 + 0.9 * inward, colour, strength * inward);
      }
    }

    /**
     * The player's pulse, on the wheel's own rim.
     *
     * Elsewhere the game lays a ladder of falling beats over the picture. That
     * would be the only straight line in a picture that has none: here the hand is
     * already the line of sound and already goes once round a turn, and the beat
     * grid folds to that same turn - eight bars, three beats to a bar - so every
     * beat has a bearing of its own and the hand crossing that bearing *is* the
     * beat arriving. A tooth per beat costs nothing to explain: the rim becomes a
     * clock face with the pulse on it, and striking a beat is what lights it.
     *
     * The shot comes from src/game.js and is only read here: this draws the pulse,
     * it does not judge it.
     */
    function pulse(shot) {
      var gap = shot.gap > 0 ? shot.gap : 1;
      ctx.globalCompositeOperation = "lighter";

      // The rim brightens as the run grows: the wheel's version of a line that
      // gets wider the longer a player stays with the piece.
      if (shot.run > 0.02) ring(view.outer, 2 + 4 * shot.run, COOL, 0.015 + 0.05 * shot.run);

      // The teeth: every beat the wheel has room to show. When the ground stops
      // and the wheel unwinds there is no whole turn left to mark, and the teeth
      // go back on the rack along with everything else ahead of the hand.
      for (var i = shot.pointer; i < shot.beats.length; i++) {
        var beat = shot.beats[i];
        var away = beat.time - shot.now;
        if (away > view.ahead) break;
        if (beat.taken) continue; // that one is light on the rim now, not a tooth
        var near = Math.max(0, 1 - away / (3 * gap)); // due within three beats
        tooth(
          angleAt(beat.time),
          (beat.bar ? 1.5 : 1) * (3 + 9 * near), // a downbeat reaches further in
          beat.bright ? MARK : COOL,
          0.05 + 0.3 * near * near
        );
      }

      // What the player struck: light laid round the bearing its beat was at, and
      // fading. A ring rather than a glow, because the tooth is going in the same
      // place, and two full lights on one spot are white rather than loud.
      for (var s = 0; s < shot.strikes.length; s++) {
        var one = shot.strikes[s];
        var faded = Math.max(0, 1 - (shot.now - one.at) / shot.fade);
        if (faded <= 0.01) continue;
        if (one.when === null || one.when === undefined) {
          // A click with no beat near it: one dull mark where the hand has got to.
          var stray = point(view.outer + 6, view.hand);
          dot(stray.x, stray.y, 1.6, COOL, 0.05 * faded);
          continue;
        }
        var struck = angleAt(one.when);
        var at = point(view.outer - 7, struck);
        glow(
          at.x,
          at.y,
          view.outer * (0.05 + 0.18 * faded * faded) + 10,
          one.kind === "gold" ? MARK : COOL,
          (one.truest ? 0.24 : 0.16) * faded
        );
        tooth(struck, 5 + 9 * faded * faded, MARK, 0.18 + 0.45 * faded);
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      var width = screen.width();
      var height = screen.height();
      view.width = width;
      view.height = height;
      view.cx = width / 2;
      view.cy = height / 2;
      view.outer = Math.min(width, height) * RIM;
      view.inner = Math.min(width, height) * HUB;

      var jumped = lastNow >= 0 && (now < lastNow - 0.001 || now > lastNow + 2);
      var elapsed = now - lastNow;
      if (lastNow < 0 || elapsed < 0 || elapsed > 0.5) elapsed = 1 / 60;
      time += elapsed;
      lastNow = now;

      if (jumped) {
        from = 0;
        to = 0;
        screen.wipe();
      }

      // While the ground keeps coming back the whole turn is shown, so you can see
      // the shape of the variation coming; once it has stopped there is nothing to
      // see ahead of you, and only the next few seconds are on the wheel. The
      // change takes UNWIND seconds, so the far edge of the disc empties inwards
      // rather than vanishing between one frame and the next.
      var fugue = now >= hingeTime;
      var ahead = fugue ? AHEAD : Math.max(AHEAD, untilTurnEnd(now));
      if (fugue && now - hingeTime < UNWIND) {
        var letGo = 1 - (now - hingeTime) / UNWIND;
        ahead = AHEAD + Math.max(0, untilTurnEnd(now) - AHEAD) * letGo;
      }
      view.ahead = ahead;

      if (from > to) to = from;
      while (from < notes.length && notes[from].time + notes[from].length + TAIL < now) from++;
      while (to < notes.length && notes[to].time < now + ahead + 0.05) to++;

      var sounding = 0;
      for (var i = from; i < to; i++) {
        var one = notes[i];
        if (one.time <= now && one.time + one.length >= now) sounding++;
      }

      if (!jumped) screen.veil(TRAIL);

      ctx.globalCompositeOperation = "lighter";

      // How much of the organ is going decides how quietly each light is laid
      // down: in the fugue a dozen notes are sounding at once and they sit near
      // enough together for their lights to fall on one another, so the more that
      // play, the softer each one is drawn. The picture breathes with the music.
      var calm = 1 / (1 + 0.055 * sounding);

      // A slow breath of light behind the wheel, grown by how much is playing.
      var breathe = 0.5 + 0.5 * Math.sin(time * 0.17);
      var reach = view.outer * (1.05 + 0.12 * breathe);
      var halo = ctx.createRadialGradient(view.cx, view.cy, 0, view.cx, view.cy, reach);
      halo.addColorStop(0, "rgba(46,66,112," + (0.016 + 0.005 * sounding).toFixed(3) + ")");
      halo.addColorStop(1, "rgba(6,8,16,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      // The pitch of the music: a ring at every C, so a note's height can be read
      // off the wheel the way it is read off a line in the other pictures.
      for (var pitch = Math.ceil(pitchLow / 12) * 12; pitch <= pitchHigh; pitch += 12) {
        ring(radiusFor(pitch), 1.2, COOL, 0.03);
      }

      // The clock face: a mark at every bar of the turn, and a gold one where the
      // ground begins. The hand brightens each one as it crosses it.
      var handAngle = angleAt(now);
      view.hand = handAngle;
      for (var b = 0; b < periodBars; b++) {
        var mark = (b / periodBars + TOP) * TAU;
        var off = Math.abs(Math.sin((mark - handAngle) / 2)); // how far the hand is from here
        var crossing = Math.max(0, 1 - off * 9);
        var head = b === 0;
        var tick = point(view.outer + 6, mark);
        dot(tick.x, tick.y, head ? 2.6 : 1.6, head ? GOLD : COOL, head ? 0.1 + 0.3 * crossing : 0.05 + 0.3 * crossing);
      }

      // The rim keeps count: a mark for every turn taken, gold while the ground was
      // being said, cool since. It says how far into the piece you are, and where
      // the ground stopped.
      var done = Math.max(0, Math.min(turns, turnOf(now)));
      var intoTurn = (clock.at(now) - anchorBar) / periodBars;
      var sinceMark = 1 - (intoTurn - Math.floor(intoTurn)); // 1 just after a turn begins
      for (var t = 0; t < done; t++) {
        var tallied = point(view.outer + 16, (t / turns + TOP) * TAU);
        var carried = t < groundTurns;
        var fresh = t === done - 1 && sinceMark > 0.8 ? sinceMark : 0;
        dot(
          tallied.x,
          tallied.y,
          carried ? 2.2 : 1.7,
          carried ? GOLD : COOL,
          (carried ? 0.1 : 0.06) + 0.4 * fresh
        );
      }

      // Where lights have already been laid down this frame. Two voices striking
      // the same pitch at the same moment - which this arrangement does often -
      // land on one spot of the wheel, and two full lights on one spot is white
      // rather than loud, so the second one is drawn for less.
      var spots = {};

      // The notes of the turn being played, and the last few seconds of light.
      for (var n = from; n < to; n++) {
        var note = notes[n];
        var away = note.time - now;
        if (away > ahead) continue;
        var angle = angleAt(note.time);
        var lit = point(radiusFor(note.pitch), angle);
        var gold = groundKeys[keyOf(note)] === true;
        var colour = gold ? GOLD : pick(note.voice, n);
        var size = weightOf(note, gold);
        if (away > 0) {
          // What is still to come is drawn plain and small: a frame can only afford
          // so many soft lights, and the shape ahead is a shape, not a glare.
          var nearly = 1 - Math.min(1, away / Math.max(2, ahead));
          if (nearly > 0.86) glow(lit.x, lit.y, size * 4.2, colour, 0.16 * nearly * calm);
          dot(lit.x, lit.y, size * (0.45 + 0.6 * nearly), colour, (0.06 + 0.3 * nearly) * calm);
          continue;
        }
        var end = note.time + note.length;
        var age = now - end;
        var strength = age <= 0 ? 1 : Math.max(0, 1 - age / TAIL);
        // Only what has been struck is bright enough to burn a spot out, so only
        // what has been struck is measured against what is already shining there.
        var spot = Math.round(lit.x / 4) + ":" + Math.round(lit.y / 4);
        var share = spots[spot] === true ? 0.5 : 1;
        spots[spot] = true;
        if (strength > 0.3) glow(lit.x, lit.y, size * (2.2 + 3.4 * strength), colour, 0.22 * strength * calm * share);
        dot(lit.x, lit.y, size * (0.75 + 0.4 * strength), colour, 0.72 * strength * calm * share);
      }

      // A fresh telling of the ground: gold, wherever its first note falls.
      if (ground) {
        for (var g = 0; g < ground.heard.length; g++) {
          var telling = ground.heard[g];
          var since = now - telling.time;
          if (since < 0 || since > GROUND_BLOOM) continue;
          var faded = 1 - since / GROUND_BLOOM;
          var tellingHere = point(radiusFor(telling.pitch), angleAt(telling.time));
          bloom(tellingHere.x, tellingHere.y, view.outer * (0.08 + 0.34 * faded * faded), GOLD, 0.22 * faded);
        }
      }

      // A voice coming back after a long silence.
      for (var w = 0; w < wakes.length; w++) {
        var wake = wakes[w];
        var back = now - wake.time;
        if (back < 0 || back > WAKE_BLOOM) continue;
        var grown = 1 - back / WAKE_BLOOM;
        var wokeHere = point(radiusFor(wake.pitch), angleAt(wake.time));
        bloom(wokeHere.x, wokeHere.y, view.outer * (0.06 + 0.22 * grown), pick(wake.voice, 0), 0.2 * grown);
      }

      // And the fugue beginning: the one moment in this piece worth a flash of the
      // picture's own light over the wheel.
      if (opening) {
        var sinceOpening = now - opening.time;
        if (sinceOpening >= 0 && sinceOpening < FUGUE_BLOOM) {
          var widening = 1 - sinceOpening / FUGUE_BLOOM;
          var hingePlace = point(radiusFor(opening.pitch), angleAt(opening.time));
          bloom(hingePlace.x, hingePlace.y, view.outer * (0.25 + 0.7 * widening * widening), COOL, 0.22 * widening);
        }
      }

      hand(handAngle, 1);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    return { reset: reset, frame: frame, pulse: pulse };
  }

  Bach.looks.round = createRoundLook;
})(window.Bach);
