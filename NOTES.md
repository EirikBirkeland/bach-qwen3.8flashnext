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
