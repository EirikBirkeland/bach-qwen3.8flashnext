# Bach: the plan

Tick items as `[x]` when done. Each item is sized to fit one session; split it if it turns out bigger.

The file "OVERLORDS_REQUESTS" contains the owner's requests. Prioritize maximally. When a request is completely finished, move the whole entry, with your note on what shipped, to the end of "archive/COMPLETED_OVERLORDS_REQUESTS", so only open requests are left to read.

## The idea, in the owner's words

> "Here are my top 10 bach organ pieces. This game will be a tribute to this beautiful music."
>
> "You get something like Rez, or a psychedelic 'chill game'. Or, you get amazing animations that fit the music perfectly."
>
> "Even a half-failed attempt may be fun."

The owner has given four pieces so far. They are in `music/` as MIDI files:

- Toccata and Fugue in D minor, BWV 565
- Passacaglia and Fugue in C minor, BWV 582
- Wachet auf, ruft uns die Stimme, BWV 645
- Ich ruf zu dir, Herr Jesu Christ, BWV 639

## Pillars

1. **The music is the script.** Everything on screen comes from the notes: which voice plays, how high, how long,
   what sounds together, where a theme enters. Nothing moves for no reason.
2. **Bach played properly.** Every note of the piece, at the right time, in a sound that suits an organ.
3. **A browser page.** Static files, no build step, sound made in code.
4. **Beautiful before clever.** This is a tribute. If a choice is between impressive and beautiful, take beautiful.

## Milestones

### Milestone 0: first baby steps (the owner wants to see a first something about an hour after you start)

Do these quickly and roughly, in the first session if you can, and release as soon as it plays. Polish comes after.

- [x] A small tool of your own that turns a MIDI file into plain note data (JSON): for each note its voice or
      track, pitch, start and length in seconds. Convert BWV 565 first. Commit the JSON.
- [x] `index.html` with a start button (browsers only allow sound after a click) that plays BWV 565 from the
      note data with a simple organ-like voice.
- [x] One simple visual driven by the notes while it plays, for example a light per note, placed by pitch and
      coloured by voice.
- [x] Release `0.0.1`.

### Milestone 1: all four pieces, played properly

- [x] Convert the other three pieces. A test that every converted piece matches its MIDI file note for note.
- [x] A way to choose the piece.
- [x] Timing that follows the tempo changes in the MIDI file.
- [x] A better organ: several pipes per note, so it sounds full and not like a beep. Check the loudness by numbers
      so chords do not distort.
- [x] Pause, restart, and a way to move to any point in the piece.

### Milestone 2: a visual world for each piece

- [x] Study each piece as data and write down its shape in `NOTES.md`: its sections, its voices, where the theme
      enters, where it is busiest and where it rests.
- [x] Design a different look for each piece that grows out of that shape. One piece per session.
      Done: BWV 639, woven (0.2.0); BWV 645, the long view (0.2.1); BWV 565, the fugue picture
      (0.2.3); BWV 582, the wheel that turns once to the ground bass (0.2.4).

### Milestone 3: something to do

- [x] Something for a player to do in time with the music, in the spirit of Rez, with a "just watch" mode beside it.
      Decide what, write the design here first, then build it.
      Done across `0.3.0` to `0.3.5`: strike the beat of the piece, and a bell rings the harmony; the run,
      the score line and the sentence at the end; and three of the four pieces mark their beats inside their
      own picture rather than wearing the game's ladder. "Just watch" is one press away at any moment.

  - [x] The design, written down here before any of it was built - see below.
  - [x] Built and released as `0.3.0`: `src/pulse.js` for the beat grid, `src/landmarks.js` for the moments
        worth marking, `organ.chime` for the bell, `src/game.js` for the run and the ladder and the words,
        and the page wired to them - "Play along" beside Pause, or the `P` key, or a click on the picture,
        or Enter. Just watching is what it was before, and one press away.
  - [x] The ladder is laid *over* the picture, not part of it. Each piece's world could take its pulse in
        its own way - the wheel ticking one tooth of the rim to a beat, the long view planting a lamp on the
        road, the braid breathing with it. Only do it where it is better, piece by piece.
        Done, and the deciding is done too: the wheel takes it on its rim (`0.3.2`), the long view plants lamps
        on its verges (`0.3.4`) and the braid stands a ruler of beats along the top and bottom of its music
        (`0.3.5`), wherever a beat of the piece has a place of its own in the picture. The fugue picture of
        BWV 565 keeps the game's ladder on purpose: its notes fall, and a ladder of falling beats is the same
        shape over the same few seconds.
  - [x] The braid of BWV 639 has taken the pulse too (`0.3.5`), and it is not breathing: it is a ruler. A bar
        of this piece is six and a half seconds and a beat is eighty pixels along the screen, twelve of them
        in view at a time, where the game's ladder showed two and fell straight down the middle of a picture
        whose time runs sideways. A mark per beat, along the top of the music and along the bottom - the two
        places a note is never drawn - a bar's opening standing taller than the beats inside it, and the beat
        the piece marks for itself taller and brighter however far off it is: the phrase said again at 0:26 is
        a whole screen away and already on this one, which no ladder two beats tall could ever have said.
  - [x] The wheel of BWV 582 has taken the pulse into its own world (`0.3.2`): a tooth per beat just inside
        the rim, at the bearing that beat falls on within the turn, so the hand crossing a tooth *is* the
        beat arriving; a struck beat lights the rim where its tooth stood, and a long run brightens the whole
        rim. The other three pieces keep the ladder - their pictures already run on a straight timeline.
        A picture that wants the pulse is now asked for it: `src/visual.js` asks, `src/main.js` hands it over,
        and `src/game.js` keeps all the judging and hands the picture a plain shot of the beats, the run,
        and what the player struck.
  - [x] The bell is no longer one struck sound for all four pieces. `src/touch.js` sizes each piece's bell
        from the piece: how loud, from how full the music is where the bells land, and how long it hangs,
        from the piece's own beat. `node tools/touch.mjs` prints the measuring of it - the spread of
        "bell beside its own music" across the four went from 3.1 to 1.7, and every bell now fills about
        three fifths of a beat instead of a third of it in BWV 639 and nine tenths in BWV 582.

