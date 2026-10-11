# Notes between sessions

## Session 1 — 2026-10-11 — milestone 0: first something

What I did:

- `git init`, then built the whole of milestone 0: `tools/midi.mjs` (my own MIDI
  file reader), `tools/midi2json.mjs` (MIDI → note data), `index.html` +
  `src/{pieces,audio,visual,main}.js`, and released `0.0.1`.
- Converted BWV 565 only: 3651 notes, 9m32s, three voices (right hand 1905,
  left hand 1417, pedal 329), widest sounding chord 9 notes. `data/` holds the
  JSON plus a generated `.js` copy (see the file:// note below).
- The organ: two oscillators per note (a second pipe a hair flat, at 0.32),
  a normalised eight-harmonic stop mix, four slightly different stop mixes picked
  per note, a 5.2 Hz tremulant plus a slow air modulation, a 2.2 s noise impulse
  response as the room, and a lowpass at 6.2 kHz. Notes are handed over 0.35 s
  ahead (`LOOKAHEAD`) of the audio clock, so stop silences in a third of a second.
- Loudness by numbers: one note peaks at `0.5 / busiest moment` ≈ 0.056 for this
  piece, times about 1.3 with the second pipe, so nine notes peak near 0.7 and
  `VOLUME` 0.8 puts that under a limiter at -3 dB. The limiter is deliberately
  lazy so a soft verse stays soft.
- The visual: notes fall at 62 px/s toward a "line of sound" at 72% height, x =
  pitch across the piece's own range, colour per voice, a flare as a note crosses,
  trails from a 0.26 alpha fade, small marks at every C, a slow halo grown by how
  many notes are sounding.
- Wrote the release menu at `releases/index.html`. It reads `releases.js`, which
  `tools/release.sh` now writes next to `releases.json`.
- 14 tests pass (`node --test`).

Decisions worth keeping:

- **No ES modules, no fetch in the page.** A page opened straight from disk cannot
  `fetch()` a `.json` file and will not load `type="module"` scripts. So the page
  is classic scripts around a `window.Bach` global, and the converter also emits
  `data/<slug>.js`, which is the same JSON wrapped as
  `window.BachData[slug] = …` and loaded with a `<script>` tag. The `.json` is
  the real file: tests read it, the `.js` is generated and byte-checked against it.
  If a future session adds a file the page needs, generate a `.js` wrapper too
  rather than reaching for fetch.
- Note rows are arrays in the order named by the JSON `format` field
  (`voice, pitch, time, duration, velocity`), which keeps BWV 565 at 110 KB
  instead of 250 KB. `organ.prepare()` turns rows into objects once.
- The page does the display naming (`src/pieces.js`): the MIDI track names are
  "RH:1", "LH:" and "". The data file keeps the raw name.

Things that surprised me:

- LilyPond repeats the same tempo mark dozens of times; the reader drops a mark
  that repeats the tempo already in force, and marks at one tick keep file order.
- These MIDI files carry no dynamics at all: every velocity is 90/127 = 0.7087.
  The page cannot borrow expression from the file, so it will have to shape its
  own (by register, by texture, by section) when the playing gets more subtle.
- The 565 edition here ends the Fugue on D minor (D2 D3 F3 A3) — no Picardy
  third. That is the source, not a conversion bug. Do not "fix" it.
- **BWV 582 needs a decision before it is converted.** Its 9 tracks include
  tracks 5, 6 and 7 holding the same line simultaneously at three octaves
  (48/36/60 offset, 856 notes each), and track 4 duplicating track 3 twelve
  semitones higher for the first half. Playing every track would sound like a
  stacked-octave drone. Check against the score which track is the real one (or
  add a doubling rule) in that session — this is milestone 1's first job.
- `test/page.test.mjs` runs the four page scripts against a fake DOM, canvas and
  Web Audio, because there is no browser here. It found a real bug at once (the
  organ built its stop mixes but never called `makeWaves`, so pipes got
  `undefined` waves). It checks: every oscillator gets started, envelope points
  are in time order, colours handed to the canvas are parseable, everything is
  wired to the destination, nothing is drawn off screen, and pipe start times
  match the note times to within 8 ms.

Next, in order:

1. Milestone 1: decide the BWV 582 doubling, convert the other three pieces, and
   make `test/data.test.mjs` cover all of them (it already checks every
   `data/*.json` against its MIDI file).
2. A way to choose the piece — the list already builds itself from
   `Bach.pieces`, so it is mostly a naming/colour entry per piece.
3. Pause, restart, and clicking anywhere on the progress to move into the piece.
   `organ.play(prepared, from)` already takes a start point; the visual resets
   itself when time jumps backwards.
4. A fuller organ: more pipes per note, and dynamics drawn from the music rather
   than the flat velocities. Also consider reverb that changes with the section.
5. Only then milestone 2 looks per piece.

How this was verified (no browser here, so nothing was listened to):

- `node --check` on every script; `node --test` = 14 passing.
- `test/data.test.mjs` reconverts BWV 565 from the MIDI and compares every note
  with the committed JSON, and checks the generated `.js` byte for byte; it also
  checks order, positive lengths, the pitch range, the stated duration, and that
  no chord is wider than 24 notes.
- `test/midi.test.mjs` works the expected seconds out by hand on a file built in
  the test: 0.125 s, 0.2 s, 0.2417 s — so the tempo map is right, not just stable.
- `test/page.test.mjs` (see above) checks pipe start times against the note times.
- Released as `0.0.1`; `releases/v0.0.1/` holds the playable copy, and the menu
  page lists it first.

## Session 2 — 2026-10-11 — milestone 1: all four pieces

What I did:

- Converted the other three pieces, so the card now offers four. BWV 639: 553
  notes, 1m59s. BWV 645: 863 notes, 3m41s. BWV 582: 9546 notes, 12m18s, ten
  tempo marks (the editor slows down twice before the Fugue and again at the end).
- **Solved the BWV 582 doubling, and found the same thing in BWV 639.** Two rules
  in `tools/midi2json.mjs`, both recorded in the JSON so nothing goes missing
  quietly (`sourceNoteCount`, `copies.octaveTracks`, `copies.unisonNotes`):
  1. *a whole track that repeats another track at a fixed octave is an octave
     coupler, keep the lowest copy.* In 582 tracks 5, 6 and 7 were the same line at
     C2/C3/C4 (856 notes each): kept 6 (C1-C3, which fits a 32-note pedalboard;
     track 5 reaches C4, above any pedalboard, and hits the manuals in unison 111
     times). Track 4 was track 3 an octave up, dropped. In 639 tracks 2 and 4 were
     exact octave copies of 1 and 3 - the whole file was doubled - dropped.
  2. *a note that repeats an already-kept note at the same pitch, same moment, same
     length is one struck key,* dropped (31 in 582, 2 each in 639 and 645).
  A track of fewer than 8 notes is never called a copy: a couple of notes an octave
  above a line are music, not a coupler.
- What made me sure about the octaves: keeping the lowest copies, the Passacaglia
  ends on Pedal C1+G2, manuals C3-G3-C4-G4 / E4-C5-E5 / C6 - a huge C major from
  the floor up - and 639 opens on F2 / Ab3 / C5, an F minor chord, which is the
  key of that piece. `node tools/inspect.mjs <slug> 0 end` prints those chords.
- The 582 file really is a keyboard arrangement written in octaves everywhere (the
  right hand alone has 1421 octave pairs inside its own track), so its top note is
  C7. Left as the file says; not my business to re-bar it.
- `src/pieces.js` now names the voices as a player would say them and colours gold
  = the line to follow (the chorale melody where there is one): 639 chorale in the
  right hand, 645 chorale in the left ("lower"), 582 has a fourth voice, the
  octave above the right hand. Order on the card: 565, then the two short ones,
  then the Passacaglia last.
- **Bug found and fixed:** note end times are `time + duration`, which lands off
  the four-decimal grid, so a note ending exactly as another starts looked like it
  was still sounding. The organ's `busiestMoment` was 16 for 582 (true 12), 5 for
  639 (true 3), and every pipe was made quieter than needed. Now ends are put back
  on the grid (`onTheGrid` in src/audio.js) and the pieces play about a third
  louder. Peak of a full chord is unchanged at about 0.65 before the limiter.
- New `tools/inspect.mjs`: notes per second, widest chord and where, voices with
  their real names and ranges, and the notes sounding at any second you name.
  Use it before believing anything about a piece.
- Tests: 30 pass. `test/data.test.mjs` now also proves nothing was invented (every
  row must be found in its MIDI track), that each recorded octave copy really is
  one (checked against the MIDI, not with the converter's own code), that the
  counts add up, that no note is struck twice, and that every piece on the card has
  data, names and colours for all its voices. `test/page.test.mjs` clicks every
  piece, checks its notes reached the organ at the right seconds, its voice lines,
  and that nothing was drawn off screen.

Things that surprised me:

- Three of the four files were not three-voice textures at all: BWV 639's 967
  notes were really 555, BWV 582's 11687 were really 9577. Playing every track as
  it stands would have sounded like an octave-coupled drone.
- The octave-doubled `t2` of 582 is not a pure copy: 73 of its notes have no
  partner in `t1`. So it stays, and is called "Octave above" on screen.
- `node:vm` sandboxes make their own `Array`, so `assert.deepStrictEqual` on an
  array produced inside the sandbox fails even when the contents match. Spread it
  into this realm first (`[...piecesListed()]`).

Next, in order:

1. Pause, restart, and clicking the progress line to move into the piece
   (`organ.play(prepared, from)` already takes a start point).
2. Milestone 1's organ item: more pipes per note, and dynamics drawn from the
   music (these files carry no dynamics at all: 582 is all velocity 127, 565 all
   90). Register changes per section would suit the Passacaglia especially.
3. Before building milestone 2 on it: check the picture's cost for 582 - it has a
   peak of 310 notes on screen at once against 156 for 565, and each note makes a
   gradient every frame. If it stutters, cheapen the bar for far-off notes.
4. Then milestone 2, one piece per session, starting with BWV 639 (2 minutes, 3
   voices, easiest to judge) or 582 (the most obvious shape: theme, 20 variations,
   Fugue).
