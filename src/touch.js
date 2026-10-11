// The touch of a piece: how big a bell to ring when the player strikes its pulse.
//
// One bell for all four pieces was the first version, and it was wrong by about
// 10 dB. Measured over the beats themselves (tools/touch.mjs), that fixed bell sat
// anywhere between a third of the music and nine tenths of it, piece to piece: under
// BWV 639's chorale it was hardly heard, over one note of BWV 565's fugue it was as
// loud as the tune. These two rules even that out, and nothing in them is typed in
// per piece.
//
//   Bach.touch(notes, beats, gap) -> { level, decay, fullness }
//
// The size follows how full the piece is where the bells land - half as much, in
// decibels, as the music moves: a piece running 6 dB fuller gets a bell 3 dB
// bigger, and the four pieces end up within about 5 dB of one another instead of
// 10 dB apart. Going the whole way - a bell always at the same share of its own music -
// was measured too, and refused: it hands the biggest bell of all to BWV 639, the
// one piece whose level never drops, and takes that chorale's widest chord with a
// heavy bell on it, the room counted after it, to 0.83 of full scale instead of
// 0.77. tools/touch.mjs prints both rules beside each other.
//
// The length follows the piece's own beat. A bell hangs for about 1.2 beats, so in
// BWV 639 (one beat is 1.62 s) it carries across the bar, and in BWV 582 (0.83 s,
// and seven parts going at once) it is gone before the next beat lands. By
// construction an audible bell - within 40 dB of its own top - never overlaps the
// next one, which is what keeps a run of taps from turning into a wash.

window.Bach = window.Bach || {};

(function (Bach) {
  var FULL = 0.078; // the bell of a piece that is running full on every beat
  var SMALLEST = 0.03; // no bell so small it is only felt
  var LARGEST = 0.09; // ... and none so big it competes with the organ
  var RING = 1.2; // a bell hangs for this many beats of the piece
  var SHORTEST = 0.9; // ... never so short it is a click
  var LONGEST = 2.2; // ... never so long it is a cymbal

  /** The middle of a list of numbers. */
  function middle(list) {
    if (list.length === 0) return 0;
    var sorted = list.slice().sort(function (a, b) {
      return a - b;
    });
    return sorted[Math.floor(sorted.length / 2)];
  }

  /**
   * How loud the piece runs where the bells land: the middle, over all the beats,
   * of the pipe-weight sounding at each one, as a share of the loudest the piece
   * ever gets - and "the loudest it ever gets" is what the organ plays it as, so a
   * piece that never has more than two notes going is not credited with a tutti it
   * never has. A piece running full on every beat scores 1; one that spends its
   * time on a single line scores a good deal less. A note let go at exactly the
   * second of a beat has stopped sounding, which is the rule the game uses too.
   */
  function fullness(notes, beats, spec) {
    var loudest = Math.max(spec.minChord, spec.heaviestChord(notes, spec.registration));
    if (beats.length === 0) return 0; // nothing to strike over, so nothing to size a bell against
    var live = [];
    var next = 0;
    var weights = [];
    for (var i = 0; i < beats.length; i++) {
      var at = beats[i].time;
      while (next < notes.length && notes[next].time <= at) {
        live.push(notes[next]);
        next++;
      }
      var kept = [];
      var weight = 0;
      for (var l = 0; l < live.length; l++) {
        var note = live[l];
        if (note.time + note.length <= at) continue;
        kept.push(note);
        weight += spec.noteWeight(note, spec.registration);
      }
      live = kept;
      weights.push(weight);
    }
    return middle(weights) / loudest;
  }

  /**
   * The bell for a piece. `notes` are the organ's own, in time order and with their
   * lines named; `beats` and `gap` come from src/pulse.js for the same piece.
   */
  function touch(notes, beats, gap) {
    var spec = Bach.organSpec;
    var full = Math.max(0, Math.min(1, fullness(notes, beats, spec)));
    var level = FULL * Math.sqrt(full);
    if (!(level >= SMALLEST)) level = SMALLEST;
    if (level > LARGEST) level = LARGEST;
    var beat = typeof gap === "number" && gap > 0 ? gap : 1;
    var decay = Math.min(LONGEST, Math.max(SHORTEST, RING * beat));
    return { level: level, decay: decay, fullness: full };
  }

  // The rule's own numbers, so a test or a tool can quote them instead of copying
  // them - the same deal as Bach.organSpec.
  Bach.touchRules = {
    full: FULL,
    smallest: SMALLEST,
    largest: LARGEST,
    ring: RING,
    shortest: SHORTEST,
    longest: LONGEST,
  };
  Bach.touchFullness = fullness;
  Bach.touch = touch;
})(window.Bach);
