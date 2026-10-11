# Releases

## 0.4.2 — 2026-10-11

The bell you strike now fits the moment it rings in, not only the piece.

- **One bell per piece was still the coarsest thing left in the sound.** Sized for a whole
  piece, it rang 10 dB *louder* than the music over the Passacaglia's opening pedal solo -
  where one low line is barely speaking - and rang at full size in the silences between
  sections of the Toccata.
- **Every beat now gets its own share of the piece's bell**, by how much is sounding under
  it: a beat half as full as the piece runs at its middle rings a bell at 0.59 of it, and a
  beat in a silence rings the least bell the piece allows. The fullest beats still ring the
  whole of the piece's bell, and no beat rings more than that: a piece's loudest moment is
  precisely where there is no room left for a bigger bell, and the organ sets its own volume
  by that loudest chord.
- **Measured, over every beat of the four pieces:** the spread of how far the bell sits under
  its own music came down from 9.3 dB to 5.4 dB in the Toccata, 4.2 to 3.0 in the
  Passacaglia, and 4.7 to 3.8 in BWV 645, and the beats where the bell rang louder than
  everything sounding went from 95 to 14 in all - the Toccata's 66 are all gone. The share
  the rule uses (0.75) is measured too: the organ's loudness at a beat rises as the
  three-quarters power of how much is sounding there, fitted over the 1,729 beats of the
  four pieces where anything sounds. `node tools/touch.mjs` prints the lot.
- BWV 639 is as it was, which is right: a chorale with four voices going on every beat has no
  thin moments to fix.

## 0.4.1 — 2026-10-11

One pixel of the Passacaglia stopped burning out white when you strike a beat.

- **The wheel of BWV 582 had a record of where it had already laid light, and its beat
  teeth were not consulting it.** A tooth is three pixels of light just inside the rim,
  which is exactly where this keyboard arrangement strikes its top notes, and a whole light
  laid on a spot that is already shining is one burnt-out pixel. Two frames in twelve
  minutes did that (225.8 s and 245.8 s). A tooth now steps aside where the music is
  already shining there - a tick on a note's own flare is white on white anyway - and the
  beat is still told by the ring of light round it and the part of the tooth standing on
  ground of its own. Nothing anywhere in the piece goes over now.
- **The record covers the ground a light falls on, not just its middle.** Two marks four
  pixels apart are one light to the eye; the old record compared middles, so a tooth three
  pixels outside a note's core was taken for standing in the dark.
- **The measuring went from one second to a sixth of one.** The frames where a struck beat
  and a struck note land together last hundredths of a second, and a coarse grid walks
  straight past them - this burn sat under a twice-a-second check for three sessions. The
  Passacaglia is now walked beat by beat with every beat struck, and none of the four
  pieces' pictures goes over white on the player's account.

## 0.4.0 — 2026-10-11

The organ breathes now. Every piece is shaped phrase by phrase, thin moments are played
fuller than full ones, and a line is brought out when it comes back.

- **The music was flat, and it was not our fault.** These editions carry no dynamics at
  all: every key of the Passacaglia was struck at 127, every key of the Toccata at 90, so
  until now the organ played a whole chorale at one level from first note to last. The
  shaping is read out of the notes instead, and nothing about it is typed in per piece.
- **A phrase is an arch.** It begins held back, grows to two thirds along, and settles a
  little at its cadence - about 2 dB of swell, over four bars in three of these pieces and
  over the eight bars of one turn of the Passacaglia's ground. This is what a phrase sounds
  like when a person plays it and not a player piano.
- **A thin moment is played fuller than a full one.** In the bare middle of the Toccata's
  fugue exactly one note sounds at a time for a minute and a half, and the organ - which
  sets its whole volume by the loudest chord in the piece - was playing it as if nine were
  going. Now a single line comes up about 2 dB and a crowded ending is held back,
  against how many notes *this* piece usually has going.
