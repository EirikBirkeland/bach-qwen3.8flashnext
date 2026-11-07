// The Great Organ Prospekt: a living Baroque cathedral organ facade.
//
// Inspired by the great Silbermann and Schnitger organs of Saxony and northern
// Germany, this look builds a symmetrical five-division pipe facade across the
// nave: flanking Pedal Towers (16' and 8' bass pipes), inner Choir and Positiv
// flats, and a commanding central Hauptwerk tower crowned by a Gothic rose
// oculus high in the stone clerestory.
//
// Every pitch in the piece is assigned to its physical pipe across the facade.
// When a note is about to speak, a beam of celestial light descends from the
// vaults toward the pipe's gilded labium (mouth); while the note sounds, wind
// of light fills the pipe body from mouth to crown and contrapuntal Gothic
// arches span overhead between simultaneously sounding intervals (octaves in
// gold, fifths in sapphire, thirds and sixths in rose-amber).

window.Bach = window.Bach || {};

(function (Bach) {
  var GOLD = "#ffd47a";
  var COOL = "#bcd0f0";
  var AMBER = "#ffb066";
  var ROSE = "#ff9bb0";
  var SAPPHIRE = "#79e2ff";
  var VIOLET = "#c39bff";
  var MARK = "#e8f1ff";
  var CASE_DARK = "#120e09";
  var CASE_GOLD = "#9b7838";
  var PIPE_TIN = "#5c687d";

  var AHEAD = 3.2; // seconds of approaching light shown above the pipe mouths
  var TAIL = 1.8; // seconds a pipe's afterglow lingers after the key lets go
  var CEILING = 0.65;
  var STRONGEST = 0.8;
  var TRAIL = 0.28;

  function createProspektLook(canvas) {
    var screen = Bach.createScreen(canvas);
    var ctx = screen.ctx;
    var notes = [];
    var pick = Bach.colourPicker({});
    var bars = [0];
    var pitchLow = 36;
    var pitchHigh = 84;
    var tune = null;
    var tuneFrom = null;
    var subject = {};
    var from = 0;
    var to = 0;
    var lastNow = -1;
    var nowTime = 0;
    var pipes = []; // geometry for each semitone from pitchLow to pitchHigh

    screen.onResize(function () {
      lastNow = -1;
      pipes = [];
    });

    function keyOf(note) {
      return note.voice + ":" + note.pitch + ":" + note.time;
    }

    function reset(list, look) {
      notes = list || [];
      pick = Bach.colourPicker(look && look.colours);
      bars = look && look.bars && look.bars.length > 1 ? look.bars : [0];
      pitchLow = (look && look.pitchLow) || 36;
      pitchHigh = (look && look.pitchHigh) || 84;
      if (pitchHigh <= pitchLow) pitchHigh = pitchLow + 36;

      if (tuneFrom !== notes) {
        tune = Bach.theme ? Bach.theme(notes, { bars: bars }) : null;
        tuneFrom = notes;
        subject = {};
        if (tune) {
          for (var h = 0; h < tune.heard.length; h++) {
            var heard = tune.heard[h].notes;
            for (var i = 0; i < heard.length; i++) subject[keyOf(heard[i])] = true;
          }
        }
      }

      from = 0;
      to = 0;
      lastNow = -1;
      pipes = [];
      screen.wipe();
    }

    /**
     * Builds the symmetrical 5-section Baroque Prospekt pipe layout for the
     * current screen dimensions and pitch range:
     *   [Left Pedal Tower] [Left Flat] [Central Great Tower] [Right Flat] [Right Pedal Tower]
     *
     * Low pitches stand in the outer Pedal Towers (alternating C-side left and
     * C#-side right, as on a real Baroque organ chest), middle pitches in the
     * Positiv/Oberwerk flats, and upper/cantus pitches in the central Hauptwerk.
     */
    function buildPipes(width, height) {
      var span = Math.max(12, pitchHigh - pitchLow + 1);
      var margin = Math.min(110, width * 0.09);
      var usableW = width - margin * 2;
      var chestY = Math.round(height * 0.78);
      var pipeW = Math.max(4, Math.min(16, (usableW / span) * 0.72));
      var out = [];

      // Assign each pitch a slot across the 5-division symmetrical facade.
      for (var p = pitchLow; p <= pitchHigh; p++) {
        var idx = p - pitchLow;
        var norm = idx / Math.max(1, span - 1); // 0 = lowest, 1 = highest
        var section = 2; // 0: L-Tower, 1: L-Flat, 2: Center Tower, 3: R-Flat, 4: R-Tower
        var local = 0; // 0..1 within section
        var parity = p % 2 === 0;

        if (norm < 0.26) {
          // Pedal towers on the outer flanks (C-side left, C#-side right)
          section = parity ? 0 : 4;
          local = norm / 0.26;
        } else if (norm < 0.62) {
          // Inner flats (Left and Right manual divisions)
          section = parity ? 1 : 3;
          local = (norm - 0.26) / 0.36;
        } else {
          // Central Hauptwerk tower
          section = 2;
          local = (norm - 0.62) / 0.38;
        }

        // Section horizontal bounds as fractions of usableW
        var bounds = [
          [0.0, 0.18],
          [0.20, 0.38],
          [0.40, 0.60],
          [0.62, 0.80],
          [0.82, 1.0],
        ][section];

        // Arrange pipes in each tower so the tallest stand toward the middle of
        // the tower (a classic mitre/pyramid pipe crown).
        var folded = parity ? local * 0.5 : 1 - local * 0.5;
        var x = margin + usableW * (bounds[0] + folded * (bounds[1] - bounds[0]));

        // Pipe height: towers rise higher than flats; central and pedal towers command the nave
        var arch = 1 - Math.abs(folded - 0.5) * 1.45; // 1 at tower center, ~0.28 at edges
        var towerScale = section === 0 || section === 4 ? 0.46 : section === 2 ? 0.42 : 0.28;
        var bodyH = Math.round(height * (0.11 + towerScale * Math.max(0.2, arch)));
        var footH = Math.round(height * (section === 2 ? 0.055 : 0.045));
        var mouthY = chestY - footH;
        var topY = mouthY - bodyH;

        out[idx] = {
          pitch: p,
          x: x,
          w: pipeW * (section === 0 || section === 4 ? 1.18 : section === 2 ? 1.0 : 0.86),
          chestY: chestY,
          mouthY: mouthY,
          topY: topY,
          bodyH: bodyH,
          section: section,
        };
      }
      return out;
    }

    /** Draws the Gothic cathedral vault ribs and the clerestory Rose Oculus behind the organ. */
    function drawCathedralVaults(width, height, fullness, now) {
      var cx = width * 0.5;
      var roseY = height * 0.16;
      var roseR = Math.min(width, height) * 0.095;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // Pointed Gothic vault ribs springing from the side pillars to the central boss
      ctx.strokeStyle = COOL;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.05 + 0.04 * fullness;
      for (var v = 0; v < 4; v++) {
        var pillarX = width * (0.08 + v * 0.28);
        ctx.beginPath();
        ctx.moveTo(pillarX, height * 0.82);
        ctx.quadraticCurveTo(pillarX, height * 0.22, cx, height * 0.04);
        ctx.stroke();
      }

      // Clerestory Gothic Rose Oculus above the central Hauptwerk tower
      ctx.translate(cx, roseY);
      ctx.strokeStyle = GOLD;
      ctx.globalAlpha = 0.035 + 0.045 * fullness;
      ctx.beginPath();
      ctx.arc(0, 0, roseR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, roseR * 0.58, 0, Math.PI * 2);
      ctx.stroke();

      var petals = 12;
      var spin = now * 0.04;
      for (var i = 0; i < petals; i++) {
        var a0 = spin + (i * Math.PI * 2) / petals;
        var a1 = a0 + Math.PI / petals;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(
          Math.cos(a0) * roseR * 0.75,
          Math.sin(a0) * roseR * 0.75,
          Math.cos(a1) * roseR,
          Math.sin(a1) * roseR
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    /** Draws the carved Baroque organ case, wind-chest, and unlit pipe silhouettes. */
    function drawOrganFacade(width, height, fullness) {
      var chestY = Math.round(height * 0.78);
      var margin = Math.min(110, width * 0.09);

      // The wind-chest rule (also the line of sound)
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = COOL;
      ctx.globalAlpha = 0.08 + 0.12 * fullness;
      ctx.fillRect(margin, chestY, width - margin * 2, 1.5);
      ctx.fillStyle = GOLD;
      ctx.globalAlpha = 0.06 + 0.08 * fullness;
      ctx.fillRect(margin, chestY + 6, width - margin * 2, 1);

      // Subtle metallic silhouette for each pipe in the facade
      for (var i = 0; i < pipes.length; i++) {
        var p = pipes[i];
        if (!p) continue;
        var half = p.w * 0.42;
        // Pipe resonator body
        ctx.fillStyle = PIPE_TIN;
        ctx.globalAlpha = 0.045;
        ctx.fillRect(p.x - half, p.topY, half * 2, p.bodyH);

        // Gilded pipe mouth (labium)
        ctx.fillStyle = CASE_GOLD;
        ctx.globalAlpha = 0.11;
        ctx.fillRect(p.x - half, p.mouthY - 2, half * 2, 2);

        // Conical pipe foot resting on the wind-chest
        ctx.beginPath();
        ctx.moveTo(p.x - half, p.mouthY);
        ctx.lineTo(p.x + half, p.mouthY);
        ctx.lineTo(p.x, p.chestY);
        ctx.closePath();
        ctx.fillStyle = PIPE_TIN;
        ctx.globalAlpha = 0.05;
        ctx.fill();
      }
    }

    /** Draws an approaching note descending toward its pipe's mouth. */
    function drawComing(pipe, now, note, colour, weight) {
      var ahead = note.time - now;
      var endAhead = note.time + note.length - now;
      if (ahead >= AHEAD || endAhead <= 0) return;
      var yBottom = pipe.mouthY - Math.max(0, ahead / AHEAD) * pipe.bodyH;
      var yTop = pipe.mouthY - Math.min(1, endAhead / AHEAD) * pipe.bodyH;
      if (yBottom <= yTop) return;
      var near = 1 - Math.max(0, ahead) / AHEAD;
      var w = Math.max(1.6, pipe.w * 0.28);
      ctx.fillStyle = colour;
      ctx.globalAlpha = 0.05 + 0.18 * near;
      ctx.fillRect(pipe.x - w * 0.5, yTop, w, yBottom - yTop);
    }

    /** Lights a speaking pipe from its gilded mouth up through its resonator. */
    function drawSpeakingPipe(pipe, colour, strength, isSubject) {
      if (strength <= 0.02) return;
      var room = Math.min(1, CEILING / Bach.lightOf(colour));
      var flare = 0.04 * strength;
      var coreAlpha = Math.min(0.42 * strength, room - flare);
      var half = Math.max(2, pipe.w * 0.42);
      var litH = pipe.bodyH * (0.35 + 0.65 * Math.min(1, strength));
      var top = pipe.mouthY - litH;

      // Soft aura around the speaking pipe
      ctx.fillStyle = colour;
      ctx.globalAlpha = flare;
      ctx.fillRect(pipe.x - half * 1.4, top, half * 2.8, litH);

      // Shoulders of the pipe body (calibrated for the frame veil so the voice's
      // true colour shines richly without saturating to white)
      ctx.globalAlpha = 0.16 * strength;
      if (half > 1) {
        ctx.fillRect(pipe.x - half, top, half - 1, litH);
        ctx.fillRect(pipe.x + 1, top, half - 1, litH);
      }

      // Incandescent wind core down the center of the pipe
      ctx.globalAlpha = coreAlpha;
      ctx.fillRect(pipe.x - 1, top, 2, litH);

      // Console key reflection below the wind-chest
      var keyH = 12 + 22 * strength;
      ctx.globalAlpha = 0.18 * strength;
      ctx.fillRect(pipe.x - half * 0.65, pipe.chestY + 8, half * 1.3, keyH);

      // Warm wind-bloom at the gilded pipe labium (mouth) where the air speaks
      var mouthSize = 18 + 16 * strength;
      var mouthGlow = ctx.createRadialGradient(pipe.x, pipe.mouthY, 0, pipe.x, pipe.mouthY, mouthSize);
      mouthGlow.addColorStop(0, colour);
      mouthGlow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = mouthGlow;
      ctx.globalAlpha = 0.24 * strength;
      ctx.fillRect(pipe.x - mouthSize, pipe.mouthY - mouthSize, mouthSize * 2, mouthSize * 2);

      // Gilded crown flare at the pipe mouth when freshly struck
      if (isSubject) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.2 * strength;
        ctx.beginPath();
        ctx.arc(pipe.x, pipe.mouthY, half * 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    /**
     * Connects simultaneously sounding pipes with pointed Gothic harmonic arches
     * in the cathedral space above the organ.
     */
    function drawHarmonicArches(activePipes) {
      if (activePipes.length < 2) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < activePipes.length; i++) {
        for (var j = i + 1; j < activePipes.length && j <= i + 4; j++) {
          var a = activePipes[i];
          var b = activePipes[j];
          var interval = Math.abs(b.pitch - a.pitch) % 12;
          var archColour = COOL;
          if (interval === 0) archColour = GOLD; // Octave
          else if (interval === 7 || interval === 5) archColour = SAPPHIRE; // 5th / 4th
          else if (interval === 3 || interval === 4 || interval === 8 || interval === 9) archColour = ROSE; // 3rd / 6th

          var midX = (a.pipe.x + b.pipe.x) * 0.5;
          var spanX = Math.abs(b.pipe.x - a.pipe.x);
          var apexY = Math.max(24, Math.min(a.pipe.topY, b.pipe.topY) - 18 - spanX * 0.14);

          ctx.strokeStyle = archColour;
          ctx.lineWidth = interval === 0 ? 1.5 : 1.0;
          ctx.globalAlpha = 0.08 * Math.min(a.strength, b.strength);
          ctx.beginPath();
          ctx.moveTo(a.pipe.x, a.pipe.topY);
          ctx.quadraticCurveTo(midX, apexY, b.pipe.x, b.pipe.topY);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function frame(now) {
      var width = screen.width();
      var height = screen.height();
      nowTime = now;

      if (pipes.length === 0) pipes = buildPipes(width, height);

      if (lastNow < 0 || now < lastNow - 0.05) {
        screen.wipe();
        from = 0;
        to = 0;
      } else {
        screen.veil(TRAIL);
      }
      lastNow = now;

      while (to < notes.length && notes[to].time <= now + AHEAD) to++;
      while (from < to && notes[from].time + notes[from].length < now - TAIL) from++;

      // Count how many notes are sounding right now
      var soundingCount = 0;
      for (var k = from; k < to; k++) {
        if (notes[k].time <= now && notes[k].time + notes[k].length >= now) soundingCount++;
      }
      var fullness = Math.min(1, soundingCount / 6);

      drawCathedralVaults(width, height, fullness, now);
      drawOrganFacade(width, height, fullness);

      // Strongest note per pitch owns the speaking pipe so unisons never double-burn
      var bestByPitch = {};
      for (var n = from; n < to; n++) {
        var note = notes[n];
        var pIdx = note.pitch - pitchLow;
        var pipe = pipes[pIdx];
        if (!pipe) continue;
        var isSubj = subject[keyOf(note)] === true;
        var colour = isSubj ? GOLD : pick(note.voice, note.voice);
        var weight = note.role === "melody" ? 5.5 : note.role === "pedal" ? 4.5 : 3;

        if (note.time > now) {
          drawComing(pipe, now, note, colour, weight);
        } else {
          var age = now - (note.time + note.length);
          var strength = age <= 0 ? 1 : Math.max(0, 1 - age / TAIL);
          var prev = bestByPitch[note.pitch];
          if (!prev || strength * weight > prev.score) {
            bestByPitch[note.pitch] = {
              pipe: pipe,
              pitch: note.pitch,
              colour: colour,
              strength: strength,
              score: strength * weight,
              isSubject: isSubj,
              sounding: age <= 0,
            };
          }
        }
      }

      var activePipes = [];
      for (var pitchKey in bestByPitch) {
        if (!Object.prototype.hasOwnProperty.call(bestByPitch, pitchKey)) continue;
        var entry = bestByPitch[pitchKey];
        drawSpeakingPipe(entry.pipe, entry.colour, entry.strength, entry.isSubject);
        if (entry.sounding) activePipes.push(entry);
      }

      drawHarmonicArches(activePipes);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    /**
     * Draws the player's pulse as sanctuary balustrade lamps along the organ gallery.
     */
    function pulse(shot) {
      var width = screen.width();
      var height = screen.height();
      var chestY = Math.round(height * 0.78);
      var margin = Math.min(110, width * 0.09);
      var beats = shot.beats;
      var lookAhead = shot.ahead || 2;

      ctx.globalCompositeOperation = "lighter";

      if (shot.run > 0.02) {
        ctx.fillStyle = MARK;
        ctx.globalAlpha = 0.04 + 0.14 * shot.run;
        ctx.fillRect(margin, chestY - 2, width - margin * 2, 4);
      }

      for (var i = shot.pointer; i < beats.length; i++) {
        var beat = beats[i];
        var away = beat.time - shot.now;
        if (away < -0.1) continue;
        if (away > lookAhead) break;
        if (beat.taken) continue;
        var near = 1 - Math.max(0, away) / Math.max(0.1, lookAhead);
        var dropY = chestY - Math.max(0, away) * 52;
        var halfW = (beat.bar ? 42 : 24) * (0.4 + 0.6 * near);
        ctx.fillStyle = beat.bright ? GOLD : MARK;
        ctx.globalAlpha = (beat.bright ? 0.25 : 0.14) * near;
        ctx.fillRect(width * 0.5 - halfW, dropY - 1, halfW * 2, 2);
      }

      for (var j = 0; j < shot.strikes.length; j++) {
        var one = shot.strikes[j];
        var age = shot.now - one.at;
        if (age < 0 || age > shot.fade) continue;
        var fade = 1 - age / shot.fade;
        ctx.strokeStyle = one.kind === "stray" ? COOL : GOLD;
        ctx.lineWidth = one.truest ? 2.2 : 1.4;
        ctx.globalAlpha = (one.kind === "stray" ? 0.15 : 0.38) * fade;
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.16, 28 + age * 90, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    return { reset: reset, frame: frame, pulse: pulse };
  }

  Bach.looks = Bach.looks || {};
  Bach.looks.prospekt = createProspektLook;
})(window.Bach);
