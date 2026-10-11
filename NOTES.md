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

## Session 3 — 2026-10-11 — milestone 1: hold it, start it again, move anywhere — and the bars were never there

What I did:

- **The note bars were never drawn.** `src/visual.js` had
  `top = horizon - (note.time - now) * SPEED` and
  `bottom = horizon + (now - note.time) * SPEED` — the same number, so
  `bar()`'s `if (bottom <= top) return` threw away every note of every frame
  since 0.0.1. What shipped was flashes at the line of sound and nothing else.
  Now `top = horizon - (end - now) * SPEED` with `end = time + length`, so a bar
  *is* the note: 62 px to the second tall, its struck end crossing the line of
  sound at its own second.
- Pause, Restart and Stop in the top corner; the line along the bottom is a
  click target now (`#seek`, 18 px tall, `#progress` inside it). Keys: space
  rests and starts, ← → travel ten seconds, Home starts over, Escape is the
  card. The card says this in plain words.
- Organ: `stop(at)` quiets everything and hands back (and keeps) where in the
  piece you stand; `play(piece, from)` first quiets anything still sounding and
  then **takes up again the notes still held at `from`, for whatever is left of
  them**, so a chord held through a rest does not come back with its inner
  voices missing. `pump` and `play` share one `speak()`.
- `main.js` has a `paused` state. The frame loop keeps running while rested and
  `organ.time()` is frozen, so the picture holds still and its trails settle,
  rather than fading to black. `moveTo` works rested or running; `restart` too.
- Visual wipes the screen and rewinds its note window when time jumps backwards
  (`jumpedBack`): without it a jump back left the old picture and drew nothing
  of the new place, because `from` only ever walks forward.
- New `test/screen.mjs`: a canvas that measures light — hex and rgba, vertical
  and radial gradients, `lighter` against `source-over` — on a 64×40 grid, and
  `test/picture.test.mjs` asks each piece for its busiest second.
- New tests: pause timings, a held note taken up again, seek by click, the keys,
  restart rested or not, a backwards jump compared with a fresh page at the same
  second, a bar of light at the right x for every note sounding, a crowded
  frame's drawing budget, and *every `#id` main.js reaches for exists in
  index.html* (the stand-in document invents anything, so that is the only guard
  against a typo in the id list). 48 tests pass in about 2.4 s.
- Released `0.1.1`.

Measured, since I can neither see nor hear:

- Crowded frame (Passacaglia at 420 s): 542 boxes, 203 gradients. Budgets in the
  test are 1500 and 600.
- Brightest frame of the busiest second, mean light over the whole screen:
  565 0.031, 639 0.029, 645 0.034, 582 0.045 — against 0.026 for an empty
  screen. Peak 0.18 to 1.00, burnt-out cells essentially none. The screen is
  dark ground with bright notes, not a wash.
- Notes on screen at once peaks at 158 (565), 315 (582), 79 (639), 63 (645).

What surprised me:

- Two releases shipped a picture with no notes in it, and every existing test was
  happy: the fake canvas recorded only positions, and the "nothing off screen"
  and "something near the line" assertions pass on the static parts alone
  (12 rects a frame). Positions without colour could not see it; the new tests
  check the colour of the wipe and the height of a bar against the note.
- "A quiet second is darker than a crowded one" is not a claim I can make. In
  BWV 639 nearly every moment has all three voices busy, and the picture draws
  notes up to ~9 s ahead as well, so a thin moment can measure brighter than a
  crowded one. I dropped the claim instead of softening its threshold until it
  meant nothing.
- BWV 565 has a real rest around 10 s in — no note at all for most of a second —
  which is why the pause test now rests it at twelve seconds instead.

Next, in order:

1. Milestone 1's remaining item: a fuller organ, and dynamics taken from the
   music rather than the flat velocities (582 is all 127, 565 all 90). Register
   changes per section would suit the Passacaglia best.
2. The look of the bars has never been seen by anyone. Before building milestone 2
   on it, judge it by numbers and by eye: `node tools/inspect.mjs bwv582 410 end`
   says what is on screen at a moment, and the picture tests print their numbers.
   315 notes at once may want the far, faint ones drawn more cheaply.
3. Then milestone 2, one piece per session: 565 or 582 first.

## Session 5 — 2026-10-11 — milestone 2, first item: the shape of all four pieces

What I did:

- **`tools/midi.mjs` now reads the time signature** (meta 0x58) and hands back
  `timeSignatures` (`beats`, `beat`, `barTicks`) and `toSeconds(tick)`. LilyPond
  writes the denominator as a power, not as a number: BWV 582 arrives as `3,2`,
  and the only reading that makes the ground bass eight bars is 2 → quarter
  notes. Checked, not assumed: 3/4 at ♩=72 gives 2.5 s a bar, the ground bass
  statements land 20 s apart, and 21 statements × 8 bars = 168 bars = 420 s,
  which is exactly where the file's two "slip" tempo marks sit (6:59, 7:00).
- **New `tools/shape.mjs`** — the shape of a piece in numbers, for a person
  deciding what it should look like. Nothing in the page reads it. It prints:
  the metre and bar count; a bar-by-bar profile (notes starting, notes sounding,
  mean register, which voices) as sparklines; *sections* cut where the mix of the
  music changes; silences (nothing at all sounding) and each voice's own rests;
  the thinnest and fullest bars; and **figures that come back** — melodies found
  by matching the steps between notes, so a copy at another pitch counts.
  Flags: `--bars` for the whole table, `--json` for the same numbers as data.
  Run `node tools/shape.mjs` for all four.
- **New `test/shape.test.mjs`** (17 tests, 93 in all). Hand-built melodies for the
  pattern finder, hand-worked bars for the bar table, and the claims below about
  the four pieces. `test/midi.test.mjs` gained a time-signature test.
- Wrote the four shapes at the bottom of these notes. That is milestone 2's first
  box ticked. **No release**: nothing on screen or in the ears changed.

Decisions worth keeping:

