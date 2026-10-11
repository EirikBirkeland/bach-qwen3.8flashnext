# Releases

## 0.2.1 — 2026-10-11

BWV 645 gets a picture of its own, and it is made for waiting.

- **BWV 645 ("Wachet auf") is now a long road, not falling notes.** The chorale
  melody — the gold line you follow — does not sing until 0:50, then stops for 29
  seconds and again for 23. Falling notes only ever show the next few seconds, so
  none of that came across. Now the music ahead of you climbs toward a horizon and
  the whole three and a half minutes are on the screen at once: you see the
  chorale a long way off before it arrives, you see the emptiness where it stops,
  and each time it comes in after a rest it blooms on the line of sound.
- **Repeats that begin between the phrases are found now.** The page worked out
  that BWV 639 plays its opening again; it said "nothing in BWV 645 is played
  twice", which was simply false — that piece brings its opening ritornello back
  whole at 1:32, nineteen bars along, and no phrase length that starts at bar 1
  puts a line nineteen bars along. The finder slides a window along the piece and
  compares every pair of stretches instead of tiling the piece from the start.
  In the long view you can watch that warm bar line approach for a minute before
  it arrives.
- A frame of the new picture draws about 900-1100 marks, and it stays light on a
  dark ground: mean light 0.044 at its fullest, nothing burnt out anywhere.
- The measuring canvas now records the colour of what a picture draws, not just
  where: a test can tell gold from blue. Three tests had their own copies of the
  page's script list; they read the page and the folder instead.
- BWV 565 and BWV 582 still wear the falling picture, unchanged, until each one
  gets its own.

## 0.2.0 — 2026-10-11

The first piece gets a picture of its own. BWV 639 is no longer falling notes.

- **BWV 639 ("Ich ruf zu dir") is woven, not falling.** A bar of this piece takes
  six and a half seconds, so notes falling at walking pace showed almost nothing at
  a time. Now time runs sideways and one phrase — four bars, twenty-six seconds —
  is exactly as wide as the screen: the whole shape of a phrase is in front of you
  while it is played. The three lines are unbroken strands of light (these editions
  write everything legato) crossing a line of sound a quarter of the way in. The
  line to follow is drawn the stoutest and an inner voice the thinnest, in the same
  order the organ plays them, and a faint line at every C lets you watch the piece
  sink, because its notes do.
- **The repeat is something you can see.** This piece plays its opening four bars
  again, whole, at 0:25. The page works that out from the notes themselves — nobody
  told it where the repeats are — and the phrase that was already heard is warm gold
  instead of cool blue, with its bar line glowing as it arrives.
- **The page knows the bar lines now.** The converter reads the time signature the
  edition wrote into each MIDI file and keeps where every bar starts, in seconds:
  BWV 639 has 18 bars of 6.49 s, the Passacaglia 293 bars of 2.5 s. That is the
  editor's own way of barring the music, not one invented here.
- A small line in the corner of the screen says how to read the picture you are
  looking at.
- The other three pieces still wear the falling picture, unchanged, until each one
  gets its own.

## 0.1.2 — 2026-10-11

The organ has ranks now. A note is no longer one pipe, and the corner of the
screen says what is playing.

- **Every note speaks through several pipes**: four or five on the manuals,
  three on the pedals — an open Principal, a stopped Gedackt, a Voix céleste
  tuned a shade sharp so the two beat slowly against each other, an Octava an
  octave up, and a Nassat a twelfth up to lead the line you are meant to follow.
  The line to follow (gold on screen) is drawn a third louder again than an
  inner voice, so a chorale melody comes through on its own; the pedals get the
  big pipes. Upper ranks break out below a low note, the way a mixture does, so
  the bottom stays clear instead of turning to mud.
- **Pipes speak, they don't switch on.** Every key lets in a moment of wind
  against the lip as it opens, no two keys open at quite the same instant, and
  each pipe settles back a little after its attack, so a held chord breathes
  instead of standing still.
- **Loudness is measured now, not guessed.** A new tool (`node
  tools/loudness.mjs`) rebuilds the instrument in plain numbers and renders every
  piece through it: the loudest chord of every piece peaks around 0.4 of full
  scale where the levels allow 0.56, and the limiter only starts working at
  0.71 — so nothing distorts, and a soft verse stays softer than a tutti. A thin
  piece like BWV 639, three notes at a time, is played at its own level instead
  of being turned down as though it were a tutti.
- While a piece plays, the corner under its title lists what the organ is drawn
  with — manuals and pedals separately.

## 0.1.1 — 2026-10-11

The notes are really drawn now, and you can hold the music, start it again, or
move into it anywhere.

- **The notes themselves were missing.** Every bar of light fell out of a formula
  that gave its top and its bottom the same height, so nothing was drawn: what
  you saw was the flash where a note crosses the line of sound, and nothing
  else. A bar is now as tall as its note is long — a chord of half notes hangs
  under the line, a running passage comes down in short strokes. This was a bug
  in 0.0.1 and 0.1.0, not a look you had gone quiet about.
- Pause, Restart and Stop sit in the corner while a piece plays. Space pauses
  and starts again, the arrow keys travel ten seconds, Home starts over, Escape
  goes back to the card. Clicking the line along the bottom moves to that place
  in the piece.
- Pausing in the middle of a held note does not cut the harmony short: when the
  music comes back, the notes still held are taken up again for whatever was
  left of them.
- The picture is checked by numbers now, since nobody here can see it: a test
  finds the moment where most notes sound at once, paints it on a measuring
  canvas, and fails if the screen washes out or stays dark. Another test wants a
  bar of light at the right place on the screen for every note sounding.

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
