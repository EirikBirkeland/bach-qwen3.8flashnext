// Where the bar lines of a MIDI file fall, in seconds.
//
// These are the bar lines of the edition that wrote the file: the editor put its
// metre there, so the bars are the editor's, not ones we invented. The reading of
// the denominator was checked against the music - BWV 582 is marked 3,2, and its
// ground bass is eight bars of three quarter notes, which only fits "2 means
// quarter notes".
//
// A MIDI file never writes a bar line: it writes a metre and a tick count, and the
// bars follow by arithmetic from the first tick. That is where the anacrusis below
// comes from - a file cannot say "the music starts half a bar early", so the
// arithmetic has to be corrected by what the music itself says at its end.

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
  const lift = anacrusis(starts, duration);
  const lined = lift > 0 ? starts.map((at) => round(at + lift)).filter((at) => at <= duration - 0.05) : starts;
  return {
    starts: lined.filter((value, index) => index === 0 || value > lined[index - 1] + 0.001),
    metre: { beats: marks[0].beats, beat: marks[0].beat },
  };
}

/**
 * How far the first bar line sits after the first note, or 0.
 *
 * An edition that opens with a pickup breaks the arithmetic: the music starts part
 * of a bar in, so every bar line drawn from the first tick is that much too early.
 * There is no pickup marker to read, but the end of the piece says the same thing.
 * These editions end exactly on a bar line - which is what lets a bar line with no
 * music after it be dropped at all - so whatever the last bar is short by is the
 * pickup the piece opened with.
 *
 * BWV 645 is the case. Its last chord is four seconds long and ends the piece, so
 * it fills a whole four-second bar; the piece opened with one eighth note. That is
 * half a beat of a four-second bar, and half a beat is the difference between a
 * beat a player can strike and one nobody could: the whole of that piece's pulse
 * was being asked for a half second before the music arrives.
 *
 * The bar to judge by is the middle of all of them, not the last one: an editor who
 * slows down at the end stretches the bars he is still drawing. In BWV 582 the bar
 * before the last is more than twice as long as the ground's, and the last is a
 * quarter shorter than one - read that last gap alone and the Passacaglia looks as
 * though it opened with three fifths of a bar missing, when it opened on the beat.
 */
function anacrusis(starts, duration) {
  if (starts.length < 3) return 0;
  const gaps = [];
  for (let i = 1; i < starts.length; i++) gaps.push(starts[i] - starts[i - 1]);
  gaps.sort((a, b) => a - b);
  const bar = gaps[Math.floor(gaps.length / 2)];
  const short = round(duration - starts[starts.length - 1]);
  return short > 0 && short * 2 < bar ? short : 0;
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