- **How a "theme" is found.** Match steps between successive notes, not pitches:
  then a fugue answer on the dominant and a ground bass an octave down are the
  same tune. A copy must be at least **two bars after** the last one counted, or
  it is a sequence (the same bar again at another pitch) and not the theme coming
  back — without that rule a run of parallel sixths in BWV 565 out-voted the
  ground bass. And once the most-frequent length is known, the *longest* figure
  that comes back nearly as often (≥ ¾ of the copies) is taken instead, because a
  theme comes back whole: that is what turned the ground bass's 8-note head into
  the 15-note theme it is.
- **A bar with no music after it is not counted.** Several of these editions end
  exactly on a bar line, and that last line was being reported as an empty bar.
- **These editions write everything legato.** In BWV 639 not one of the three
  voices has a rest of even one beat in two minutes; the chorale melodies are
  tied across every phrase mark in the score. So phrase ends cannot be read from
  rests — only the chorale in BWV 645 actually stops for breath. The look will
  have to find phrases in the melody and the bar grid, not in silences.
- **Session 4 left no notes.** Reconstructed from the commit: ranks of pipes per
  note, `tools/loudness.mjs`, the stops line in the corner, released as 0.1.2.

A bug I made and fixed: my first `stepIndex` cut its window one step too long (an
offset past the comma), so every "figure" was reported with a phantom extra note
and one voice's figure could not be found in another. `whereHeard` returned 0 for
a figure that `returningFigures` had just found — that contradiction is what gave
it away. The first test below pins it.

---

# The shape of the pieces

From `node tools/shape.mjs`. Pitch names are the file's; bar numbers start at 1.

## BWV 565 — Toccata and Fugue in D minor

