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