#### The design: strike the beat

**What the player does.** While a piece plays, click anywhere on the picture (or press Enter) in time with
its pulse. Every beat of the piece is a chance; you take the ones you like. Nothing fails, nothing stops:
the organ plays every note of the piece whatever the player does. "Just watch" is the same thing with the
game switched off, and one button (or `P`) turns it on and off at any moment.

**Why the pulse, and not the notes.** Measured from the data before choosing (the numbers are written in
`NOTES.md`): the notes of the line to follow come at 3.3 a second in BWV 565 and 5.9 in BWV 582, which no
hand can do; the tune that comes back is far too rare to chase — the ground bass is heard 13 times in twelve
minutes. The beat is the one thing all four pieces mark at a rate a hand can keep, and it is steady:
37 a minute in BWV 639 (♩=37), 60 in BWV 565 and BWV 645, 72 in BWV 582. It also has to be *listened* to:
BWV 582 slows five times in its last two minutes and BWV 639 four times at its end, so a player who wants
the run has to slow down with the organ.

**Where the beats come from.** The data file already holds the piece's own bar lines (seconds, from the
MIDI's tempo map) and its metre, so the grid is `bar start + k × bar length ÷ beats`. No new number is
typed in per piece, a downbeat lands exactly on the bar line the picture already draws, and a ritardando
stretches the beats with the bars.

**What happens when you catch one.** A bell rings. Its note is the lowest note sounding at that moment,
two octaves up, so whatever the player strikes is a note of the harmony that is actually sounding: the taps
shimmer over the organ and pick out the chords. That is the Rez idea — what the player does is part of the
music, not a score laid beside it.

**What is worth more.** A beat on which the music itself does something is gold on the ladder and rings
louder: the tune coming back (`src/theme.js`), a line taken up again after ten seconds of silence, a chord
of five or more struck together.

**The scoring.** A run is beats caught one after another. A beat that passes untouched ends it, and so does
a click with no beat near it (which is what stops drumming on the mouse). At the end the page says how many
of the beats you were there for and your longest run. Caught = within 0.3 s of the beat, struck true =
within 0.11 s (a true one lights brighter).

**The picture.** The game draws one thing, low in the middle of the screen and nowhere else: a ladder of
short bars falling onto a catch line about a hundred pixels above the bottom, the next beats only, about
two of them visible however fast the piece is (the ladder's pace comes from the piece's own beat). A caught
beat is gone from the ladder and lights the catch line; the longer the run, the wider and brighter that
line. Everything else on screen is the piece's own picture, untouched.

Built in this order:

1. `src/pulse.js` — the beat grid out of the data's own bars and metre.
2. `src/landmarks.js` — the moments worth marking: a line come back, a chord struck together, a telling of
      the tune. `src/look-subject.js` had private copies of two of these; they move here.
3. `organ.chime(pitch, when, weight)` — a struck bell, through the same room as the pipes, and quiet
      enough by numbers that a chord and a bell together still fit under full scale.
4. `src/game.js` — the grid, the judging, the run, the ladder, the score line.
5. `main.js` + `index.html` — the button, `P`, a click on the picture, the score, a line on the end pane.

### Milestone 4: the instrument breathes

- [x] Play every note was the first job; play every note *at one level* was never the plan. These editions
      carry no dynamics at all - every key of the Passacaglia was struck at 127, every key of the Toccata at
      90 - so the shaping had to be read out of the notes. `src/dynamics.js` gives every note a level from
      three things a piece says about itself, and nothing in it is typed in per piece: where the note sits in
      its phrase (a phrase is begun held back, grows to two thirds along, and settles at its cadence); how
      many notes are going (a single line is played up, a tutti held back, against what this piece usually
      has going); and whether this line is coming back into something after a silence - which is what an
      entry is, and it is struck firmer, most on the note that starts it. The organ weighs its ceiling after
      the shaping, so the shaping moves the loudness about inside a piece without ever making a piece louder.
      Released `0.4.0`; `node tools/dynamics.mjs` prints the measuring, bar by bar, with and without.

  - [ ] The bell is sized per piece, not per moment. `src/touch.js` gives each piece one bell from how full
        the piece runs where its beats are, and that is now the coarsest thing left in the sound: over BWV
        565 the bell sits 7 dB under the music on a beat in the bare middle and 3 dB under it in the toccata.
        Session 11 left this out on purpose, because a bell grows exactly where the chord is widest, which is
        where the headroom is already spoken for. Measured again since the shaping went in: the four pieces
        sit within 1.7 to 1 of their own music, which is as good as a per-piece rule gets.
  - [ ] The wheel of BWV 582 tips one cell of the picture white twice in the piece (225.8 s and 245.8 s,
        measured a sixtieth of a second apart, found in session 15): its beat tooth is laid where a note's
        own core is shining, and `pulse` never consults the record of where the light has already been laid.
        Small, and the grid the tests measure on should go from one second to a sixth while it is done.

### After that

Yours to plan. Add milestones here as you learn what works. The owner may add more pieces to `music/`.
