// The touch of a piece: how big a bell to ring when the player strikes its pulse.
//
// One bell for all four pieces was the first version, and it was wrong by about
// 10 dB. Measured over the beats themselves (tools/touch.mjs), that fixed bell sat
// anywhere between a third of the music and nine tenths of it, piece to piece: under
// BWV 639's chorale it was hardly heard, over one note of BWV 565's fugue it was as
// loud as the tune. These two rules even that out, and nothing in them is typed in
// per piece.
//
//   Bach.touch(notes, beats, gap) -> { level, decay, fullness, sizes }
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
// Then the same question was asked again *inside* a piece, because one bell per
// piece was still the coarsest thing in the sound: over BWV 582's opening pedal
// solo a bell sized for the whole passacaglia rang 10 dB LOUDER than the music the
// player was listening to, and in the rests between sections of BWV 565 it rang at
// full size over nothing at all. So every beat gets its own size in `sizes`, by the
// same rule one step down: a moment running half as full as the piece runs at its
// middle gets a bell at 0.59 of its bell, and a moment at the piece's own middle
// gets exactly that bell - `level` is still the piece's bell and still the biggest
// bell a beat of that piece ever rings. Not letting a moment's bell grow past it is
// not timidity: the organ sets its own volume by the piece's widest chord, so every
// piece's loudest moment already sits at the same share of full scale, and a bell
// that grew with the music would be paid for exactly where there is no room left -
// tools/touch.mjs prints that arithmetic. The share is 0.75 and not a tidy half
// because that is how the organ actually grows: put the four pieces' beats - 1,729 of
// them, everywhere anything sounds - on a log-log graph of rendered loudness against
// how much is sounding, and the slope is three quarters. tools/touch.mjs prints the
// fit beside the number the rule uses, so the two cannot drift apart.
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
  var LEAN = 0.75; // a moment's own share: see the note above on the measured exponent
  var LEAST = 0.4; // ... and never under two fifths of the piece's own bell
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
   * How much of the piece is sounding at every one of its beats, as a share of the
   * loudest the piece ever gets - and "the loudest it ever gets" is what the organ
   * plays it as, so a piece that never has more than two notes going is not credited
   * with a tutti it never has. A beat in a full chord scores 1; a beat on a single
   * line scores a good deal less; a beat in a rest scores nothing. A note let go at
   * exactly the second of a beat has stopped sounding, which is the rule the game
   * uses too.
   *
   * One number out of this list is the piece's own fullness - its middle, which is
   * what sizes the piece's bell - and the list itself is what sizes every beat.
   */
  function fullnesses(notes, beats, spec) {
    var loudest = Math.max(spec.minChord, spec.heaviestChord(notes, spec.registration));
    var out = [];
    if (beats.length === 0 || loudest <= 0) return out; // nothing to strike over
    var live = [];
    var next = 0;
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
      out.push(weight / loudest);
    }
    return out;
  }

  /** How loud the piece runs where the bells land: see `fullnesses`. */
  function fullness(notes, beats, spec) {
    return middle(fullnesses(notes, beats, spec));
  }

  /**
   * How a bell is made less than the piece's own: a moment running `full` where the
   * piece runs `middle` gets a bell at `full / middle` to the power LEAN of it - the
   * exponent the organ's own loudness grows by - held between LEAST of that bell and
   * the bell itself. A moment fuller than the piece's middle is on the far side of
   * that ceiling and simply rings the piece's bell.
   */
  function trim(full, middle) {
    if (!(middle > 0)) return LEAST; // nothing to measure against: the least bell
    var share = Math.pow(Math.max(0, full) / middle, LEAN);
    if (share > 1) return 1;
    return share < LEAST ? LEAST : share;
  }

  /**
   * The bell for a piece. `notes` are the organ's own, in time order and with their
   * lines named; `beats` and `gap` come from src/pulse.js for the same piece.
   *
   * `level` and `decay` are the piece's own bell, rung by its fullest beats; `sizes`
   * has one sizing per beat, in the order the beats were given, and none of them is
   * bigger than the piece's.
   */
  function touch(notes, beats, gap) {
    var spec = Bach.organSpec;
    var every = fullnesses(notes, beats, spec);
    var full = Math.max(0, Math.min(1, middle(every)));
    var level = FULL * Math.sqrt(full);
    if (!(level >= SMALLEST)) level = SMALLEST;
    if (level > LARGEST) level = LARGEST;
    var beat = typeof gap === "number" && gap > 0 ? gap : 1;
    var decay = Math.min(LONGEST, Math.max(SHORTEST, RING * beat));
    var sizes = [];
    for (var i = 0; i < beats.length; i++) {
      sizes.push({ level: level * trim(every[i], full), decay: decay, fullness: every[i] });
    }
    return { level: level, decay: decay, fullness: full, sizes: sizes };
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
    lean: LEAN,
    least: LEAST,
  };
  Bach.touchFullness = fullness;
  Bach.touchFullnesses = fullnesses;
  Bach.touchTrim = trim;
  Bach.touch = touch;
})(window.Bach);
