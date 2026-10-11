// What the notes look like. Everything here is drawn from the notes themselves:
// pitch decides where across the screen, time decides how far down, the voice
// decides the colour, and a note is brightest as it crosses the line of sound.
//
// Depends on nothing but window; see index.html for the load order.

window.Bach = window.Bach || {};

(function (Bach) {
  var SPEED = 62; // pixels a second of music takes on the way down
  var FALL_BACK = ["#ffd47a", "#79e2ff", "#c39bff", "#ff9bb0", "#9dff9b"];

  function createVisual(canvas) {
    var ctx = canvas.getContext("2d");
    var width = 1;
    var height = 1;
    var horizon = 0;
    var notes = [];
    var from = 0;
    var to = 0;
    var lastNow = -1;
    var time = 0;
    var palette = {};
    var spare = [];
    var pitchLow = 0;
    var pitchHigh = 0;

    function setPalette(colours) {
      palette = colours || {};
      spare = [];
      for (var key in palette) {
        if (Object.prototype.hasOwnProperty.call(palette, key)) spare.push(palette[key]);
      }
    }

    function colourOf(voice, index) {
      if (palette[voice]) return palette[voice];
      if (palette[String(voice)]) return palette[String(voice)];
      return spare[index % spare.length] || FALL_BACK[index % FALL_BACK.length];
    }

    function resize() {
      var ratio = window.devicePixelRatio || 1;
      width = Math.max(320, window.innerWidth);
      height = Math.max(240, window.innerHeight);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      horizon = Math.round(height * 0.72);
      // The canvas is wiped on resize, so lay the whole background down again.
      ctx.fillStyle = "#05060b";
      ctx.fillRect(0, 0, width, height);
      lastNow = -1;
    }

    function xFor(pitch) {
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
      setPalette(look.colours);
      from = 0;
      to = 0;
      lastNow = -1;
      ctx.fillStyle = "#05060b";
      ctx.fillRect(0, 0, width, height);
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
      var glow = ctx.createRadialGradient(x, horizon, 0, x, horizon, size);
      glow.addColorStop(0, colour);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.55 * fade;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, horizon, size, 0, Math.PI * 2);
      ctx.fill();
    }

    function frame(now) {
      var elapsed = now - lastNow;
      if (lastNow < 0 || elapsed < 0 || elapsed > 0.5) elapsed = 1 / 60;
      time += elapsed;
      lastNow = now;

      // Fade the last frame instead of clearing it: moving notes leave a trail.
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(5,6,11,0.26)";
      ctx.fillRect(0, 0, width, height);

      var spanAhead = horizon / SPEED + 1;
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
        var top = horizon - (note.time - now) * SPEED;
        var bottom = horizon + (now - note.time) * SPEED;
        var strength = 1;
        var incoming = note.time - now;
        if (incoming > 0) strength = Math.max(0.25, 1 - incoming / spanAhead) * 0.8;
        if (past > 0) strength = Math.max(0, 1 - past / tailBehind);
        if (note.time <= now && end >= now) soundingCount++;
        var colour = colourOf(note.voice, i);
        if (bottom > -20 && top < height + 20) {
          bar(xFor(note.pitch), Math.max(-40, top), Math.min(height + 40, bottom), colour, strength);
        }
        if (note.time <= now && now - note.time < 0.6) {
          flare(xFor(note.pitch), colour, (now - note.time) / 0.6);
        }
      }

      // The line of sound: brighter while more notes are crossing it.
      ctx.globalAlpha = 1;
      var line = ctx.createLinearGradient(0, horizon - 26, 0, horizon + 26);
      var warmth = Math.min(1, soundingCount / 7);
      line.addColorStop(0, "rgba(120,150,200,0)");
      line.addColorStop(0.5, "rgba(150,180,230," + (0.05 + 0.1 * warmth).toFixed(3) + ")");
      line.addColorStop(1, "rgba(120,150,200,0)");
      ctx.fillStyle = line;
      ctx.fillRect(0, horizon - 26, width, 52);
      ctx.fillStyle = "rgba(190,210,240," + (0.1 + 0.16 * warmth).toFixed(3) + ")";
      ctx.fillRect(0, horizon, width, 1);

      // Every C gets a small mark, so the eye has something to hold on to.
      ctx.fillStyle = "rgba(200,215,240,0.16)";
      for (var pitch = Math.ceil(pitchLow / 12) * 12; pitch <= pitchHigh; pitch += 12) {
        var x = xFor(pitch);
        ctx.fillRect(x - 0.5, horizon - 7, 1, 14);
      }

      // A slow breath of light behind it all, grown by how much is sounding.
      var breathe = 0.5 + 0.5 * Math.sin(time * 0.21);
      var radius = (0.28 + 0.1 * breathe + 0.02 * soundingCount) * Math.max(width, height);
      var halo = ctx.createRadialGradient(width / 2, horizon, 0, width / 2, horizon, radius);
      halo.addColorStop(0, "rgba(46,66,112," + (0.02 + 0.012 * soundingCount).toFixed(3) + ")");
      halo.addColorStop(1, "rgba(6,8,16,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    window.addEventListener("resize", resize);
    resize();

    return { reset: reset, frame: frame };
  }

  Bach.createVisual = createVisual;
})(window.Bach);
