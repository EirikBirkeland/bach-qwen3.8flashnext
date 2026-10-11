// The fugue look: a tune you learn, and then see coming back.
//
// This is the picture for BWV 565, and it exists for a few things about that
// piece that falling notes cannot show. Its fugue is one subject heard eight
// times, handed from one line to another, three of those times by a pedal that
// had been silent for a minute and more. Its middle is bare: for eleven bars one
// note sounds at a time. And its toccata and its end are chords - eight or nine
// notes struck together, which is the widest anything here gets.
//
// So:
//  - the subject is gold, wherever it is and whoever is playing it. It is the line
//    to follow in this piece, and it changes hands, so the colour goes with the
//    tune and not with the voice. src/theme.js works out what the tune is, from
//    the notes.
//  - a lamp shows where the next telling of it will land, while it is still above
//    the line of sound, and a bloom marks the moment it is struck.
//  - a chord of five notes or more is drawn as a flare right across the light it
//    covers, because a chord in this piece is an event and not a texture. In the
//    fugue nothing reaches five at once: the flares mark the toccata and the end,
//    which is what they are for.
//  - a voice coming back after a long silence blooms in its own colour. The pedal
//    waits ninety seconds and more twice; when it comes back it should be a scene.
//  - the whole picture breathes with how thick the music is. When one note sounds
//    at a time the trails stretch and that note is drawn big, so the bare middle
//    looks bare instead of merely empty.
//
// As always sideways is pitch, so a chord spreads out and you can see how wide it
// is, and a bar line is drawn where the music's own bar lines are.

window.Bach = window.Bach || {};

