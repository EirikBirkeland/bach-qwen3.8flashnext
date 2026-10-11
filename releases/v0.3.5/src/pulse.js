// The pulse of a piece: where its beats are, in seconds.
//
// Nothing is typed in per piece. The data file already holds the piece's own bar
// lines - seconds off the MIDI file's tempo map, worked out by tools/bars.mjs -
// and its metre, so a beat is a bar start plus a share of that bar. That means
// two things worth having: a downbeat lands exactly on the bar line the picture
// draws, and where the player slows down - five times in the last two minutes of
// BWV 582 - the beats stretch along with the bars.
//
//   Bach.beats(data) -> [ { time: 0, bar: true, index: 0 }, ... ] in time order
//
// The last bar of a piece is often not a whole bar, so the bar's length is taken
// from the next bar line where there is one and from the piece's end where there
// is not, and a beat past the end is not counted.

window.Bach = window.Bach || {};

(function (Bach) {
  /**
   * The beats of a piece, as seconds. Each one says whether it opens a bar, and
   * how long a beat is where it falls - which is the same wherever the piece is
   * steady and different where it is not.
   */
  function beats(data) {
    var bars = data.bars || [];
    var perBar = (data.metre && data.metre.beats) || 4;
    var end = data.duration || 0;
    var out = [];
    for (var b = 0; b < bars.length; b++) {
      var start = bars[b];
      var stop = b + 1 < bars.length ? bars[b + 1] : end;
      if (!(stop > start)) continue;
      var step = (stop - start) / perBar;
      for (var k = 0; k < perBar; k++) {
        var at = start + k * step;
        if (at >= end) break;
        out.push({ time: at, bar: k === 0, gap: step, index: out.length, taken: false });
      }
    }
    return out;
  }

  /** How long a beat usually is: the middle of all the gaps, so a slow ending
   *  does not pull the figure about. */
  function beatGap(beats) {
    var gaps = [];
    for (var i = 0; i < beats.length; i++) gaps.push(beats[i].gap);
    if (gaps.length === 0) return 1;
    gaps.sort(function (a, b) {
      return a - b;
    });
    return gaps[Math.floor(gaps.length / 2)];
  }

  Bach.beats = beats;
  Bach.beatGap = beatGap;
})(window.Bach);
