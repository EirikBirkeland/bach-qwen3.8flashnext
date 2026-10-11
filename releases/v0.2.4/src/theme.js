// The tune that comes back, and everywhere it is heard.
//
// Some of these pieces are one figure, said over and over: the fugue subject of
// BWV 565, the ground bass of BWV 582. A picture that can mark those can show the
// shape of the piece rather than just its next second - so this works out, from
// the notes alone, what the tune is and every moment it is heard.
//
//   Bach.theme(notes, { bars: data.bars })
//     -> { voice: 6, notes: 15, steps: [-12, 7, ...], heard: [ { voice: 6, pitch: 36,
//          time: 18.3, until: 26.3, notes: [ ...the notes of this one telling... ] } ] }
//     -> null when nothing of eight notes or more comes back
//
// How it works. A line of music is written down as the steps from one note to the
// next, so a tune counts as itself whatever pitch it is played at - which is how a
// fugue answer on the dominant, or a ground bass an octave down, is the same tune.
// Then every window of eight notes or more is written down and counted, and the
// window that turns up most in one voice is the tune of the piece. If a longer
// window comes back nearly as often, that one is taken instead, because a theme
// comes back whole and not by halves.
//
// A copy has to wait before it counts as the tune coming back - two bars by
// default. Without that rule a sequence, which is the same bar again and again at
// rising pitch, out-votes the theme: in BWV 565 a run of parallel sixths in the
// toccata does exactly that.
//
// Notes are the page's own objects - voice, pitch, time, length - and the hearings
// hand back those same objects, so a picture can mark a telling of the tune by
// asking whether a note it is about to draw is one of them.

window.Bach = window.Bach || {};

(function (Bach) {
  var MIN_NOTES = 8; // fewer notes than this and it is a figure, not a tune
  var MAX_NOTES = 40; // a theme longer than this is two themes
  var NEARLY = 0.75; // "nearly as often", when choosing the longest whole telling

  /**
   * A voice's line as the steps between its notes, so a window of it can be
   * looked up whatever pitch it is sung at. `keyAt(start, steps)` names the window
   * of that many steps from the note at `start`.
   */
  function stepIndex(notes) {
    var times = [];
    for (var i = 0; i < notes.length; i++) times.push(notes[i].time);

    var steps = [];
    for (var i = 1; i < notes.length; i++) steps.push(notes[i].pitch - notes[i - 1].pitch);

    // All the steps in one string, so the key of any window is a slice of it.
    var text = steps.join(",");
    var offset = [0];
    for (var i = 0; i < steps.length; i++) offset.push(offset[i] + String(steps[i]).length + 1);

    return {
      times: times,
      steps: steps,
      // A window of `length` steps starts at offset[start] and ends one before the
      // next step begins - that is where the comma between them sits.
      keyAt: function (start, length) {
        return text.slice(offset[start], offset[start + length] - 1);
      },
    };
  }

  /**
   * Every figure of `count` notes that a voice plays more than once, most copies
   * first. `gap` is how many seconds a copy must wait since the last one was
   * counted, which is what keeps a sequence from passing for a theme.
   */
  function returningFigures(index, count, gap) {
    var span = count - 1; // the steps between the notes
    if (span < 1) return [];

    var places = {};
    for (var start = 0; start + span <= index.steps.length; start++) {
      var key = index.keyAt(start, span);
      if (!places[key]) places[key] = [];
      places[key].push(start);
    }

    var found = [];
    for (var key2 in places) {
      if (!Object.prototype.hasOwnProperty.call(places, key2)) continue;
      if (/^0(,0)*$/.test(key2)) continue; // the same note hammered over is not a tune
      var starts = places[key2];
      var apart = [];
      for (var i = 0; i < starts.length; i++) {
        var start = starts[i];
        var last = apart[apart.length - 1];
        if (last === undefined) apart.push(start);
        else if (start >= last + span && index.times[start] >= index.times[last] + gap) apart.push(start);
      }
      if (apart.length >= 2) found.push({ steps: key2.split(",").map(Number), starts: apart });
    }
    return found.sort(function (a, b) {
      return b.starts.length - a.starts.length || a.starts[0] - b.starts[0];
    });
  }

  /**
   * The figure a voice brings back most: the one with the most copies, or - when a
   * longer one comes back nearly as often - the longer one, since a theme is heard
   * whole.
   */
  function figureOf(notes, gap) {
    var index = stepIndex(notes);
    var longest = Math.min(MAX_NOTES, index.steps.length + 1);
    var best = null;
    var bestCopies = 0;
    for (var count = MIN_NOTES; count <= longest; count++) {
      var found = returningFigures(index, count, gap);
      if (found.length === 0) continue;
      var copies = found[0].starts.length;
      if (copies > bestCopies) {
        best = found[0];
        bestCopies = copies;
      } else if (copies >= bestCopies * NEARLY && found[0].steps.length > best.steps.length) {
        best = found[0];
      }
    }
    return best ? { index: index, steps: best.steps, starts: best.starts } : null;
  }

  /** The notes of each voice, each voice in its own list, in time order. */
  function lines(notes) {
    var byVoice = {};
    var order = [];
    for (var i = 0; i < notes.length; i++) {
      var line = String(notes[i].voice);
      if (!byVoice[line]) {
        byVoice[line] = [];
        order.push(line);
      }
      byVoice[line].push(notes[i]);
    }
    for (var o = 0; o < order.length; o++) {
      byVoice[order[o]].sort(function (a, b) {
        return a.time - b.time || a.pitch - b.pitch;
      });
    }
    byVoice.order = order;
    return byVoice;
  }

  /** How long a bar is, in seconds, from the data file's own bar lines. */
  function barSeconds(bars) {
    if (!bars || bars.length < 2) return 0;
    return bars[1] - bars[0];
  }

  function theme(notes, options) {
    var settings = options || {};
    // A copy must wait two bars, unless told otherwise: shorter than that and it
    // is more likely the same bar again at another pitch.
    var gap = settings.gap === undefined ? barSeconds(settings.bars) * 2 : settings.gap;

    var voices = lines(notes);
    var best = null;
    for (var v = 0; v < voices.order.length; v++) {
      var line = voices.order[v];
      var mine = voices[line];
      var figure = figureOf(mine, gap);
      if (!figure) continue;
      // Weighed by copies times length, so a whole theme said a dozen times beats
      // a short figure said a dozen and a half.
      var weight = figure.starts.length * (figure.steps.length + 1);
      if (!best || weight > best.weight) {
        best = { voice: mine[0].voice, figure: figure, weight: weight };
      }
    }
    if (!best) return null;

    // Now look for that figure in every voice: a fugue hands its subject from one
    // line to another, and a ground bass turns up in the manuals as well as the
    // pedals.
    var wanted = best.figure.steps.join(",");
    var length = best.figure.steps.length + 1;
    var heard = [];
    for (var w = 0; w < voices.order.length; w++) {
      var other = voices[voices.order[w]];
      var index = stepIndex(other);
      for (var start = 0; start + best.figure.steps.length <= index.steps.length; start++) {
        if (index.keyAt(start, best.figure.steps.length) !== wanted) continue;
        var run = other.slice(start, start + length);
        heard.push({
          voice: other[start].voice,
          pitch: other[start].pitch,
          time: other[start].time,
          until: run[run.length - 1].time + run[run.length - 1].length,
          notes: run,
        });
      }
    }
    heard.sort(function (a, b) {
      return a.time - b.time;
    });

    return {
      voice: best.voice,
      notes: length,
      steps: best.figure.steps,
      heard: heard,
    };
  }

  Bach.theme = theme;
})(window.Bach);