9:32, 3651 notes, 4/4 at ♩=60 → **4 s a bar, 143 bars**, and one tempo mark: the
file plays the whole piece at one speed. RH 1905 [C#3–C6], LH 1417 [C#2–F5],
pedal 329 [C2–B3].

- **Bars 1–30 (0:00–1:56) are the Toccata**: 24–44 notes a bar, chords up to 9
  sounding (the widest moment of the piece, 0:39), fullest at bars 22–30.
- **The Fugue begins at about 1:58.** A figure of 32 notes is heard **eight
  times**, and the order is convincing: LH A4 1:58, RH D5 2:06, RH A5 2:34, pedal
  D3 3:24, pedal G3 5:42, LH D4 6:08, LH A4 6:58, pedal A3 7:14 — tonic and
  dominant alternately, one voice at a time at first.
- The pedal is silent for two ages: **1:58–3:24 (86 s)** and **3:47–5:42 (115 s)**,
  again 6:25–7:14 (49 s). A picture that shows the pedal line must show it waiting.
- **The middle is bare**: bars 58–84 (3:48–5:32) run on 1–1.8 voices, and bars
  74–84 (4:52–5:35, eleven bars) have exactly **one note sounding at a time**.
- Bars 85–129 (5:36–8:32): three voices steady, ~27 notes a bar. The end, bars
  130–143, is chords again (6.5 sounding at 8:36) and lands low, about F2.
- Seven moments when nothing at all sounds, all of them in the first 30 seconds,
  longest 2 s at 0:17.

For the look: three worlds — the chordal toccata, the bare middle, the fugue —
and the fugue is really its eight entries, which can be marked as they arrive.

## BWV 582 — Passacaglia and Fugue in C minor

12:17, 9546 notes, **3/4 at ♩=72 → 2.5 s a bar, 293 bars**. Ten tempo marks,
nine of them in the last two minutes (and two at 6:59–7:00, which mark the hinge
between the two halves). RH 4358 [G3–C7], "octave above" 1609 [G4–C7], LH 2723
[C2–C6], pedal 856 [C1–C3].

- **The ground bass: 15 notes**, found in the pedal **13 times** — 0:18, 0:38,
  0:58, 1:18, 1:58, 2:18, 2:38, 3:18, 4:19, 5:38, 5:58, 6:18, 6:38 — statements
  **eight bars (20 s) apart**; where the gap is wider the theme is in a manual,
  not the pedal.
- **Bars 1–8: one voice, one note at a time** — the theme alone. Full texture
  from bar 9.
- **Bars 1–168 = 21 statements × 8 bars = the Passacaglia**, 0:00–7:00. Its last
  bar (168, 6:57) is the fullest of the whole piece: 12 notes sounding and 83
  notes starting. Then the tempo slips twice and **the Fugue takes off about
  7:01 (bar ~170)**.
- The fugue runs 34–39 notes a bar with 6–7.5 sounding at once, five minutes on
  end — as thick as the loudest variations, but without a break. At its worst the
  screen holds 315 notes at a time (measured in session 3).
- Almost no silence: **one** moment in 12 minutes when nothing sounds (0.83 s at
  11:53). But individual lines rest a lot — LH 61 rests, pedal 32 (60 s at 4:19,
  58 s at 8:12), the octave line 31 (silent 9:20–10:12).

For the look: the passacaglia has an obvious 20-second pulse to build on and the
variations can be counted; after 7:00 the ground is gone and it has to be a
different world entirely.

## BWV 639 — Ich ruf zu dir, Herr Jesu Christ (F minor)

1:59, 553 notes, **4/4 at ♩=37 → 6.49 s a bar, 18 bars** (a slow bar: the
chorale moves in quarters and the two accompanying lines run in sixteenths, so a
bar holds 16 of their notes). Chorale 125 [Eb4–F5], LH 287 [Eb3–C5], pedal 141
[D2–C4].

- **Bars 1–4 come back exactly at 0:25 (bar 5)** — chorale, left hand and pedal
  all together at the same pitch: the two Stollen of the chorale's bar form. The
  left hand's opening figure returns a third time at 1:16 (bar 12).
- **Nothing is ever silent** and no voice ever rests a beat or more, anywhere.
- Three voices at the most, always; 24–48 notes a bar (fullest bars 6 and 2).
  Sections: bars 1–9 sit about Eb4, bars 10–18 about Bb3 — the piece sinks.
- The ending slows: ♩ 35 at 1:53, 30 at 1:55, 10 at 1:56.

For the look: only three lines, so the gold chorale has nothing to hide behind;
the four-bar phrase (26 s) is the unit, and it is heard twice in the same notes.

## BWV 645 — Wachet auf, ruft uns die Stimme (E flat major)

3:40, 863 notes, **4/4 at ♩=60 → 4 s a bar, 56 bars**, one tempo mark. RH 504
[G3–F5], chorale 74 [Eb3–G4], pedal 285 [C2–C4].

- **The chorale makes people wait for it: its first note is at 0:50 (bar 13).**
  It then breathes 2–5 s at a time (1:00, 1:14, 1:26, …) and leaves altogether
  for **29 s (1:34–2:03)** and **23 s (2:30–2:53)**. Its last note is at 3:24.
- **The opening ritornello returns unchanged**: the right hand's 85-note figure
  and the pedal's 43-note one, heard at 0:16 (bars 5–10), come back at 1:32
  (bars 24–29) while the chorale is resting. The right hand's little 9-note
  figure appears 8 times over the piece (0:18 … 3:08): that figure *is* the
  refrain.
- Two voices without the chorale, three with it; widest chord 4 (bar 20, 1:16);
  at most 22 notes starting in a bar — the thinnest piece here.
- The sections are just that alternation: bars 1–11 alone, 12–23 with the
  chorale, 24–29 alone, 30–38 with, 39–44 alone, 45–51 with, 52–56 alone.
- Two moments of total silence only, 0.5 s each (0:07, 0:15).

For the look: the waiting, the arrival of the gold line, and the refrain coming
back are the whole drama of this one.

## What surprised me

- **Two of the four pieces are built on a literal repeat, not on development.**
  BWV 639 plays its first four bars again, note for note in all three voices, and
  BWV 645 brings its opening ritornello back whole in the middle. That is worth
  more to a picture than any amount of key-change: the eye can recognise something.
- **The ground bass is in the pedal only 13 times, though there are 21
  statements.** So eight statements must carry the theme in a manual, or written
  out differently. I could not check this against a score, so treat the count as
  "the theme in the pedal", not "the variations".
- **A bar of these files is not what I expected.** BWV 639's bar is 6.5 seconds
  because the editor wrote the accompaniment in sixteenths at ♩=37; the number
  of bars a printed edition would show is not the number measured here. The bar
  grid is still self-consistent, which is all the look needs, but do not quote
  "bar 12" to anyone holding a score.
- The pattern finder is picky in a useful way: the fugue subject of BWV 565 came
  out as eight entries, three of them in the pedal after long silences, which is
  exactly the sort of thing a picture could mark and that I could not have found
  by reading the data by eye.

---

Next, in order:

1. Milestone 2, second item: **a look per piece, one piece per session.** BWV 639
   first (three lines, two minutes, easy to judge) or BWV 645 (the clearest
   drama: wait, arrival, refrain). BWV 582 last: it is 12 minutes and 315 notes
   at once.
2. If a look wants the bar grid (a pulse on each bar, a phrase every four bars),
   the page needs bar lines: add a `bars` array in `tools/midi2json.mjs`, which
   means re-running the converter — `test/data.test.mjs` compares the data files
   byte for byte, so regenerate before committing. The `.js` wrappers the page
   loads are generated from the same JSON, so they follow along.
3. The section cut is a candidate list, not truth: for BWV 582 it does not stop at
   every variation (a variation is not much of a change of mix). If a look needs
   "which variation am I in", derive it from the theme's copies, not from
   `boundaries()`.
4. Still not done from session 3's list: cheapening far, faint notes for BWV 582.

## Session 6 — 2026-10-11 — milestone 2: BWV 639 is woven, not falling

**What was waiting for me.** The last session left a whole look in the working tree —
uncommitted, unreleased, and with no notes (the log stopped at "measure the shape").
It was finished and 107 tests passed, so this session was: check it properly, fix
what was wrong in it, and ship it. Released as `0.2.0`.

What is in the tree now:

- **Looks are pluggable.** `src/visual.js` keeps the canvas (`createScreen`: wipe,
  veil, resize) and picks one look out of `Bach.looks`; `src/look-fall.js` is the
  old falling picture, unchanged; `src/look-braid.js` is the new one. `src/pieces.js`
  says who wears what, and its `hint` is the small line in the corner that says how
  to read the picture.
- **The woven picture (BWV 639).** Time runs sideways and one phrase — four bars,
  25.9 s — is exactly as wide as the screen, so the whole shape of a phrase is in
  front of you while it is played. A bar of this piece is 6.49 s, which is why
  falling notes showed nothing: one bar was most of the height of a screen. Each
  voice is an unbroken strand (these editions are legato), crossing a line of sound
  a quarter of the way in; a line at every bar, a wider one every phrase, gold where
  a phrase was already heard.
- **`src/echoes.js`** finds the repeats from the notes alone: a phrase is
  `barsPerPhrase` bars, its notes keyed by "place in the phrase : pitch", and a
  later phrase counts when 7/8 of its keys were heard in an earlier one at the same
  place and pitch (so an ornament still counts as the same phrase). For 639 it finds
  exactly one: 0:25, 0.95 of the opening.
- **The data files have bar lines now** (`metre`, `bars`): `tools/bars.mjs`, moved
  out of `tools/shape.mjs`, which now reads them from the data instead of re-reading
  the MIDI file. Only the woven picture uses them so far.
- **`tools/look.mjs`** prints every piece's picture in numbers (busiest second,
  quietest, burnt-out cells, goldness, what comes back).

What I fixed, all of it found by checking rather than by looking:

- The **measuring harness was measuring a different picture from the page**: it
  handed the look notes with no `role`, so every line was drawn 3 px thick while the
  page drew 5.5/4.5/3. `notesFor(data, roles)` now mirrors `toObjects` in
  `src/audio.js`.
- `weightOf` promised the line to follow was the stoutest and gave that to the pedal.
  Melody 5.5, pedal 4.5, inner 3 — the same order the organ plays them in.
- `main.js` handed `roles` to the picture, which no picture ever read. The roles
  travel with the notes (organ.prepare attaches them), so the dead field is gone.
- New tests. The lines sounding at 14 s in BWV 639 must each be drawn as thick as
  their role says — matched to their boxes by pitch order — and "a piece is drawn the
  picture it asks for" wraps `Bach.createVisual` to see what the page really asked
  for, plus the hint on screen. I checked both fail when they should: drop the roles
  and the thickness test says "the melody line on 72 is drawn 3 thick"; take
  `name` out of `main.js` and the page test says "was drawn as fall, asked for braid".
