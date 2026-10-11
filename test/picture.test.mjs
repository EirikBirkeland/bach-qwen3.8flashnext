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
    // One look every two seconds, all the way through: a picture can burn out in a
    // part of the piece nobody thought to look at.
    const worst = brightestFrame(scene, Math.ceil(data.duration / 2) + 1, 0.5, 2);
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

// BWV 582 wears the wheel: time goes round instead of down, one turn to one
// telling of the ground bass, so that the repetition which *is* the piece can be
// seen, and so that the seven minutes where the ground is said and the five where
// it has stopped being said look different from one another. These are the numbers
// that stand for looking at it.

const WHEEL = { rim: 0.42, hub: 0.055, bend: 0.85, top: -0.25 }; // src/look-round.js
const WHEEL_GOLD = "#ffd47a"; // ... and GOLD: the ground bass, and nothing else
const WHEEL_COOL = "#bcd0f0"; // ... and COOL: the wheel's own light, and the fugue's first note
const CENTRE = { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 };
const WHEEL_OUTER = Math.min(STAGE_WIDTH, STAGE_HEIGHT) * WHEEL.rim;

/** Which bar of the piece a second falls on, counting into the bar. */
function barAt(bars, seconds) {
  let low = 0;
  let high = bars.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (bars[middle] <= seconds) low = middle;
    else high = middle - 1;
  }
  if (low >= bars.length - 1) return low + (seconds - bars[low]) / (bars[low] - bars[low - 1]);
  return low + (seconds - bars[low]) / (bars[low + 1] - bars[low]);
}

/** How far the middle of a drawn box is out from the middle of the wheel, and at
 *  what angle round it. */
function polar(box) {
  const x = box.x + box.w / 2;
  const y = box.y + box.h / 2;
  return {
    radius: Math.hypot(x - CENTRE.x, y - CENTRE.y),
    degrees: ((Math.atan2(y - CENTRE.y, x - CENTRE.x) * 180) / Math.PI + 450) % 360,
  };
}

/** Where the wheel draws one pitch at one moment: the look's own two lines of
 *  geometry, here so that a test can say where a thing belongs and so prove it was
 *  drawn there at all. */
function wheelAt(scene, anchor, barsPerTurn, pitch, seconds) {
  const turn = (barAt(scene.look.bars, seconds) - anchor) / barsPerTurn;
  const angle = (turn - Math.floor(turn) + WHEEL.top) * Math.PI * 2;
  const span = Math.min(STAGE_WIDTH, STAGE_HEIGHT);
  const inner = span * WHEEL.hub;
  const share = Math.max(
    0,
    Math.min(1, (pitch - scene.look.pitchLow) / (scene.look.pitchHigh - scene.look.pitchLow))
  );
  const radius = inner + (WHEEL_OUTER - inner) * Math.pow(share, WHEEL.bend);
  return {
    x: CENTRE.x + Math.cos(angle) * radius,
    y: CENTRE.y + Math.sin(angle) * radius,
    radius: radius,
    angle: angle,
  };
}

/** What the wheel calls the ground: the tune, its turn in bars, and where a turn
 *  starts. All of it the look works out for itself; a test needs it to ask where. */
function groundOf(stage, scene) {
  const tune = stage.bach.theme(scene.notes, { bars: scene.look.bars });
  const apart = [];
  for (let i = 1; i < tune.heard.length; i++) {
    apart.push(barAt(scene.look.bars, tune.heard[i].time) - barAt(scene.look.bars, tune.heard[i - 1].time));
  }
  apart.sort((a, b) => a - b);
  const barsPerTurn = Math.max(2, Math.round(apart[Math.floor(apart.length / 2)]));
  const notes = [];
  for (const telling of tune.heard) notes.push(...telling.notes);
  return {
    tune: tune,
    notes: notes,
    barsPerTurn: barsPerTurn,
    anchor: barAt(scene.look.bars, tune.heard[0].time),
    turns: Math.ceil((barAt(scene.look.bars, tune.heard[tune.heard.length - 1].until) - barAt(scene.look.bars, tune.heard[0].time)) / barsPerTurn),
  };
}

