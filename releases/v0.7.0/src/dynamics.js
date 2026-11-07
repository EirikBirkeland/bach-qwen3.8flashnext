// The touch of a piece: how loud each of its notes is played.
//
// These editions were engraved with no dynamics at all - every key of the
// Passacaglia was struck at 127, every key of the Toccata at 90 - so the organ has
// nothing to borrow and, left to itself, plays a whole chorale at one level from
// first note to last. An organist does not do that. This works the shaping out of
// the notes themselves, and nothing in it is typed in per piece:
//
//   Bach.dynamics(notes, { bars: data.bars, phrase: 4 }) -> one number per note
//
// Three things the music says about itself:
//
//   a phrase is an arch: begun held back, growing to two thirds along, settling at
//   its cadence. That is what a phrase of four bars sounds like when a person plays
//   it and not a player piano. `phrase` is how many bars one takes, which the card
//   says: four for three of these pieces, eight for the Passacaglia, whose phrase
//   is one turn of its ground bass.
//
//   a thin moment is played fuller than a full one: one line on a quiet manual, a
//   tutti held back a little. The organ sets its whole volume by the heaviest chord
//   in the piece, so without this the bare middle of BWV 565 - where exactly one
//   note sounds at a time for a minute and a half - is played as if nine were going.
//
//   a line taken up again is brought out, most on the note that starts it and
//   easing off over the second after. That is what an entry is: the pedal of BWV 565
//   comes back after waiting a hundred and fifteen seconds, the chorale of BWV 645
//   comes home after twenty-nine seconds of waiting for it.
//
// A note's number is those three multiplied, and it stays inside a guard so that no
// combination can say something silly. The organ reads its weights - and so the
// volume it plays the whole piece at - after the shaping, which is what lets this
// move the loudness about inside a piece without ever making the piece louder.

window.Bach = window.Bach || {};

