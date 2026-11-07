// The moments in a piece that are worth marking.
//
// Three things happen in this music that a listener notices, and the notes on
// their own say when:
//
//   a line is taken up again after a long silence - the pedal of BWV 565 waits
//   ninety seconds and more, twice;
//   a handful of notes are struck together - a chord, which in that piece is an
//   event and not a texture;
//   the tune that comes back comes back - which is src/theme.js's work, asked for
//   here so that everything asking it asks the same question.
//
// Bach.landmarks(notes, { bars: data.bars }) hands back all three, sorted by
// time, each one { time, kind, ... }. src/look-subject.js draws the first two and
// src/game.js pays out on all three.

window.Bach = window.Bach || {};

(function (Bach) {
  var GONE = 10; // seconds a line has to be quiet for before its return is a homecoming
  var TOGETHER = 5; // notes struck at once before it counts as a chord
  var STRUCK_WITHIN = 0.02; // a twentieth of a second is one moment, not two

  /**
   * Where a voice comes back after having been silent GONE seconds or more. Not
   * the first time it speaks - that is only it starting.
   */
  function returns(notes, goneFor) {
    var gone = goneFor === undefined ? GONE : goneFor;
    var ended = {};
    var found = [];
    for (var i = 0; i < notes.length; i++) {
      var note = notes[i];
      var line = String(note.voice);
      var end = note.time + note.length;
      if (ended[line] === undefined) {
        ended[line] = end;
        continue;
      }
      if (note.time - ended[line] >= gone) found.push(note);
      if (end > ended[line]) ended[line] = end;
    }
    return found;
  }

  /**
   * Where TOGETHER notes or more begin together, as one moment: when it was
   * struck, how far across the pitches the notes of it reach, and how many.
   * Notes are taken in time order, so a group is a run of them beginning within
   * STRUCK_WITHIN of the first.
   */
  function struckTogether(notes, atLeast) {
    var least = atLeast === undefined ? TOGETHER : atLeast;
    var found = [];
    var group = [];
    for (var i = 0; i <= notes.length; i++) {
      var note = notes[i];
      if (note && group.length > 0 && note.time - group[0].time < STRUCK_WITHIN) {
        group.push(note);
        continue;
      }
      if (group.length >= least) {
        var low = group[0].pitch;
        var high = group[0].pitch;
        for (var g = 0; g < group.length; g++) {
          if (group[g].pitch < low) low = group[g].pitch;
          if (group[g].pitch > high) high = group[g].pitch;
        }
        found.push({ time: group[0].time, low: low, high: high, notes: group.length });
      }
      group = note ? [note] : [];
    }
    return found;
  }

  /**
   * Everything worth marking, in time order. `bars` is only there so the tune
   * finder knows how long a bar is; without it no tune is looked for.
   */
  function landmarks(notes, options) {
    var settings = options || {};
    var out = [];
    var i;

    var back = settings.gone === false ? [] : returns(notes, settings.gone);
    for (i = 0; i < back.length; i++) {
      out.push({ time: back[i].time, kind: "return", voice: back[i].voice, pitch: back[i].pitch });
    }

    var chords = settings.chord === false ? [] : struckTogether(notes, settings.chord);
    for (i = 0; i < chords.length; i++) {
      out.push({ time: chords[i].time, kind: "chord", notes: chords[i].notes });
    }

    if (settings.tune !== false && Bach.theme && notes.length > 0) {
      var tune = Bach.theme(notes, { bars: settings.bars });
      if (tune) {
        for (i = 0; i < tune.heard.length; i++) {
          out.push({ time: tune.heard[i].time, kind: "tune", voice: tune.heard[i].voice });
        }
      }
    }

    out.sort(function (a, b) {
      return a.time - b.time;
    });
    return out;
  }

  Bach.returns = returns;
  Bach.struckTogether = struckTogether;
  Bach.landmarks = landmarks;
})(window.Bach);