/** The notes' own lights: flat squares of a voice's colour, inside the rim. The
 *  clock face, the rim and the hand are all outside it or cool, so they are left
 *  out of what is counted as a note. */
function lights(stage, scene) {
  const worn = Object.keys(scene.look.colours).map((key) => scene.look.colours[key]);
  return stage.drawn.filter((box) => {
    const isNote = box.colour === WHEEL_GOLD || worn.indexOf(box.colour) >= 0;
    return isNote && box.w >= 3 && box.w <= 14 && polar(box).radius <= WHEEL_OUTER - 2;
  });
}

/** The gold ones among them. */
function goldLights(stage, scene) {
  return lights(stage, scene).filter((box) => box.colour === WHEEL_GOLD);
}

test("BWV 582: the wheel turns once to a telling of the ground, and the ground is in the same place each turn", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  const ground = groundOf(stage, scene);

  assert.strictEqual(ground.barsPerTurn, 8, "the tellings of the ground are not eight bars apart");
  assert.strictEqual(ground.tune.heard.length, 13, "the ground is heard thirteen times, and the wheel is built on that");
  assert.strictEqual(scene.look.phrase, ground.barsPerTurn, "the piece does not ask for the turn the music says");

  // Two turns of the wheel apart, the ground has been said again: its lights have
  // to come back to exactly the same places, or the wheel is not telling anyone
  // anything about the repetition.
  const at = 62;
  stage.frame(at);
  const one = goldLights(stage, scene).map((box) => polar(box));
  stage.frame(at + ground.barsPerTurn * (scene.data.bars[1] - scene.data.bars[0]));
  const twice = goldLights(stage, scene).map((box) => polar(box));
  assert.ok(one.length > 6 && twice.length > 6, "barely any ground is lit at " + at + " s: " + one.length + " and " + twice.length);
  const matched = one.filter((place) =>
    twice.some((other) => Math.abs(other.radius - place.radius) < 2 && Math.abs(other.degrees - place.degrees) < 1)
  ).length;
  assert.ok(matched >= one.length - 1, "the ground's lights came back to " + matched + " of " + one.length + " places, not all of them");
});

test("BWV 582: gold is the ground bass, and no other note is gold", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  for (const voice in scene.look.colours) {
    assert.notStrictEqual(scene.look.colours[voice], WHEEL_GOLD, "a voice wears gold too, so gold cannot be the ground");
  }
  const stage = createStage(scene);
  const ground = groundOf(stage, scene);

  const at = 66; // the ground is being said, and the manuals are busy above it
  stage.frame(at);
  const sounding = soundingAt(scene, at);
  // The ground is one line, one note at a time, so "what it is saying" is what it
  // has struck in the last couple of seconds and not yet let go of.
  const singing = ground.notes.filter((note) => note.time <= at && note.time + note.length + 2 > at);
  const company = sounding.filter((note) => ground.notes.indexOf(note) < 0);
  assert.ok(singing.length >= 2, "the ground should have struck notes at " + at + " s, and has " + singing.length + "");
  assert.ok(company.length >= 2, "and it should have company, or this proves something");

  const gold = goldLights(stage, scene).map((box) => polar(box));
  for (const note of singing) {
    const place = wheelAt(scene, ground.anchor, ground.barsPerTurn, note.pitch, note.time);
    const here = { radius: place.radius, degrees: polar({ x: place.x, y: place.y, w: 0, h: 0 }).degrees };
    assert.ok(
      gold.some((box) => Math.abs(box.radius - here.radius) < 3 && Math.abs(box.degrees - here.degrees) < 1.2),
      "the ground's own note at " + note.pitch + " was not gold"
    );
  }
  for (const note of company) {
    const place = wheelAt(scene, ground.anchor, ground.barsPerTurn, note.pitch, note.time);
    // A note the ground is also playing, at the same moment and pitch, would be
    // drawn on top of it: that is the ground being doubled, not a mistake.
    const doubled = singing.some((one) => {
      const other = wheelAt(scene, ground.anchor, ground.barsPerTurn, one.pitch, one.time);
      return Math.hypot(other.x - place.x, other.y - place.y) < 8;
    });
    if (doubled) continue;
    assert.ok(
      gold.every((box) => Math.abs(box.radius - place.radius) > 3 || Math.abs(box.degrees - place.degrees) > 1.2),
      "an ordinary note (" + note.voice + " at " + note.pitch + ") was drawn gold"
    );
  }
});

