// The falling look: notes drop toward a line of sound.
//
// This is the picture for anything that moves along at walking pace - the toccata
// and fugue, the Passacaglia. Pitch decides where across the screen a note is,
// time how far down it has got, and the voice what it wears. A note is brightest
// as it crosses the line of sound, which is the moment it is struck.

window.Bach = window.Bach || {};

(function (Bach) {
  var SPEED = 62; // pixels a second of music takes on the way down
  var TRAIL = 0.26; // how fast the last frame is veiled: less = a longer trail

  function createFallLook(canvas) {
    var screen = Bach.createScreen(canvas);
    var ctx = screen.ctx;
    var notes = [];
    var pick = Bach.colourPicker({});
    var from = 0;
    var to = 0;
    var lastNow = -1;
    var time = 0;
    var pitchLow = 0;
    var pitchHigh = 0;

    screen.onResize(function () {
      // Everything on screen belongs to a frame of the old size.
      lastNow = -1;
    });

    function horizon() {
      return Math.round(screen.height() * 0.72);
    }

    function xFor(pitch) {
      var width = screen.width();
      var margin = Math.min(120, width * 0.12);
      var span = Math.max(1, pitchHigh - pitchLow);
      return margin + ((pitch - pitchLow) / span) * (width - margin * 2);
    }

    /**
     * Start over from an empty screen with a new piece: the notes to draw, how
     * wide the keyboard is, and what colour each voice wears.
     */
    function reset(list, look) {
      notes = list;
      pitchLow = look.pitchLow;
      pitchHigh = look.pitchHigh;
      pick = Bach.colourPicker(look.colours);
      from = 0;
      to = 0;
      lastNow = -1;
      screen.wipe();
    }

    /** A soft bar of light for one note: faint where it is still coming, bright
     *  where it has reached the line of sound. */
    function bar(x, top, bottom, colour, strength) {
      if (bottom <= top) return;
      var glow = ctx.createLinearGradient(0, top, 0, bottom);
      glow.addColorStop(0, "rgba(0,0,0,0)");
      glow.addColorStop(0.25, colour);
      glow.addColorStop(1, colour);
      ctx.globalAlpha = 0.13 * strength;
      ctx.fillStyle = glow;
      ctx.fillRect(x - 9, top, 18, bottom - top);
      ctx.globalAlpha = 0.5 * strength;
      ctx.fillRect(x - 3.2, top, 6.4, bottom - top);
      ctx.globalAlpha = Math.min(1, 0.95 * strength);
      ctx.fillRect(x - 1.1, top, 2.2, bottom - top);
    }

    /** The flash where a note first crosses the line of sound. */
    function flare(x, colour, howFar) {
      var size = 30 * (1 - howFar) + 6;
      var fade = (1 - howFar) * (1 - howFar);
      var glow = ctx.createRadialGradient(x, horizon(), 0, x, horizon(), size);
      glow.addColorStop(0, colour);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.55 * fade;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, horizon(), size, 0, Math.PI * 2);
      ctx.fill();
    }

    function frame(now) {
      var width = screen.width();
      var height = screen.height();
      var line = horizon();

      // A jump back into the piece: the notes already on screen belong to a later
      // moment, so start the picture again from an empty screen and from the top
      // of the note list.
      var jumpedBack = lastNow >= 0 && now < lastNow - 0.001;
      var elapsed = now - lastNow;
      if (lastNow < 0 || elapsed < 0 || elapsed > 0.5) elapsed = 1 / 60;
      time += elapsed;
      lastNow = now;

      if (jumpedBack) {
        from = 0;
        to = 0;
        screen.wipe();
      } else {
        screen.veil(TRAIL);
      }

      var spanAhead = line / SPEED + 1;
      var tailBehind = 130 / SPEED;
      if (from > to) to = from;
      while (from < notes.length && notes[from].time + notes[from].length < now - tailBehind) from++;
      while (to < notes.length && notes[to].time < now + spanAhead) to++;

      var soundingCount = 0;
      ctx.globalCompositeOperation = "lighter";
      for (var i = from; i < to; i++) {
        var note = notes[i];
        var end = note.time + note.length;
        var past = now - end;
        // The bar is the note itself: its far end (where it stops) is still above
        // the line until it is due, and the end it started at hangs below once it
        // has been struck. So its height is the length of the note.
        var top = line - (end - now) * SPEED;
        var bottom = line + (now - note.time) * SPEED;
        var strength = 1;
        var incoming = note.time - now;
        if (incoming > 0) strength = Math.max(0.25, 1 - incoming / spanAhead) * 0.8;
        if (past > 0) strength = Math.max(0, 1 - past / tailBehind);
        if (note.time <= now && end >= now) soundingCount++;
        var colour = pick(note.voice, i);
        if (bottom > -20 && top < height + 20) {
          bar(xFor(note.pitch), Math.max(-40, top), Math.min(height + 40, bottom), colour, strength);
        }
        if (note.time <= now && now - note.time < 0.6) {
          flare(xFor(note.pitch), colour, (now - note.time) / 0.6);
        }
      }

      // The line of sound: brighter while more notes are crossing it.
      ctx.globalAlpha = 1;
      var band = ctx.createLinearGradient(0, line - 26, 0, line + 26);
      var warmth = Math.min(1, soundingCount / 7);
      band.addColorStop(0, "rgba(120,150,200,0)");
      band.addColorStop(0.5, "rgba(150,180,230," + (0.05 + 0.1 * warmth).toFixed(3) + ")");
      band.addColorStop(1, "rgba(120,150,200,0)");
      ctx.fillStyle = band;
      ctx.fillRect(0, line - 26, width, 52);
      ctx.fillStyle = "rgba(190,210,240," + (0.1 + 0.16 * warmth).toFixed(3) + ")";
      ctx.fillRect(0, line, width, 1);

      // Every C gets a small mark, so the eye has something to hold on to.
      ctx.fillStyle = "rgba(200,215,240,0.16)";
      for (var pitch = Math.ceil(pitchLow / 12) * 12; pitch <= pitchHigh; pitch += 12) {
        var x = xFor(pitch);
        ctx.fillRect(x - 0.5, line - 7, 1, 14);
      }

      // A slow breath of light behind it all, grown by how much is sounding.
      var breathe = 0.5 + 0.5 * Math.sin(time * 0.21);
      var radius = (0.28 + 0.1 * breathe + 0.02 * soundingCount) * Math.max(width, height);
      var halo = ctx.createRadialGradient(width / 2, line, 0, width / 2, line, radius);
      halo.addColorStop(0, "rgba(46,66,112," + (0.02 + 0.012 * soundingCount).toFixed(3) + ")");
      halo.addColorStop(1, "rgba(6,8,16,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    return { reset: reset, frame: frame };
  }

  Bach.looks.fall = createFallLook;
})(window.Bach);