- **A line taken up again is brought out**, most on the note that starts it and easing off
  over the second after: the pedal of the Toccata coming back after waiting a hundred and
  fifteen seconds, the chorale of "Wachet auf" coming home after twenty-nine seconds of
  waiting for it. A whole ensemble arriving together out of a silence is not an entry -
  that is a chord, and the Toccata is nothing but those.
- **Nothing got louder.** The organ weighs its loudest chord after the shaping, so the
  top of a piece still lands exactly on the ceiling it sets itself; what changed is
  everything underneath it. Measured, the shaping swings a phrase 1.1 to 1.4 dB above its
  own opening, narrows the gap between the thinnest and fullest bars by half a dB, and
  touches 330 of the Toccata's 3651 notes with an entry. `node tools/dynamics.mjs` prints
  all of it, bar by bar, with and without.
- **Found on the way:** the measuring harness had been counting how hard a key was struck
  twice over, so every rendered peak was reading 6 to 23 per cent too high. Fixed; the
  numbers quoted from now on are the ones the instrument really reaches.

## 0.3.5 — 2026-10-11

"Ich ruf zu dir" keeps its own beat now: a ruler of ticks along the top and the bottom
of the music, and the repeat you can see coming a whole screen away.

- **The woven picture took the pulse.** Until now the game laid its ladder of falling
  beats across the middle of this picture - two beats tall, straight down, over a piece
  whose time runs sideways through a phrase of twenty-six seconds. The braid has its own
  place for a beat: one tick per beat along the top of the music and along the bottom of
  it, the two places a note is never drawn, walking into the line of sound at the pace the
  music itself goes. A bar's opening stands taller than the three beats inside it, so the
  four of them read as one bar.
- **What the ruler shows that the ladder could not.** Twelve beats are on the screen at a
  time instead of two, so the slowing down at the end of the piece is something you can
  see arriving and slow down with. And the one beat worth more than the others here - the
  opening phrase said again at 0:26 - stands lit and taller a whole phrase off, while it
  is still a screen away.
- **What striking one does.** A ring of light contracting round the line of sound at both
  edges of the music, and a bell in the harmony as before. A caught beat leaves the ruler,
  so you can see where you were. A long run lights the ruler and the line of sound it is
  crossed by.
- **One piece keeps the ladder on purpose**: the Toccata and Fugue, BWV 565. Its notes
  fall, and a ladder of falling beats is the same shape over the same few seconds.
- **Measured, since nobody here can see it.** The ruler costs about a quarter of the light
  the ladder did, and nothing in the piece burns out white on its account - which needed
  fixing: a struck beat lands where a note has just struck and is already blazing, so its
  light is a ring with an empty middle now, the same device the Passacaglia's wheel uses.

## 0.3.4 — 2026-10-11

"Wachet auf" now keeps its own beat: lamps down the sides of the road, and you can
see the chorale coming a minute off.

- **The road took the pulse.** Until now the game laid its ladder of falling beats on
  top of this picture - two beats tall, in the middle of the screen, over a road that
  shows the whole piece at once. The road has its own place for a beat: every beat of
  the piece is now a lamp on each of its two verges, standing at the height that beat
  has reached on the climb. Near at hand there is one to a beat; further off, one to a
  bar, since past a few beats the beats themselves are a few pixels apart.
- **What the road shows that the ladder could not.** Four beats in this piece are worth
  more than the rest - the opening ritornello at 0:16 and 1:32, and the line to follow
  come home at 2:03 and 2:53 - and they can stand a *minute* ahead of you. A
  ladder two beats tall cannot show a minute; this picture can, and they are lit, bigger
  and brighter than an ordinary bar, while they are still far up the road.
- **What striking one does.** Light laid across the line of sound at both verges, and a
  bell in the harmony as before. A long run lights the edges of the road itself. A click
  with no beat near it is a dull flick at either hand. Nothing slides down the verges:
  what has been struck has arrived.
- The colours say what they always said - gold is the chorale, warm is a repeat - so the
  pulse is a cold white and says nothing else. The line under the piece on the card now
  tells you the lamps are the beat.
