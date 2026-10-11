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

## Session 11 — 2026-10-11 — milestone 3: every piece gets a bell of its own

**Released 0.3.1.** The open PLAN item was "the bell is one struck sound for all four
pieces; decide heavier or lighter by the numbers". So: measured, then a rule, then the
rule wired in, then the numbers checked again.

What I did:

- **`tools/touch.mjs`** — measures a bell against the music it is struck over, per
  piece. It asks the page's own code (not a copy) for the beats, their length and the
  note each would ring; renders the whole piece at 16 kHz and keeps, for every beat,
  the loudest sample within a twelfth of a second either side (`peaksAt`, new in
  `test/render.mjs`). Prints three tables — what the bells land on, what one fixed
  bell makes of that, what each piece's own bell makes — and then the rule that was
  refused, beside the one chosen.
- **The measuring, first.** With the one fixed bell (level 0.07, decay 1.2 s) the
  ratio "bell beside its own music, over the beats" was **0.30 / 0.93 / 0.54 / 0.50**
  for 639 / 565 / 645 / 582: nine tenths under a bare line of BWV 565's fugue, a
  third under BWV 639's chorale. Ten dB of difference between pieces, which is the
  whole complaint, quantified. The piece's own level where the bells land (median of
  those rendered peaks): **0.119 / 0.374 / 0.204 / 0.220**.
- **`src/touch.js`** — the rule, nothing typed in per piece:
  `level = 0.078 × sqrt(fullness)`, clamped to [0.03, 0.09];
  `decay = 1.2 × the piece's beat`, clamped to [0.9 s, 2.2 s];
  where `fullness` is the **middle of the pipe-weight sounding at each beat, over the
  loudest the piece ever gets** (`max(3, heaviestChord)` — see the surprise below).
  Result: **0.037 / 0.069 / 0.052 / 0.054** and **1.2 / 1.95 / 1.2 / 1.0 s**. The
  spread of "bell beside its music" fell from 3.1 to **1.7** (−10.6…−0.6 dB before,
  −10.7…−6.0 now), and every bell now fills about **60% of a beat** — in BWV 639 it
  carries right across the bar, in BWV 582 it is gone before the next beat lands.
  Because the audible part of a bell (within 40 dB of its top) is about half the
  decay, **no two bells are audible at once in any piece** — pinned as a test.
- `organ.chime(pitch, when, how hard, touch)` takes the sizing with the strike;
  `bellLevel` / `bellDecay` fall back on the plain bell for anything that is not a
  number, or shorter than the attack, and both are in `Bach.organSpec` so
  `test/render.mjs` measures with the engine's own rule instead of copying it.
  `src/game.js` works the touch out once in `open()` and hands it with every strike.
- `MIN_CHORD = 3` came out of `prepare()`'s inline `Math.max(3, heaviest)` into a
  named constant, in `organSpec` as `minChord`, because the rule needs the same floor.
- `test/render.mjs` grew `loadPage()` (the page's playing-along scripts in a bare
  window, from `test/files.mjs`), so `tools/loudness.mjs` and the tests ask the page
  rather than reimplementing it. `tools/loudness.mjs` now shows each piece's bell and
  its own headroom: chord+bell 0.353 / 0.414 / 0.474 / 0.466 against a limiter at 0.708.
- 219 tests pass (was 206). New `test/touch.test.mjs` (10), one game test, two page
  tests. `tools/mutate.sh` has eleven new mutations and all are caught.

Decisions worth keeping:

- **The tidy rule was refused, on headroom.** "A bell always at the same share of its
  own music" makes the four ratios equal — and hands the biggest bell to BWV 639, the
  one piece whose level never drops (its thin figure is 0.362 against a median of
  0.374: it never thins out). That bell would be level 0.095, and its widest chord
  with the heaviest strike on it, the room counted after, would sit at **0.83 of full
  scale against 0.77 now**. The sqrt rule is "half as much, in decibels, as the music
  moves", which buys most of the evenness and none of the crowding. `tools/touch.mjs`
  prints both columns so nobody has to take that on trust.
- **Fullness is measured against `max(3, heaviestChord)`, not the piece's own
  heaviest chord.** The organ sets its gain as `ceiling / max(3, heaviest)`, so a
  piece that never has more than two notes going is played as if three were — that is
  how loud it actually is, and it is what a bell has to sit under. BWV 639 is the one
  real piece where this bites: its heaviest chord weighs 2.35, under the floor of 3,
  so its fullness is 0.78 and not 1.0, and its bell came out 0.069 instead of 0.078.
  A hand-built "one line at a time" piece scores 0.22, not 1.
- `sqrt`, clamps and floors aside, the bell is deliberately never *louder* than about
  half the music it is struck over: this is a tribute, and the tap is a comment on the
  music, not a second soloist.
- **Left out on purpose: sizing a bell per moment instead of per piece.** BWV 565's
  own level over its beats runs from 0.070 (quarter of the way up) to 0.119 (middle)
  to about 0.4 in the toccata — a 20 dB range no per-piece number can sit well in
  twice over. A per-moment trim would fix that, but the bell grows exactly where the
  chord is widest, which is the one place the headroom is already spoken for. Numbers
  are here if a later session wants it; it is not the item PLAN asked for.

What surprised me:

- **"Decay 1.2 s" was really a 0.6 s bell.** The decay is an exponential ramp to
  0.0001, so it is 40 dB down halfway through and 60 dB down three quarters along.
  Worth knowing before touching a bell again: the number on the tin is four times what
  an ear keeps.
- **My own harness was feeding the rule NaN.** `test/game.test.mjs`'s `notesOf` built
  notes with no `role` and no `velocity`, so `noteWeight` → `struck(undefined)` → NaN,
  and `Bach.touch`'s floor guard (`if (!(level >= SMALLEST))`) swallowed it silently
  and returned the smallest bell. It passed by luck. Now the harness gives roles and
  velocities like the page does — session 6's lesson, in a different file.
- Two of the guard clamps in the rule are doing real work on hand-built pieces and none
  on the four real ones: the smallest bell (a piece that is mostly silence) and the
  longest bell (a piece with a 4-second beat). Both now have tests, because "the clamp
  is not exercised" is how a rule silently stops being one.
