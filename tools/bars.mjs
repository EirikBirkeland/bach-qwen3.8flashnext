// Where the bar lines of a MIDI file fall, in seconds.
//
// These are the bar lines of the edition that wrote the file: the editor put its
// metre there, so the bars are the editor's, not ones we invented. The reading of
// the denominator was checked against the music - BWV 582 is marked 3,2, and its
// ground bass is eight bars of three quarter notes, which only fits "2 means
// quarter notes".

/**
 * @param song  what readMidiFile returns
 * @param duration  seconds to stop at, so no bar line lands after the last note
 * @returns {{ metre: {beats: number, beat: number}, starts: number[] }}
 */
export function barLines(song, duration) {
  const marks =
    song.timeSignatures.length > 0
      ? song.timeSignatures
      : [{ tick: 0, seconds: 0, beats: 4, beat: 4, barTicks: song.ticksPerQuarter * 4 }];
  const starts = [];
  for (const mark of marks) {
    let tick = mark.tick;
    // Walk back to the last bar line before this change of metre, so the new
    // metre starts a bar rather than landing in the middle of one.
    while (tick - mark.barTicks >= marks[0].tick) tick -= mark.barTicks;
    for (; ; tick += mark.barTicks) {
      const seconds = round(song.toSeconds(tick));
      // A bar line with no music after it is not worth a bar: many of these
      // editions end exactly on the line.
      if (seconds > duration - 0.05) break;
      if (seconds >= (starts.length > 0 ? starts[starts.length - 1] : -1)) starts.push(seconds);
    }
  }
  starts.sort((a, b) => a - b);
  return {
    starts: starts.filter((value, index) => index === 0 || value > starts[index - 1] + 0.001),
    metre: { beats: marks[0].beats, beat: marks[0].beat },
  };
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