- **Measured, since nobody here can see or hear:** the heaviest frame of the piece went
  from 1128 marks to 1290 (of a budget of 1500), and its worst mean light *fell*, from
  0.0470 with the ladder to 0.0451 with the lamps; nothing burns out that did not burn
  out before. Tests: 248, from 241, and ten new ways to break the lamps, every one of
  which a test now notices - which is how I found that the crowding rule I meant to write
  would never have fired, and left it out.

## 0.3.3 — 2026-10-11

BWV 645's beat was half a beat early. Now it lands where the music does.

- **The bug.** "Wachet auf" opens with a single eighth note before its first whole
  bar - a pickup. A MIDI file cannot say such a thing: it writes a metre and counts
  ticks, and the bar lines were drawn by arithmetic from the first tick. So every
  bar line in that piece sat half a second too early, and for three and a half
  minutes the player was asked to strike half a second before the music got there.
- **How the file tells us now.** These editions end exactly on a bar line, so
  whatever the last bar is short by is what the piece was short at the start. The
  chord that ends "Wachet auf" holds four seconds to the very end - a whole bar -
  so its first bar line sits at 0.5 s and its 56 bars became 55 whole ones.
- **What that buys in the game.** BWV 645 has four gold beats where it had none:
  the opening ritornello told twice (0:16 and 1:32) and the chorale coming home
  twice (2:03 and 2:53). All four used to sit past the nearest beat a strike is
  judged against, which is why nothing on its ladder was ever gold.
- The other three pieces kept the bar lines they had. The rule is read off the end of
  a piece, and the two that slow to a stop at the end do not look like a pickup at
  all - BWV 582's last bar is shorter than its stretched one before it, and that is
  the slowing, not a missing bar.
- **Measured, since nobody here can see or hear:** the share of a piece's own
  note-length that is struck exactly on a beat went from 26% to 64% for BWV 645; the
  other three sit at 48, 49 and 56%, which is what a bar of four with eighths in it
  looks like. The long view of the piece measures as it always did (fullest second
  0.0427 mean light, nothing new burnt out), and its bells are the same size. Tests:
  241, from 230, and four new ways to break the bar rule, every one of which a test
  now notices.

## 0.3.2 — 2026-10-11

The Passacaglia's wheel takes its pulse into its own world: no ladder over it.

- **BWV 582 marks its beats on its own rim.** A tooth per beat, just inside the marks
  that count the turns, at the bearing that beat falls on within the turn - and since
  the hand *is* the line of sound and goes once round a turn, the hand crossing a
  tooth is the same event as the beat arriving. Eight bars of 3/4 to a turn means
  twenty-four teeth, three to a bar, so the metre is written on the wheel.
- **Striking is what lights it.** A caught beat lays a ring of light round the bearing
  its tooth stood at; a long run brightens the whole rim. A click with no beat near it
  is a dull mark where the hand has got to. A beat the music is marking - a fresh
  telling of the ground - is drawn in a whiter light, and nothing on the wheel is ever
  gold but the ground itself. When the ground stops and the wheel unwinds for the
  fugue, the teeth go back on the rack with everything else that was ahead.
- **A picture is now asked whether it wants the pulse.** `src/visual.js` asks the look,
  `src/main.js` hands it over, and `src/game.js` keeps all the judging and hands the
  picture a plain shot of the frame instead: the beats, which are still in play, how
  long the run is, and what the player struck and on which beat. The other three
  pieces say no and keep the ladder - notes falling (BWV 565), a phrase laid sideways
  (BWV 639), a road receding to a horizon (BWV 645) are all straight timelines
  already, and a ladder belongs on one.
- **Measured, since nobody can see:** the wheel's heaviest frame goes from 668 marks
  to 720 with the pulse on, against a budget of 1500; the brightest second of the
  whole twelve minutes goes from mean light 0.0340 to 0.0348; and striking every
  beat all the way through burns out no cell at all, same as before.
- **The test canvases now refuse nonsense**: a box or a glow drawn with a number that
  is not one is invisible rather than wrong, and that is how a device gets lost without
  any test noticing. Both the page's stand-in canvas and the measuring canvas now say
  so. 230 tests pass, and `tools/mutate.sh` can break the wheel's pulse thirteen ways.