test("BWV 582: a note is drawn where its pitch and its moment put it", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  const ground = groundOf(stage, scene);
  const at = 214; // four voices going, well inside a turn
  stage.frame(at);
  const sounding = soundingAt(scene, at).filter((note) => note.time + 0.05 < at);
  assert.ok(sounding.length >= 4, "this moment should have four lines sounding, and has " + sounding.length);
  const lit = lights(stage, scene).map((box) => polar(box));
  for (const note of sounding) {
    const place = wheelAt(scene, ground.anchor, ground.barsPerTurn, note.pitch, note.time);
    const degrees = polar({ x: place.x, y: place.y, w: 0, h: 0 }).degrees;
    assert.ok(
      lit.some((box) => Math.abs(box.radius - place.radius) < 3 && Math.abs(box.degrees - degrees) < 1.2),
      "the note at " + note.pitch + " struck at " + note.time + " s was not drawn where it belongs"
    );
  }
  // And the wheel reads high notes outwards, which is what a wheel of pitch means.
  const high = wheelAt(scene, ground.anchor, ground.barsPerTurn, 96, at);
  const low = wheelAt(scene, ground.anchor, ground.barsPerTurn, 24, at);
  assert.ok(high.radius > low.radius * 4, "the top of the piece is barely further out than the bottom");
});

test("BWV 582: each turn of the wheel is written new above the ground", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  const ground = groundOf(stage, scene);
  const turn = ground.barsPerTurn * (scene.data.bars[1] - scene.data.bars[0]);
  stage.frame(100);
  const one = lights(stage, scene).map((box) => Math.round(polar(box).radius) + ":" + Math.round(polar(box).degrees));
  stage.frame(100 + turn);
  const twice = lights(stage, scene).map((box) => Math.round(polar(box).radius) + ":" + Math.round(polar(box).degrees));
  assert.ok(one.length > 40 && twice.length > 40, "a turn of the wheel holds only " + one.length + " lights");
  const shared = one.filter((place) => twice.indexOf(place) >= 0).length;
  assert.ok(
    shared < (one.length + twice.length) / 4,
    shared + " of " + twice.length + " lights are in the same place a turn later: this variation looks like the last"
  );
});

test("BWV 582: the ground stops coming back, and the wheel comes apart", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  const ground = groundOf(stage, scene);
  const hinge = scene.data.bars[Math.floor(ground.anchor + ground.turns * ground.barsPerTurn)];
  assert.ok(hinge > 400 && hinge < 440, "the fugue should take off about seven minutes in, not at " + hinge + " s");

  // While the ground is being said, the whole turn is on the screen: you can see
  // the shape of the variation coming, so there is no dark side to the wheel.
  for (const at of [60, 200, 380]) {
    stage.frame(at);
    const gap = biggestGap(lights(stage, scene).map((box) => polar(box).degrees));
    assert.ok(gap < 90, "at " + at + " s a whole " + gap.toFixed(0) + " degrees of the wheel is dark: the turn is not all there");
  }
  // After the hinge there is no ground, so nothing is gold anywhere, and what is
  // lit is a hand sweeping a dark disc: a big piece of the wheel is dark.
  for (const at of [hinge + 30, 520, 660]) {
    stage.frame(at);
    assert.strictEqual(goldLights(stage, scene).length, 0, "something was gold after the ground stopped, at " + at + " s");
    const gap = biggestGap(lights(stage, scene).map((box) => polar(box).degrees));
    assert.ok(gap > 120, "at " + at + " s the fugue fills the whole wheel (" + gap.toFixed(0) + " degrees dark at best)");
  }
});

/** The widest gap between a set of bearings round the wheel, in degrees. */
function biggestGap(degrees) {
  const sorted = degrees.slice().sort((a, b) => a - b);
  if (sorted.length === 0) return 360;
  let gap = 360 - (sorted[sorted.length - 1] - sorted[0]);
  for (let i = 1; i < sorted.length; i++) gap = Math.max(gap, sorted[i] - sorted[i - 1]);
  return gap;
}

