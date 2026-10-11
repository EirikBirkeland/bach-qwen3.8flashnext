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

- [ ] A small tool of your own that turns a MIDI file into plain note data (JSON): for each note its voice or
      track, pitch, start and length in seconds. Convert BWV 565 first. Commit the JSON.
- [ ] `index.html` with a start button (browsers only allow sound after a click) that plays BWV 565 from the
      note data with a simple organ-like voice.
- [ ] One simple visual driven by the notes while it plays, for example a light per note, placed by pitch and
      coloured by voice.
- [ ] Release `0.0.1`.

### Milestone 1: all four pieces, played properly

- [ ] Convert the other three pieces. A test that every converted piece matches its MIDI file note for note.
- [ ] A way to choose the piece.
- [ ] Timing that follows the tempo changes in the MIDI file.
- [ ] A better organ: several pipes per note, so it sounds full and not like a beep. Check the loudness by numbers
      so chords do not distort.
- [ ] Pause, restart, and a way to move to any point in the piece.

### Milestone 2: a visual world for each piece

- [ ] Study each piece as data and write down its shape in `NOTES.md`: its sections, its voices, where the theme
      enters, where it is busiest and where it rests.
- [ ] Design a different look for each piece that grows out of that shape. One piece per session.

### Milestone 3: something to do

- [ ] Something for a player to do in time with the music, in the spirit of Rez, with a "just watch" mode beside it.
      Decide what, write the design here first, then build it.

### After that

Yours to plan. Add milestones here as you learn what works. The owner may add more pieces to `music/`.