- Measured the split of `visual.js` against the old code in a throw worktree at
  `c302ec3`: identical mean light, peak and burnt cells for all three fall pieces at
  their busiest second (565 0.0390/0.65/0, 645 0.0341/0.50/0, 582 0.0454/1.00/6).
  Worth recording: session 3 wrote 0.031 for 565, and that difference comes from the
  harness of the day, not from any change to the picture.

What surprised me:

- **`phraseEchoes` can only see a repeat that begins where its own grid begins.** BWV
  645's opening ritornello comes back whole — bars 5–10 again at bar 24 — and
  `tools/look.mjs` was printing "nothing in it is played twice over" for it, which is
  simply false. The two tellings are 19 bars apart and 19 has no divisors, so no
  whole number of bars per phrase can put a line at both. I reworded the tool to say
  what it actually tested, and made "the repeat finder has to slide along the piece
  instead of tiling it" the first job of 645's look.
- Two repeat questions, two tools: `echoes.js` asks "was this whole stretch played
  before" (nothing in 565 at four bars; at two bars it points at 5:12 as a repeat of
  0:38, which is the toccata's parallel chords, not music worth marking), `shape.mjs`
  asks "is this tune back" and finds the fugue subject eight times. Do not conflate
  them.
- A frame of the woven picture draws 250-odd boxes at 10 s, well under the 1500
  budget, and its light is mean 0.031-0.034 with one burnt cell in the whole piece.

Next, in order:

1. **BWV 645's own look.** Three voices, 3m40, and the clearest drama here: the
   waiting, the gold chorale arriving at 0:50, its 29 s and 23 s absences, and the
   ritornello back whole at 1:32. Start by making the repeat finder slide (a window
   of bars moved along the piece, best match wins) instead of tiling from bar 1.
2. BWV 582 last of all: 315 notes on screen at once, and the far faint ones may want
   drawing more cheaply (a crowded frame is 542 boxes and 203 gradients against
   budgets of 1500 and 600, so it is not urgent).
3. BWV 565 wants its three worlds — chordal toccata, the bare middle where one note
   sounds at a time, and the eight fugue entries, which `tools/shape.mjs` already
   finds with their keys and times.
4. Still open from milestone 1: dynamics drawn from the music instead of the flat
   velocities (582 is all 127, 565 all 90).
5. For myself: commit and release before a session ends. Work left in the tree with no
   notes is a session's worth of thinking nobody can recover.

## Session 7 — 2026-10-11 — milestone 2: BWV 645 is a long road, and the repeat finder learned to slide

**Released 0.2.1 (the look and the finder) and 0.2.2 (one tuning to the arrivals).**

What I did:

- **`Bach.echoes(notes, bars, { minBars })` replaces `phraseEchoes`.** The old one
  tiled the piece into phrases from bar 1 and compared phrase to phrase, which is
  how it found BWV 639's repeat and how it *failed* to see BWV 645's: that piece
  brings its opening ritornello back whole nineteen bars along, and nineteen has
  no divisors, so no phrase length puts a line at both ends of the gap. Now every
  bar is written down as the set of "where in the bar : how high" its notes make;
  two bars agree when 3/4 of the later one's keys were heard in the earlier; then
  for every distance between two bars the piece is walked along looking for a *run*
  of bars agreeing with the bar that far before them. A run of `minBars` or more is
  a repeat; one bar agreeing is a figure and gets nothing. Longest run wins if a
  stretch could be matched several ways, and no bar is claimed twice. Finds, and
  only what I claimed: 639 one repeat at 0:25 (4 bars, 0.95, same as before), 645
  one at 1:32 (8 bars, 0.98, of what was heard at 0:16), nothing in 565 at 4+ bars,
  nothing in 582 at any length — the variations are always re-written above the
  ground. Cost: 3 ms for 645, ~105 ms for the Passacaglia (nobody asks it to).