test("BWV 582: the rim keeps count of the turns, and says where the ground stopped", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  const ground = groundOf(stage, scene);
  const rimMarks = () => stage.drawn.filter((box) => polar(box).radius > WHEEL_OUTER + 10 && box.w <= 6);

  stage.frame(20);
  assert.strictEqual(rimMarks().length, 0, "the rim had marks before a turn of the wheel was done");
  for (const at of [100, 300]) {
    stage.frame(at);
    const done = Math.max(0, Math.floor((barAt(scene.look.bars, at) - ground.anchor) / ground.barsPerTurn));
    assert.strictEqual(rimMarks().length, done, "the rim counts wrong at " + at + " s");
  }
  stage.frame(700);
  const marks = rimMarks();
  assert.ok(marks.length > 30, "the rim only counted " + marks.length + " turns of the whole piece");
  const gold = marks.filter((box) => box.colour === WHEEL_GOLD).length;
  assert.strictEqual(gold, ground.turns, "the rim does not say how many turns carried the ground");
});

test("BWV 582: a voice come back after a long silence blooms in its own colour", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  const ground = groundOf(stage, scene);
  const lastSaid = ground.tune.heard[ground.tune.heard.length - 1].until;
  // The pedal is the last line into the fugue, half a minute after it let go of the
  // ground for the last time.
  const pedal = scene.notes.filter((note) => note.voice === 6 && note.time > lastSaid)[0];
  assert.ok(pedal.time - lastSaid > 10, "the pedal should wait a while before it speaks again");
  const worn = scene.look.colours["6"];
  const place = wheelAt(scene, ground.anchor, ground.barsPerTurn, pedal.pitch, pedal.time);

  const blooms = () =>
    stage.drawn.filter(
      (box) =>
        box.colour === "(gradient)" &&
        String(box.fill).indexOf(worn) === 0 &&
        Math.hypot(box.x + box.w / 2 - place.x, box.y + box.h / 2 - place.y) < 60
    );
  stage.frame(pedal.time - 0.5);
  assert.strictEqual(blooms().length, 0, "the pedal's second coming bloomed before it was struck");
  stage.frame(pedal.time + 0.3);
  assert.ok(blooms().length > 0, "the pedal came back after 29 s of silence and nothing was made of it");
});

test("BWV 582: the fugue's first note is a scene of its own", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  const ground = groundOf(stage, scene);
  const lastSaid = ground.tune.heard[ground.tune.heard.length - 1].until;
  const opening = scene.notes.filter((note) => note.time >= lastSaid)[0];
  assert.ok(opening, "nothing was struck after the ground's last note let go");
  const place = wheelAt(scene, ground.anchor, ground.barsPerTurn, opening.pitch, opening.time);
  // The picture's own colour, not a voice's: this is the piece turning a corner.
  const flash = () =>
    stage.drawn.filter(
      (box) =>
        box.colour === "(gradient)" &&
        String(box.fill).indexOf(WHEEL_COOL) === 0 &&
        box.w > 150 &&
        Math.hypot(box.x + box.w / 2 - place.x, box.y + box.h / 2 - place.y) < 150
    );
  stage.frame(opening.time - 0.5);
  assert.strictEqual(flash().length, 0, "the fugue was flashed before it began");
  stage.frame(opening.time + 0.5);
  assert.ok(flash().length > 0, "the fugue began and nothing was made of it");
});

