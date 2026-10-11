// The long view: the whole piece lies ahead of you, receding toward a horizon.
//
// This is the picture for BWV 645, and it exists for one thing about that piece:
// it makes you wait. The chorale melody - the gold line, the one to follow - does
// not sing until 0:50, then stops for 29 seconds and again for 23, and the opening
// ritornello comes back whole at 1:32. None of that shows in notes falling at a
// walking pace, which only ever show the next few seconds. So the music ahead is
// drawn the way a long road is: the line of sound is down near you and what is
// coming climbs toward a horizon, quickly at first and then hardly at all, so the
// whole piece is on the screen at once. You see the chorale a long way off before
// it arrives, you see the emptiness where it stops, and you see the warm line of
// the ritornello while it is still a minute away.
//
// What is drawn, and where each of it comes from:
//  - one bar of light per note, as tall as the note is and as far across as it is
//    high: sideways is pitch, as it always is here, so a chord spreads out.
//  - the climb. A moment one second ahead lifts a little above the line of sound
//    and every further few seconds lifts it by less, so near music is roomy and far
//    music crowds, and the whole piece fits without scrolling.
//  - a line at every bar and a stronger one every phrase, crowding toward the
//    horizon, which is what makes the distance read as distance.
//  - warm where a bar begins something the piece already played; src/echoes.js
//    works that out from the notes, and here you can see it coming.
//  - an arrival. The line to follow comes in after a rest, so each of its
//    entrances is marked while it is still far off and blooms when it is struck.

window.Bach = window.Bach || {};