- **BWV 645 wears `src/look-vigil.js`, the long view.** The reason is one fact:
  the chorale does not sing until 0:50, then stops for 29 s and for 23 s. Falling
  notes show a few seconds; the waiting is the piece and was invisible. So the
  line of sound sits at 86% of the height and everything ahead *climbs* toward a
  horizon at 17%, a log climb (`step * log(1 + seconds/2.5)`) with `step` derived
  from the piece's own length so the whole piece always fits between the two.
  Sideways is still pitch, so chords spread. A line at every bar and a stronger one
  every phrase crowds toward the horizon, which is what sells the distance; pitch
  gets a faint line at every C. Far notes are one hairline at ~0.05 alpha, near
  ones get glow, body and core. Only what has *sounded* is lit, and only below the
  line of sound. A bar that begins a repeat is drawn warm (`#ffb066`, deliberately
  not the chorale's own gold) and stays warm while it is still to come — at 0:20
  you can see the ritornello's line a minute off, up the road.
- **Arrivals.** The line to follow is watched: whenever it has been gone ten seconds
  or more, its next note is an arrival — a lamp that grows as it comes and a bloom
  on the line of sound when it is struck. In 645 that is exactly three moments:
  0:50, 2:03, 2:53. At four seconds it also caught breaths inside phrases (2:24,
  3:03, 3:13) and that was 0.2.1's noise; 0.2.2 fixed it.
- **The measuring canvas now records colour**, not just position and alpha. Session
  3's notes say the missing-note-bars bug survived two releases because the harness
  could not see colour; now a test can insist a thing is warm rather than blue.
- **Three tests had their own copies of the page's script list.** They now read
  `test/files.mjs`, which reads index.html and the src folder. New test: every
  `src/look-*.js` must be loaded by index.html — that is how a look written and
  never wired in would hide.
- 120 tests pass (was 109).

Decisions worth keeping:

- `minBars` comes from the piece's own `phrase` (4 for both looks that use it). It
  is not a knob for "how strict"; a repeat shorter than a phrase is a figure.
- The share is divided by the *bigger* of the two bars, so a thin stretch cannot
  pose as a repeat of a full one. There is a test for it: same notes, one voice
  missing, must not be called a repeat.
- `step = span / log(1 + duration/STEP)` means one constant (2.5 s) sets the near
  pace and the piece's own length sets everything else. Nothing per-piece to tune;
  a 12-minute piece would simply have a slightly slower near hand (39 px/s against
  49 px/s here).
- `BREATH = 10` s for an arrival; `SINK = 1.7` makes a played note drop faster than
  the same time ahead lifted it, which is what perspective does.

What surprised me:

- **The ritornello is eight bars, not six.** The shape tool had found the right
  hand's 85-note figure over bars 5–10; the sliding finder says bars 24–31 repeat
  bars 5–12 at ≥ 3/4 per bar. The follow-on bars agree too. I left the honest
  number the finder measured rather than trimming it to the tool's guess.
- At `minBars: 2` BWV 645 also reports 0:08 as a repeat of 0:00 and 2:08 of 1:32.
  Two bars agreeing twice is not something a listener would call a repeat, which is
  the whole reason for the run-length rule.
- **The far band's light is mostly the horizon glow, not the notes.** With no notes
  at all the top of the screen measures 0.0317 mean light against 0.0252 in the
  middle, so retuning the far notes' alpha changed almost nothing. The vertical
  profile is what showed it: rows top-to-bottom read dim, dimmer, bright at the line
  of sound (row 34), which is the picture I wanted — a road with a bright end near
  you, not a wash.
- A test that filtered note marks by box *width* silently stopped matching when I
  thinned the far notes by a hair. Filtering by colour (the voices' own palette,
  which the harness now records) is the honest version.

A mistake worth remembering: **my mutation-check loop undid its work with
`git checkout -- <file>`, which restores the committed version.** src/echoes.js was
committed with the old finder, so the checkout silently threw away the rewritten one
and every later test in that run measured a mixture; the untracked new look file,
having nothing to restore to, just accumulated mutations. I rewrote echoes.js and
re-ran everything with `cp` to /tmp as the undo. Commit (or at least `git add`)
before mutation testing, and never use git as the undo for work it has not seen.

Measured, since nobody can see or hear:

- Vigil: fullest second (1:06) mean light 0.0439, peak 0.42, 0 burnt; quietest
  (0:00) 0.0299; worst frame of the piece 0.0458 at 1:30; heaviest frame 1126
  boxes at 0:15 (budget 1500), of ~860 notes drawn every frame. 565, 639 and 582
  measure exactly as in session 6 — the old looks were not touched.
- Mutation-checked, all caught: lighting a note above the line of sound; the warm
  line drawn cool; showing only 30 s ahead; no arrivals at all; a fixed climb step;
  thin bars counting as notes; a thin bar posing as a full one; a run not having to
  be contiguous; a look file left out of index.html.

Next, in order:

1. **BWV 565's own look.** Its three worlds are written down in these notes — the
   chordal toccata (bars 1–30), the bare middle (bars 74–84 has exactly one note
   sounding at a time), and the fugue's eight entries, which `tools/shape.mjs`
   already prints with their keys and times. The pedal waits 115 seconds at a time;
   a picture that shows the pedal must show it waiting.
2. **BWV 582 last**: 12 minutes, 315 notes on screen at once, and 21 statements of
   a ground to build a pulse on. Note that the long view would be cheap enough for
   it (one gradient-laden fall frame is 542 boxes; the vigil's is ~1100), but it is
   a different problem — the Passacaglia has no long silences at all.
3. Still open from milestone 1: dynamics drawn from the music instead of the flat
   velocities (582 is all 127, 565 all 90).
4. Small thing I noticed and did not do: at its fullest the Passacaglia in the fall
   look burns 6 of 2560 measuring cells white (peak 1.00 at 7:00). Worth a session
   of its own — every other piece and picture stays under 0.86.

## Session 8 — 2026-10-11 — milestone 2: BWV 565 is a fugue, and the subject is gold

**Released 0.2.3.**

What I did:

- **`src/theme.js` — the page can now hear what a piece keeps coming back to.** It
  writes each voice as the steps between its notes (so a tune is itself at any
  pitch: a fugue answer on the dominant, a ground bass an octave down), counts every
  window of 8–40 notes, takes the one that comes back most — or the longest one that
  comes back nearly as often, since a theme returns whole — and then looks for it in
  every voice. A copy must wait two bars, or it is a sequence. This is a port of what
  `tools/shape.mjs` does; both were checked against the same four pieces and they
  agree: **565** a 32-note subject heard 8 times (LH 1:58, RH 2:06, RH 2:34, pedal
  3:24, pedal 5:42, LH 6:08, LH 6:58, pedal 7:14), **582** a 15-note ground heard 13
  times, all in the pedal, **639** the chorale's opening phrase twice (0:00, 0:25),
  **645** the opening ritornello twice (0:16, 1:32). A hearing hands back the note
  objects themselves, so a picture marks them by identity.
- **`src/look-subject.js`, and BWV 565 wears it.** Notes fall as before, at 58 px a
  second toward a line of sound at 78%, with a bar line every four seconds and a
  faint line at every C. On top of that: every note of the subject is **gold**
  whoever is playing it; a **lamp** grows where the next telling will land and a
  **bloom** marks it struck; a chord of **five or more struck together** flares
  across all the ground it covers; a voice back after **ten seconds** gone blooms in
  its own colour; and the veil, the halo, the line of sound and the weight of a note
  all scale with how much of the organ is going, so the bare middle stretches out.
- `src/pieces.js`: 565's voices changed colour (RH blue, LH rose, pedal violet) so
  that **gold belongs to the tune alone**. That is the first time a look changed a
  piece's colours, and a test insists on it.
- `tools/look.mjs` now prints what comes back for each piece, so the next look can be
  planned from the same numbers the page uses.
- Tests: 139 pass (was 120). New `test/theme.test.mjs` (13) — hand-built tunes, the
  sequence rule, the two-bar rule, and the four real pieces' claims. Six more in
  `test/picture.test.mjs` for the new look. `test/screen.mjs` records the colours a
  gradient was built from (`fill`), and hands back the sandbox's `Bach`, so a test
  can ask the page's own finder about the very notes the picture was given.

What I fixed after checking, rather than after looking:

- **The lamp and wake-bloom tests were not testing the blooms.** The harness records
  `fill` for a plain box as its colour, and a plain gold note bar matched
  "starts with gold" just as well as the gold lamp did — deleting the lamp from the
  look changed nothing. Caught by mutation, not by the test. A glow is now recognised
  as a *gradient* that starts from the colour.
- Two measurement moments fought me. A note struck at exactly `now` has nothing
  below the line yet, so it draws no body; and at a hand-over second the look lights
  both the note letting go and the one arriving (its rule is `time <= now <= end`).
  "One note sounding alone" therefore has to be picked with the look's own rule, not
  the organ's, and a moment chosen a few frames after the strike.
- The fugue's chords are four at the most (measured: nothing between 130 and 500 s
  reaches five together), which is what makes the flare mean the toccata and the
  finale. That claim is pinned as a claim about the notes, and the picture is made to
  draw no flare across 206–214 s, where four notes ring out on almost every beat.

Things that surprised me:

- The finder is cheap enough to run when a piece is clicked: 70 ms for BWV 565,
  ~210 ms for the Passacaglia, and the look only does it once per note list.
- The subject's entries do not land on bar lines (the first is 118.25 s, mid-bar), so
  bar lines could not have marked them; the finder had to come from the notes.
- The three looks now each carry their own `coming` / `sounded` / `bloom`. A fourth
  will copy them a third time: worth pulling those three into one shared file when
  BWV 582's look is written.

Measured, since nobody can see or hear:

- BWV 565 in the new picture: fullest second (0:39, nine notes) mean light 0.0364,
  brightest 0.56, nothing burnt; quietest (about 0:18) 0.0261; worst frame of the
  piece 0.0370 at 5:42; a crowded frame 373 boxes (the test allows 800). Gold marks:
  none at 0:40, 109 at 2:00, 65 at 3:24. At 0:39 the chord's flare is a 515 px line
  on the line of sound; across 206–214 s there is none.
- Mutation-checked, all caught: the finder ignoring the two-bar wait, the finder never
  preferring the longer telling, subject notes not gold, no lamp, a lamp that does not
  grow, no bloom on arrival, a voice not marked when it returns, `WAKE` at one second
  instead of ten, `CHORD` at three instead of five, no thin-music weighting, a flare
  that never fades, and a harness that forgets gradient colours.

Next, in order:

1. **BWV 582's own look** — the last piece still wearing the falling picture. Its
   shape is a 20-second round of a 15-note ground, 21 of them, then the Fugue from
   7:01 which is another world entirely (the ground is gone: the finder finds nothing
   4 bars or longer). The gold-subject machinery is most of what it needs; what it
   needs on top is the 20-second pulse and a hinge at the Fugue. While it is being
   redone: in `fall` it burns 6 measuring cells white at 7:00 (peak 1.00), the only
   piece that does.
2. Pull the shared drawing (a note coming, a note sounded, a round glow, a voice
   returning) out of the looks into one file before a fourth copy of it is written.
3. Still open from milestone 1: dynamics drawn from the music instead of the flat
   velocities (582 is all 127, 565 all 90).

## Session 9 — 2026-10-11 — milestone 2 finished: BWV 582 is a wheel

**Released 0.2.4.** Milestone 2 is done: all four pieces wear a picture of their own.

What I did:

- **`src/look-round.js`, and BWV 582 wears it.** Time goes round instead of down,
  because the piece's shape *is* a round: one turn of the wheel = one telling of
  the ground bass. Angle is time, radius is pitch (low near the middle, the
  manuals' C7 near the rim), a hand goes once round a turn as the line of sound,
  the whole turn ahead is drawn as a faint shape, and the rim keeps one mark per
  turn taken.
- **Nothing about the wheel is typed in.** `Bach.theme` finds the ground (15 notes,
  13 tellings) and the wheel's turn is the median gap between its tellings, measured
  in *bars* (8 here); the anchor is the first telling; the number of turns that carry
  the ground (20) comes from where the last telling ends; the fugue begins where that
  last telling lets go (421.28 s). Folding by bars and not seconds is what keeps the
  ground in its place while the player slows down five times in the last two minutes
  (`barClock` asks the bar grid both ways: bar-of-a-second, second-of-a-bar).
- **At the hinge the wheel unwinds**: over ten seconds the reachable window shrinks
  from a whole turn to four seconds, so the far edge of the disc empties inwards.
  The fugue's first note gets a flash of the picture's own cool light; after that
  it is a hand sweeping a dark disc, which is honest — with no ground there *is*
  nothing ahead of you to see.
- `src/pieces.js`: 582's right hand is blue and its left hand green, because
  **gold belongs to the ground alone**. The rim's tally marks are gold for the
  twenty turns that carried the ground, cool since, so the rim says where the
  piece turned into the fugue.
- Tests: 151 pass (was 139). Twelve new ones for the wheel; the geometry ones
  replicate the look's two formulas on purpose ("a test that cannot say where a
  thing is drawn cannot say it was drawn").

What I fixed, and it matters beyond this session:

- **`test/screen.mjs` was measuring every radial glow in the wrong place.** It took
  the *end circle's x* as the middle's y (`dy = y - args[3]` instead of `args[1]`),
  so a bloom at (640, 400) was measured as if its middle were at (640, 640) — off
  the screen — and counted as transparent. Every glow in every look away from the
  top-left corner has been under-measured since 0.0.1. Also, linear gradients were
  only measured vertically, so a sideways gradient counted as its first stop
  everywhere (BWV 565's chord flares measured as nothing). Both fixed; all four
  pieces' numbers moved, no picture changed, and every existing test still passed
  — which says the old thresholds were relative enough to survive an honest fix.
- **The burnt-out cells session 7 noticed in BWV 582 are gone** (0 of 2560 over the
  whole piece; the fall look had 6). Three causes, all found by printing every box
  covering the burnt cell: a note's own core and its own glow both full at the same
  pixel (fixed by making a note's glow a *ring* with an empty middle); the seven
  pitch rings washing cool light over everything (0.045 → 0.03 alpha); and — the
  real one — **two voices striking the same pitch at the same moment**, which this
  keyboard arrangement does constantly, landing two full lights on one spot. So the
  look keeps a per-frame record of where light has been laid and draws the second
  one there for half. That is also honest: two voices on one spot are one light.
- `calm = 1 / (1 + 0.055 × notes sounding)`: the fuller the organ, the softer each
  light is laid down. Same family as the subject look's breathing; without it the
  fugue burns in nine sampled frames out of ~1450.
- Gradients per frame: my first version made ~509 in the worst frame (every
  upcoming note had a glow) against a maximum of 10 in any other look. Upcoming
  notes are plain dots now unless nearly struck: 119 gradients, 668 boxes worst.

Things that surprised me, and decisions that came out of them:

- **The finder's ground is one note out of phase.** The 15-note figure it settles on
  starts on the ground's *last* note (the arrival on C1) and runs into the next
  telling, so the opening statement (0–18.3 s, the theme an octave up on the
  manuals) is not gold. I left it: fixing the phase in `theme.js` would mean a rule
  about which rotation of a periodic figure is "the" one, and the risk to BWV 565's
  eight entries is not worth 14 notes of gold. The wheel treats the opening as the
  first turn's worth of music, which is what it is.
- **I had to drop a device I liked.** I marked "each voice taking up the fugue", but
  the data says the right hand starts the fugue alone and the left hand is
  accompanying from the start — and the two genuine late entries (octave line 433 s,
  pedal 450 s) were *already* caught by the ten-second-return rule, so the device
  was redundant as well as musically false. A mutation (drop the entries) survived
  and that is what told me. Now it is one honest thing: the fugue's first note
  flashes, and a voice coming back after ten seconds gone blooms in its own colour.
- Two more mutations survived at first — the hand, and the ground's arrival bloom —
  and the size claim for gold; all three now have tests that fail when they are
  broken. The mutation loop used `cp` to /tmp as the undo, never `git checkout`, on
  session 7's lesson.
- **The fugue has no subject worth marking.** Running the finder on the fugue alone
  gives a 33-note figure heard three times — not a subject. So the fugue half of the
  wheel has no gold, which is also the truth of it: the ground was the thing that
  came back, and it has stopped.

Measured, since nobody can see or hear (all with the fixed canvas):

- BWV 582 in the wheel: fullest second mean 0.0295, quietest 0.0253 (an empty screen
  is 0.0253-ish, the busiest frame of the whole piece 0.0370 at 6:58), brightest
  spot 0.79, **0 cells burnt out**, worst frame 668 boxes of which 119 gradients.
- The others, resampled every second instead of every six: 565 worst 0.0455 (0
  burnt), 639 worst 0.0368 (0 burnt), 645 worst 0.0467 at 0:50 with 2 cells burnt
  (the chorale's first arrival: worth a look some session, still inside the 5%
  allowance). `tools/look.mjs` now takes 90 s for all four; the tests take 7.5 s.
- The wheel's own claims, checked: the ground's gold lights come back to the same
  places a turn later (all of them, within 2 px), a turn's worth of ordinary lights
  shares under a quarter of its places with the next turn, the fugue leaves more
  than 120° of the wheel dark where the passacaglia leaves less than 90°, the rim
  counts exactly `floor(bars since the anchor ÷ 8)` marks with 20 of them gold.

Next, in order:

1. **Milestone 3: something to do.** Nothing is designed yet; PLAN.md says write the
   design there first. Think about what four pieces this picture language can play
   with: the wheel's rim already counts turns, the vigil already marks arrivals, the
   wheel and the vigil both know where the tune is coming next — a game around
   "be there when it arrives" is closer than a made-up one.
2. For myself, again: **the shared drawing**. Four looks now each carry their own
   `coming`/`sounded`/`bloom`/halo, and this session wrote a fifth and sixth copy.
   Pull them into one file, and keep the numbers identical per look (the light
   measurements are the safety net: they are all in these notes, so a refactor that
   changes a picture will show up).
3. Still open from milestone 1: dynamics drawn from the music instead of the flat
   velocities (582 is all 127, 565 all 90).
4. Small honest debts: BWV 645 burns 2 cells at the chorale's arrival; the harness
   still cannot see `ctx.arc` + `fill` (no look uses them, and none should until it
   can); `theme.js`'s phase for a periodic figure (see above, deliberately left).

## Session 10 — 2026-10-11 — milestone 3: play along, and the bell rings in the harmony

**Released 0.3.0.** Milestone 3's first item: something to do, with "just watch" beside it.

What I did:

- **Wrote the design in PLAN.md first, as the item asked**, then built it. The player clicks anywhere on the
  picture (or presses Enter) in time with the piece's pulse; a catch rings a bell whose note is the lowest
  note *sounding* then, two octaves up, so the taps are always notes of the harmony actually being played.
  A run is beats caught in a row; a beat let go ends it, and so does a click with no beat near it.
- **Why the pulse and not the notes** - measured first, which is the part worth keeping:
  the line to follow comes at 3.3 notes a second in BWV 565 and 5.9 in BWV 582 (unplayable), and the tune
  that comes back is far too rare to chase (the ground is heard 13 times in 12 minutes; the 645 chorale is
  74 notes with a 31 s hole in it). The pulse is the one thing all four mark at a rate a hand can hold:
  **37 a minute (639), 60 (565 and 645), 72 (582)**, and it is steady - every "line to follow" I measured
  sits between 19 and 166 a minute depending on the moment. For reference, the bass line as played (the
  lowest sounding note, thinned to no two targets under 0.45 s) would have been 63–98 a minute: playable,
  but arbitrary where a chordal passage thins it. The pulse also *makes you listen*: 582 slows five times
  in its last two minutes and 639 four times at the end, so a run there means slowing down with the organ.
- **`src/pulse.js`** - the beat grid from the data's own `bars` and `metre`: `bar start + k × bar ÷ beats`.
  Nothing per piece typed in; a downbeat lands exactly on a bar line the picture already draws; a
  ritardando stretches its beats (582's widest beat is 1.75 s against a usual 0.83).
- **`src/landmarks.js`** - the moments worth marking: a line back after ten seconds gone, five struck
  together, a telling of the tune. `src/look-subject.js` had **private copies of two of these**; they moved
  here and the look calls the shared ones - the first payment on session 9's "shared drawing" debt.
  `src/theme.js` now keeps one answer per (note list, gap), because the fugue picture and the game both ask
  and the Passacaglia takes a fifth of a second to answer.
- **`organ.chime(pitch, when, weight)`** - a struck bell: one wave (unison, octave, twelfth and above),
  6 ms up, 1.2 s away, two strikes 6 cents apart so the ring moves, wired past the tremulant into the same
  lowpass and the same room. `when` omitted means now, which is what a strike means.
- **`src/game.js`** - judging, the run, the ladder, the words. Windows: ±0.11 s struck true, ±0.3 s caught.
  The ladder is a pile of wide thin bars low in the middle of the screen falling onto a line 96 px above the
  bottom; its pace comes from the piece's own beat (always about 2.2 beats in view, whether the piece is
  639's 1.62 s or 582's 0.83 s). A gold beat is one a landmark sits within min(0.2 s, a third of a beat).
- **The page**: "Play along" beside Pause (it reads "Just watch" while on), the `P` key, a click on the
  canvas, Enter, a score line top-centre ("12 in a row · best 15 · 63 of 224"), and a sentence on the end
  pane. Switching resets the count. `test/page.test.mjs` has a player who is there for 21 beats running in
  BWV 639 through the real wiring and catches all 21.
- 206 tests pass (was 151). `tools/mutate.sh` is new: it breaks 24 things in turn and insists a test notices.

Loudness by numbers, since the bell is the first thing added on top of the organ:

- One bell, both strikes in phase, heaviest weight: **0.166** of full scale.
- The widest chord of each piece with that bell on top: 0.345 / 0.373 / 0.501 / 0.396, and the two peaks
  landing in the same instant: **0.51–0.67**, all under the limiter's 0.708. With the room and the tremulant
  counted on top of that: 0.71–0.92, under full scale. That is the claim in `test/organ.test.mjs`;
  `node tools/loudness.mjs` now prints both columns.

Five mutations survived the first round, and each was a hole in a test, not bad luck:

- **A mutation that never applied.** A previous `perl` edit had eaten the backslashes in `beats\[pointer\]`,
  so the pattern was a character class and matched nothing: "SURVIVED" meant "never tried". `tools/mutate.sh`
  now compares the file first and prints `NO PATTERN` when the mutation changed nothing.
- Two page tests checked "no bell rang" at a second **where no beat was near**, so a stray click and no click
  looked identical. They now aim at a real beat, which is the only moment the difference is visible.
- The bell's `start()` was unchecked: the harness counted created oscillators. Now `audio.started` must grow
  by two, and the start times must be now (that also pins the decision that the bell rings **when the player
  struck**, not when the beat was).
- The landmark-ordering test had only one moment to order. Now it is a chord at 20 s and a return at 40 s,
  found in the wrong order and needing the sort.
- `if (at >= end) break;` in the beat grid was unobservable for all four pieces (the last bar's length is
  taken from the duration, so beats land inside it by construction). There is now a piece whose bar lines
  run past its own end, and the grid still stops at the music.

A bug the tidy-up flushed out, worth remembering: naming the ladder's line of sound `line` inside `draw`
**shadowed the game's own `line()` function**, so the strike's light was laid at `NaN` and simply never
appeared - no test noticed, because a gradient with NaN in it still counts as a gradient. The game's fake
canvas now asserts every `fillRect` and `createRadialGradient` argument is a finite number, and seven tests
failed at once when I put the shadowing back. One day the same rule belongs in `test/screen.mjs`.

Decisions worth keeping:

- The beat grid is per-bar subdivision, not the MIDI tempo marks: downbeats on bar lines mattered more than
  exact subdivisions inside a bar that changes tempo mid-way (639's last bar is 8.96 s with the slows inside
  it; its four beats are spread evenly, which is honest but not the same as the audio).
- A bell rings when **you** struck, at `ctx.currentTime`, not at the beat's second. Checked through the
  harness: the organ leads the page by 0.06 s and `organ.time()` accounts for it, so the two line up.
- A beat let go ends the run even though the player may only want the gold ones. Chosen: a run should mean
  "I was with it", and the alternative (only misses near gold beats count) made the number meaningless.
- Striking is a click whose `target` is the canvas itself. The HUD layers are `pointer-events: none` except
  their own controls, so a click over the music reaches the canvas and a click on a button does not, with no
  geometry to keep in sync.

What surprised me:

- The fugue of BWV 565 never reaches five notes struck together, so "five struck together" is a toccata-and-
  finale mark only - pinned as a claim about the notes (`test/pulse.test.mjs`), the same fact session 8 used
  for the chord flare.
- BWV 645's chorale is taken up exactly twice after a ten-second wait (2:03 and 2:53), which is the same two
  blooms the vigil already draws. Two looks and the game now agree on those moments from the same finder.
- Re-running `tools/look.mjs bwv565` after moving the look's private finders: worst frame 0.0455, 0 cells
  burnt - exactly session 9's numbers, so the refactor laid no light down differently.

Next, in order:

1. Milestone 3 has two open follow-ups written in PLAN.md: the ladder is laid *over* the picture instead of
   being part of each piece's world (the wheel could tick a rim tooth per beat, the vigil plant a lamp on the
   road, the braid breathe), and the bell is one struck sound for all four pieces when 639 and 582 are
   worlds apart in touch. Both want a decision per piece, by numbers where possible.
2. The rest of session 9's shared-drawing debt: the four looks still each carry their own
   `coming`/`sounded`/`bloom`/halo. `landmarks.js` is the first piece of shared logic out of them; the light
   helpers are next, and the light measurements in these notes are the safety net.
3. Still open from milestone 1: dynamics drawn from the music instead of the flat velocities (582 is all
   127, 565 all 90). `render.mjs` and `loudness.mjs` would let that be checked by numbers.
4. Small honest debts: BWV 645 burns 2 cells at the chorale's arrival; `test/screen.mjs` still cannot see
   `ctx.arc` + `fill`; `theme.js`'s phase for a periodic figure (session 9, deliberately left); and
   `test/page.test.mjs`'s harness does not yet insist drawn numbers are finite - `test/game.test.mjs` does
   and it caught a real bug in minutes.
