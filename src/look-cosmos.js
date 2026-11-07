// Harmonia Mundi: Celestial Counterpoint and the Circle of Fifths.
//
// For Bach, music was the audible mathematics of God's creation. This look maps
// every note onto a celestial astrolabe ordered by the Circle of Fifths
// (C, G, D, A, E, B, F#, C#, Ab, Eb, Bb, F), with octave register radiating
// from the inner pedal sanctum outward to the high descant rim.
//
// Because fifths lie beside one another and major/minor triads form compact
// triangles on the Circle of Fifths, every chord Bach writes crystallizes as a
// luminous polygon in the heart of the astrolabe, rotating and resolving as the
// harmony modulates and returns home to the tonic.

window.Bach = window.Bach || {};

(function (Bach) {
  var GOLD = "#ffd47a";
  var COOL = "#bcd0f0";
  var SAPPHIRE = "#79e2ff";
  var ROSE = "#ff9bb0";
  var MARK = "#e8f1ff";
  var TAU = Math.PI * 2;
  var TOP = -Math.PI * 0.5;

  // Pitch class (0=C .. 11=B) mapped to its step on the Circle of Fifths (0..11)
  var FIFTH_STEP = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  var FIFTH_NAMES = ["C", "G", "D", "A", "E", "B", "F#", "C#", "Ab", "Eb", "Bb", "F"];

  var AHEAD = 2.8;
  var TAIL = 2.2;
  var TRAIL = 0.24;
  var CEILING = 0.65;
  var STRONGEST = 0.8;

  function createCosmosLook(canvas) {
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

    screen.onResize(function () {
      lastNow = -1;
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
      screen.wipe();
    }

    /** Polar coordinates on the celestial astrolabe for a given MIDI pitch. */
    function pointOf(pitch, cx, cy, innerR, outerR) {
      var pc = ((pitch % 12) + 12) % 12;
      var step = FIFTH_STEP[pc];
      var angle = TOP + (step / 12) * TAU;
      var norm = Math.max(0, Math.min(1, (pitch - pitchLow) / Math.max(1, pitchHigh - pitchLow)));
      var r = innerR + Math.pow(norm, 0.88) * (outerR - innerR);
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        angle: angle,
        r: r,
        step: step,
      };
    }

    /** Draws the golden astrolabe rings, 12 Circle-of-Fifths cusps, and sacred geometry. */
    function drawAstrolabe(cx, cy, innerR, outerR, fullness, now) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // Outer zodiac rim and octave rings
      var rings = [0, 0.33, 0.66, 1.0, 1.07];
      for (var i = 0; i < rings.length; i++) {
        var r = innerR + rings[i] * (outerR - innerR);
        ctx.strokeStyle = i === 4 ? GOLD : COOL;
        ctx.lineWidth = i === 4 ? 1.4 : 0.9;
        ctx.globalAlpha = i === 4 ? 0.14 + 0.1 * fullness : 0.05 + 0.04 * fullness;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
      }

      // 12 spokes of the Circle of Fifths and Gothic trefoil cusps on the outer ring
      ctx.font = "12px 'Iowan Old Style', 'Palatino Linotype', Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var labelR = outerR + 26;

      for (var s = 0; s < 12; s++) {
        var a = TOP + (s / 12) * TAU;
        var cos = Math.cos(a);
        var sin = Math.sin(a);

        ctx.strokeStyle = COOL;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.022;
        ctx.beginPath();
        ctx.moveTo(cx + cos * innerR * 0.6, cy + sin * innerR * 0.6);
        ctx.lineTo(cx + cos * outerR * 1.05, cy + sin * outerR * 1.05);
        ctx.stroke();

        // Key name on the rim (low per-frame alpha since veil accumulates ~4x)
        ctx.fillStyle = s === 0 ? GOLD : COOL;
        ctx.globalAlpha = s === 0 ? 0.14 : 0.08;
        ctx.fillText(FIFTH_NAMES[s], cx + cos * labelR, cy + sin * labelR);
      }

      // Slowly revolving inner sacred rosette
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.025 + 0.03 * fullness;
      for (var p = 0; p < 6; p++) {
        var pa = now * 0.05 + (p * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(pa) * innerR * 0.45,
          cy + Math.sin(pa) * innerR * 0.45,
          innerR * 0.45,
          0,
          TAU
        );
        ctx.stroke();
      }

      ctx.restore();
    }

    /**
     * Draws the harmonic polygon connecting all notes currently sounding, plus
     * contrapuntal arcs connecting consecutive notes within each voice.
     */
    function drawHarmonicPolygon(soundingNodes, cx, cy) {
      if (soundingNodes.length < 2) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      // Sort by angle around the astrolabe so the polygon forms a clean star/hull
      var ordered = soundingNodes.slice().sort(function (a, b) {
        return a.pt.angle - b.pt.angle;
      });

      // Translucent stained-glass fill when 3 or more pitches form a triad/chord
      if (ordered.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(ordered[0].pt.x, ordered[0].pt.y);
        for (var i = 1; i < ordered.length; i++) {
          ctx.lineTo(ordered[i].pt.x, ordered[i].pt.y);
        }
        ctx.closePath();
        ctx.fillStyle = GOLD;
        ctx.globalAlpha = 0.045;
        ctx.fill();
      }

      // Luminous chord edges between every pair of sounding pitches
      for (var a = 0; a < ordered.length; a++) {
        for (var b = a + 1; b < ordered.length; b++) {
          var p1 = ordered[a];
          var p2 = ordered[b];
          var stepDiff = Math.abs(p1.pt.step - p2.pt.step);
          if (stepDiff > 6) stepDiff = 12 - stepDiff;
          var edgeCol = stepDiff <= 1 ? GOLD : stepDiff <= 4 ? SAPPHIRE : ROSE;

          ctx.strokeStyle = edgeCol;
          ctx.lineWidth = stepDiff <= 1 ? 1.7 : 1.1;
          ctx.globalAlpha = 0.22 * Math.min(p1.strength, p2.strength);
          ctx.beginPath();
          ctx.moveTo(p1.pt.x, p1.pt.y);
          // Slight curve toward the center of the astrolabe
          ctx.quadraticCurveTo(
            (p1.pt.x + p2.pt.x) * 0.42 + cx * 0.16,
            (p1.pt.y + p2.pt.y) * 0.42 + cy * 0.16,
            p2.pt.x,
            p2.pt.y
          );
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    function drawNode(pt, colour, weight, strength, isCoreOwner) {
      if (strength <= 0.02) return;
      var room = Math.min(1, CEILING / Bach.lightOf(colour));
      var flare = 0.09 * strength;
      var coreAlpha = Math.min(STRONGEST * strength, room - flare);
      var size = weight * 0.65;

      // Soft outer halo box
      ctx.fillStyle = colour;
      ctx.globalAlpha = flare;
      ctx.fillRect(pt.x - size * 2.2, pt.y - size * 2.2, size * 4.4, size * 4.4);

      // Shoulders around the core
      ctx.globalAlpha = 0.42 * strength;
      if (size > 1.2) {
        ctx.fillRect(pt.x - size, pt.y - size, size - 1.2, size * 2);
        ctx.fillRect(pt.x + 1.2, pt.y - size, size - 1.2, size * 2);
      }

      if (isCoreOwner) {
        ctx.globalAlpha = coreAlpha;
        ctx.fillRect(pt.x - 1.2, pt.y - 1.2, 2.4, 2.4);
      }

      // Orbital ring around active note
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.32 * strength;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, size * 1.8, 0, TAU);
      ctx.stroke();
    }

    function frame(now) {
      var width = screen.width();
      var height = screen.height();
      nowTime = now;
      var cx = width * 0.5;
      var cy = height * 0.5;
      var minDim = Math.min(width, height);
      var innerR = minDim * 0.09;
      var outerR = minDim * 0.37;

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

      var soundingCount = 0;
      for (var k = from; k < to; k++) {
        if (notes[k].time <= now && notes[k].time + notes[k].length >= now) soundingCount++;
      }
      var fullness = Math.min(1, soundingCount / 6);

      drawAstrolabe(cx, cy, innerR, outerR, fullness, now);

      var bestByPitch = {};
      var soundingNodes = [];
      var lastByVoice = {};

      ctx.globalCompositeOperation = "lighter";

      for (var n = from; n < to; n++) {
        var note = notes[n];
        var pt = pointOf(note.pitch, cx, cy, innerR, outerR);
        var isSubj = subject[keyOf(note)] === true;
        var colour = isSubj ? GOLD : pick(note.voice, note.voice);
        var weight = (note.role === "melody" ? 5.5 : note.role === "pedal" ? 4.5 : 3) + (isSubj ? 0.8 : 0);

        if (note.time > now) {
          var ahead = (note.time - now) / AHEAD;
          var near = 1 - Math.min(1, ahead);
          ctx.fillStyle = colour;
          ctx.globalAlpha = 0.05 + 0.18 * near;
          ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
        } else {
          var age = now - (note.time + note.length);
          var strength = age <= 0 ? 1 : Math.max(0, 1 - age / TAIL);

          // Voice-leading orbital thread drawn when the note is freshly struck so
          // the veil trails it smoothly without over-accumulating old transitions
          var prevVoicePt = lastByVoice[note.voice];
          if (prevVoicePt && now - note.time < 0.14) {
            ctx.strokeStyle = colour;
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = 0.16;
            ctx.beginPath();
            ctx.moveTo(prevVoicePt.x, prevVoicePt.y);
            ctx.quadraticCurveTo(cx, cy, pt.x, pt.y);
            ctx.stroke();
          }
          lastByVoice[note.voice] = pt;

          var prevPitch = bestByPitch[note.pitch];
          if (!prevPitch || strength * weight > prevPitch.score) {
            bestByPitch[note.pitch] = {
              pt: pt,
              colour: colour,
              weight: weight,
              strength: strength,
              score: strength * weight,
              sounding: age <= 0,
            };
          }
        }
      }

      for (var pitchKey in bestByPitch) {
        if (!Object.prototype.hasOwnProperty.call(bestByPitch, pitchKey)) continue;
        var item = bestByPitch[pitchKey];
        drawNode(item.pt, item.colour, item.weight, item.strength, true);
        if (item.sounding) soundingNodes.push(item);
      }

      drawHarmonicPolygon(soundingNodes, cx, cy);

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    function pulse(shot) {
      var width = screen.width();
      var height = screen.height();
      var cx = width * 0.5;
      var cy = height * 0.5;
      var outerR = Math.min(width, height) * 0.395;
      var lookAhead = shot.ahead || 2;

      ctx.globalCompositeOperation = "lighter";

      if (shot.run > 0.02) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.08 + 0.14 * shot.run;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, 0, TAU);
        ctx.stroke();
      }

      for (var i = shot.pointer; i < shot.beats.length; i++) {
        var beat = shot.beats[i];
        var away = beat.time - shot.now;
        if (away < -0.1) continue;
        if (away > lookAhead) break;
        if (beat.taken) continue;
        var a = TOP + ((i % 12) / 12) * TAU;
        var px = cx + Math.cos(a) * outerR;
        var py = cy + Math.sin(a) * outerR;
        var near = 1 - Math.max(0, away) / Math.max(0.1, lookAhead);
        ctx.fillStyle = beat.bright ? GOLD : MARK;
        ctx.globalAlpha = 0.12 + 0.25 * near;
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }

      for (var j = 0; j < shot.strikes.length; j++) {
        var one = shot.strikes[j];
        var age = shot.now - one.at;
        if (age < 0 || age > shot.fade) continue;
        var fade = 1 - age / shot.fade;
        ctx.strokeStyle = one.kind === "stray" ? COOL : GOLD;
        ctx.lineWidth = one.truest ? 2 : 1.2;
        ctx.globalAlpha = 0.32 * fade;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR + age * 28, 0, TAU);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }

    return { reset: reset, frame: frame, pulse: pulse };
  }

  Bach.looks = Bach.looks || {};
  Bach.looks.cosmos = createCosmosLook;
})(window.Bach);