test("BWV 582: the hand is the line of sound, bent round, and it goes once to a turn", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  const ground = groundOf(stage, scene);
  const inner = Math.min(STAGE_WIDTH, STAGE_HEIGHT) * WHEEL.hub;
  const dashes = () =>
    stage.drawn.filter((box) => {
      const where = polar(box);
      return box.colour === WHEEL_COOL && box.w <= 6 && where.radius > inner * 0.4 && where.radius < WHEEL_OUTER;
    });
  const bearingOf = (box) =>
    Math.atan2(box.y + box.h / 2 - CENTRE.y, box.x + box.w / 2 - CENTRE.x);

  for (const at of [40, 120, 300]) {
    stage.frame(at);
    const lit = dashes();
    assert.ok(lit.length > 15, "the hand is barely drawn at " + at + " s: " + lit.length + " marks");
    const due = wheelAt(scene, ground.anchor, ground.barsPerTurn, 60, at).angle;
    for (const box of lit) {
      // Every dash of the hand lies along the one bearing this moment of the turn
      // is on - which is what makes it a line of sound and not a scatter.
      const off = Math.abs(((bearingOf(box) - due + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      assert.ok(off < 0.06, "a dash of the hand is off its line at " + at + " s by " + off.toFixed(3) + " radians");
    }
  }

  // And it travels: half a turn later it is on the other side of the wheel.
  stage.frame(120);
  const before = bearingOf(dashes()[0]);
  stage.frame(120 + ground.barsPerTurn * (scene.data.bars[1] - scene.data.bars[0]) * 0.5);
  const after = bearingOf(dashes()[0]);
  const moved = Math.abs(((after - before + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  assert.ok(moved > 2.5, "half a turn of the piece moved the hand by only " + moved.toFixed(2) + " radians");
});

test("BWV 582: a telling of the ground blooms gold where it begins, and not before", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  const ground = groundOf(stage, scene);
  const telling = ground.tune.heard.find((one) => one.time > 100);
  assert.ok(telling, "no telling of the ground after 100 s");
  const place = wheelAt(scene, ground.anchor, ground.barsPerTurn, telling.pitch, telling.time);
  const near = (box) => Math.hypot(box.x + box.w / 2 - place.x, box.y + box.h / 2 - place.y) < 120;
  const goldGlow = () =>
    stage.drawn.filter((box) => box.colour === "(gradient)" && String(box.fill).indexOf(WHEEL_GOLD) === 0 && near(box));

  stage.frame(telling.time - 0.5);
  assert.strictEqual(goldGlow().length, 0, "the ground glowed before it was said again");
  stage.frame(telling.time + 0.4);
  const fresh = goldGlow();
  assert.ok(fresh.length > 0, "the ground came back at " + telling.time + " s and no gold light marked it");
  stage.frame(telling.time + 1.8);
  const fading = goldGlow();
  assert.ok(fading.length > 0, "the glow had nothing to fade in: it was gone 1.8 s in");
  assert.ok(
    Math.max.apply(null, fading.map((box) => box.alpha)) < Math.max.apply(null, fresh.map((box) => box.alpha)),
    "the ground's arrival glow never fades: it would just be a permanent gold blob"
  );
  stage.frame(telling.time + 6);
  assert.strictEqual(goldGlow().length, 0, "the ground was still glowing six seconds after it began");
});

test("BWV 582: the ground is the stoutest light on the wheel", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  stage.frame(120); // the ground going, with three voices above it
  const worn = Object.keys(scene.look.colours).map((key) => scene.look.colours[key]);
  // Only what has been struck and is still bright counts, so a note still coming
  // up - drawn small on purpose - cannot answer for one that is sounding.
  const lit = lights(stage, scene).filter((box) => box.alpha > 0.4);
  const gold = lit.filter((box) => box.colour === WHEEL_GOLD);
  const others = lit.filter((box) => worn.indexOf(box.colour) >= 0);
  assert.ok(gold.length > 1 && others.length > 3, "not enough is lit at 120 s to compare anything");
  assert.ok(
    Math.min.apply(null, gold.map((box) => box.w)) > Math.max.apply(null, others.map((box) => box.w)),
    "a voice is drawn as stout as the ground: gold would be the only thing saying which is which"
  );
});

test("BWV 582: a frame of the wheel is cheap, and nothing on it burns out", () => {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const stage = createStage(scene);
  let most = 0;
  let burnt = 0;
  for (let at = 1; at < scene.data.duration; at += 1) {
    const seen = stage.frame(at);
    if (stage.drawn.length > most) most = stage.drawn.length;
    burnt += seen.burnt;
    assert.ok(seen.mean < 0.06, "the wheel is washed out at " + at + " s: mean light " + seen.mean.toFixed(3));
  }
  assert.ok(most > 150, "one frame draws only " + most + " marks: is the picture missing?");
  assert.ok(most < 1500, "one frame draws " + most + " boxes: that will not keep up with the music");
  assert.strictEqual(burnt, 0, burnt + " cells of the grid burned out white somewhere in the piece");
});
