// Which stretches of a piece are something the player has already heard.
//
// A repeat is the one thing in this music an eye can recognise while it is
// hearing the piece for the first time, so the pictures mark it. This works it
// out from the notes alone - nobody told it where the repeats are.
//
//   Bach.phraseEchoes(notes, bars, 4)
//     -> [{ phrase: 1, again: 0, at: 25.9459, until: 51.89, matched: 0.98 }]
//
// A phrase is `barsPerPhrase` bars long. A later phrase counts as an echo of an
// earlier one when the two hold the same number of bars and most of the later
// phrase was heard in the earlier one at the same pitch and in the same place in
// the phrase. "Most" is `part`, seven parts in eight by default: that is what
// lets a phrase come back with an ornament added and still count as the same
// thing. BWV 639 plays its opening four bars again whole, with one extra curl in
// the melody, and it should read as a repeat.
//
// Notes are objects with time, pitch and length, sorted by time; bars are the
// seconds each bar starts at.

window.Bach = window.Bach || {};

(function (Bach) {
  // How finely a note's place inside its phrase is written down, in steps of a
  // bar. Sixteenth notes - the fastest these editions write - land on the grid.
  var STEPS_PER_BAR = 32;
  // A phrase with fewer notes than this is not a phrase, it is a handful of held
  // notes, and two of them sounding alike would not mean anything.
  var MIN_NOTES = 30;

  /** The phrases of a piece: where each starts and ends, how many bars, and its
   *  notes keyed by "where in the phrase : how high". */
  function phrasesOf(notes, bars, barsPerPhrase, until) {
    var phrases = [];
    for (var index = 0; index < bars.length; index += barsPerPhrase) {
      phrases.push({
        at: bars[index],
        until: index + barsPerPhrase < bars.length ? bars[index + barsPerPhrase] : until,
        bars: Math.min(barsPerPhrase, bars.length - index),
        keys: {},
        count: 0,
      });
    }
    for (var i = 0; i < notes.length; i++) {
      var note = notes[i];
      var phrase = phraseAt(phrases, note.time);
      if (!phrase) continue;
      var span = phrase.until - phrase.at;
      // Where the note sits inside its phrase, written so that the same note in a
      // phrase played at a different speed still lands in the same place.
      var place = Math.round(((note.time - phrase.at) / span) * phrase.bars * STEPS_PER_BAR);
      var key = place + ":" + note.pitch;
      if (!phrase.keys[key]) phrase.count++;
      phrase.keys[key] = 1;
    }
    return phrases;
  }

  /** The phrase a moment falls in, or nothing if it is past the last bar line. */
  function phraseAt(phrases, at) {
    for (var i = 0; i < phrases.length; i++) {
      if (at >= phrases[i].at && at < phrases[i].until) return phrases[i];
    }
    return null;
  }

  /** How much of `later` was already heard in `earlier`, between 0 and 1. */
  function partHeardBefore(earlier, later) {
    var keys = Object.keys(later.keys);
    if (keys.length === 0) return 0;
    var heard = 0;
    for (var i = 0; i < keys.length; i++) {
      if (earlier.keys[keys[i]]) heard++;
    }
    // Divided by the bigger of the two, so a short stretch cannot pass itself off
    // as a repeat of a long one.
    return heard / Math.max(Object.keys(earlier.keys).length, keys.length);
  }

  function phraseEchoes(notes, bars, barsPerPhrase, part) {
    var needed = part || 0.75;
    barsPerPhrase = Math.max(1, barsPerPhrase || 4);
    if (!bars || bars.length < 2 || notes.length === 0) return [];
    var lastNote = notes[notes.length - 1];
    var until = lastNote.time + lastNote.length + 0.001;
    var phrases = phrasesOf(notes, bars, barsPerPhrase, until);
    var found = [];
    for (var later = 1; later < phrases.length; later++) {
      for (var earlier = 0; earlier < later; earlier++) {
        if (phrases[earlier].bars !== phrases[later].bars) continue;
        if (phrases[later].count < MIN_NOTES || phrases[earlier].count < MIN_NOTES) continue;
        var matched = partHeardBefore(phrases[earlier], phrases[later]);
        if (matched >= needed) {
          found.push({
            phrase: later,
            again: earlier,
            at: phrases[later].at,
            until: phrases[later].until,
            matched: Math.round(matched * 100) / 100,
          });
          break; // the earliest thing it matches is what it is a repeat of
        }
      }
    }
    return found;
  }

  Bach.phraseEchoes = phraseEchoes;
})(window.Bach);