## 0.3.1 — 2026-10-11

The bell you strike when you play along is now the piece's own, instead of one
bell for all four pieces.

- **Measured first.** Struck over the beats themselves, the one fixed bell sat
  anywhere between a third of the music and nine tenths of it: hardly heard under
  BWV 639's chorale, and as loud as the tune over a single note of BWV 565's fugue.
  `node tools/touch.mjs` prints the whole of that, piece by piece.
- **Each piece sizes its bell** from two things that are already in it: how full the
  music is where the bells land - so the slow chorale's bell is nearly twice the
  size of the toccata's - and how long a beat is, so BWV 639's bell hangs 1.95 s,
  right across its bar, while BWV 582's is gone within a second and leaves the
  fugue clear. The spread between the four went from 3.1 to 1.7: they now sit within
  about 5 dB of each other, where they were 10 dB apart.
- **No two bells are audible at once**, in any piece. What an ear keeps hearing of a
  bell is about half its decay, and a decay is 1.2 beats, so a run of taps stays a
  run of taps instead of turning into a wash.
- **Nothing got louder than the room allows**: each piece's widest chord with the
  heaviest bell of its own size on top still stays under where the limiter starts
  (0.35 to 0.47 against 0.708), so the bigger bell on the slow chorale costs nothing.
- New in the code: `src/touch.js`, the rule; `organ.chime(pitch, when, how hard,
  touch)`, so the bell takes its size with it; and `tools/touch.mjs`, which measures
  one fixed bell against one per piece and shows why the tidier rule - a bell always
  at the same share of its music - was refused. 219 tests pass, and `tools/mutate.sh`
  has eleven new things it can break to prove they are watching.

## 0.3.0 — 2026-10-11

There is something to do now: play along with the pulse of the piece. Just
watching is still there, one button away.

- **Play along.** Click anywhere on the picture, or press Enter, in time with the
  piece's pulse. Every beat of the piece is a chance and you take the ones you
  like. The beats come from the piece's own bar lines and its metre, so nobody
  typed in a tempo: BWV 639 asks for 37 a minute and BWV 582 for seventy-two, and
  where the Passacaglia slows down five times before it ends the beats slow too,
  so a run there means slowing down with the organ.
- **A catch rings a bell.** Its note is the lowest note sounding at that moment,
  two octaves up, so whatever you strike is a note of the harmony that is actually
  being played, and a run of them shimmers over the organ and picks out the
  chords. The organ plays every note of the piece either way: nothing in the music
  depends on you, which is the whole point of a tribute.
- **Some beats are worth more.** One that the music itself is marking - the tune
  coming back, a line taken up again after ten seconds gone, five notes struck
  together - is gold on the ladder and rings for more.
- **A run** is beats caught one after another. Letting a beat go ends it, and so
  does a click with no beat near it, which is what stops drumming on the mouse.
  Nothing fails and nothing stops. When the piece ends it says how many of the
  beats you were there for, your longest run, and how many were struck true.
- **What it draws** is one thing: a short ladder of bars low in the middle of the
  screen, the next couple of beats arriving on a line that grows wider and brighter
  as the run grows. The piece's own picture is untouched. "Play along" beside
  Pause, or the `P` key, switches it on and off at any moment, and the count
  starts afresh either way.
- The bell is small by numbers: the loudest chord of any piece, with the heaviest
  bell anyone can ask for struck on top of it, still stays under where the limiter
  starts - 0.49 against 0.708 in `node tools/loudness.mjs`.
- New in the code: `src/pulse.js` for the beat grid, `src/landmarks.js` for the
  moments worth marking (the fugue picture had private copies of two of those
  finders, now shared), `organ.chime` for a struck bell sounding through the same
  room as the pipes, and `src/game.js`. `src/theme.js` now answers the same
  question about the same notes once, since a picture and the game both ask it.
