// The picture, measured by numbers. The notes have to be drawn, the screen has
// to stay dark with bright light on it, and nothing may burn out white. Nobody
// can see the screen from here, so this is as close as the checking gets to
// looking at it. The canvas that does the measuring is in screen.mjs; where each
// note's bar of light lands is checked in page.test.mjs.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";
import { brightestFrame, warmestFrame, createStage, notesFor, busiestSecond } from "./screen.mjs";

const root = new URL("..", import.meta.url);

/** What src/pieces.js says the page can play. */
function piecesListed() {
  const source = fs.readFileSync(new URL("src/pieces.js", root), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.Bach.pieces;
}

function coloursFor(piece) {
  const colours = {};
  for (const index in piece.voices) {
    if (Object.prototype.hasOwnProperty.call(piece.voices, index)) colours[index] = piece.voices[index].colour;
  }
  return colours;
}

function rolesFor(piece) {
  const roles = {};
  for (const index in piece.voices) {
    if (Object.prototype.hasOwnProperty.call(piece.voices, index)) roles[index] = piece.voices[index].role || "inner";
  }
  return roles;
}

/** What the picture for a piece is told: its notes, and how the piece is to be worn. */
function sceneFor(piece) {
  const data = JSON.parse(fs.readFileSync(new URL("data/" + piece.slug + ".json", root), "utf8"));
  const look = piece.look || {};
  return {
    slug: piece.slug,
    data: data,
    notes: notesFor(data, rolesFor(piece)),
    look: {
      name: look.name,
      phrase: look.phrase,
      pitchLow: data.pitchRange[0],
      pitchHigh: data.pitchRange[1],
      colours: coloursFor(piece),
      bars: data.bars,
      duration: data.duration,
    },
  };
}

const scenes = piecesListed().map((piece) => ({ piece: piece, scene: sceneFor(piece) }));

// What the screen holds when nothing is played at all: the dark of the page, the
// line of sound, and the slow halo behind it.
const silence = brightestFrame(
  { notes: [], look: { pitchLow: 36, pitchHigh: 92, colours: { 1: "#ffd47a" } } },
  60,
  5
);

for (const { piece, scene } of scenes) {
  const data = scene.data;
  const at = busiestSecond(data);

  test(piece.slug + ": its busiest moment is light on a dark ground", () => {
    const busy = brightestFrame(scene, 60, at);
    assert.ok(
      busy.mean > silence.mean,
      "a crowded second (" + busy.mean.toFixed(3) + ") looks like an empty one (" + silence.mean.toFixed(3) + ")"
    );
    assert.ok(
      busy.peak > silence.peak + 0.05,
      "nothing gets bright around the line of sound, at " + at + " s: peak " + busy.peak.toFixed(3)
    );
    assert.ok(busy.mean < 0.4, "the whole screen is washed out at " + at + " s: mean light " + busy.mean.toFixed(3));
    assert.ok(
      busy.burnt <= busy.cells * 0.03,
      busy.burnt + " cells of the grid are burnt out white, at " + at + " s"
    );
  });

  test(piece.slug + ": no part of it washes out", () => {
    // One look every twelve seconds, all the way through.
    const worst = brightestFrame(scene, Math.ceil(data.duration / 12) + 1, 0.5, 12);
    assert.ok(
      worst.mean < 0.45,
      "the screen is washed out at " + worst.at.toFixed(0) + " s: mean light " + worst.mean.toFixed(3)
    );
    assert.ok(
      worst.burnt <= worst.cells * 0.05,
      worst.burnt + " cells of the grid are burnt out white, at " + worst.at.toFixed(0) + " s"
    );
  });
}

/** The scene of one piece by name, so a test can be about a piece it means. */
function sceneOf(slug) {
  const found = scenes.find((one) => one.piece.slug === slug);
  assert.ok(found, slug + " is not on the card");
  return found.scene;
}

// The screen the measuring canvas pretends to be, and where the woven picture
// puts its line of sound on it.
const WIDTH = 1280;
const LINE_X = Math.round(WIDTH * 0.26);

// BWV 639 wears its own picture: a phrase to a screen, time running sideways.
test("BWV 639: the future is on the screen, and only what was played is lit", () => {
  const scene = sceneOf("bwv639-ich-ruf-zu-dir");
  const stage = createStage(scene);
  stage.frame(30);

  assert.ok(stage.drawn.length > 60, "barely anything is drawn: " + stage.drawn.length + " boxes");
  assert.ok(stage.drawn.length < 900, "one frame draws " + stage.drawn.length + " boxes: that will not keep up");

  // What a note looks like once it has been struck is the strongest thing on the
  // screen, so the strong boxes say where the line of sound is. The wide ones are
  // the background, not a note.
  const lit = stage.drawn.filter((box) => box.alpha > 0.45 && box.w < 200);
  assert.ok(lit.length > 10, "nothing is struck bright on the line of sound");
  assert.ok(
    lit.every((box) => box.x + box.w <= LINE_X + 2),
    "a note is lit before it is played: " + JSON.stringify(lit[0])
  );

  const comingUp = stage.drawn.filter((box) => box.x > LINE_X + 2 && box.w < 200);
  assert.ok(comingUp.length > 10, "nothing is coming: the future is not on the screen");
  assert.ok(
    Math.max.apply(null, comingUp.map((box) => box.x + box.w)) > WIDTH - 12,
    "the music still to come stops short of the edge of the screen"
  );
  assert.ok(
    Math.max.apply(null, comingUp.map((box) => box.alpha)) < 0.45,
    "something coming up is as bright as what is being played"
  );
});

test("BWV 639: a whole phrase of four bars is in front of you at once", () => {
  const scene = sceneOf("bwv639-ich-ruf-zu-dir");
  const bar = scene.data.bars[1] - scene.data.bars[0];
  const stage = createStage(scene);
  const at = scene.data.bars[4]; // the start of the second phrase
  stage.frame(at);
  const drawn = stage.drawn.filter((box) => box.alpha > 0.05 && box.w > 2 && box.h < 20);
  // Four bars of six and a half seconds each, at that speed, is the width of the
  // screen - so the bars coming up, and the one just played, are all here.
  assert.ok(drawn.length > 40, "only " + drawn.length + " notes are on the screen, and a phrase holds about 130");
  const right = Math.max.apply(null, drawn.map((box) => box.x + box.w));
  assert.ok(right > WIDTH - 12, "the screen does not reach a phrase ahead: the farthest note ends at " + right);
  assert.ok(bar > 5, "this piece's bar is " + bar + " s, which is not what the look was made for");
});

test("BWV 639: each of the three lines is drawn as thick as its part in the music", () => {
  // The woven picture gives a line its thickness from what src/pieces.js calls it:
  // the line to follow is the stoutest, an inner voice the thinnest. That only
  // happens if the notes still carry their role when they reach the picture - if
  // they ever lose it every strand is drawn alike and the chorale is just one more
  // line. And a higher note is drawn higher up, so the lines sounding at one
  // moment can be matched to the boxes drawn at that moment by their order.
  const WEIGHTS = { melody: 5.5, pedal: 4.5, inner: 3 };
  const scene = sceneOf("bwv639-ich-ruf-zu-dir");
  const stage = createStage(scene);
  const at = 14; // inside the first phrase, all three voices playing, well apart
  stage.frame(at);

  const sounding = scene.notes.filter((note) => note.time <= at && note.time + note.length >= at);
  assert.strictEqual(sounding.length, 3, "three voices play all through this piece, but not at " + at + " s");
  const pitches = sounding.map((note) => note.pitch).sort((a, b) => a - b);
  for (let i = 1; i < pitches.length; i++) {
    assert.ok(pitches[i] - pitches[i - 1] > 3, "these lines lie too close together here to tell apart");
  }

  const bodies = stage.drawn.filter((box) => Math.abs(box.alpha - 0.46) < 0.001);
  assert.strictEqual(bodies.length, sounding.length, "one bright box per line still sounding, no more");
  const highest = sounding.slice().sort((a, b) => b.pitch - a.pitch); // top of the screen first
  const topmost = bodies.slice().sort((a, b) => a.y - b.y);
  for (let i = 0; i < highest.length; i++) {
    assert.ok(
      Math.abs(topmost[i].h - WEIGHTS[highest[i].role]) < 0.01,
      "the " + highest[i].role + " line on " + highest[i].pitch + " is drawn " + topmost[i].h + " thick"
    );
  }
});

test("BWV 639: the phrase that comes back is warm instead of cool", () => {
  const scene = sceneOf("bwv639-ich-ruf-zu-dir");
  const bar = scene.data.bars[1] - scene.data.bars[0];
  const phrase = 4 * bar;
  const first = warmestFrame(scene, 90, 2);
  const again = warmestFrame(scene, 90, phrase + 2);
  assert.ok(
    again.warm > first.warm + 0.004,
    "the repeat " + phrase.toFixed(0) + " s in is not warmer than the first telling: " + again.warm.toFixed(4) + " against " + first.warm.toFixed(4)
  );
});

// BWV 645 wears the long view: the whole piece receding to a horizon, so that its
// waiting, its arrival and its return can all be seen. These are the numbers that
// stand for looking at it.
const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 800;
const SOUND_Y = Math.round(STAGE_HEIGHT * 0.86); // where a note is struck
const HORIZON_Y = Math.round(STAGE_HEIGHT * 0.17); // where the far music settles
const WARM_LINE = "#ffb066"; // src/look-vigil.js: a bar line already heard

/** How far across the screen a pitch sits, the way the look does it. */
function across(scene, pitch) {
  const margin = Math.min(120, STAGE_WIDTH * 0.12);
  const span = Math.max(1, scene.look.pitchHigh - scene.look.pitchLow);
  return margin + ((pitch - scene.look.pitchLow) / span) * (STAGE_WIDTH - margin * 2);
}

/** The marks the notes make. These are the only things on the screen drawn in a
 *  voice's own colour: bar lines and pitch marks are cool blue, a repeat's line is
 *  warm, and the blooms are gradients. */
function marks(stage, scene) {
  const worn = [];
  for (const voice in scene.look.colours) worn.push(scene.look.colours[voice]);
  return stage.drawn.filter((box) => worn.indexOf(box.colour) >= 0 && box.w < 40);
}

test("BWV 645: the whole piece is on the screen at once", () => {
  const scene = sceneOf("bwv645-wachet-auf");
  const stage = createStage(scene);
  stage.frame(20);

  const drawn = marks(stage, scene);
  assert.ok(
    drawn.length > scene.notes.length * 0.8,
    "only " + drawn.length + " marks for " + scene.notes.length + " notes: the piece is not all on the screen"
  );
  const top = Math.min.apply(null, drawn.map((box) => box.y));
  assert.ok(
    top >= HORIZON_Y - 10 && top <= HORIZON_Y + 14,
    "the far end of the piece is drawn at " + top.toFixed(1) + " px, not up at the horizon (" + HORIZON_Y + ")"
  );
});

test("BWV 645: what has sounded is lit and what is still coming is faint", () => {
  const scene = sceneOf("bwv645-wachet-auf");
  const stage = createStage(scene);
  stage.frame(66); // three voices away from the finish, as crowded as it gets

  const lit = stage.drawn.filter((box) => box.alpha > 0.55 && box.w < 400);
  assert.ok(lit.length > 3, "nothing is struck bright at the line of sound");
  const early = lit.filter((box) => box.y < SOUND_Y - 0.01);
  assert.strictEqual(
    early.length,
    0,
    "a note was drawn lit above the line of sound, where it has not been played yet: " + JSON.stringify(early[0])
  );

  const comingUp = marks(stage, scene).filter((box) => box.y + box.h < SOUND_Y);
  assert.ok(comingUp.length > 100, "almost nothing is still to come: " + comingUp.length);
  assert.ok(
    Math.max.apply(null, comingUp.map((box) => box.alpha)) < 0.55,
    "something still to come is as bright as what has been played"
  );
});

test("BWV 645: the ritornello coming back is warm, and warm while it is still to come", () => {
  const scene = sceneOf("bwv645-wachet-auf");
  const stage = createStage(scene);
  const back = scene.data.bars[23]; // 1:32, where the opening is played again

  // Twenty seconds in: the return is over a minute away and already on the screen.
  stage.frame(20);
  let warm = stage.drawn.filter((box) => box.colour === WARM_LINE);
  assert.strictEqual(warm.length, 2, "the repeat's bar line is not on the screen at all: " + JSON.stringify(warm));
  assert.ok(
    warm.every((box) => box.y + box.h < SOUND_Y),
    "at 0:20 the warm line is not far up the road: " + JSON.stringify(warm)
  );

  stage.frame(back + 0.4);
  warm = stage.drawn.filter((box) => box.colour === WARM_LINE);
  assert.ok(
    warm.some((box) => Math.abs(box.y + box.h / 2 - SOUND_Y) < 40),
    "the warm line never reached the line of sound: " + JSON.stringify(warm)
  );
});

test("BWV 645: the chorale is marked while it is still to come, and blooms when it arrives", () => {
  const scene = sceneOf("bwv645-wachet-auf");
  const stage = createStage(scene);
  const arrival = scene.notes.filter((note) => note.role === "melody")[0]; // it waits until 0:50
  assert.ok(arrival.time > 40, "this test wants a line that really does keep you waiting");
  const x = across(scene, arrival.pitch);

  // Six seconds off: a lamp, small and away up the road, and no bloom yet.
  stage.frame(arrival.time - 6);
  const lamps = stage.drawn.filter(
    (box) => box.w >= 20 && box.w <= 90 && Math.abs(box.x + box.w / 2 - x) < 30
  );
  assert.ok(lamps.length > 0, "nothing marks the chorale while it is still to come");
  const bloomsEarly = stage.drawn.filter(
    (box) => box.w > 120 && box.w < 600 && Math.abs(box.x + box.w / 2 - x) < 30
  );
  assert.strictEqual(bloomsEarly.length, 0, "it bloomed before it arrived");

  stage.frame(arrival.time + 0.1);
  const blooms = stage.drawn.filter(
    (box) =>
      box.w > 120 &&
      box.w < 600 &&
      Math.abs(box.x + box.w / 2 - x) < 30 &&
      Math.abs(box.y + box.h / 2 - SOUND_Y) < 30
  );
  assert.ok(blooms.length > 0, "the arrival of the chorale drew no bloom at the line of sound");
});

test("BWV 645: a frame of the long view is cheap enough to draw sixty times a second", () => {
  const scene = sceneOf("bwv645-wachet-auf");
  const stage = createStage(scene);
  let most = 0;
  for (let at = 0; at < scene.data.duration; at += 5) {
    stage.frame(at);
    if (stage.drawn.length > most) most = stage.drawn.length;
  }
  assert.ok(most > 300, "one frame only draws " + most + " marks: is the picture missing?");
  assert.ok(most < 1500, "one frame draws " + most + " boxes: that will not keep up with the music");
});

// BWV 565 wears the fugue picture. Four things about that piece are what it is
// made of: a subject that comes back eight times in different voices, a toccata
// and an end built of chords struck together, a pedal that stays silent for a
// minute and a half at a time, and a middle so bare that one note sounds at a
// time. These are the numbers that stand for looking at it.

const SUBJECT_LINE = Math.round(STAGE_HEIGHT * 0.78); // src/look-subject.js: SOUND
const SUBJECT_GOLD = "#ffd47a"; // ... and GOLD: the tune, whoever sings it
const STRIKE = "#eef3ff"; // ... and STRIKE: where a whole chord was struck

/** Where across the screen a note's bar is drawn. */
const centre = (box) => box.x + box.w / 2;

/** Is this box a glow of that colour? A note is drawn in flat colour; only a glow
 *  is a gradient that starts from the colour and fades out of it. */
function glowing(box, colour) {
  return box.colour === "(gradient)" && String(box.fill).indexOf(colour) === 0;
}

/** The notes sounding at a moment. */
function soundingAt(scene, at) {
  return scene.notes.filter((note) => note.time <= at && note.time + note.length > at);
}

test("BWV 565: gold marks the tune that comes back, not the voice singing it", () => {
  const scene = sceneOf("bwv565-toccata-and-fugue-d-minor");
  // Gold has to belong to the tune alone, or it would say nothing.
  for (const voice in scene.look.colours) {
    assert.notStrictEqual(
      scene.look.colours[voice],
      SUBJECT_GOLD,
      "a voice wears gold as well, so gold cannot mark the subject"
    );
  }

  const stage = createStage(scene);
  const tune = stage.bach.theme(scene.notes, { bars: scene.look.bars });
  assert.strictEqual(tune.heard.length, 8, "the eight tellings are what this picture is built on");
  const sings = [];
  for (const one of tune.heard) sings.push(...one.notes);

  stage.frame(40); // the toccata, two minutes before the subject is heard
  assert.strictEqual(
    stage.drawn.filter((box) => box.colour === SUBJECT_GOLD).length,
    0,
    "something was gold in the toccata, where the subject has not been heard yet"
  );

  const at = 370; // the left hand has the subject while the other two go on with theirs
  stage.frame(at);
  const sounding = soundingAt(scene, at);
  const withIt = sounding.filter((note) => sings.indexOf(note) >= 0);
  const without = sounding.filter((note) => sings.indexOf(note) < 0);
  assert.ok(withIt.length > 0, "the subject should be sounding at " + at + " s");
  assert.ok(without.length > 0, "and it should be accompanied, or this proves nothing");

  const gold = stage.drawn.filter((box) => box.colour === SUBJECT_GOLD);
  // Only the light that is crossing the line of sound counts, so a subject note
  // still on its way down cannot answer for a chord note on the same pitch, and a
  // note that has not been struck yet cannot be mistaken for one that has.
  const crossing = (list) => list.filter((box) => box.y <= SUBJECT_LINE && box.y + box.h >= SUBJECT_LINE);
  const crossingGold = crossing(gold);
  for (const note of withIt) {
    const x = across(scene, note.pitch);
    assert.ok(
      crossingGold.some((box) => Math.abs(centre(box) - x) < 3),
      "the subject's own note at " + note.pitch + " was not drawn gold"
    );
  }
  for (const note of without) {
    const x = across(scene, note.pitch);
    if (withIt.some((one) => Math.abs(across(scene, one.pitch) - x) < 12)) continue; // too near to tell apart
    assert.ok(
      crossingGold.every((box) => Math.abs(centre(box) - x) > 3),
      "an ordinary accompanying note (" + note.voice + " at " + note.pitch + ") was drawn gold"
    );
  }
});

test("BWV 565: the next telling of the subject can be seen coming, and blooms when it arrives", () => {
  const scene = sceneOf("bwv565-toccata-and-fugue-d-minor");
  const stage = createStage(scene);
  const tune = stage.bach.theme(scene.notes, { bars: scene.look.bars });
  const entry = tune.heard.find((one) => one.time > 200); // the pedal's, at 3:24
  assert.ok(entry.voice === 3, "this test is about the pedal coming in after its long rest");
  const x = across(scene, entry.pitch);

  stage.frame(entry.time - 4);
  const lamps = stage.drawn.filter((box) => glowing(box, SUBJECT_GOLD) && box.w < 120 && Math.abs(centre(box) - x) < 20);
  assert.ok(lamps.length > 0, "nothing marked the subject four seconds before it was struck");
  assert.ok(
    lamps.every((box) => box.y + box.h < SUBJECT_LINE),
    "the lamp is not up above the line of sound, where the music is still to come: " + JSON.stringify(lamps[0])
  );
  assert.strictEqual(
    stage.drawn.filter((box) => glowing(box, SUBJECT_GOLD) && box.w > 150 && Math.abs(box.y + box.h / 2 - SUBJECT_LINE) < 40).length,
    0,
    "the subject bloomed four seconds before it arrived"
  );

  stage.frame(entry.time + 0.1);
  assert.ok(
    stage.drawn.some(
      (box) => glowing(box, SUBJECT_GOLD) && box.w > 150 && Math.abs(centre(box) - x) < 40 && Math.abs(box.y + box.h / 2 - SUBJECT_LINE) < 40
    ),
    "no gold bloom at the line of sound when the subject came in"
  );

  // And it grows as it comes: bigger and stronger one second off than six.
  stage.frame(entry.time - 6);
  const far = stage.drawn.filter((box) => glowing(box, SUBJECT_GOLD) && box.w < 120 && Math.abs(centre(box) - x) < 20);
  stage.frame(entry.time - 1);
  const near = stage.drawn.filter((box) => glowing(box, SUBJECT_GOLD) && box.w < 120 && Math.abs(centre(box) - x) < 20);
  assert.ok(far.length > 0 && near.length > 0, "no lamp to compare");
  assert.ok(
    Math.max.apply(null, near.map((box) => box.w)) > Math.max.apply(null, far.map((box) => box.w)),
    "the lamp is no bigger close up than it was far off: it does not grow"
  );
  assert.ok(
    Math.max.apply(null, near.map((box) => box.alpha)) > Math.max.apply(null, far.map((box) => box.alpha)),
    "the lamp is no brighter close up than it was far off"
  );
});

test("BWV 565: a voice coming back after a long silence blooms in its own colour", () => {
  const scene = sceneOf("bwv565-toccata-and-fugue-d-minor");
  const stage = createStage(scene);
  const back = 226.25; // where the left hand starts again after twenty seconds on its own
  const voice = 2;
  const before = scene.notes.filter((note) => note.voice === voice && note.time + note.length <= back);
  const silent = back - Math.max.apply(null, before.map((note) => note.time + note.length));
  assert.ok(silent >= 10, "this test wants a real absence: the left hand was gone " + silent.toFixed(1) + " s");
  const note = scene.notes.find((one) => one.voice === voice && one.time === back);
  assert.ok(note, "nothing was struck at " + back + " s");
  const worn = scene.look.colours[String(voice)];

  const isBloom = (list) => list.filter((box) => glowing(box, worn) && box.w > 60).length;
  stage.frame(back - 0.5);
  assert.strictEqual(isBloom(stage.drawn), 0, "it bloomed before the voice came back");
  stage.frame(back + 0.2);
  const blooms = stage.drawn.filter((box) => glowing(box, worn) && box.w > 60);
  assert.ok(blooms.length > 0, "the left hand came back after " + silent.toFixed(0) + " s and nothing was made of it");
  assert.ok(
    blooms.some((box) => Math.abs(box.y + box.h / 2 - SUBJECT_LINE) < 40 && Math.abs(centre(box) - across(scene, note.pitch)) < 40),
    "the bloom was not at the line of sound where the voice came in: " + JSON.stringify(blooms[0])
  );

  // A breath inside a phrase is not a homecoming. The right hand stops for a
  // quarter of a second here and starts again: nobody should make a scene about it.
  const breath = 313; // the right hand, gone 1.25 s
  const goneBefore = scene.notes.filter((note) => note.voice === 1 && note.time + note.length <= breath);
  const gone = breath - Math.max.apply(null, goneBefore.map((note) => note.time + note.length));
  assert.ok(gone > 0.5 && gone < 3, "this test wants a short breath, not " + gone);
  const worn1 = scene.look.colours["1"];
  stage.frame(breath + 0.2);
  assert.strictEqual(
    stage.drawn.filter((box) => glowing(box, worn1) && box.w > 60).length,
    0,
    "a voice was made a scene of after only " + gone + " s"
  );
});

test("BWV 565: a chord struck together flares across the screen, and the fugue never strikes one", () => {
  const scene = sceneOf("bwv565-toccata-and-fugue-d-minor");
  const stage = createStage(scene);

  stage.frame(39.1); // the widest moment of the piece: eight notes at once, at 0:39
  const flares = stage.drawn.filter((box) => box.colour === STRIKE && box.w > 200);
  assert.ok(flares.length > 0, "no flare for a chord of eight struck together");
  assert.ok(
    flares.every((box) => Math.abs(box.y + box.h / 2 - SUBJECT_LINE) < 10),
    "the chord's flare is not on the line of sound: " + JSON.stringify(flares[0])
  );

  // In the fugue nothing reaches five notes together, so nothing flares there. That
  // is a fact about the notes, not about the picture, so it is checked as one.
  const fugue = scene.notes.filter((note) => note.time > 130 && note.time < 500);
  let widest = 0;
  for (const note of fugue) {
    const together = fugue.filter((one) => Math.abs(one.time - note.time) < 0.02).length;
    if (together > widest) widest = together;
  }
  assert.ok(widest < 5, "the fugue does strike chords of " + widest + ", so the flare would not mean the toccata");
  // The fugue's accompaniment strikes four notes together on almost every beat
  // here, so this is where a flare would be wrongly painted if the picture asked
  // for fewer than five notes together.
  for (let at = 206; at < 214; at += 0.25) {
    stage.frame(at);
    assert.strictEqual(
      stage.drawn.filter((box) => box.colour === STRIKE).length,
      0,
      "a chord flared in the fugue, at " + at.toFixed(2) + " s: the flare would say nothing there"
    );
  }
  stage.frame(300);
  assert.strictEqual(stage.drawn.filter((box) => box.colour === STRIKE).length, 0, "a chord flared in the bare middle");
});

test("BWV 565: where one note sounds alone it is drawn as if it were the whole piece", () => {
  const scene = sceneOf("bwv565-toccata-and-fugue-d-minor");
  const stage = createStage(scene);

  // A moment in the bare middle with one melody note sounding alone - struck a
  // moment ago, and not at the very second another lets go, since the picture
  // lights a note until it has let go.
  const litAt = (at) => scene.notes.filter((note) => note.time < at && note.time + note.length > at);
  const lettingGoAt = (at) => scene.notes.filter((note) => Math.abs(note.time + note.length - at) < 1e-6).length;
  let alone = 0;
  for (let step = 0; step < 2000 && alone === 0; step++) {
    const at = 240 + step * 0.05;
    const sounding = litAt(at);
    if (sounding.length === 1 && sounding[0].role === "melody" && lettingGoAt(at) === 0) alone = at;
  }
  assert.ok(alone > 0, "no moment in the middle with one melody note sounding on its own");
  const busy = busiestSecond(scene.data);
  assert.ok(soundingAt(scene, busy).length >= 8, "the fullest second at " + busy + " s is not crowded");

  const quiet = stage.frame(alone);
  const bodiesAlone = stage.drawn.filter((box) => Math.abs(box.alpha - 0.45) < 0.001);
  assert.strictEqual(bodiesAlone.length, 1, "one note sounds, so one body should be lit: " + bodiesAlone.length);
  // A tenth of a second after the fullest second: a note has to have been struck
  // for a moment before it is a bar of light at all.
  const loud = stage.frame(busy + 0.1);
  const bodiesCrowded = stage.drawn.filter((box) => Math.abs(box.alpha - 0.45) < 0.001);
  assert.ok(bodiesCrowded.length > 6, "at " + busy + " s only " + bodiesCrowded.length + " notes are lit");

  assert.ok(
    quiet.mean < loud.mean,
    "the bare moment (" + quiet.mean.toFixed(4) + ") is no darker than the crowded one (" + loud.mean.toFixed(4) + ")"
  );
  assert.ok(
    Math.max.apply(null, bodiesAlone.map((box) => box.w)) > Math.max.apply(null, bodiesCrowded.map((box) => box.w)),
    "a note on its own is drawn no stouter than a note in a crowd"
  );
});

test("BWV 565: a frame of the fugue picture is cheap enough to keep up", () => {
  const scene = sceneOf("bwv565-toccata-and-fugue-d-minor");
  const stage = createStage(scene);
  let most = 0;
  for (let at = 0; at < scene.data.duration; at += 2) {
    stage.frame(at);
    if (stage.drawn.length > most) most = stage.drawn.length;
  }
  assert.ok(most > 100, "one frame draws only " + most + " marks: is the picture missing?");
  assert.ok(most < 800, "one frame draws " + most + " boxes: that will not keep up with the music");
});