(function (Bach) {
  var SPEED = 58; // pixels a second of music takes on the way down
  var SOUND = 0.78; // where a note is struck
  var TRAIL_THIN = 0.12; // how fast the last frame is veiled when hardly anything sounds
  var TRAIL_FULL = 0.3; // ... and when the whole organ is going
  var FULL = 6; // how many notes sounding counts as "the whole organ"
  var TAIL = 2.6; // seconds a note takes to go dark once it has stopped
  var WAKE = 10; // seconds a voice has to be gone for before its return is a homecoming
  var WAKE_BLOOM = 1.8; // seconds a returning voice glows for
  var ENTRY_BLOOM = 2.2; // seconds a telling of the subject glows for
  var CHORD = 5; // notes struck together before it counts as a chord
  var CHORD_FADE = 0.9; // seconds a chord's flare lasts
  var GOLD = "#ffd47a"; // the subject, whoever is playing it
  var STRIKE = "#eef3ff"; // the hot line where a whole chord was struck
  var COOL = "#bcd0f0"; // bar lines, pitch lines, the line of sound

  function createSubjectLook(canvas) {
    var screen = Bach.createScreen(canvas);
    var ctx = screen.ctx;
    var notes = [];
    var pick = Bach.colourPicker({});
    var bars = [0];
    var phraseBars = 4;
    var pitchLow = 0;
    var pitchHigh = 0;
    var tune = null; // what comes back: { notes, heard: [...] }
    var tuneFrom = null; // the notes that was worked out from
    var subject = {}; // every note that is one telling of it, by its key
    var wakes = []; // where a voice comes back after a long silence
    var chords = []; // where a handful of notes are struck together
    var from = 0;
    var to = 0;
    var lastNow = -1;
    var time = 0;
    // Filled in at the top of every frame, so the helpers know the size of things.
    var view = { width: 1, height: 1 };

    screen.onResize(function () {
      lastNow = -1;
    });

    /**
     * A note's own name. Nothing plays the same note twice at the same moment -
     * the converter left doubled notes out for that reason - so voice, pitch and
     * second together pick out exactly one note.
     */
    function keyOf(note) {
      return note.voice + ":" + note.pitch + ":" + note.time;
    }

    function reset(list, look) {
      notes = list;
      pick = Bach.colourPicker(look.colours);
      bars = look.bars && look.bars.length > 1 ? look.bars : [0];
      phraseBars = Math.max(1, look.phrase || 4);
      pitchLow = look.pitchLow;
      pitchHigh = look.pitchHigh;

      // Finding the tune is the one expensive part - a fraction of a second for
      // the longest piece - and it is the same every time, so it is only done
      // again when it is a different piece being asked about.
      if (tuneFrom !== list) {
        tune = Bach.theme ? Bach.theme(list, { bars: bars }) : null;
        tuneFrom = list;
        subject = {};
        if (tune) {
          for (var h = 0; h < tune.heard.length; h++) {
            var heard = tune.heard[h].notes;
            for (var i = 0; i < heard.length; i++) subject[keyOf(heard[i])] = true;
          }
        }
        wakes = returns(list);
        chords = struckTogether(list);
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
          continue; // a voice's first note is not a return
        }
        if (note.time - ended[line] >= WAKE) found.push(note);
        if (end > ended[line]) ended[line] = end;
      }
      return found;
    }

    /**
     * Where CHORD notes or more begin together, as one moment: when it was struck,
     * and how far across the screen the notes of it reach.
     */
    function struckTogether(list) {
      var found = [];
      var group = [];
      for (var i = 0; i <= list.length; i++) {
        var note = list[i];
        // Notes arrive in time order, so a group is a run of them beginning within
        // a twentieth of a second of the first.
        if (note && group.length > 0 && note.time - group[0].time < 0.02) {
          group.push(note);
          continue;
        }
        if (group.length >= CHORD) {
          var low = group[0].pitch;
          var high = group[0].pitch;
          for (var g = 0; g < group.length; g++) {
            if (group[g].pitch < low) low = group[g].pitch;
            if (group[g].pitch > high) high = group[g].pitch;
          }
          found.push({ time: group[0].time, low: low, high: high, notes: group.length });
        }
        group = note ? [note] : [];
      }
      return found;
    }

    function xFor(pitch) {
      var width = screen.width();
      var margin = Math.min(120, width * 0.12);
      var span = Math.max(1, pitchHigh - pitchLow);
      return margin + ((pitch - pitchLow) / span) * (width - margin * 2);
    }

    /** How thick a line is drawn: the one to follow is the stoutest, in the same
     *  order the organ plays them, and everything is drawn stouter the fewer notes
     *  there are, so a bare moment is not a thin one. */
    function weightOf(note, thin) {
      var weight = note.role === "melody" ? 5.5 : note.role === "pedal" ? 4.5 : 3;
      if (subject[keyOf(note)] === true) weight += 0.8;
      return weight * (1 + 0.4 * thin);
    }

    /** A bar of light still on its way down: a hairline and a little body. */
    function coming(x, top, bottom, colour, weight, strength) {
      if (bottom <= top || strength <= 0.02) return;
      var thick = weight * (0.3 + 0.7 * strength);
      ctx.globalAlpha = 0.06 * strength;
      ctx.fillStyle = colour;
      ctx.fillRect(x - thick, top, thick * 2, bottom - top);
      ctx.globalAlpha = 0.05 + 0.28 * strength;
      ctx.fillRect(x - thick * 0.3, top, thick * 0.6, bottom - top);
    }

    /** A bar of light that has been struck: a glow, a body, and a bright core. */
    function sounded(x, top, bottom, colour, weight, strength) {
      if (bottom <= top || strength <= 0.02) return;
      ctx.globalAlpha = 0.1 * strength;
      ctx.fillStyle = colour;
      ctx.fillRect(x - weight * 1.7, top, weight * 3.4, bottom - top);
      ctx.globalAlpha = 0.45 * strength;
      ctx.fillRect(x - weight * 0.45, top, weight * 0.9, bottom - top);
      ctx.globalAlpha = Math.min(1, 0.95 * strength);
      ctx.fillRect(x - 1, top, 2, bottom - top);
    }

    /** A round glow: used for an arrival, a return, and a chord. Only the part of
     *  it that is on the screen is asked for. */
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

    /** Everything a chord is: a hot line where it was struck, spread as wide as
     *  the chord itself, and a soft light over all of it. */
    function chordFlare(chord, line, faded) {
      var x1 = xFor(chord.low);
      var x2 = xFor(chord.high);
      var left = Math.max(0, Math.min(x1, x2) - 30);
      var right = Math.min(view.width, Math.max(x1, x2) + 30);
      if (right <= left) return;
      var tall = 26 + chord.notes * 2;
      var band = ctx.createLinearGradient(left, 0, right, 0);
      band.addColorStop(0, "rgba(255,212,122,0)");
      band.addColorStop(0.5, "rgba(255,226,168,1)");
      band.addColorStop(1, "rgba(255,212,122,0)");
      ctx.globalAlpha = 0.24 * faded;
      ctx.fillStyle = band;
      ctx.fillRect(left, line - tall, right - left, tall * 2);
      ctx.globalAlpha = 0.5 * faded;
      ctx.fillStyle = STRIKE;
      ctx.fillRect(left, line - 1, right - left, 2);
    }

    function frame(now) {
      var width = screen.width();
      var height = screen.height();
      view.width = width;
      view.height = height;
      var line = Math.round(height * SOUND);
      var reach = line / SPEED; // how many seconds of music fit on the screen

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

      if (from > to) to = from;
      while (from < notes.length && notes[from].time + notes[from].length < now - TAIL) from++;
      while (to < notes.length && notes[to].time < now + reach + 0.1) to++;

      // How much of the organ is going: that decides how long the trails are, how
      // big the light behind everything is, and how stout the notes are drawn.
      var sounding = 0;
      for (var i = from; i < to; i++) {
        var note = notes[i];
        if (note.time <= now && note.time + note.length >= now) sounding++;
      }
      var thick = Math.max(0, Math.min(1, sounding / FULL));
      var thin = 1 - thick;

      if (!jumped) screen.veil(TRAIL_THIN + (TRAIL_FULL - TRAIL_THIN) * thick);

      ctx.globalCompositeOperation = "lighter";

      // A slow breath of light behind the line of sound, grown by the music.
      var breathe = 0.5 + 0.5 * Math.sin(time * 0.19);
      var radius = (0.3 + 0.12 * breathe + 0.02 * sounding) * Math.max(width, height);
      var halo = ctx.createRadialGradient(width / 2, line, 0, width / 2, line, radius);
      halo.addColorStop(0, "rgba(46,66,112," + (0.01 + 0.01 * sounding).toFixed(3) + ")");
      halo.addColorStop(1, "rgba(6,8,16,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);

      // The pitch of the music: a faint line at every C, so a chord's width and a
      // melody's height have a ruler to be measured against.
      ctx.fillStyle = COOL;
      for (var pitch = Math.ceil(pitchLow / 12) * 12; pitch <= pitchHigh; pitch += 12) {
        ctx.globalAlpha = 0.04;
        ctx.fillRect(xFor(pitch) - 0.5, 0, 1, height);
      }

      // The bar lines, four seconds apart here. A stronger one every phrase.
      for (var b = 0; b < bars.length; b++) {
        var y = Math.round(line - (bars[b] - now) * SPEED);
        if (y < -2 || y > height + 2) continue;
        var phraseLine = b % phraseBars === 0;
        ctx.fillStyle = COOL;
        ctx.globalAlpha = phraseLine ? 0.09 : 0.04;
        ctx.fillRect(0, y - (phraseLine ? 1 : 0.5), width, phraseLine ? 2 : 1);
      }

      // The chords: struck together, and flaring across all the ground they cover.
      for (var c = 0; c < chords.length; c++) {
        var chord = chords[c];
        var since = now - chord.time;
        if (since < 0 || since > CHORD_FADE) continue;
        chordFlare(chord, line, 1 - since / CHORD_FADE);
      }

      // The notes.
      for (var n = from; n < to; n++) {
        var one = notes[n];
        var end = one.time + one.length;
        var gold = subject[keyOf(one)] === true;
        var colour = gold ? GOLD : pick(one.voice, n);
        var weight = weightOf(one, thin);
        var x = xFor(one.pitch);
        // The bar is the note: its far end is above the line until it is due, and
        // the end it began at hangs below once it has been struck.
        var top = line - (end - now) * SPEED;
        var bottom = line + (now - one.time) * SPEED;
        if (top > height + 20 || bottom < -20) continue;
        if (top < -40) top = -40;
        if (bottom > height + 20) bottom = height + 20;

        if (one.time > now) {
          coming(x, top, bottom, colour, weight, Math.max(0.25, 1 - (one.time - now) / reach));
          continue;
        }
        if (top < line) coming(x, top, Math.min(bottom, line), colour, weight, 0.45);
        var age = now - end;
        sounded(x, Math.max(top, line), bottom, colour, weight, age <= 0 ? 1 : Math.max(0, 1 - age / TAIL));
      }

      // The subject: a lamp where the next telling is going to land, and a bloom
      // when it is struck. Both gold, because in this piece it is the tune that is
      // followed and not any one pair of hands.
      if (tune) {
        for (var e = 0; e < tune.heard.length; e++) {
          var entry = tune.heard[e];
          var x2 = xFor(entry.pitch);
          var away = entry.time - now;
          if (away > 0 && away < reach) {
            var near = 1 - away / reach;
            bloom(x2, line - away * SPEED, 6 + 30 * near, GOLD, 0.1 + 0.35 * near);
          } else if (away <= 0 && now - entry.time < ENTRY_BLOOM) {
            var faded = 1 - (now - entry.time) / ENTRY_BLOOM;
            bloom(x2, line, 40 + 170 * faded * faded, GOLD, 0.38 * faded);
          }
        }
      }

      // A voice coming back after a long silence: its own colour, its own moment.
      for (var w = 0; w < wakes.length; w++) {
        var wake = wakes[w];
        var back = now - wake.time;
        if (back < 0 || back > WAKE_BLOOM) continue;
        bloom(xFor(wake.pitch), line, 26 + 110 * (1 - back / WAKE_BLOOM), pick(wake.voice, 0), 0.3 * (1 - back / WAKE_BLOOM));
      }

      // The line of sound: brighter while more of the organ is going.
      var band = ctx.createLinearGradient(0, line - 30, 0, line + 30);
      band.addColorStop(0, "rgba(120,150,200,0)");
      band.addColorStop(0.5, "rgba(150,180,230," + (0.03 + 0.11 * thick).toFixed(3) + ")");
      band.addColorStop(1, "rgba(120,150,200,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = band;
      ctx.fillRect(0, line - 30, width, 60);
      ctx.fillStyle = "rgba(190,210,240," + (0.1 + 0.14 * thick).toFixed(3) + ")";
      ctx.fillRect(0, line, width, 1);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    return { reset: reset, frame: frame };
  }

  Bach.looks.subject = createSubjectLook;
})(window.Bach);
