// Which stretches of a piece are something the player has already heard.
//
// A repeat is the one thing in this music an eye can recognise while it is
// hearing the piece for the first time, so the pictures mark it. This works it
// out from the notes alone - nobody told it where the repeats are.
//
//   Bach.echoes(notes, bars, { minBars: 4 })
//     -> [{ at: 92.0, until: 124.0, again: 16.0, bars: 8, matched: 0.98 }]
//
// The window slides. It is not tied to phrases beginning every four bars, or at
// any other spacing, because the music does not care how an edition bars it: BWV
// 645 brings its opening back whole nineteen bars later, and nineteen has no
// divisors, so a finder that tiled the piece from bar 1 could never see it.
//
// How it works: every bar is written down as the set of "where in the bar : how
// high" its notes make. Two bars agree when at least `part` of the later bar -
// three quarters by default - was heard in the earlier one at the same pitch and
// in the same place in the bar; that is what lets a bar come back with an
// ornament added and still count. Then, for every distance between two bars, the
// piece is walked along looking for a run of bars that agree with the bar the same
// distance before them. A run of several is the music coming back; one bar on its
// own is a figure, or a coincidence, so nothing is made of it.
//
// Notes are objects with time, pitch and length; bars are the seconds each bar
// starts at, as the data file gives them.

window.Bach = window.Bach || {};

(function (Bach) {
  // How finely a note's place inside its bar is written down, in steps of a bar.
  // Sixteenth notes - the fastest these editions write - land on the grid.
  var STEPS_PER_BAR = 32;
  // A bar with fewer notes than this says nothing. Two held chords agreeing with
  // two other held chords would not mean the music came back.
  var MIN_NOTES = 6;

  /** How long a bar is, in seconds. The last bar stands in for itself. */
  function barSpan(bars, index) {
    if (index + 1 < bars.length) return bars[index + 1] - bars[index];
    return bars.length > 1 ? bars[bars.length - 1] - bars[bars.length - 2] : 1;
  }

  /** Which bar a moment falls in, or -1 if it is before the music starts. */
  function barIndexOf(bars, at) {
    if (at < bars[0]) return -1;
    var low = 0;
    var high = bars.length - 1;
    while (low < high) {
      var middle = (low + high + 1) >> 1;
      if (bars[middle] <= at) low = middle;
      else high = middle - 1;
    }
    return low;
  }

  /** Every bar of the piece as the notes it holds, keyed by where in the bar each
   *  one falls and how high it is - which is what makes two bars comparable. */
  function barShapes(notes, bars) {
    var shapes = [];
    for (var i = 0; i < bars.length; i++) shapes.push({ keys: {}, count: 0 });
    for (var n = 0; n < notes.length; n++) {
      var note = notes[n];
      var index = barIndexOf(bars, note.time);
      if (index < 0) continue;
      var place = Math.round(((note.time - bars[index]) / barSpan(bars, index)) * STEPS_PER_BAR);
      var shape = shapes[index];
      var key = place + ":" + note.pitch;
      if (!shape.keys[key]) shape.count++;
      shape.keys[key] = 1;
    }
    return shapes;
  }

  /** What two bars have in common: how many of the later bar's notes were heard in
   *  the earlier one, out of how many there were to hear, and the share between
   *  them. Divided by the bigger of the two, so a thin bar cannot pass itself off
   *  as a repeat of a full one. */
  function inCommon(earlier, later) {
    var keys = Object.keys(later.keys);
    var heard = 0;
    for (var i = 0; i < keys.length; i++) {
      if (earlier.keys[keys[i]]) heard++;
    }
    var of = Math.max(Object.keys(earlier.keys).length, keys.length);
    return { heard: heard, of: of, part: of === 0 ? 0 : heard / of };
  }

  /** Does this bar agree with the bar a given distance before it? */
  function agrees(shapes, earlier, later, needed) {
    if (shapes[earlier].count < MIN_NOTES || shapes[later].count < MIN_NOTES) return null;
    var share = inCommon(shapes[earlier], shapes[later]);
    return share.part >= needed ? share : null;
  }

  function echoes(notes, bars, options) {
    var settings = options || {};
    var minBars = Math.max(2, settings.minBars || 4);
    var needed = settings.part || 0.75;
    if (!bars || bars.length < 2 || notes.length === 0) return [];

    var shapes = barShapes(notes, bars);
    var runs = [];
    for (var distance = 1; distance < bars.length; distance++) {
      var run = null;
      for (var later = distance; later < bars.length; later++) {
        var earlier = later - distance;
        var share = agrees(shapes, earlier, later, needed);
        if (!share) {
          if (run) {
            if (run.bars >= minBars) runs.push(run);
            run = null;
          }
          continue;
        }
        if (!run) run = { first: later, again: earlier, bars: 0, heard: 0, of: 0 };
        run.bars++;
        run.heard += share.heard;
        run.of += share.of;
      }
      if (run && run.bars >= minBars) runs.push(run);
    }

    // A stretch that could be matched more than one way keeps its longest telling,
    // and nothing is called a repeat twice.
    runs.sort(function (a, b) {
      return b.bars - a.bars || a.first - b.first;
    });
    var claimed = {};
    var found = [];
    for (var r = 0; r < runs.length; r++) {
      var run2 = runs[r];
      var already = false;
      for (var b = 0; b < run2.bars; b++) {
        if (claimed[run2.first + b]) already = true;
      }
      if (already) continue;
      for (var c = 0; c < run2.bars; c++) claimed[run2.first + c] = true;
      var end = run2.first + run2.bars;
      found.push({
        at: bars[run2.first],
        until: end < bars.length ? bars[end] : bars[bars.length - 1] + barSpan(bars, bars.length - 1),
        again: bars[run2.again],
        bars: run2.bars,
        matched: Math.round((run2.heard / run2.of) * 100) / 100,
      });
    }
    found.sort(function (x, y) {
      return x.at - y.at;
    });
    return found;
  }

  Bach.echoes = echoes;
})(window.Bach);