- The mutation "the smallest bell is not a floor" **would have survived**: the thinnest
  hand-built piece I had was at 0.036, just above the floor of 0.03. Adding a piece
  that is mostly silence made the floor observable (23 failures).

Measured, since nobody can see or hear:

- Full table: `node tools/touch.mjs` (takes ~7 s; it renders all four pieces).
- Levels 0.037 / 0.069 / 0.052 / 0.054; decays 1.2 / 1.95 / 1.2 / 1.0 s; ratios to
  each piece's own beat-level 0.46 / 0.25 / 0.33 / 0.34 — that last set in the same
  worst-case bounds the rule itself uses (plain note weights), where the spread is
  1.8 to 1 against the rendered one of 1.7 quoted above. Bell alone: 0.089 / 0.164 /
  0.124 / 0.129 of full scale at the heaviest strike.
- Mutation-caught: same size for all four, same length for all four, a let-go-on-the-
  beat note still counted, a thin piece credited with a tutti, no floor under the
  smallest bell, no ceiling over the longest, `chime` ignoring the touch's level,
  ignoring its decay, taking a nonsense touch at face value, and a strike not carrying
  the touch at all.

Next, in order:

1. **The last open item of milestone 3: the ladder is laid over the picture instead of
   being part of it.** Each world could take its pulse its own way — the wheel ticking
   a rim tooth per beat, the vigil planting a lamp on the road, the braid breathing.
   This one needs judgement I cannot get from numbers alone, so: change one piece's
   world at a time, and keep the light measurements as the safety net.
2. The shared-drawing debt, still: four looks each carry their own
   `coming`/`sounded`/`bloom`/halo. `landmarks.js` and now `touch.js` are the shared
   logic taken out of them; the light helpers are next.
3. Still open from milestone 1: dynamics drawn from the music instead of the flat
   velocities (582 is all 127, 565 all 90). `peaksAt` and `renderAcross` now make a
   per-bar loudness profile cheap to compute, which is most of what that needs.
