# Releases

## 0.1.0 — 2026-10-11

All four pieces are here now. Open `index.html` and choose.

- The Passacaglia and Fugue in C minor, BWV 582 (12m18s, 9546 notes), Wachet auf,
  ruft uns die Stimme, BWV 645 (3m41s) and Ich ruf zu dir, Herr Jesu Christ,
  BWV 639 (1m59s) join the Toccata and Fugue. Each piece names its voices the way
  they are played - chorale melody, hands, pedal - and wears its own colours.
- Some of these files wrote a line more than once: the Passacaglia had its pedal
  line in three octaves at once, the chorale preludes had whole staves repeated an
  octave up. Each line is now played once, in the octave that sits on the manual
  or the pedalboard, and every note left out is written down in the data file.
- The tests check all four pieces note for note against their MIDI files, account
  for every note that was left out, and play every piece on the card.
- The organ measures its loudest moment properly now. A note that ends exactly as
  another starts used to be counted as sounding with it, which made the thickest
  chord look bigger than it is and every pipe to be made quieter than it needs to
  be. The Passacaglia and the two chorale preludes play about a third louder now,
  with the same headroom before the limiter.
- `node tools/inspect.mjs bwv639 0 end` prints what is sounding at a moment you
  name, so the music can be checked by numbers.

## 0.0.1 — 2026-10-11

The first something. Open `index.html` and press the piece.

- Toccata and Fugue in D minor, BWV 565, plays in full: all 3651 notes of the
  Mutopia file, in the right order at the right seconds, for 9 minutes 32.
- An organ built in code: two pipes per note, a mix of eight harmonics, a
  tremulant breathing over the whole stop, and a stone room to decay in.
- The notes fall down the screen and light up as they cross the line of sound.
  Pitch is left to right, colour is the voice: right hand, left hand, pedal.
- A menu page, `releases/index.html`, lists every version ever released.

## 0.0.0 — the starting point

- The plan, four MIDI files from the Mutopia Project, and the release tool.