(function (Bach) {
  // The arch of a phrase, as a share of the note's plain level.
  var ARCH = {
    start: 0.86, // a new phrase is begun held back
    peak: 1.08, // ... grows to here ...
    peakAt: 0.65, // ... two thirds along the phrase
    end: 0.94, // ... and settles a little as it lets go
  };
  var DEFAULT_PHRASE = 4; // bars to a phrase, when nothing says

  var RETURN = 1; // seconds a line has to be silent for before its next note is an entry
  var HAIR = 0.02; // the moment just before a note: was anything already sounding?
  var ENTRY = 1.22; // how much firmer the entering note is struck
  var ENTRY_EASE = 1.2; // ... and how long the line keeps that, after its first note

  var THIN = 0.3; // how far a thin moment is played up: three tenths of the way, in decibels
  var THINNEST = 1.15; // a single line is never played up more than this
  var FULLEST = 0.92; // ... and a tutti is never held back more than this

  var SMALLEST = 0.8; // the guard: a note is never played below this ...
  var LARGEST = 1.5; // ... nor above this, whatever the three rules say together

  /** Note times come in to four decimals; so does an end, or a hand-over looks late. */
  function grid(seconds) {
    return Math.round(seconds * 10000) / 10000;
  }

  function middle(list) {
    if (list.length === 0) return 0;
    var sorted = list.slice().sort(function (a, b) {
      return a - b;
    });
    return sorted[Math.floor(sorted.length / 2)];
  }

  /** How many entries of a sorted list are at or below `at`. */
  function atOrBelow(sorted, at) {
    var low = 0;
    var high = sorted.length;
    while (low < high) {
      var mid = (low + high) >> 1;
      if (sorted[mid] <= at) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  /**
   * How many notes are sounding at each note of a piece - or at any moment asked
   * for, which is how the entry rule asks what was going on just before a line came
   * back. A note let go at exactly that moment has stopped: the hand over to the
   * next chord is one moment, not two, which is the rule the organ uses too.
   */
  function soundingAt(notes, moment) {
    var starts = notes.map(function (one) {
      return one.time;
    });
    var ends = notes
      .map(function (one) {
        return grid(one.time + one.length);
      })
      .sort(function (a, b) {
        return a - b;
      });
    starts.sort(function (a, b) {
      return a - b;
    });
    return notes.map(function (one) {
      var at = moment ? moment(one) : one.time;
      return Math.max(0, atOrBelow(starts, at) - atOrBelow(ends, at));
    });
  }

  /** How many notes are sounding as each one begins - itself included. */
  function sounding(notes) {
    return soundingAt(notes, null).map(function (count) {
      return Math.max(1, count);
    });
  }

  /**
   * Where each note sits within its own phrase, in bars: 0 on the phrase's opening
   * bar, and a whole number's worth of bars on, however the tempo runs. No bar grid
   * means no arch - a piece nobody has barred is left as it stands.
   */
  function places(notes, bars, duration, phrase) {
    if (!bars || bars.length < 2 || !(phrase > 0)) return null;
    return notes.map(function (one) {
      var low = 0;
      var high = bars.length - 1;
      while (low < high) {
        var mid = (low + high + 1) >> 1;
        if (bars[mid] <= one.time) low = mid;
        else high = mid - 1;
      }
      var start = bars[low];
      var stop = low + 1 < bars.length ? bars[low + 1] : Math.max(duration, start);
      var through = stop > start ? (one.time - start) / (stop - start) : 0;
      var place = low + Math.max(0, Math.min(1, through));
      return ((place % phrase) + phrase) % phrase;
    });
  }

  /** The arch itself: one number for one place within a phrase. */
  function arch(place) {
    var p = place;
    if (p >= ARCH.peakAt) {
      if (p === ARCH.peakAt) return ARCH.peak;
      return ARCH.peak + (ARCH.end - ARCH.peak) * ((p - ARCH.peakAt) / (1 - ARCH.peakAt));
    }
    return ARCH.start + (ARCH.peak - ARCH.start) * (p / ARCH.peakAt);
  }

  /**
   * A thin moment played up, a full one held back, against how many notes this
   * piece usually has going.
   */
  function body(count, reference) {
    if (!(count > 0) || !(reference > 0)) return 1;
    var lift = Math.pow(reference / count, THIN);
    if (lift > THINNEST) return THINNEST;
    if (lift < FULLEST) return FULLEST;
    return lift;
  }

  /**
   * Where each line is taken up again, and how much that lifts the notes after it.
   * Two things make an entry and both are needed: the line has been silent for a
   * second or more, and something else was already sounding as it came back. An
   * entry is a line joining a texture - that is what makes it heard - so a whole
   * ensemble arriving together out of a bar of silence is not one, and the toccata
   * of BWV 565 is nothing but that. A line's first note ever is not a homecoming
   * either, only a start.
   */
  function entries(notes) {
    var lift = [];
    var silentUntil = {}; // each line: when its last note let go
    var begun = {}; // each line: its own entry, or null since the last one eased off
    var going = soundingAt(notes, function (note) {
      return note.time - HAIR;
    });
    for (var i = 0; i < notes.length; i++) {
      var note = notes[i];
      var line = String(note.voice);
      var end = grid(note.time + note.length);
      var soFar = begun[line];
      if (silentUntil[line] === undefined) {
        lift.push(1);
      } else if (note.time - silentUntil[line] >= RETURN && going[i] > 0) {
        lift.push(ENTRY);
        begun[line] = end;
      } else if (soFar !== undefined && soFar !== null) {
        var since = Math.max(0, note.time - soFar);
        if (since >= ENTRY_EASE) {
          begun[line] = null;
          lift.push(1);
        } else {
          lift.push(1 + (ENTRY - 1) * (1 - since / ENTRY_EASE));
        }
      } else {
        lift.push(1);
      }
      if (silentUntil[line] === undefined || end > silentUntil[line]) silentUntil[line] = end;
    }
    return lift;
  }

  /**
   * How loud every note of a piece is played, one number per note, in the order the
   * notes were given. `notes` are the organ's own: pitch, time, length, voice, role.
   */
  function dynamics(notes, options) {
    var settings = options || {};
    var phrase = settings.phrase > 0 ? settings.phrase : DEFAULT_PHRASE;
    var arches = places(notes, settings.bars, settings.duration, phrase);
    var counts = sounding(notes);
    var reference = middle(counts);
    var lifted = entries(notes);
    var out = [];
    for (var i = 0; i < notes.length; i++) {
      var shade = (arches ? arch(arches[i] / phrase) : 1) * body(counts[i], reference) * lifted[i];
      if (shade < SMALLEST) shade = SMALLEST;
      if (shade > LARGEST) shade = LARGEST;
      out.push(Math.round(shade * 1000) / 1000);
    }
    return out;
  }

  // The rule's own numbers, so a test or a tool quotes them instead of copying them.
  Bach.dynamicsRules = {
    arch: ARCH,
    defaultPhrase: DEFAULT_PHRASE,
    retake: RETURN,
    hair: HAIR,
    entry: ENTRY,
    ease: ENTRY_EASE,
    thin: THIN,
    thinnest: THINNEST,
    fullest: FULLEST,
    smallest: SMALLEST,
    largest: LARGEST,
  };
  // The three rules apart from each other, for a measurement or a test that wants
  // to ask one of them alone.
  Bach.dynamicsShape = {
    arch: arch,
    places: places,
    sounding: sounding,
    soundingAt: soundingAt,
    body: body,
    entries: entries,
    middle: middle,
  };
  Bach.dynamics = dynamics;
})(window.Bach);