- 206 tests pass, and `tools/mutate.sh` breaks each new rule in turn - a caught
  beat that is not marked, a beat let go that does not end the run, a beat grid
  that ignores the metre - and insists a test notices every one.

## 0.2.4 — 2026-10-11

BWV 582 is a wheel now. That is the last of the four pieces wearing a picture of
its own.

- **The Passacaglia and Fugue no longer falls; it turns.** Its first seven minutes
  are one 15-note ground bass in the pedal, said again every eight bars while
  everything above it is written new, so time goes round: one turn of the wheel is
  one telling of the ground, and the ground is traced in the same place every time
  it is played. How long a turn is was not typed in - the page measures it from the
  gaps between the tellings it hears, which say eight bars.
- **Gold is the ground bass**, and no voice wears it: the right hand is blue now,
  the left hand green. The wheel is high-pitched outwards and low-pitched near the
  middle, so the pedal's ground sits in the middle of the shape it keeps returning
  to.
- **A hand goes once round a turn** and is the line of sound: what it has passed is
  lit, and the whole turn ahead is there as a faint shape, so you see the variation
  coming before you hear it.
- **The rim keeps count.** One mark per turn taken, gold for the twenty turns that
  carried the ground and cool for the ones since, so the rim says both how far into
  twelve minutes you are and where the ground stopped.
- **Then the ground stops.** The wheel unwinds over ten seconds, the fugue's first
  note flashes, and the last five minutes are a hand sweeping a dark disc with a
  few seconds of light on it - because with no ground there is nothing ahead of you
  to see. A voice coming back after ten seconds gone still blooms in its own colour.
- Nothing burns out white anywhere in this piece now; the falling picture used to.
- The measuring canvas had been reading every round glow in the wrong place (it took
  the wrong number for the middle of the circle), so glows away from the top-left
  corner counted as invisible. Fixed: the numbers for all four pieces moved a
  little, and the pictures themselves did not.

## 0.2.3 — 2026-10-11

BWV 565 gets a picture of its own, and in it the fugue subject is gold.

- **The page now finds the tune a piece keeps coming back to, by itself.** It writes
  each line down as the steps between its notes, so a tune counts as itself at any
  pitch, and looks for the figure that comes back most often. In BWV 565 that is the
  32-note fugue subject, and it is heard eight times: 1:58, 2:06, 2:34, 3:24, 5:42,
  6:08, 6:58 and 7:14. The same finder hears the ground bass of BWV 582 (15 notes,
  13 times, always in the pedal) and the two tellings of the repeats in the two
  chorale pieces, so the next pictures can be built on it.
- **The Toccata and Fugue is no longer drawn as falling notes.** Every note of the
  subject is gold, whoever is playing it — left hand, right hand, pedal — because
  in this piece it is the tune that is followed and not one pair of hands. A lamp
  grows where the next telling is going to land, while it is still above the line of
  sound, and it blooms when it is struck.
- **A chord flares across the screen.** Where five notes or more are struck together
  a hot line is drawn over all the ground the chord covers. That is the toccata and
  the last two minutes; nothing in the fugue reaches five at once, so the flares
  mark the chordal worlds and nothing else.
- **A voice coming back after a long silence is a scene.** The pedal stops for 86
  seconds, then 115, then 49, and each time it returns it blooms in its own colour.
  A breath of a second inside a phrase is still nothing.
- **The picture breathes with the music.** Where eleven bars have one note sounding
  at a time the trails stretch and that note is drawn a third bigger; where the
  whole organ is going the trails are short and the notes thin.
- The other three pieces look exactly as they did. BWV 582 still wears the falling
  picture — that comes next.

## 0.2.2 — 2026-10-11

One line about the chorale's arrivals in BWV 645.

- **The gold line now blooms three times, not six.** A bloom marked every time the
  chorale came back after four seconds of silence, which counted breaths taken
  inside a phrase as well. Now it has to have been gone ten seconds or more, so the
  blooms are exactly where the chorale really leaves and comes back: 0:50, when it
  first arrives after waiting 50 seconds, 2:03 after half a minute gone, and 2:53
  after 23 seconds.

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