(function (Bach) {
  var HORIZON = 0.17; // how far up the screen the far music settles
  var SOUND = 0.86; // the line of sound: where a note is struck
  var STEP = 2.5; // seconds the climb is measured in: smaller means a faster near hand
  var SINK = 1.7; // how much faster played music drops than the same time ahead lifts
  var TAIL = 2.4; // seconds a note takes to sink away and go dark after it stops
  var BREATH = 10; // seconds a line has to be gone for its next note to be an arrival
  var BLOOM = 1.8; // seconds an arrival glows for once it is struck
  var TRAIL = 0.3; // how fast the last frame is veiled: less = a longer trail
  var COOL = "#bcd0f0"; // bar lines and the line of sound
  var WARM = "#ffb066"; // a bar line that begins something already heard

  function createVigilLook(canvas) {
    var screen = Bach.createScreen(canvas);
    var ctx = screen.ctx;
    var notes = [];
    var pick = Bach.colourPicker({});
    var bars = [0];
    var phraseBars = 4;
    var pitchLow = 0;
    var pitchHigh = 0;
    var pieceSeconds = 1;
    var echoes = []; // stretches the piece plays again: [{ at, until }]
    var warmLines = {}; // the bars that begin one of those, by their second
    var arrivals = []; // where the line to follow comes in after a rest
    var from = 0;
    var to = 0;
    var lastNow = -1;
    var time = 0;

    // Where the line of sound is, where the horizon is, and how tall one step of
    // the climb is for this screen and this piece. Filled in at the top of frame.
    var view = { line: 1, horizon: 0, span: 1, step: 1, full: 1 };

    screen.onResize(function () {
      lastNow = -1;
    });

    function reset(list, look) {
      notes = list;
      pick = Bach.colourPicker(look.colours);
      bars = look.bars && look.bars.length > 1 ? look.bars : [0];
      phraseBars = Math.max(1, look.phrase || 4);
      pitchLow = look.pitchLow;
      pitchHigh = look.pitchHigh;
      pieceSeconds = look.duration || secondsOf(list);
      echoes = Bach.echoes(notes, bars, { minBars: phraseBars });
      warmLines = {};
      for (var i = 0; i < echoes.length; i++) warmLines[String(echoes[i].at)] = true;
      arrivals = entrances(list);
      from = 0;
      to = 0;
      lastNow = -1;
      screen.wipe();
    }

    /** How long the piece is, if nothing was said about it. */
    function secondsOf(list) {
      if (list.length === 0) return 1;
      var last = list[list.length - 1];
      return last.time + last.length;
    }

    /**
     * The notes that begin the line to follow after it has been gone a while. In
     * BWV 645 the chorale waits 50 seconds for its turn, then leaves for 29 and
     * for 23: those three entrances are the shape of the piece, so they get
     * marked. A breath inside a phrase is not an arrival - at ten seconds or
     * more this finds exactly those three and no others.
     */
    function entrances(list) {
      var found = [];
      var lastEnd = {};
      for (var i = 0; i < list.length; i++) {
        var note = list[i];
        if (note.role !== "melody") continue;
        var line = String(note.voice);
        var end = note.time + note.length;
        if (lastEnd[line] === undefined || note.time - lastEnd[line] >= BREATH) found.push(note);
        if (lastEnd[line] === undefined || end > lastEnd[line]) lastEnd[line] = end;
      }
      return found;
    }

    function xFor(pitch) {
      var width = screen.width();
      var margin = Math.min(120, width * 0.12);
      var span = Math.max(1, pitchHigh - pitchLow);
      return margin + ((pitch - pitchLow) / span) * (width - margin * 2);
    }

    /** How far the music has climbed after this many seconds: the further ahead,
     *  the less each second lifts it, which is what crowds the far end of the road. */
    function climb(seconds) {
      if (seconds <= 0) return 0;
      return Math.log(1 + seconds / STEP);
    }

    /** Where a moment is drawn: above the line of sound while it is coming, below
     *  it once it has been struck. */
    function yFor(at, now) {
      var ahead = at - now;
      if (ahead >= 0) return view.line - view.step * climb(ahead);
      return view.line + view.step * climb(-ahead) * SINK;
    }

    /** 1 for a note at hand, falling to 0 for one still at the horizon. */
    function near(at, now) {
      var share = 1 - climb(at - now) / view.full;
      return Math.max(0, Math.min(1, share));
    }

    /** How thick a voice's light is: the line to follow is the stoutest, in the
     *  same order the organ plays them. */
    function weightOf(note) {
      if (note.role === "melody") return 5.5;
      if (note.role === "pedal") return 4.5;
      return 3;
    }

    /** The part of a note still to come: a thin, faint thing, dimmer the further
     *  off it is - too far off, it is not even a hairline yet. */
    function coming(x, top, bottom, colour, weight, strength) {
      if (bottom <= top || strength <= 0.02) return;
      var thick = weight * (0.35 + 0.65 * strength);
      if (strength > 0.3) {
        ctx.globalAlpha = 0.09 * strength;
        ctx.fillStyle = colour;
        ctx.fillRect(x - thick * 1.8, top, thick * 3.6, bottom - top);
      }
      ctx.globalAlpha = 0.045 + 0.45 * strength;
      ctx.fillStyle = colour;
      ctx.fillRect(x - thick * 0.4, top, thick * 0.8, bottom - top);
    }

    /** The part of a note that has sounded: a glow, a body, a bright core. */
    function sounded(x, top, bottom, colour, weight, strength) {
      if (bottom <= top || strength <= 0.02) return;
      ctx.globalAlpha = 0.09 * strength;
      ctx.fillStyle = colour;
      ctx.fillRect(x - weight * 1.6, top, weight * 3.2, bottom - top);
      ctx.globalAlpha = 0.45 * strength;
      ctx.fillRect(x - weight * 0.4, top, weight * 0.8, bottom - top);
      ctx.globalAlpha = Math.min(1, 0.9 * strength);
      ctx.fillRect(x - 0.9, top, 1.8, bottom - top);
    }

    function frame(now) {
      var width = screen.width();
      var height = screen.height();

      view.line = Math.round(height * SOUND);
      view.horizon = Math.round(height * HORIZON);
      view.span = view.line - view.horizon;
      view.full = climb(pieceSeconds);
      view.step = view.span / view.full;

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

      // Everything is on the screen: the piece from here to its last note, and the
      // last couple of seconds of what has already sounded, on its way out.
      if (from > to) to = from;
      while (from < notes.length && notes[from].time + notes[from].length < now - TAIL) from++;
      while (to < notes.length && notes[to].time < now + pieceSeconds + 0.1) to++;

      // How much is sounding right now: the light behind everything grows with it.
      var sounding = 0;
      for (var i = from; i < to; i++) {
        if (notes[i].time <= now && notes[i].time + notes[i].length >= now) sounding++;
      }

      ctx.globalCompositeOperation = "lighter";

      // A slow breath of light behind the line of sound.
      var breathe = 0.5 + 0.5 * Math.sin(time * 0.19);
      var radius = (0.3 + 0.1 * breathe + 0.02 * sounding) * Math.max(width, height);
      var halo = ctx.createRadialGradient(width / 2, view.line, 0, width / 2, view.line, radius);
      halo.addColorStop(0, "rgba(46,66,112," + (0.03 + 0.008 * sounding).toFixed(3) + ")");
      halo.addColorStop(1, "rgba(6,8,16,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      // The horizon: where the far music settles, and how much of it is there.
      var far = ctx.createLinearGradient(0, view.horizon - 50, 0, view.horizon + 140);
      far.addColorStop(0, "rgba(90,120,180,0)");
      far.addColorStop(0.3, "rgba(96,126,186," + (0.05 + 0.004 * sounding).toFixed(3) + ")");
      far.addColorStop(1, "rgba(6,8,16,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = far;
      ctx.fillRect(0, view.horizon - 50, width, 190);

      // The pitch of the music: a faint line at every C, so the eye can tell how
      // high a note is and see a chord spread.
      ctx.fillStyle = COOL;
      for (var pitch = Math.ceil(pitchLow / 12) * 12; pitch <= pitchHigh; pitch += 12) {
        ctx.globalAlpha = 0.045;
        ctx.fillRect(xFor(pitch) - 0.5, view.horizon - 6, 1, view.span + 6);
      }

      // The bar lines, crowding toward the horizon. A bar that begins something
      // the piece already played is warm, and stays warm while it is still to come.
      for (var b = 0; b < bars.length; b++) {
        var y = yFor(bars[b], now);
        if (y < view.horizon - 2 || y > height + 4) continue;
        var close = near(bars[b], now);
        var phraseLine = b % phraseBars === 0;
        var warm = warmLines[String(bars[b])] === true;
        ctx.fillStyle = warm ? WARM : COOL;
        if (warm) {
          ctx.globalAlpha = 0.05 + 0.07 * close;
          ctx.fillRect(0, y - 7, width, 14);
        }
        var thick = (phraseLine ? 2 : 1) * (0.5 + 0.5 * close);
        ctx.globalAlpha = (warm ? 0.3 : phraseLine ? 0.15 : 0.06) * (0.35 + 0.65 * close);
        ctx.fillRect(0, y - thick / 2, width, thick);
      }

      // The notes.
      for (var n = from; n < to; n++) {
        var note = notes[n];
        var weight = weightOf(note);
        var colour = pick(note.voice, n);
        var x = xFor(note.pitch);
        var top = yFor(note.time + note.length, now);
        var bottom = yFor(note.time, now);
        if (top < view.horizon - 4) top = view.horizon - 4;
        if (bottom <= top) continue; // too far off to be a pixel yet

        if (note.time > now) {
          coming(x, top, bottom, colour, weight, near(note.time, now));
        } else {
          var age = now - (note.time + note.length);
          var strength = age <= 0 ? 1 : Math.max(0, 1 - age / TAIL);
          // Only what has sounded is lit, and that is the part below the line of
          // sound. The rest of the bar is still on its way and stays faint.
          sounded(x, Math.max(top, view.line), bottom, colour, weight, strength);
          if (top < view.line) coming(x, top, view.line, colour, weight, 0.45);
        }
      }

      // The arrivals of the line to follow: a mark while they are still off, and a
      // bloom the moment one of them is struck.
      for (var e = 0; e < arrivals.length; e++) {
        var arrival = arrivals[e];
        var ax = xFor(arrival.pitch);
        var ay = yFor(arrival.time, now);
        var wear = pick(arrival.voice, 0);
        var away = arrival.time - now;
        if (away > 0) {
          var close = near(arrival.time, now);
          var size = 5 + 34 * close;
          var lamp = ctx.createRadialGradient(ax, ay, 0, ax, ay, size);
          lamp.addColorStop(0, wear);
          lamp.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = 0.07 + 0.3 * close;
          ctx.fillStyle = lamp;
          ctx.fillRect(ax - size, ay - size, size * 2, size * 2);
        } else if (now - arrival.time < BLOOM) {
          var faded = 1 - (now - arrival.time) / BLOOM;
          var wide = 24 + 130 * faded * faded;
          var bloom = ctx.createRadialGradient(ax, view.line, 0, ax, view.line, wide);
          bloom.addColorStop(0, wear);
          bloom.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = 0.4 * faded;
          ctx.fillStyle = bloom;
          ctx.fillRect(ax - wide, view.line - wide, wide * 2, wide * 2);
        }
      }

      // The line of sound: brighter while more notes are sounding.
      var warmth = Math.min(1, sounding / 5);
      var band = ctx.createLinearGradient(0, view.line - 30, 0, view.line + 30);
      band.addColorStop(0, "rgba(120,150,200,0)");
      band.addColorStop(0.5, "rgba(150,180,230," + (0.05 + 0.09 * warmth).toFixed(3) + ")");
      band.addColorStop(1, "rgba(120,150,200,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = band;
      ctx.fillRect(0, view.line - 30, width, 60);
      ctx.fillStyle = "rgba(190,210,240," + (0.1 + 0.14 * warmth).toFixed(3) + ")";
      ctx.fillRect(0, view.line, width, 1);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    return { reset: reset, frame: frame };
  }

  Bach.looks.vigil = createVigilLook;
})(window.Bach);
