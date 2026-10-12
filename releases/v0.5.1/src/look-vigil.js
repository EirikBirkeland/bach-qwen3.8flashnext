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
//  - the pulse, when someone is playing along. The game would otherwise lay its
//    ladder of falling beats over this picture; the road takes it instead, as a
//    lamp on each of its verges - see `pulse` below.

window.Bach = window.Bach || {};

(function (Bach) {
  var HORIZON = 0.17; // how far up the screen the far music settles
  var SOUND = 0.86; // the line of sound: where a note is struck
  var STEP = 2.5; // seconds the climb is measured in: smaller means a faster near hand
  var SINK = 1.7; // how much faster played music drops than the same time ahead lifts
  var TAIL = 2.4; // seconds a note takes to sink away and go dark after it stops
  var BREATH = 10; // seconds a line has to be gone for its next note to be an arrival
  var BLOOM = 1.8; // seconds an arrival glows for once it is struck
  var CEILING = 0.65; // how much light a struck note's core may be, whatever it wears
  var STRONGEST = 0.8; // ... and the alpha it is laid at when its colour is dark enough
  var CORE = 0.9; // how wide that core is, on either side of the note, in pixels
  var COLUMN = 4; // how wide a strip of the screen one core may own, in pixels
  var TRAIL = 0.3; // how fast the last frame is veiled: less = a longer trail
  var COOL = "#bcd0f0"; // bar lines and the line of sound
  var WARM = "#ffb066"; // a bar line that begins something already heard
  var MARK = "#e8f1ff"; // a beat of the player's pulse, planted on the verge.
  // Never gold, which is the line to follow, and never warm, which is a repeat.
  var BEATS = 4; // while a beat is this many beats off it gets a lamp to itself
  var EDGE = 0.6; // where a lamp stands within the verge, as a share of its width
  var VERGE = 26; // how wide a strip of the verge the run can light

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

    /** How wide a verge is: the strip at either side no note is ever drawn in. */
    function verge() {
      return Math.min(120, screen.width() * 0.12);
    }

    function xFor(pitch) {
      var width = screen.width();
      var margin = verge();
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

    /** The part of a note that has sounded: a glow, a body, a bright core.
     *
     * One light deep, never three. The body used to run on underneath the core, so
     * the three layers laid 1.44 of the voice's own colour in one 1.8px line - over
     * full scale on its own, which is how the brightest notes of this picture came
     * out white instead of gold and burnt their cell out on the way (see
     * tools/burn.mjs). So the body gives way where the core lies, the whole width of
     * the note is kept and nothing is added on top of anything, and the core's alpha
     * is capped by how much light its colour already carries: a violet note and a
     * gold one are struck with the same amount of light, and both keep the colour
     * that says which voice they are. `thread` says whether this note lays that core at
     * all: one strip of the screen gets one, and `owners` says whose.
     */
    function sounded(x, top, bottom, colour, weight, strength, thread) {
      if (bottom <= top || strength <= 0.02) return;
      var flare = 0.09 * strength;
      // The most of this colour that may be laid in one place, and what is left for
      // the core once the flare has had its share of that place.
      var room = Math.min(1, CEILING / Bach.lightOf(colour));
      var bright = Math.min(STRONGEST * strength, room - flare);
      var half = weight * 0.4;
      ctx.fillStyle = colour;
      ctx.globalAlpha = flare;
      ctx.fillRect(x - weight * 1.6, top, weight * 3.2, bottom - top);
      ctx.globalAlpha = 0.45 * strength;
      if (half > CORE) {
        ctx.fillRect(x - half, top, half - CORE, bottom - top);
        ctx.fillRect(x + CORE, top, half - CORE, bottom - top);
      }
      if (!thread) return; // that pitch is already a bright thread, laid by a better line
      ctx.globalAlpha = bright;
      ctx.fillRect(x - CORE, top, CORE * 2, bottom - top);
    }

    /** Which strip of the screen a note's core belongs to. */
    function column(x) {
      return Math.round(x / COLUMN);
    }

    /**
     * Whose the bright thread is on each strip of the screen.
     *
     * Two voices can strike one pitch in the same moment - this arrangement of BWV
     * 645 does it four times - and their bars fall on one 1.8px line, where two full
     * lights are white rather than loud however little each of them is on its own. So
     * one strip gets one thread, and it goes to the note shining brightest there: the
     * stoutest line the organ plays, unless that one is on its way out. The others
     * keep their flare and their body, so the pitch is still lit and only the thread
     * is told once, in the colour of the line the ear is following.
     */
    function owners(now) {
      var mine = {};
      var shine = {};
      for (var n = from; n < to; n++) {
        var note = notes[n];
        if (note.time > now) break; // sorted by time: nothing past this has sounded
        var age = now - (note.time + note.length);
        if (age > TAIL) continue; // and that one has gone dark
        var strip = column(xFor(note.pitch));
        var bright = weightOf(note) * (age <= 0 ? 1 : 1 - age / TAIL);
        if (mine[strip] === undefined || bright > shine[strip]) {
          mine[strip] = note;
          shine[strip] = bright;
        }
      }
      return mine;
    }

    /** A round light laid on the screen, only the part of it that is on it. */
    function bloom(x, y, size, colour, strength) {
      if (size <= 0 || strength <= 0.01) return;
      var round = ctx.createRadialGradient(x, y, 0, x, y, size);
      round.addColorStop(0, colour);
      round.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = strength;
      ctx.fillStyle = round;
      var left = Math.max(0, x - size);
      var top = Math.max(0, y - size);
      var width = screen.width();
      var height = screen.height();
      ctx.fillRect(left, top, Math.min(width, x + size) - left, Math.min(height, y + size) - top);
    }

    /**
     * A lamp by the road: a bead of light with a soft light round it, bigger and
     * brighter the nearer its beat is. Far off it is a speck, and no more.
     */
    function lamp(x, y, size, colour, strength) {
      if (size <= 0 || strength <= 0.01) return;
      ctx.fillStyle = colour;
      if (size > 5) {
        ctx.globalAlpha = strength * 0.12;
        ctx.fillRect(x - size, y - size * 0.6, size * 2, size * 1.2);
      }
      var bead = 1.4 + size * 0.18;
      ctx.globalAlpha = strength;
      ctx.fillRect(x - bead / 2, y - bead / 2, bead, bead);
    }

    /**
     * The player's pulse, planted along the road.
     *
     * The game could lay its ladder of falling beats over this picture, and does
     * for the pieces that have nowhere else to put a beat. The road has: a ladder
     * two beats tall is a worse version of what is already here, since this is a
     * picture of the whole piece at once. So every beat becomes a lamp on the two
     * verges, standing at the height its moment has reached on the climb. Near at
     * hand there is one to a beat; further off, one to a bar, since past a few
     * beats the beats themselves are a few pixels apart. A beat the piece is
     * marking for itself keeps its lamp however far off it is - which is the thing
     * a ladder could not do: the chorale coming in a minute from now is already on
     * this screen.
     *
     * What the player strikes does not walk back down the verges - that part of
     * the screen belongs to the words the page writes - it lands on the line of
     * sound, where the beat has got to, at the two verges. The verges themselves
     * brighten as a run grows, which is this picture's version of the ladder's
     * line getting wider.
     *
     * The shot comes from src/game.js and is only read here: this draws the pulse,
     * it does not judge it.
     */
    function pulse(shot) {
      var width = screen.width();
      var margin = verge();
      var left = margin * EDGE;
      var right = width - left;
      var gap = shot.gap > 0 ? shot.gap : 1;

      ctx.globalCompositeOperation = "lighter";

      // A long run lights the edges of the road itself.
      if (shot.run > 0.02) {
        var top = view.horizon;
        var drop = view.line - view.horizon;
        ctx.fillStyle = MARK;
        ctx.globalAlpha = 0.008 + 0.02 * shot.run;
        ctx.fillRect(left - VERGE / 2, top, VERGE, drop);
        ctx.fillRect(right - VERGE / 2, top, VERGE, drop);
        ctx.globalAlpha = 0.04 + 0.16 * shot.run;
        ctx.fillRect(left - 1, top, 2, drop);
        ctx.fillRect(right - 1, top, 2, drop);
      }

      // The lamps, from the beat being struck now up to the last the road holds.
      for (var i = shot.pointer; i < shot.beats.length; i++) {
        var beat = shot.beats[i];
        if (beat.taken) continue; // that one is light on the line of sound now
        var away = beat.time - shot.now;
        if (away < 0) continue; // gone by, and nobody's to strike any more
        var y = yFor(beat.time, shot.now);
        if (y < view.horizon - 2) break; // past the far end of the road
        // One to a beat while the beats can be told apart, one to a bar beyond
        // that, and one to any beat the piece is marking for itself however far
        // off it is - the chorale coming in a minute from now is already on this
        // screen, which is the one thing a ladder two beats tall could never say.
        if (away > BEATS * gap && !beat.bar && !beat.bright) continue;
        var close = near(beat.time, shot.now);
        var size = (beat.bright ? 2 : 1) * (2 + 11 * close);
        // Faint by numbers, and never bright: a lamp stands within a couple of
        // pixels of the next one up the road, and a heap of bright lights on one
        // strip of screen is one white smear - the one thing a road may not be.
        var strength = beat.bright ? 0.22 + 0.23 * close : 0.1 + 0.35 * close * close;
        lamp(left, y, size, MARK, strength);
        lamp(right, y, size, MARK, strength);
      }

      // What the player struck, on the line of sound at each verge, and fading.
      for (var s = 0; s < shot.strikes.length; s++) {
        var one = shot.strikes[s];
        var faded = Math.max(0, 1 - (shot.now - one.at) / shot.fade);
        if (faded <= 0.01) continue;
        if (one.when === null || one.when === undefined) {
          // A click with no beat near it: a dull flick at either hand.
          ctx.fillStyle = MARK;
          ctx.globalAlpha = 0.05 * faded;
          ctx.fillRect(left - 9, view.line - 1, 18, 2);
          ctx.fillRect(right - 9, view.line - 1, 18, 2);
          continue;
        }
        var reach = (one.truest ? 34 : 22) + 80 * faded * faded + 30 * shot.run;
        bloom(left, view.line, reach, MARK, (one.truest ? 0.13 : 0.09) * faded);
        bloom(right, view.line, reach, MARK, (one.truest ? 0.13 : 0.09) * faded);
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
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

      // The notes. One bright thread per strip of the screen, and who gets it is
      // settled before any of them is drawn, since the thread belongs to whichever
      // note is shining most on that strip and not to whichever was written down first.
      var lit = owners(now);
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
          sounded(x, Math.max(top, view.line), bottom, colour, weight, strength, lit[column(x)] === note);
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
          var marker = ctx.createRadialGradient(ax, ay, 0, ax, ay, size);
          marker.addColorStop(0, wear);
          marker.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = 0.07 + 0.3 * close;
          ctx.fillStyle = marker;
          ctx.fillRect(ax - size, ay - size, size * 2, size * 2);
        } else if (now - arrival.time < BLOOM) {
          var faded = 1 - (now - arrival.time) / BLOOM;
          var wide = 24 + 130 * faded * faded;
          var glow = ctx.createRadialGradient(ax, view.line, 0, ax, view.line, wide);
          glow.addColorStop(0, wear);
          glow.addColorStop(1, "rgba(0,0,0,0)");
          ctx.globalAlpha = 0.4 * faded;
          ctx.fillStyle = glow;
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

    return { reset: reset, frame: frame, pulse: pulse };
  }

  Bach.looks.vigil = createVigilLook;
})(window.Bach);