4. Small honest debts: BWV 645 burns 2 measuring cells at the chorale's arrival;
   `test/screen.mjs` cannot see `ctx.arc` + `fill`; `test/page.test.mjs`'s harness does
   not insist drawn numbers are finite (game.test's does); `theme.js`'s phase for a
   periodic figure (session 9, deliberately left).

## Session 12 — 2026-10-11 — milestone 3: the wheel takes its own pulse

**Released 0.3.2.** The open item was "the ladder is laid *over* the picture, not part
of it - only where it is better, piece by piece". It is better for one piece so far,
the wheel, and that is what shipped.

What I did:

- **The plumbing.** `src/game.js` gained `paint(what)`: hand it a function and the
  piece's own world draws the pulse instead of the ladder; hand it nothing and the
  ladder comes back. Every frame the game now builds a *shot* - `now`, the beats, the
  `pointer` (first beat a strike can still be judged against), the beat's length, how
  much of them is worth showing, how long a strike's light lasts, the run as 0..1, and
  what the player struck lately - and hands it either to the painter or to its own
  ladder. `src/visual.js` gained `pulse()`, which says whether the active look wants
  it, and `src/main.js` asks once per piece: `game.paint(visual.pulse())`.
- **`src/look-round.js` draws its pulse on its own rim.** One tooth per beat, just
  inside the marks that count the turns, at the bearing that beat falls on within the
  turn. Eight bars of 3/4 to a turn means **twenty-four teeth, three to a bar**: the
  metre written on the wheel. A tooth grows and brightens as the hand comes round to
  it (over three beats' worth of time); a beat the music is marking is drawn in a
  whiter light; a caught beat lays a *ring* round the bearing its tooth stood at (a
  ring, not a glow - the tooth is going in the same place and session 9's lesson is
  that two full lights on one spot are white, not loud); a long run brightens the
  whole rim through `ring()`; a click with no beat near it is one dull mark at the
  hand. The teeth stop where the wheel's shown window stops, so when the fugue unwinds
  the wheel the teeth go back on the rack with everything else that was ahead.
- **Harness: `createStage(scene, { play: true })`** loads the game's scripts too and
  wires game and picture together exactly as index.html does, so the light of the
  picture *and* its pulse is measured together. `stage.hit(at)`, `stage.painted()`,
  `stage.beats()`, `stage.score()`, `stage.rung` are there for it.
- **`notesFor` in `test/screen.mjs` now carries the loadness** as well as the role,
  read off the data's own `format`. Session 11's trap again, in a different file: a
  harness handing notes with no velocity gives `Bach.touch` a NaN, which its floor
  guard swallows, and every bell comes out the smallest one, quietly.
- **Session 10's debt paid: both stand-in canvases refuse nonsense.** `test/screen.mjs`
  and `test/page.test.mjs` now assert every `fillRect` and gradient argument is a
  finite number, and a box that covers the whole canvas is allowed to be a wipe (the
  wheel and the vigil open by wiping, and their wipes are honest). A device drawn at
  NaN is invisible, which is how one gets lost for a whole release.
- 230 tests pass (was 219): 2 in `game.test.mjs` about the shot, 8 in
  `picture.test.mjs` about the rim, 1 in `page.test.mjs` that the Passacaglia's piece
  really is painted by its own picture. `tools/mutate.sh` has thirteen new mutations,
  all caught.

Decisions worth keeping:

- **A picture is asked, not configured.** A look declares itself by returning a
  `pulse` function; nothing in `src/pieces.js` says who takes the pulse, so a look and
  its entry on the card cannot disagree.
- **The game keeps all the judging.** "A picture that draws the pulse draws it; it
  judges nothing." The shot is read-only in spirit; `beats[].taken` is the game's work.
- **The shot says *which beat* a strike caught** (`strike.when`, the beat's own second),
  not only when the player clicked. That is what lets a world put its light where the
  beat was rather than where the hand is now. The wheel folds `when` back into a
  bearing, so the light lands on the tooth you hit.
- **Travelling back leaves your struck lights behind you; travelling on does not.**
  `frame` now clears `lit` only on a backwards jump. A forward skip bigger than half a
  second is a seek, not a missed beat, and a strike should still be fading on its own
  clock - which the harness needs too, since it frames a sixth of a second apart.
- **MARK (`#e8f1ff`) is the pulse's colour on the wheel, and never gold.** Gold is the
  ground bass and nothing else there, and a beat cannot take that meaning away. The
  first version of the gold test let a mutation that lit struck beats gold survive -
  it only looked at frames with no strikes in - so the test now strikes a telling of
  the ground and checks the light it lays is not gold either.
- **The other three keep the ladder, on purpose.** BWV 565 falls, BWV 639 lays a
  phrase sideways, BWV 645 recedes to a horizon: all straight timelines already, so a
  ladder of falling beats is not a foreign object on them. The wheel was the only
  picture with no straight line anywhere. The vigil's road could still take lamps and
  the braid could breathe; the PLAN item stays open until someone decides that is
  better rather than merely possible.

What surprised me:

- **The wheel's turn divides exactly into beats** - 8 bars × 3 beats - so "a tooth per
  beat" lands on a whole number of bearings and the three-to-a-bar grouping shows the
  metre for free. Checked, not assumed: the test counts the bearings covered and the
  gap halfway between two beats, where there must be nothing drawn.
- **The hand kept getting into my measurements.** It is drawn in the same cool as the
  teeth, it reaches the same radius, and its tip bloom passes within ~40 px of a beat's
  tooth: my first "nothing lit before the strike" claim was really measuring the hand.
  Two fixes: identify the pulse's boxes by *difference* against the same picture drawn
  with nobody playing, and compare before against after at one place instead of
  asserting absolute geometry.
- **That difference is only honest if both stages are framed identically.** Framing one
  and not the other puts the look's own boxes into the "pulse" list, because the slice
  offset is the picture's box count. `wheelPlaying().see(seconds)` frames both, always,
  in the same order.
- **Eight of my thirteen new mutations were never tried the first time**: my perl
  patterns had a `/` inside a pattern, a missing trailing `/`, and an unescaped `)`.
  `tools/mutate.sh` reported them as `NO PATTERN`, which is the failure mode session 10
  added it for. Fixed, re-run: 13 of 13 caught, including "the wheel keeps the game's
  ladder after all" (17 tests fail) and "a struck beat is lit gold" (3 fail).
- **A beat already let go is nobody's to strike again**: the game's `pointer` only ever
  moves forward, so a test that frames past a beat and then tries to hit it gets a
  stray. Three of my new tests had to be reordered so the strikes happen ahead of any
  frame that passes their beat.

Measured, since nobody can see or hear:

- Wheel, worst second over the whole piece (one frame a second): mean light **0.0340**
  with nobody playing, **0.0348** with every beat struck; brightest spot 0.48 in both;
  **0 cells burnt out** in both, over all twelve minutes.
- Heaviest frame: **668 marks** alone, **720** with the pulse on, against a budget of
  1500; gradients 149 → 150 (the run's ring is the only gradient the pulse adds).
- Tests: 230 in ~10.5 s, up from 219 in 6.7 s. The new ones build playing stages, and
  each one makes the page find the ground bass again (~0.2 s); `Bach.theme`'s cache is
  per sandbox, so a stage that has both a picture and a game pays it twice.

Next, in order:

1. The rest of the ladder item, if it is wanted: the vigil (BWV 645) planting lamps
   along the road for its beats, or the braid (BWV 639) breathing with them. Do it
   only if it reads better than the ladder, and `createStage(scene, { play: true })`
   now makes the light measurable either way.
2. The shared-drawing debt, again, and now bigger: `pulse` is a sixth place that draws
   a glow or a ring. `landmarks.js`, `touch.js` and the shot are the shared logic so
   far; `coming`/`sounded`/`bloom`/`halo` are still copied into every look.
3. Still open from milestone 1: dynamics drawn from the music instead of the flat
   velocities (582 is all 127, 565 all 90).
4. Small honest debts: `theme.js`'s phase for a periodic figure (session 9, left on
   purpose); BWV 645 burning 2 measuring cells at the chorale's arrival (session 9's
   number, not re-measured here); the harness still cannot see `ctx.arc` + `fill`.

## Session 13 — 2026-10-11 — milestone 3: BWV 645's beat was half a beat early

**Released 0.3.3.** A bug, found while measuring for the next look item, and it was a
bug with teeth: the whole of one piece's pulse was being asked for half a second
before the music got there.

What I went in to do was the vigil's own pulse (BWV 645 planting lamps along its road
instead of wearing the game's ladder). First step was to ask which of its beats the
music marks, and the answer was **none**. That was the thread I pulled.

What I did:

- **Found it.** `Bach.landmarks` gives BWV 645 four moments: 16.5, 92.5 (the opening
  ritornello, told twice) and 123.5, 173.5 (the chorale coming home twice). Every one
  of them is at a half second, and the beat grid was at whole seconds, so not one was
  within `min(0.2, gap/3)` of a beat — the piece could never have a gold beat. From
  there: the notes themselves are struck at 0.5, 1.5, 2.5 … (430 onsets on the half
  second against 268 on the whole second), the pedal's quarter notes walk 0.5 apart
  all the way through, and the chord that **ends the piece starts at 216.5 and holds
  exactly four seconds to its last sound** — one whole bar. The edition bars the music
  from 0.5; the MIDI file cannot say so, and `tools/bars.mjs` was drawing bars by
  arithmetic from tick 0. The piece opens with an eighth-note pickup, and every bar
  line in it was half a beat early.
- **The rule now, in `tools/bars.mjs`.** These editions end exactly on a bar line —
  which is what already lets a bar line with no music after it be dropped — so
  whatever the last bar is short by is the pickup the piece opened with, and the whole
  grid is lifted by that much. BWV 645: 56 bars of 0, 4, 8 … became 55 whole bars from
  0.5. Two guards, both tested:
  - the yardstick is the **middle** bar of the piece, not the last gap. BWV 582 slows
    five times in its last two minutes, so its last-but-one bar is 5.24 s and its last
    is 1.875 s: read the last gap and the Passacaglia looks like it opened with three
    fifths of a bar missing. Judge by the middle (2.5 s) and nothing is lifted.
  - the shortfall has to be under half a bar, and there have to be three bar lines to
    judge by. BWV 639 ends by slowing to a stop, so its last bar is *longer* than one.
- **What it buys.** BWV 645 has four gold beats now, and they are exactly the four
  moments the vigil already marks with its lamps and its warm bar line. The beat grid
  starts at 0.5 (the pickup is not a beat: nobody could strike an eighth note). The
  long view's bar lines and its phrase lines fell into step with the music's own
  phrasing, and `tools/shape.mjs`'s sections now break at the ritornello's return to
  the half second.
- **New tests, 241 in all (was 230).** `test/data.test.mjs` gained five tests for the
  rule (a piece ending on the line, a piece with a pickup, a stretched last bar, a
  piece too short to judge, and BWV 645's final chord filling its last bar), and its
  three pickup-blind claims are gone: `bars[0] === 0` became "the first bar line is
  under a bar in, and the last bar is at least half a bar". `test/pulse.test.mjs`
  gained the claim that should have been there from the start — **the beat is where the
  music is struck** — measured as the share of a piece's own note-length struck within
  a twentieth of a second of a beat, which every piece must now get above 0.4 on. And
  one that says each of BWV 645's four moments is exactly one beat. `tools/mutate.sh`
  now mutates `tools/bars.mjs` too: four ways to break the rule, all caught (7, 5, 5
  and 3 failing tests).
- Re-measured what the shift could have disturbed: the long view of 645 is fullest
  second mean 0.0427, brightest 0.42, 0 cells burnt, worst frame 0.0417 at 0:50 with
  the same 2 burnt cells it has had since session 9 (the chorale's first arrival,
  still an open debt). Its bell is the same size (level 0.052); what changed is where
  the bells land — the piece's own level under its beats 0.204 → 0.218, and the bell's
  share of it 0.33 → 0.38, both for the better since the bells now land on notes.

Decisions worth keeping:

- **The share of note-length on the beat, for the four pieces:** 565 0.49, 639 0.48,
  582 0.56, 645 0.64 (it was 0.26 before the fix). About half is what a bar of four
  with eighths and sixteenths in it looks like; a fifth means the grid is half a beat
  off the music. That is the honest general guard, and it is a test now.
- **I did not derive the bar grid from the notes.** The onsets in 639 and 582 sit about
  a fiftieth of a beat (17–35 ms) *before* the grid — a hair flat, most likely the
  editor's tempo mark rounded. Fixing that would mean letting the notes re-barrow the
  edition for all four pieces, for a gain no ear could hear, and it would move the
  wheel's whole geometry in BWV 582 for nothing. The bar lines are the editor's; the
  pickup was a fact the file could not write, which is different.
- A pickup note belongs to no bar in `tools/shape.mjs`'s table — correct, since an
  anacrusis is written as its own partial bar. Nothing in the page reads that table.
- Two whole bars' worth of the "beat sits at a rate a hand can keep" test moved to
  `beats[0].time === data.bars[0]`: the first beat is wherever the edition's first bar
  line is, and that is now allowed to be a pickup in.

What surprised me:

- **My own third test was wrong, and the code was right.** I wrote a synthetic "639"
  — a constant-tempo piece of 119.23 s with 6.4865 s bars — expecting no lift, and it
  lifted. Of course it did: 639's long last bar comes from a real ritardando, which a
  one-tempo fake cannot make, so my fake really did end on a stump of a bar. The test
  now reads the real BWV 639 file and says why a real one is needed to make the point.
- The half-second was hiding in plain sight in these notes: session 5 wrote that the
  ritornello's figure is heard "at 0:16 (bars 5–10)", and after the fix it starts on
  bar 5 to the half second, and shape.mjs's sections break on the returns. Two tools
  had been quietly reporting a grid that did not fit.
- `grep`-ing my own NOTES for "0.5" would not have found this. What found it was
  asking a question I had not asked before — *which beats are gold in this piece* —
  and getting an answer that was too tidy to be true.

Next, in order:

1. **The vigil (BWV 645) taking its own pulse**, as planned before the bug turned up.
   The geometry is worked out: the road's climb is `line - step·climb(ahead)` with a
   beat's worth of lamps in the last 90 px, so lamps go on the two verges (x under the
   margins the notes never enter: 120 px at 1280 wide), a lamp per beat while it is
   near and one per bar beyond about four beats, `≥2 px` apart or not drawn at all,
   struck light laid on the line of sound at the verges (not sliding down them: that is
   where `#voices` and `#lookHint` live), the verge itself brightening with the run,
   and `MARK` (#e8f1ff) for its colour — never gold, which is the chorale, never WARM
   (#ffb066), which is a repeat. Two arguments the ladder had to answer: the ladder's
   pace is linear and the road's is logarithmic, so they disagree about how far off a
   second is; and the ladder shows 2.2 beats while the road can show the bar lines all
   the way to the horizon. Now that 645 has four gold beats, a pulse drawn on the road
   can show them from a minute off, which the ladder cannot do at all.
   Cost to keep an eye on: the vigil's heaviest frame is 1126 marks of a 1500 budget.
2. The shared-drawing debt, still: `coming`/`sounded`/`bloom`/`halo` are copied into
   every look, and `pulse` is now a fifth place. The light numbers in these notes are
   the safety net.
3. Still open from milestone 1: dynamics drawn from the music instead of the flat
   velocities (582 is all 127, 565 all 90).
4. Small honest debts: `theme.js`'s phase for a periodic figure (session 9, left on
   purpose); BWV 645 burning 2 measuring cells at the chorale's arrival; the harness
   still cannot see `ctx.arc` + `fill`.

## Session 14 — 2026-10-11 — milestone 3: the long view plants a lamp for every beat

**Released 0.3.4.** The ladder item, which session 12 left half done: "a picture may take
the pulse off the game and draw it in its own world, only where it is better, piece by
piece". The wheel took it in 0.3.2; this session the road of BWV 645 took it, and I
closed the item: two of the four pieces now mark their beats inside their own picture,
and the other two keep the game's ladder on purpose - the fugue picture and the braid are
already straight timelines of the next few seconds, which is exactly what a ladder of
falling beats is. Added a PLAN item for the one remaining "maybe": the braid breathing
with its own beat, undecided.

What I did:

- **`src/look-vigil.js` has a `pulse`, so the ladder never comes here.** One lamp on each
  of the two verges per beat, standing at the height that beat's moment has reached on the
  climb (`line - step·climb(ahead)`, the look's own geometry): one to a beat while the
  beats are far enough apart to be told apart, one to a bar beyond four beats, and one to
  any beat the piece is marking for itself *however far off it is* - which is the whole
  reason to prefer the road: the four gold beats of this piece (16.5 and 92.5, where the
  opening ritornello is told, and 123.5 and 173.5, where the line to follow comes home)
  stand up to a minute ahead, and a ladder two beats tall can only ever show the next two
  and a bit. The verges are the
  margins no note is ever drawn in (`xFor`'s own margin, now one function called `verge`),
  lamps stand at 0.6 of that width inboard, and everything is `MARK` (#e8f1ff): gold is the
  chorale and warm is a repeat, so a marked beat is bigger and brighter instead of another
  colour.
- **What a strike does.** Light laid on the line of sound at both verges, fading on the
  player's clock - deliberately *not* sliding down the verges with the beat, because below
  the line of sound is where `#voices` and `#lookHint` live, and because the beat has
  arrived by then. A click with no beat near it is a dull 18 px flick at either hand. A
  long run lights a strip down each verge, which is this picture's version of the ladder's
  line getting wider.
- **Sizes, from measurement rather than eye** (nobody can see this, so the harness is the
  eye): a lamp is a 1.4-4 px bead with a soft light round it, never drawn brighter than
  0.45 of full light; a struck bloom is 0.09-0.13 alpha. Both numbers are floors below
  white, and both are tests now.
- **The card says where to look**: BWV 645's hint is now "recedes to a horizon · gold is
  the chorale · warm is a repeat · the lamps mark the beat", matching the wheel's line.
- **Harness and tests: 248, was 241.** `test/picture.test.mjs` gained eight tests for the
  road's pulse (both verges lit, no ladder beams, a lamp at every beat that asks for one
  and not at the ones that do not, nothing below the line of sound, the marked beat a
  minute off lit and brighter than an ordinary bar as far off, struck light on the line of
  sound and none for a beat let go, never gold and never warm even on a struck marked beat,
  a run lighting the verges and a let-go taking it back, and one slow test that walks the
  whole piece comparing the road with itself with nobody playing). `roadPlaying()` frames
  the playing stage and the plain stage in lockstep and hands back only what playing added,
  which is session 12's difference trick again. `test/page.test.mjs`'s wiring test now
  covers both pieces that take the pulse. `tools/mutate.sh` has ten new mutations for the
  road, all caught (61 in all); four of them are the reason for the paragraph below.

What surprised me:

- **The crowding guard I went in to write is not in the code, because it would never
  have fired.** The plan said "≥2 px apart or not drawn at all". Measured, the tightest
  two lamps in this piece are 2.3 px apart - a lamp to a bar 212.5 s off its neighbour at
  the far end of the road - so a 2 px rule is dead code, and the mutation that removed it
  **SURVIVED**, which is how I found out. Out it went; the claim now lives in a test about
  the piece ("no two lamps nearer than two pixels, unless one is a beat the music is
  marking"), which is the thing that will complain if a livelier piece ever wears this
  look. The marked beats *do* crowd: 123.5 and 173.5 are not bar lines, so their lamps
  stand 1.6 px off a bar's, and they keep their light because the music, not the bar
  grid, said where they are.
- **A `Math.min(0.45, ...)` I wrote as a guard was dead too** - neither formula ever gets
  that high - and its mutation survived as well. Same lesson, cheaper: the formulas are
  the cap now, and a test says no lamp is drawn at half light or above.
- **The game's `pointer` never travels back, so a frame that goes backwards is not a
  moment anybody stands at.** My "a beat gone by must not be lit below the line of sound"
  test passed while the mutation that lit it survived: I had framed 190 s and then 60.6 s,
  so the shot's `pointer` was still up at 190 and the frame held no beat behind the hand
  at all. Session 12 hit the same trap with strikes; the rule is the same for frames. The
  test now frames 0 → 40 → 60.6 → 100 → 190 in that order, and the mutation is caught.
- **The harness samples one point per 20 px cell, so a small bright bead can hide from
  it.** My first burn claim - "the pulse burns nothing out" - was not true and not
  checkable either way: a 4 px bead at 0.62 alpha sat on a cell the picture had already
  lit to 0.32 and read as a burnt cell whenever it happened to cover the sample point.
  Two honest claims replaced it: no lamp is drawn brighter than half light, and a cell may
  only burn out if the picture alone had it above 0.85.
- **The picture alone was already burning cells out**, and I had never measured how much:
  at a sixtieth of a second over the piece, 1607 of 13200 frames have a burnt cell (worst
  frame: 4), all of them around the chorale's arrival, where the arrival bloom and the
  notes' own bright cores meet the line of sound at 0.899. That is older than this
  session - `tools/look.mjs` has been printing "worst frame ... burnt out 2" for a while -
  but I only looked at it now, because I needed it as the baseline for "did *I* burn
  anything".

Measured, since nobody can see or hear:

- Heaviest frame of BWV 645: **1128 marks alone → 1290 with its lamps** (budget 1500; the
  game's ladder over the road had been 1134, so the pulse costs about 60 more marks than
  the ladder did and shows every bar of the piece instead of two beats).
- Worst mean light over the whole piece at 1/60 s: **0.0435 alone → 0.0451 with the lamps**,
  against **0.0470 with the old ladder** - the lamps are cheaper in light than what they
  replaced. Brightest cell 0.27, unchanged. Cells burnt by the lamps alone: none anywhere
  except one at 0.899 → 0.901, at the picture's own worst spot.
- Lamps on one verge: 60 with the whole piece ahead (55 bars + the beats of the next four
  bars + the marked ones), 13 with 40 s left.
- Tests: 248 in 12.9 s, up from 241 in ~11 s. The new slow one walks the piece at a sixth
  of a second twice over (playing and not playing) and costs ~4.4 s of that.

Decisions worth keeping:

- **Where a piece's time lives, the piece says.** A look asks for the pulse by returning a
  `pulse` function; the vigil and the wheel do, the fall and the braid do not, and nothing
  in `src/pieces.js` can disagree with the picture about it.
- **The game keeps all the judging**; the road only reads the shot. `strikes[].when` is not
  used here at all - the struck light goes where the beat has got to (the line of sound),
  not where it was.
- **Nothing of the pulse goes below the line of sound.** Below it is the page's own words
  and the seek strip; above it is the piece. That is also why a beat a third of a second
  gone is not drawn on its way down the verge.
- **MARK for everything, size and brightness for the marked ones.** Every colour the road
  uses already means a thing - gold the line to follow, warm a bar that repeats - and a
  beat is a third thing that must not borrow their meaning.
- `BEATS = 4`: one lamp to a beat while a beat is less than a bar away, which is the
  metre of this piece rather than a number I like.

Next, in order:

1. **The sound's oldest gap**, not the picture's: dynamics drawn from the music instead of
   the flat velocities in the files (BWV 582 is all 127, BWV 565 all 90). It is the last
   open item left over from milestone 1 and the only one that changes what the player hears.
2. The shared-drawing debt, still: `coming`/`sounded`/bloom/`halo` and now a sixth `bloom`
   in the vigil. The small version of paying it is one round-glow helper in `src/visual.js`
   that the four looks and the game all call; the shot and `landmarks`/`touch` are the
   shared logic so far.
3. The braid (BWV 639) breathing with its own beat - a PLAN item, not a decision.
4. Small honest debts: the vigil's own burnt cells at the chorale's arrival (worth fixing
   before anyone adds more light there); `theme.js`'s phase for a periodic figure; the
   harness still cannot see `ctx.arc` + `fill`, which is why every glow here is rects.


## Session 15 — 2026-10-11 — milestone 3 finished: the braid stands its beats on a ruler

**Released 0.3.5.** The last open item of milestone 3: "the braid of BWV 639 could
still breathe with its own beat, if a look at it says that reads better than the
ladder". It reads better, and it is not breathing: it is a ruler. Three of the four
worlds now mark the player's beats inside their own picture; the fugue picture of
BWV 565 keeps the game's ladder, on purpose.

What I did:

- **The deciding, first, by numbers** (the item asked for a judgement, not a
  device). At the braid's own pace — one phrase of four bars to a screen, 49.3 px a
  second at 1280 wide — **a beat of BWV 639 is 80 px from the next one, and twelve
  of them are on the screen at a time** (19.2 s ahead of the line of sound). The
  game's ladder showed 2.2 beats, 3.6 s, at 86 px of spacing: the same spacing,
  one sixth of the piece, on an axis at right angles to a picture whose time runs
  sideways, laid across the music itself: its bars fall through y 514-704, and the
  band the notes are drawn in runs from 128 to 672. And the piece has
  exactly two beats worth striking early — 0.00 and 25.95, where the opening phrase
  is said again — which are 26 s and 21 s off: **no ladder that is two beats tall
  can show them, and the whole of this picture is one phrase wide.** That is the
  same argument the long view used in 0.3.4, and here it is stronger.
- **`src/look-braid.js` has a `pulse`.** A mark per beat stood at the x its moment
  has reached, in two rows: one hanging above the music and one standing below it,
  because those two strips are the only places a note is never drawn. Each mark
  grows towards the music as its beat comes (over four beats' worth); a bar's
  opening stands taller than the three beats inside it, so four read as one bar; a
  beat the piece is marking for itself stands taller and brighter still however far
  off it is, which is the thing a ladder could never say. A struck beat is gone from
  the ruler and lays a contracting **ring** on the line of sound at both edges of
  the band; a click with no beat near it is a dull 18 px flick; a long run lights the
  ruler and the line of sound it is crossed by, which is this picture's version of
  the ladder's line getting wider. `MARK` (#e8f1ff) for all of it: on this piece
  gold is the chorale *and* a phrase said again, so a beat may take neither.
- `pitchMargin` came out of `yFor` so the ruler and the music cannot disagree about
  where the music ends. The card says where to look: "four bars to a screen · a bar
  line glows gold on a repeat · the ticks mark the beat".
- **Tests: 257 (was 248).** Ten new for the ruler, and three existing claims
  rewritten because they said "two of the four take the pulse": the `painted()`
  table in `test/picture.test.mjs`, the page's wiring test (which now wraps
  `Bach.createGame` and asks the game itself, so main.js is what is being tested),
  and the ladder test in `test/page.test.mjs`, which now uses BWV 565 — the one piece
  that keeps the ladder — because it cannot be drawn in BWV 639 any more.
  `tools/mutate.sh` has 13 new mutations, all caught; 74 in all, and the whole run
  came back with nothing surviving (`node tools/mutate.sh`, about 25 minutes: it runs
  the whole test suite once per mutation - do not edit `src/` while it runs, it
  mutates those files in place and restores them at the end).

What I found by measuring, and it matters:

- **A struck beat can burn a pixel out, and mine did.** The first version laid a
  plain round glow on the line of sound where each ruler row meets it. Measured at a
  sixtieth of a second across the piece, **4 cells went over 0.9 where the picture
  alone sat just under 0.85** — and the reason is that in this piece a note is *usually*
  being struck on that very beat, so the chorale's own flare is already blazing at
  exactly that spot. Fixed with the wheel's old device (session 9): the struck light
  is a **ring with an empty middle** now, and nothing tips over anywhere in the piece.
- **The wheel of BWV 582 tips a cell over white, and I left it.** At a sixth of a
  second, its struck beat tips one cell over 0.9 at 225.83 s and at 245.83 s - and it
  is not the glow (the wheel lays its glows as rings already), it is the **tooth**: a
  2 px mark at 0.3 laid where a note core of 0.52-0.59 is shining, on a spot the
  picture alone has at 0.68-0.74. Session 9's device is the answer - the wheel keeps a
  per-frame record of where it has laid light and draws a second light there for half -
  and `pulse` never consults it. Session 12's "0 cells burnt with the pulse on" was
  measured one frame a second, and a one-second grid walks straight past both frames.
  To see it: two stages of BWV 582 in `test/screen.mjs`, one with `{ play: true }`, the
  same second framed in both a sixth of a second apart with every beat struck, then
  compare the two `air` grids cell by cell - over 0.9 in the playing one where the
  plain one was under 0.85 is the tell. The vigil of BWV 645 tips nothing at either
  grid, so session 14's claim holds.
- **Two of the four looks burn cells out by themselves, and it is by construction.**
  The braid alone has a cell over 0.9 in 202 of 715 frames (a sixth of a second
  apart), and BWV 565's fall look in 264 of 3432. It is a note's own three layers —
  glow 0.09, body 0.46, core 0.90 — plus the line of sound's own light and the
  struck flare, all meeting on a 2 px column at the moment the note is struck. That
  is the brightest moment of the picture and it is one cell wide, so I left it
  alone; but it is why the rule for "did *my* addition burn anything" has to be "a
  cell may only go over if the picture alone had it above 0.85". That rule is a test
  now, walked at a sixtieth of a second.
- Measured, all at 1280×800, every beat struck:
  - worst mean light over the whole piece: **0.0373 alone → 0.0397 with the ruler**,
    against **0.0430 with the game's ladder laid over the same picture**. The ruler
    costs about a quarter of the light the ladder cost.
  - heaviest frame: **283 marks alone → 337 with the ruler** (the ladder was 288),
    against a budget of 1500.
  - cells tipped over white by the ruler alone, at 1/60 s: **none anywhere**.
  - the marks are 80 px apart through the piece and **110 px in the final
    ritardando** — the slowing is something you can see arriving now, which is a
    test of its own ("the ruler stretches where the piece slows down").
  - a marked beat stands 22 px at 0.15 alpha where a bar opening stands 13 px at
    0.09 and a plain beat 9 px at 0.055, at the same distance off.

Decisions worth keeping:

- **Where a piece's time lives, the piece says.** Three worlds take the pulse and
  one does not; nothing in `src/pieces.js` can disagree with a picture about it, and
  the page test asks `game.painted()` rather than squinting at pixels for that case.
- **Nothing of the ruler goes inside the music's band.** The band's edges are where
  no note is ever drawn, so the rows hug them from outside with a 10 px gap - the
  widest a note's own glow reaches is 11 px, so they cannot touch.
- **No crowding rule in the code.** Session 14's lesson: the tightest two marks in
  this piece are 80 px apart, so "skip a mark with no room for it" would be dead
  code that no mutation can be caught by. The claim lives in a test about the piece
  ("no two marks nearer than 40 px"), which is what will complain if a livelier piece
  ever wears this picture.
- **A caught beat leaves the ruler**, as it leaves the ladder: the row visibly
  empties where you struck, and the light moved to the line of sound rather than
  doubling up.
- **The struck ring contracts as it fades** rather than spreading like a wave,
  because that is what the ladder and the long view do with a strike. Consistency
  between the four worlds beat my liking ripples.

Next, in order:

1. **The sound's oldest gap**, not the picture's: dynamics drawn from the music
   instead of the flat velocities in the files (BWV 582 is all 127, BWV 565 all 90).
   It is the last thread left over from milestone 1 and the only one that changes
   what the player hears. `peaksAt` and `renderAcross` in `test/render.mjs` make a
   per-bar loudness profile cheap, which is most of what it needs.
2. **The wheel's `pulse` should consult its own "already lit" record** - see the two
   tipped cells above, and note it is the tooth rather than the glow. Small, and its
   test grid should go from one second to a sixth while that is being done.
3. The shared-drawing debt, again, and bigger: `landmarks.js` and `touch.js` are
   shared logic, but `coming`/`sounded`/`bloom`/`ring`/`halo` are now written out in
   six places. The light numbers in these notes are the safety net for a refactor.
4. Small honest debts: `theme.js`'s phase for a periodic figure (session 9, left on
   purpose); the fall and braid looks' own burnt cells (by construction, but worth
   deciding deliberately one day rather than by accident); `test/screen.mjs` still
   cannot see `ctx.arc` + `fill`, which is why every glow here is rects.

## Session 16 — 2026-10-11 — milestone 4: the organ breathes

**Released 0.4.0.** The oldest open thread in the project, from milestone 1: the files
carry no dynamics at all (every key of the Passacaglia at 127, every key of the Toccata
at 90), so the organ had been playing a whole chorale at one level since 0.0.1.

What I did:

- **`src/dynamics.js`** — `Bach.dynamics(notes, { bars, duration, phrase })` hands back one
  number per note, from three things a piece says about itself. Nothing is typed in per
  piece except how many bars a phrase takes, which the card already said:
  **the arch** — a phrase opens held back (0.86), grows to 1.08 two thirds along, settles to
  0.94 at its cadence; **the thin and the full** — a moment is played up or down by
  `(what this piece usually has going ÷ what is going now)^0.3`, clamped to [0.92, 1.15];
  **the entry** — a line silent for a second or more that comes back *into something* is
  struck 1.22 firmer, easing off over the 1.2 s after its first note. The three multiply,
  with a guard at [0.8, 1.5]. `Bach.dynamicsShape` hands the three rules out separately so
  a test can ask one alone.
- **Wiring.** `organ.prepare(data, roles, phrase)` shades the notes there and then weighs
  its ceiling from the shaded weights — which is the whole reason this can move loudness
  *inside* a piece without ever making a piece louder. `noteWeight` and `speak` both
  multiply by `shadeOf(note)`; `main.js` passes `piece.look.phrase` (four bars for three
  pieces, eight for the Passacaglia, where a phrase is one turn of the ground).
- **`tools/dynamics.mjs`** — every bar of every piece rendered twice at 16 kHz, as the file
  has it and as the organ plays it, and the three claims measured inside each version: the
  arch (a phrase's top over its opening bar), the fullest tenth of the bars over the
  thinnest, and how many notes are an entry. ~10 s for all four.
- **Tests: 275, was 257.** `test/dynamics.test.mjs` (17): each rule on hand-built pieces
  where the answer is known beforehand, both ends of the guard reached by construction, and
  claims about the real pieces (every line back after ten seconds is brought out in all
  four; BWV 565's bare middle median ×1.184 against its finale's ×0.934; BWV 582's fugue
  held under its variations; BWV 639 has 4 entries in 553 notes because nothing there ever
  stops to breathe). One page test that the shade reaches the pipes: two identical notes,
  one shaded twice as loud, and every pipe level doubles exactly.
  `tools/mutate.sh` gained 18 mutations (14 in dynamics.js, 4 in the wiring) and all are
  caught; it also takes `ONLY=braid tools/mutate.sh` now, since a full run is half an hour.

Two harness bugs, both of the "the measuring is measuring something else" family:

- **`test/render.mjs` was multiplying how hard the key was struck by itself.** `render`
  used `gain * struck(velocity)` and `pipesOf` put `struck(velocity)` into every pipe's
  level again. Every rendered peak was reading 6% too high for the three pieces at velocity
  0.7087 and 23% too high for the Passacaglia at 1.0. Fixed, and the honest numbers are now:
  whole-piece peak 0.338 / 0.390 / 0.411 / 0.356 against a limiter at 0.708, and peak with
  the room and tremulant counted 0.468 / 0.530 / 0.570 / 0.493.
- **`preparedNotes` handed out unshaded notes**, so tools and tests could measure a
  different performance from the one the page gives. It now mirrors `prepare` exactly, by
  calling the page's own `dynamics` rather than a copy — session 6's lesson for the third
  time in a row, in a new file each time. `loadOrgan` loads `src/dynamics.js` with the
  organ now (`organScripts()` in `test/files.mjs`), and the phrase is passed through with
  `phraseFor(piece)`.

Two tests had to be re-aimed, and neither was weakened:

- **"the sound sits low"** asked its question of one chord — the heaviest — and with
  dynamics the heaviest weighted moment is no longer the busiest one. Worse, the
  Passacaglia's fullest chord is twelve high manual notes over a pedal C1, and 32.7 Hz is
  *below* the 40 Hz floor of the lowest band, so the deepest note in the chord counted for
  nothing. `bandSharesAcross` now takes the middle of a chord every ten seconds: 87 / 92 /
  95 / 75 per cent of the energy under a kilohertz. That is a claim about the instrument,
  which is what the test was for.
- **"every piece's bell sits about the same way under its own music"** had a bound of 2 and
  now measures 2.03. The rule is `sqrt(fullness)`, so the residual is by construction the
  square root of how far apart the four pieces' fullness is; the shaping widened BWV 565's
  own range (its median beat is now 0.203 of its top where it was 0.231) and the residual
  grew accordingly. The bound went to 2.2 with the arithmetic written beside it. The two
  *musical* bounds in that test — a bell at least 6 dB under its music, never 13 dB under —
  are untouched and pass at 0.496 and 0.245.

The mistake worth writing down: **my first entry rule counted a whole ensemble arriving out
of a bar of silence**, and in the toccata that is every chord. It mattered more than it
looked: the touched chord is the piece's heaviest, so the gain came down 16% (0.1092 →
0.0918) and everything else in BWV 565 was played 1.5 dB quieter to pay for it. An entry is
a line *joining* something, so the rule now asks whether anything was sounding a moment
before; the toccata's chords arrive out of silence and are left alone. The gains are
0.0943 / 0.2333 / 0.2097 / 0.0862 and the whole-piece rendered tops moved −0.95 / +1.05 /
+0.03 / +0.03 dB. (The toccata's biggest crashes *do* still get the lift, because they land
on a held pedal note. That is fine: they are the loudest thing in the piece.)

Measured, since nobody here can hear:

- the arch, per note: a phrase's high point stands 2.03 / 1.95 / 1.83 / 1.74 dB over its
  opening bar. At bar granularity the tool says 1.1 / 1.4 / 1.1 / 0.6 dB — the bar RMS
  carries the tails of its neighbours, so it smooths a per-note swell by ~40%. Quote the
  per-note figure.
- thin against full, fullest tenth of the bars over the thinnest, before → after: 565
  +3.3 → +2.8 dB, 582 +5.1 → +4.3, 645 +2.3 → +1.8, 639 0.0 → 0.0 (it never thins).
- entries: 330 of 3651 notes in 565, 4 of 553 in 639, 59 of 863 in 645, 485 of 9546 in 582.
  BWV 645's two chorale homecomings are played ×1.30 and ×1.24; its ritornello's returns
  ×1.31 at the firmest.
- a note's level, min / median / max: 565 0.80/0.98/1.49, 639 0.86/1.03/1.23, 645
  0.80/0.96/1.31, 582 0.80/1.00/1.50. The guard does real work on real pieces — six notes
  in 565 and eight in 582 sit at the 1.5 ceiling (a lone line entering at a phrase's peak).
- touch after all this: levels 0.035 / 0.069 / 0.052 / 0.057, spread of bell-over-music
  3.4 → 1.7, every bell filling 60% of a beat. Headroom worst case 0.751 of full scale.

What surprised me:

- **"a phrase said again is played the same way" is false**, and rightly so. BWV 639's
  repeat is not note-for-note identical (an ornament or two), so the thinness rule answers
  differently for ten of the 102 notes that line up, while the arch matches everywhere. A
  rule that reads the notes has to be allowed to hear the difference. That killed the test I
  wanted to write and I wrote the swell test instead.
- Even the *identical* repeat does not give byte-identical shades: the bar grid is stored to
  four decimals, so the same place in the next phrase can differ by 1e-5 of a bar and the
  arch by 1e-4. Chasing that as a bug cost me ten minutes.
- The thinness rule bites hardest where I did not expect it: 582's fugue is a shade *under*
  plain (median 0.987) because twelve notes going is way under the cap of how far a tutti
  may be held back, and its variations sit at 1.042. That is the piece's own shape coming
  out of a rule about how many notes are sounding.
- Three rules, each under 2 dB, and the piece sounds noticeably different. I had expected to
  need bigger numbers.

Next, in order:

1. **Size the bell per moment, not per piece** — PLAN's open item. `src/touch.js` gives one
   bell to a piece; over BWV 565 it now sits about 7 dB under the music on a beat in the
   bare middle and 3 dB under one in the toccata. Session 11 refused this because a bell
   grows exactly where the chord is widest, which is where the headroom is spoken for; that
   argument needs re-making with the shaped weights, where the answer may differ.
2. **The wheel's beat tooth tips a cell white** twice in BWV 582 (225.8 s, 245.8 s) —
   PLAN's other open item, and small. Do it with the light grid at a sixth of a second,
   which is what found it.
3. The shared-drawing debt, still unpaid: `coming`/`sounded`/`bloom`/`ring`/`halo` in six
   places. The light numbers in these notes remain the safety net for that refactor.
4. Small honest debts: `theme.js`'s phase for a periodic figure (session 9, left on
   purpose); `test/screen.mjs` still cannot see `ctx.arc` + `fill`.
