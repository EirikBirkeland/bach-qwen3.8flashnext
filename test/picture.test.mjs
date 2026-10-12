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

test("BWV 645: two voices striking one pitch are told as one thread of light", () => {
  // One 1.8px line can carry one bright thread: two notes on one pitch fall on it
  // together, and the second one laid there too is white rather than louder - and
  // the harness grid would never even ask, since it samples a cell at its middle and
  // a thread can pass between two cells. So this measures where the thread is drawn.
  const scene = sceneOf("bwv645-wachet-auf");
  const stage = createStage(scene);
  const CORE = 1.8; // src/look-vigil.js: twice CORE, the whole width of a struck note's core
  const weightOf = (note) => (note.role === "melody" ? 5.5 : note.role === "pedal" ? 4.5 : 3); // src/look-vigil.js
  const paired = {};
  for (const note of scene.notes) {
    const key = note.time.toFixed(3) + ":" + note.pitch;
    (paired[key] = paired[key] || []).push(note);
  }
  const unisons = Object.keys(paired)
    .map((key) => paired[key])
    .filter((group) => group.length > 1);
  assert.ok(unisons.length > 0, "this test is about two voices striking one pitch, and the piece has none");
  for (const group of unisons) {
    const at = group[0].time + 0.02;
    stage.frame(at);
    const x = across(scene, group[0].pitch);
    const threads = stage.drawn.filter(
      // at the line of sound and below it: above, the same pitch is drawn as a faint
      // hairline for the next time it is coming, and that is not a struck thread
      (box) => Math.abs(box.w - CORE) < 0.05 && box.alpha > 0.3 && box.y >= SOUND_Y - 0.01 && x >= box.x && x <= box.x + box.w
    );
    const laid = threads.reduce((sum, box) => sum + box.alpha * stage.bach.lightOf(box.colour), 0);
    assert.strictEqual(
      threads.length,
      1,
      group.length + " voices struck pitch " + group[0].pitch + " at " + at.toFixed(2) + " s and " + threads.length + " bright threads were laid there"
    );
    assert.ok(laid < 0.75, "pitch " + group[0].pitch + " at " + at.toFixed(2) + " s is laid with " + laid.toFixed(2) + " of full light: that is white");
    assert.ok(laid > 0.4, "the pitch " + group[0].pitch + " at " + at.toFixed(2) + " s is barely lit: " + laid.toFixed(2));
    // and it is the line the organ weighs most that says which colour it is
    const stoutest = group.reduce((best, one) => (weightOf(one) > weightOf(best) ? one : best), group[0]);
    assert.strictEqual(
      threads[0].colour,
      scene.look.colours[String(stoutest.voice)],
      "pitch " + group[0].pitch + " at " + at.toFixed(2) + " s is lit in " + threads[0].colour + " and not in the colour of its stoutest line"
    );
  }
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

test("BWV 645: no part of the long view burns out white", () => {
  const scene = sceneOf("bwv645-wachet-auf");
  const stage = createStage(scene);
  let burnt = 0;
  let peak = 0;
  for (let at = 1; at < scene.data.duration; at += 1 / 6) {
    const seen = stage.frame(at);
    burnt += seen.burnt;
    if (seen.peak > peak) peak = seen.peak;
  }
  assert.strictEqual(burnt, 0, burnt + " cells of the grid burned out white somewhere in the piece");
  assert.ok(peak < 0.9, "the brightest cell reaches " + peak.toFixed(3) + " of full light");
});

test("BWV 645: a bar crossing the line of sound still leaves the picture under white", () => {
  // The picture's own brightest spot is where a bar line lies across the line of
  // sound while a note is struck on it. A bar line is two pixels and the road is
  // moving at fifty pixels a second there, so the crossing is over in half a
  // second and the walk above only sees 0.74 of full light where this one sees
  // 0.85 - which is the difference between a picture that burns out and one that
  // nearly does, and the reason this walk is at a sixtieth.
  const scene = sceneOf("bwv645-wachet-auf");
  const stage = createStage(scene);
  let peak = 0;
  let where = 0;
  for (const bar of scene.data.bars) {
    for (let at = bar - 0.2; at < bar + 0.2; at += 1 / 60) {
      const seen = stage.frame(at);
      if (seen.peak > peak) {
        peak = seen.peak;
        where = at;
      }
      assert.strictEqual(seen.burnt, 0, "a cell burned out white at " + at.toFixed(2) + " s, on the bar line at " + bar.toFixed(2) + " s");
    }
  }
  assert.ok(peak < 0.9, "the crossing of a bar line whitens a cell: " + peak.toFixed(3) + " at " + where.toFixed(2) + " s");
});

test("how much light a colour carries, which is what a picture budgets against", () => {
  const stage = createStage({ notes: [], look: { pitchLow: 36, pitchHigh: 92, colours: {} } });
  const light = stage.bach.lightOf;
  assert.ok(
    light("#9dff9b") > light("#c39bff"),
    "green was read as no brighter than violet: " + light("#9dff9b").toFixed(2) + " and " + light("#c39bff").toFixed(2)
  );
  assert.ok(light("#9dff9b") > 0.85, "the brightest colour on the page reads as " + light("#9dff9b").toFixed(2));
  assert.ok(light("#c39bff") < 0.7, "the darkest colour on the page reads as " + light("#c39bff").toFixed(2));
  assert.strictEqual(light("something else"), 1, "a colour that cannot be read is taken at less than full light, and may burn out");
});

test("BWV 645: every voice is struck with the same light, and none with more than full scale", () => {
  // A struck note is the brightest thing on the screen, and it has to stay its own
  // colour: gold and violet are not the same brightness at the same alpha, so the
  // thread of light down a note's middle is capped by how much light its colour
  // already carries. Laid at a fixed alpha instead, the bright voices pass full
  // scale and come out white - and say nothing about which voice they are.
  const scene = sceneOf("bwv645-wachet-auf");
  const stage = createStage(scene);
  const CORE = 1.8; // src/look-vigil.js: twice CORE, the whole width of a struck note's core
  const struck = [];
  for (const voice in scene.look.colours) {
    const note = scene.notes.find((one) => String(one.voice) === voice);
    assert.ok(note, "voice " + voice + " has no note at all");
    stage.frame(note.time + 0.02); // struck, and not yet let go
    const x = across(scene, note.pitch);
    const threads = stage.drawn
      .filter((box) => box.colour === scene.look.colours[voice] && Math.abs(box.w - CORE) < 0.05 && box.alpha > 0.3)
      .sort((a, b) => Math.abs(a.x + a.w / 2 - x) - Math.abs(b.x + b.w / 2 - x));
    assert.ok(threads.length > 0, "voice " + voice + ": nothing was struck bright at " + note.time.toFixed(2) + " s");
    const thread = threads[0];
    struck.push({ voice: voice, light: thread.alpha * stage.bach.lightOf(thread.colour), colour: thread.colour });
  }
  for (const one of struck) {
    assert.ok(one.light < 0.62, one.colour + " is struck with " + one.light.toFixed(2) + " of full light: that alone is nearly white");
    assert.ok(one.light > 0.4, one.colour + " is struck with only " + one.light.toFixed(2) + ": a struck note should be the brightest thing on the screen");
  }
  const lights = struck.map((one) => one.light);
  const spread = Math.max.apply(null, lights) - Math.min.apply(null, lights);
  assert.ok(
    spread < 0.1,
    "the voices are struck with " + lights.map((one) => one.toFixed(2)).join(", ") + " of full light: the bright ones burn out and the dark ones do not"
  );
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

// --- playing along: the wheel takes its own pulse ---------------------------
//
// Every other piece has the game's ladder of beats laid over its picture. The
// wheel cannot use one: it is a picture with no straight line in it, and its hand
// is already the line of sound going once round a turn - so its beats have
// bearings of their own and the rim can carry them. These are the numbers for
// "the rim ticks a tooth to a beat", and they are measured with the game wired to
// the picture the way index.html wires them.

const WHEEL_MARK = "#e8f1ff"; // src/look-round.js: a beat marked on the rim

/** The difference between two bearings, in degrees, the short way round. */
function bearingGap(one, other) {
  const apart = Math.abs(one - other) % 360;
  return apart > 180 ? 360 - apart : apart;
}

/** A point on the wheel: the look's own geometry, so a test can say where a
 *  thing belongs and so prove it was drawn there. */
function wheelPoint(angle, radius) {
  return { x: CENTRE.x + Math.cos(angle) * radius, y: CENTRE.y + Math.sin(angle) * radius };
}

/**
 * The wheel with a player striking its beats, kept beside the wheel on its own.
 *
 * `see(seconds)` frames both at the same second and hands back what playing
 * along added. The picture draws the same marks whether or not anyone is
 * playing, and the pulse is laid on after them, so everything past the
 * picture's own count is the pulse and nothing else - which is the only honest
 * way to point at a tooth when the hand and the clock face are drawn in the same
 * colours as it is.
 */
function wheelPlaying() {
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const picture = createStage(scene);
  const stage = createStage(scene, { play: true });
  const ground = groundOf(picture, scene);
  const turn = ground.barsPerTurn * (scene.data.bars[1] - scene.data.bars[0]);

  return {
    scene: scene,
    ground: ground,
    turn: turn,
    painted: () => stage.painted(),
    beats: () => [...stage.beats()],
    score: () => stage.score(),
    hit: (at) => stage.hit(at),
    /** The bearing a second of the piece falls on, counted as polar() counts it. */
    bearing: (seconds) => {
      const angle = wheelAt(scene, ground.anchor, ground.barsPerTurn, 60, seconds).angle;
      return (angle * 180) / Math.PI + 90;
    },
    /** The look's own geometry for a second of the piece: bearing and angle. */
    place: (seconds) => wheelAt(scene, ground.anchor, ground.barsPerTurn, 60, seconds),
    see: function (seconds) {
      const alone = picture.frame(seconds);
      const count = picture.drawn.length;
      const seen = stage.frame(seconds);
      return {
        frame: seen,
        plain: alone,
        added: stage.drawn.slice(count),
        marks: stage.drawn.length,
        hand: this.bearing(seconds),
      };
    },
    /** The same pair, framed in lockstep, so a burnt cell can be blamed. */
    alone: picture,
    air: stage.air,
  };
}

/** Marks of the pulse just inside the rim, where its teeth live. */
function onTheRim(boxes) {
  return boxes.filter((box) => {
    const where = polar(box);
    return where.radius > WHEEL_OUTER - 24 && where.radius <= WHEEL_OUTER && box.w <= 6;
  });
}

test("only a picture that has a way to draw the pulse is given it", async () => {
  // src/main.js asks the picture whether it wants the player's pulse. One of
  // these worlds is happy with the game's ladder - the fugue picture of BWV 565
  // falls, and a ladder of falling beats is the same shape - and the other three
  // are not: a wheel of time, a road of it, and a weave of it each have their own
  // place to put a beat.
  const seen = [];
  for (const slug of [
    "bwv565-toccata-and-fugue-d-minor",
    "bwv639-ich-ruf-zu-dir",
    "bwv645-wachet-auf",
    "bwv582-passacaglia-c-minor",
  ]) {
    seen.push([slug, playground(slug).painted()]);
  }
  assert.deepStrictEqual(seen, [
    ["bwv565-toccata-and-fugue-d-minor", false],
    ["bwv639-ich-ruf-zu-dir", true],
    ["bwv645-wachet-auf", true],
    ["bwv582-passacaglia-c-minor", true],
  ]);
});

/** A stage wired for playing along, over one piece as the page hands it over. */
function playground(slug) {
  return createStage(sceneOf(slug), { play: true });
}

test("BWV 582: playing along is taken by the wheel itself, and lays no ladder over it", () => {
  const play = wheelPlaying();
  assert.strictEqual(play.painted(), true, "the wheel did not take the pulse off the game");
  const seen = play.see(120);
  assert.ok(seen.added.length > 40, "playing along drew only " + seen.added.length + " marks");

  // The ladder is a pile of wide thin bars. None of what the wheel adds is one.
  const beams = seen.added.filter((box) => box.w > 60 && box.h <= 3);
  assert.strictEqual(beams.length, 0, "a wide thin bar of the ladder was drawn over the wheel");

  // And what it does draw is a ring of teeth just inside the rim.
  const teeth = onTheRim(seen.added);
  assert.ok(teeth.length > 40, "only " + teeth.length + " marks were laid on the rim");
  const bearings = new Set(teeth.map((box) => Math.round(polar(box).degrees / 3)));
  assert.ok(bearings.size > 15, "the teeth cover only " + bearings.size + " bearings: that is not a pulse");
});

test("BWV 582: the rim grows a tooth at every beat left in the turn, and none between", () => {
  const play = wheelPlaying();
  const at = 120;
  const seen = play.see(at);
  const teeth = onTheRim(seen.added);
  const turnEnd = play.ground.tune.heard.map((one) => one.time).filter((one) => one > at)[0];
  const coming = play.beats().filter((beat) => beat.time >= at && beat.time < turnEnd - 0.05);
  assert.ok(coming.length > 12, "only " + coming.length + " beats are left in this turn to mark");

  for (const beat of coming) {
    const bearing = play.bearing(beat.time);
    const marks = teeth.filter((box) => bearingGap(polar(box).degrees, bearing) < 1.5);
    assert.ok(marks.length >= 2, "nothing was drawn at the bearing of the beat at " + beat.time + " s");
  }

  // Halfway between two beats there is nothing to strike, and nothing drawn.
  const between = (play.bearing(coming[3].time) + play.bearing(coming[4].time)) / 2;
  const stray = teeth.filter((box) => bearingGap(polar(box).degrees, between) < 1.5);
  assert.strictEqual(stray.length, 0, "there is a mark halfway between two beats, which is nobody's beat");
});

test("BWV 582: a beat the player strikes lights the rim where it was, and a let-go one does not", () => {
  const play = wheelPlaying();
  const at = 100;
  const caught = play.beats().find((one) => one.time > at + 1);
  const letGo = play.beats().find((one) => one.time > caught.time + 4);

  // The caught one: framed while it is still to come, then struck, then just after.
  play.see(caught.time - 0.4);
  play.hit(caught.time);
  const struck = play.see(caught.time + 0.2);
  const where = wheelPoint(play.place(caught.time).angle, WHEEL_OUTER - 7);
  const glow = (added) =>
    added.filter(
      (box) => box.colour === "(gradient)" && Math.hypot(box.x + box.w / 2 - where.x, box.y + box.h / 2 - where.y) < 120
    );
  assert.ok(glow(struck.added).length > 0, "the beat was struck and nothing lit where its tooth stands");
  assert.strictEqual(glow(play.see(caught.time - 0.4).added).length, 0, "something lit before the beat was struck");

  // A beat let go: the same rim, the same second along, and no light.
  const gone = play.see(letGo.time + 0.2);
  const atItsRim = (added) =>
    added.filter((box) => box.colour === "(gradient)" && bearingGap(polar(box).degrees, play.bearing(letGo.time)) < 6);
  assert.strictEqual(atItsRim(gone.added).length, 0, "a beat nobody struck lit the rim anyway");

  // A click with no beat near it: a dull mark at the hand, and no glow.
  const far = play.beats().find((one) => one.time > letGo.time + 5);
  play.hit(far.time + 0.5);
  const missed = play.see(far.time + 0.55);
  assert.strictEqual(
    missed.added.filter((box) => box.colour === "(gradient)").length,
    0,
    "a click that caught nothing rang a glow anyway"
  );
  assert.strictEqual(missed.added.filter((box) => box.w > 4).length, 0, "a missed click drew something bigger than a mark");
});

test("BWV 582: the beat is not gold, because the ground is", () => {
  const play = wheelPlaying();
  const gap = play.beats()[0].gap;
  const worth = play.beats().find((beat) => beat.bright && beat.time > 100 && beat.time < 200);
  assert.ok(worth, "a telling of the ground should be a beat worth more");
  const plain = play.beats().find((beat) => !beat.bright && beat.time > worth.time + 4 * gap);
  assert.ok(plain, "there should be an ordinary beat to compare it with");

  // A beat the music is marking is drawn in the pulse's own colour, and never gold.
  const marksAt = (seconds, added) =>
    added.filter((box) => box.w <= 6 && bearingGap(polar(box).degrees, play.bearing(seconds)) < 1.5);
  const marking = marksAt(worth.time, play.see(worth.time - 0.05).added);
  assert.ok(marking.length > 1, "nothing was drawn for the beat at " + worth.time + " s");
  assert.ok(
    marking.some((box) => box.colour === WHEEL_MARK),
    "a beat the music is marking is not picked out: " + marking.map((box) => box.colour).join(", ")
  );
  // An ordinary one, the same distance ahead, is not.
  const ordinary = marksAt(plain.time, play.see(plain.time - 0.05).added);
  assert.ok(ordinary.length > 1, "nothing was drawn for the beat at " + plain.time + " s");
  assert.strictEqual(
    ordinary.filter((box) => box.colour === WHEEL_MARK).length,
    0,
    "an ordinary beat was picked out as though the music were marking it"
  );

  // ... not even a beat the player strikes, however much the music was marking it.
  // (It has to be a beat further along than anywhere framed so far: a beat the
  // hand has passed is nobody's to strike again.)
  const goldBeat = play.beats().find((one) => one.bright && one.time > 300 && one.time < 400);
  assert.ok(goldBeat, "there should be another telling of the ground to strike");
  play.see(goldBeat.time - 0.2);
  play.hit(goldBeat.time);
  const struck = play.see(goldBeat.time + 0.1);
  assert.ok(play.score().caught > 0, "the strike did not count");
  const isGold = (box) => String(box.colour).indexOf(WHEEL_GOLD) >= 0 || String(box.fill).indexOf(WHEEL_GOLD) >= 0;
  assert.strictEqual(
    struck.added.filter(isGold).length,
    0,
    "a struck beat lit gold, and gold belongs to the ground alone"
  );

  // And nothing else playing along draws, anywhere, is gold either.
  for (const at of [66, 120, 240, goldBeat.time - 0.05]) {    const seen = play.see(at);
    assert.strictEqual(
      seen.added.filter(isGold).length,
      0,
      "something gold was drawn by playing along at " + at + " s"
    );
  }
});

test("BWV 582: when the wheel unwinds for the fugue, the teeth go back on the rack", () => {
  const play = wheelPlaying();
  const hinge = play.ground.tune.heard[play.ground.tune.heard.length - 1].until;
  const passacaglia = play.see(200);
  const fugue = play.see(hinge + 60);
  const spread = (added) => {
    const degrees = onTheRim(added).map((box) => polar(box).degrees).sort((one, other) => one - other);
    if (degrees.length < 2) return 0;
    let widest = 360 - (degrees[degrees.length - 1] - degrees[0]);
    for (let i = 1; i < degrees.length; i++) widest = Math.max(widest, degrees[i] - degrees[i - 1]);
    return 360 - widest;
  };
  assert.ok(spread(passacaglia.added) > 250, "a turn of the passacaglia marks only " + spread(passacaglia.added).toFixed(0) + " degrees of rim");
  assert.ok(spread(fugue.added) < 120, "the fugue still has " + spread(fugue.added).toFixed(0) + " degrees of teeth on the rim");
});

test("BWV 582: the teeth on the rim are cheap to draw, and tip nothing over white", () => {
  // Walked every sixth of a second. A tooth is 3 pixels of light laid down just
  // inside the rim, which is exactly where the manuals' top notes are struck, and
  // a coarser grid walks straight past the frame where the two land together -
  // which is how a frame every two seconds hid two burnt-out cells for three
  // sessions.
  const play = wheelPlaying();
  const scene = play.scene;
  const beats = play.beats();
  const luma = (spot) => 0.2126 * spot[0] + 0.7152 * spot[1] + 0.0722 * spot[2];
  let index = 0;
  let most = 0;
  let mean = 0;
  let tipped = 0;
  let rung = 0;
  let worstAlone = 0;
  for (let at = 1; at < scene.data.duration; at += 1 / 6) {
    while (index < beats.length && beats[index].time < at) {
      if (at - beats[index].time < 0.3) play.hit(beats[index].time); // there for a beat now and then
      index++;
    }
    const seen = play.see(at);
    const plainAir = play.alone.air.map(luma); // the same second, with nobody playing
    most = Math.max(most, seen.marks);
    mean = Math.max(mean, seen.frame.mean);
    worstAlone = Math.max(worstAlone, seen.plain.mean);
    rung = play.score().caught;
    // The wheel burns a cell out where two voices strike one pitch together, and
    // has a record for it; a cell may only go over on the pulse's account if the
    // music had not all but done it by itself.
    play.air.forEach((spot, k) => {
      if (luma(spot) > 0.9 && plainAir[k] < 0.85) tipped++;
    });
  }
  assert.ok(most > 200, "one frame draws only " + most + " marks with the pulse on");
  assert.ok(most < 1500, "one frame draws " + most + " boxes with the pulse on: that will not keep up");
  assert.ok(
    mean < worstAlone + 0.004,
    "the teeth cost too much light: worst mean " + mean.toFixed(4) + " against " + worstAlone.toFixed(4) + " without them"
  );
  assert.strictEqual(tipped, 0, tipped + " cells burned out white because of the pulse alone");
  assert.ok(rung > 20, "the player struck " + rung + " bells in " + Math.round(scene.data.duration) + " s: the harness is not striking");
});

test("BWV 582: where the music is already shining, the beat's tooth steps aside", () => {
  // The wheel keeps a record of where it has laid light, and a second mark on a
  // spot that is already shining is drawn for less. The Passacaglia's beat teeth
  // are the marks that needed it: they stand just inside the rim, where this
  // keyboard arrangement strikes its highest notes, and even for half a tick laid
  // on a note's own flare is white on white and over full scale. So a tooth steps
  // aside there - which is plainest on a wheel built by hand: one note, struck
  // exactly on a beat, so the tooth that beat leaves lands on the note's own core;
  // and the same wheel empty, where the tooth has the ground to itself.
  const bars = [];
  for (let bar = 0; bar <= 8; bar++) bars.push(bar * 4);
  const wheel = function (notes) {
    const scene = {
      slug: "hand-built",
      data: { bars: bars, metre: { beats: 4 }, duration: bars[bars.length - 1] },
      notes: notes,
      look: {
        name: "round",
        phrase: 4,
        pitchLow: 24,
        pitchHigh: 72,
        colours: { 1: "#79e2ff" },
        bars: bars,
        duration: bars[bars.length - 1],
      },
    };
    const stage = createStage(scene, { play: true });
    const beat = [...stage.beats()].find((one) => one.time === 8);
    assert.ok(beat && !beat.bright, "the hand-built wheel should not be marking its own beats");
    stage.hit(beat.time);
    stage.frame(beat.time + 0.02);
    // The outermost dot of the struck beat's tooth, and the whole of it: the tooth
    // is the one mark the pulse draws in its own colour, and the note it lands on
    // wears the voice's blue.
    const dots = [];
    const rest = [];
    for (const box of stage.drawn) {
      if (box.colour !== "#e8f1ff" || box.w > 6) continue;
      const where = polar(box);
      if (where.radius <= WHEEL_OUTER - 26 || where.radius > WHEEL_OUTER) continue;
      rest.push(box);
      if (where.radius > WHEEL_OUTER - 5) dots.push(box);
    }
    return { dots: dots.length, alpha: dots.length ? dots[0].alpha : 0, tooth: rest.length };
  };

  const dark = wheel([]);
  const lit = wheel([{ voice: 1, pitch: 72, time: 8, length: 4, velocity: 0.7, role: "inner" }]);
  assert.strictEqual(dark.dots, 1, "the tooth laid " + dark.dots + " dots where the rim's edge should have one");
  assert.ok(dark.alpha > 0.5, "a tooth on dark ground is only " + dark.alpha.toFixed(2) + " of full light: nothing to compare");
  assert.strictEqual(lit.dots, 0, "the tooth was drawn over a note already shining, at " + lit.alpha.toFixed(3));
  assert.strictEqual(
    lit.tooth,
    dark.tooth - 1,
    "the beat stopped being told: " + lit.tooth + " dots of tooth against " + dark.tooth + " on dark ground"
  );
});

test("BWV 582: a frame of the wheel does not remember the frames before it", () => {
  // That record of where light has been laid is about this frame and no other. One
  // that kept the last frame's writing - or the whole piece's - would play the
  // picture down towards nothing as the piece went on, and nothing else here would
  // notice: every other claim about the wheel's light is a ceiling, not a level.
  const scene = sceneOf("bwv582-passacaglia-c-minor");
  const fresh = createStage(scene);
  const played = createStage(scene);
  const at = 400; // well into the fugue, with six and a half minutes of frames behind it
  const first = fresh.frame(at);
  for (let second = 1; second < at; second += 1) played.frame(second);
  const later = played.frame(at);
  assert.ok(
    Math.abs(later.mean - first.mean) < 0.002,
    "the same second holds mean light " + later.mean.toFixed(4) + " after six minutes of playing and " + first.mean.toFixed(4) + " when the page has just opened it"
  );
  assert.ok(
    Math.abs(later.peak - first.peak) < 0.02,
    at + " s is brightest at " + later.peak.toFixed(3) + " after six minutes of playing and " + first.peak.toFixed(3) + " fresh: the picture is fading out"
  );
});

test("BWV 582: a run brightens the rim, and letting a beat go takes it back", () => {
  const play = wheelPlaying();
  // The wheel's own version of the ladder's line getting wider: the rim itself
  // takes up a ring of light while the player stays with the piece.
  const ring = (added) =>
    added.filter(
      (box) =>
        box.colour === "(gradient)" &&
        Math.hypot(box.x + box.w / 2 - CENTRE.x, box.y + box.h / 2 - CENTRE.y) < 2 &&
        String(box.fill).indexOf(WHEEL_COOL) >= 0
    );
  const from = play.beats().find((one) => one.time > 200);
  const four = play.beats().slice(play.beats().indexOf(from), play.beats().indexOf(from) + 4);
  assert.strictEqual(four.length, 4, "the harness wanted four beats in a row and found " + four.length);

  play.see(from.time - 0.5);
  assert.strictEqual(ring(play.see(from.time - 0.05).added).length, 0, "the rim was bright before anything was struck");

  for (const beat of four) {
    play.hit(beat.time);
    play.see(beat.time + 0.05);
  }
  assert.strictEqual(play.score().chain, 4, "the four beats did not make a run");
  assert.ok(ring(play.see(four[3].time + 0.1).added).length > 0, "four beats in a row and the rim did not brighten");

  // Let one go, and it is back to plain. The frames have to come at less than half
  // a second apart, because a bigger stride is a jump somewhere else, not a let-go.
  const next = play.beats().find((one) => one.time > four[3].time + 0.2);
  play.see(next.time - 0.2);
  play.see(next.time + 0.1);
  play.see(next.time + 0.4);
  assert.strictEqual(play.score().chain, 0, "letting the beat go did not end the run");
  assert.strictEqual(ring(play.see(next.time + 0.45).added).length, 0, "the rim kept its ring after the run ended");
});

// --- playing along: the long view plants its own lamps ----------------------
//
// BWV 645 is a road you can see the end of, so it has no more need of the game's
// ladder of two falling beats than the wheel had: it can put a lamp on its verge
// for every beat of the piece and show them all at once. These are the numbers
// for that, measured with the game wired to the picture the way index.html wires
// them - and against the same picture with nobody playing, which is the only way
// to point at a lamp when the road's own lines are drawn so near it.

const VIGIL_MARK = "#e8f1ff"; // src/look-vigil.js: a beat planted on the verge
const VIGIL_EDGE = 0.6; // ... and where a lamp stands within it
const VIGIL_MARGIN = Math.min(120, STAGE_WIDTH * 0.12);
const VIGIL_LEFT = VIGIL_MARGIN * VIGIL_EDGE;
const VIGIL_RIGHT = STAGE_WIDTH - VIGIL_LEFT;
const VIGIL_STEP = 2.5; // src/look-vigil.js: seconds the climb is measured in
const VIGIL_CLIMB = (seconds) => (seconds <= 0 ? 0 : Math.log(1 + seconds / VIGIL_STEP));

/** Where a second of the piece stands on the road, the way the look draws it. */
function roadY(scene, at, now) {
  const step = (SOUND_Y - HORIZON_Y) / VIGIL_CLIMB(scene.data.duration);
  return at - now >= 0 ? SOUND_Y - step * VIGIL_CLIMB(at - now) : SOUND_Y + step * VIGIL_CLIMB(now - at) * 1.7;
}

/** The long view with a player striking its beats, kept beside the road on its
 *  own: `see(seconds)` frames both at the same second and hands back what
 *  playing along added, which is the lamps, their blooms, and nothing else. */
function roadPlaying() {
  const scene = sceneOf("bwv645-wachet-auf");
  const picture = createStage(scene);
  const stage = createStage(scene, { play: true });
  return {
    scene: scene,
    painted: () => stage.painted(),
    beats: () => [...stage.beats()],
    hit: (at) => stage.hit(at),
    score: () => stage.score(),
    see: function (seconds) {
      picture.frame(seconds);
      const count = picture.drawn.length;
      const seen = stage.frame(seconds);
      return { frame: seen, added: stage.drawn.slice(count), marks: stage.drawn.length };
    },
    /** The same pair, framed in lockstep, so a burnt cell can be blamed. */
    alone: picture,
    air: stage.air,
  };
}

/** A lamp on either verge: the look's own light, small, and no part of the road. */
function onTheVerge(boxes) {
  return boxes.filter((box) => {
    const middle = box.x + box.w / 2;
    const atALamp = Math.abs(middle - VIGIL_LEFT) < 6 || Math.abs(middle - VIGIL_RIGHT) < 6;
    return atALamp && box.colour === VIGIL_MARK && box.h <= 40;
  });
}

/** The light a struck beat lays: a round bloom, and the only one the pulse draws. */
function struckLight(boxes) {
  return boxes.filter((box) => box.colour === "(gradient)");
}

test("BWV 645: the road takes the pulse itself, and lays no ladder over it", () => {
  const play = roadPlaying();
  assert.strictEqual(play.painted(), true, "the long view did not take the pulse off the game");

  const seen = play.see(40);
  assert.ok(seen.added.length > 40, "playing along drew only " + seen.added.length + " marks");
  const beams = seen.added.filter((box) => box.w > 60 && box.h <= 3);
  assert.strictEqual(beams.length, 0, "a wide thin bar of the ladder was drawn over the road");

  const lamps = onTheVerge(seen.added);
  const left = lamps.filter((box) => Math.abs(box.x + box.w / 2 - VIGIL_LEFT) < 6);
  const right = lamps.filter((box) => Math.abs(box.x + box.w / 2 - VIGIL_RIGHT) < 6);
  assert.ok(left.length > 8, "only " + left.length + " lamps on the left verge");
  assert.ok(right.length > 8, "only " + right.length + " lamps on the right verge");
  assert.strictEqual(
    left.length,
    right.length,
    "the verges do not match: " + left.length + " lamps against " + right.length
  );
});

test("BWV 645: a lamp to a beat near at hand, one to a bar beyond, and none too near", () => {
  const play = roadPlaying();
  const at = 40;
  const gap = play.beats()[0].gap;
  const gone = play.beats().find((one) => one.time > 60);

  // The moments to look at, framed in the order the music goes. The game's hand
  // never travels back - a beat the player has passed is nobody's to strike again -
  // so a frame has to come after any frame further back, or it is not a moment
  // anybody could stand at. One of them has a beat a third of a second behind it,
  // which no whole second of this piece is: its beats all fall half a beat past.
  const frames = [
    [0, play.see(0)],
    [at, play.see(at)],
    [gone.time + 0.1, play.see(gone.time + 0.1)],
    [100, play.see(100)],
    [190, play.see(190)],
  ];

  // Nothing of the pulse creeps below the line of sound: what has gone by is not
  // there to strike, and the bottom of the screen belongs to the page's own words.
  for (const one of frames) {
    for (const box of onTheVerge(one[1].added)) {
      assert.ok(
        box.y + box.h / 2 <= SOUND_Y + 2,
        "a lamp was drawn below the line of sound at " + one[0].toFixed(1) + " s: " + JSON.stringify(box)
      );
    }
  }

  // Every beat of the next four bars stands on the verge, and so does every bar
  // beyond them - which is what makes the road read as a road, lit all the way
  // to where its beats are too near together to tell one from another.
  const lamps = onTheVerge(frames[1][1].added);
  const rows = lamps.map((box) => box.y + box.h / 2);
  const coming = play.beats().filter((beat) => beat.time >= at && beat.time < at + 90);
  const wanted = coming.filter((beat) => beat.time - at <= 4 * gap || beat.bar);
  assert.ok(wanted.length > 15, "only " + wanted.length + " beats of the next minute and a half ask for a lamp");
  for (const beat of wanted) {
    const y = roadY(play.scene, beat.time, at);
    assert.ok(
      lamps.filter((box) => Math.abs(box.y + box.h / 2 - y) < 2).length >= 2,
      "no lamp at the beat " + (beat.time - at).toFixed(1) + " s off (" + beat.time + " s)"
    );
  }

  // A beat that is neither a bar's opening nor near at hand is nobody's lamp.
  const plain = coming.filter((beat) => !beat.bar && !beat.bright && beat.time - at > 8 && beat.time - at < 14);
  assert.ok(plain.length >= 2, "the harness wanted a mid-distance beat to rule out");
  for (const beat of plain) {
    const y = roadY(play.scene, beat.time, at);
    assert.strictEqual(
      rows.filter((row) => Math.abs(row - y) < 1.5).length,
      0,
      "a beat " + (beat.time - at).toFixed(1) + " s off was given a lamp, though nobody could pick it out"
    );
  }

  // And no two lamps are nearer than two pixels - nearer than that and they are one
  // light, not two. The one exception is a beat the music is marking for itself,
  // which stands where the music says it stands, bar line or none. Mostly this is a
  // claim about the piece rather than the picture: the tightest the road ever gets
  // is one lamp to a bar 2.3 px off the next, which is why the picture needs no
  // rule of its own to keep them apart. Should a livelier piece ever wear this look,
  // this is the test that would notice first.
  for (const one of frames) {
    const lines = onTheVerge(one[1].added).map((box) => Math.round((box.y + box.h / 2) * 10) / 10);
    const marked = play
      .beats()
      .filter((beat) => beat.bright)
      .map((beat) => roadY(play.scene, beat.time, one[0]));
    const apart = Array.from(new Set(lines)).sort((first, other) => first - other);
    for (let i = 1; i < apart.length; i++) {
      if (apart[i] - apart[i - 1] >= 1.9) continue;
      const excused = marked.some((y) => Math.abs(y - apart[i]) < 2 || Math.abs(y - apart[i - 1]) < 2);
      assert.ok(
        excused,
        "at " + one[0].toFixed(1) + " s two lamps " + (apart[i] - apart[i - 1]).toFixed(1) + " px apart are one light, not two, and neither is a marked beat"
      );
    }
  }
});

test("BWV 645: the chorale keeps its lamp a minute off, which no ladder could show", () => {
  const play = roadPlaying();
  const at = 100;
  const worth = play.beats().filter((beat) => beat.bright && beat.time > at + 60);
  assert.ok(worth.length > 0, "the pulse should have a marked beat the best part of a minute off");
  const seen = play.see(at);
  const lamps = onTheVerge(seen.added);
  const gap = play.beats()[0].gap;
  for (const beat of worth) {
    const y = roadY(play.scene, beat.time, at);
    assert.ok(y > HORIZON_Y, "this marked beat has already gone past the horizon");
    const here = lamps.filter((box) => Math.abs(box.y + box.h / 2 - y) < 2);
    assert.ok(here.length >= 2, "the beat the music is marking at " + beat.time + " s has no lamp " + (beat.time - at).toFixed(0) + " s off");

    // ... and it stands out from an ordinary bar a like distance off.
    const ordinary = play
      .beats()
      .filter((one) => one.bar && !one.bright && Math.abs(one.time - beat.time) > 2 && Math.abs(one.time - beat.time) < 6 * gap)[0];
    assert.ok(ordinary, "there should be an ordinary bar about as far off to compare it with");
    const there = lamps.filter((box) => Math.abs(box.y + box.h / 2 - roadY(play.scene, ordinary.time, at)) < 2);
    assert.ok(there.length >= 2, "nothing was drawn for the ordinary bar at " + ordinary.time + " s");
    const brightest = (boxes) => Math.max.apply(null, boxes.map((box) => box.alpha));
    assert.ok(
      brightest(here) > brightest(there) + 0.05,
      "a marked beat a minute off is no brighter than an ordinary one: " +
        brightest(here).toFixed(2) + " against " + brightest(there).toFixed(2)
    );
    assert.ok(
      Math.max.apply(null, here.map((box) => box.w)) > Math.max.apply(null, there.map((box) => box.w)),
      "a marked beat a minute off is no bigger than an ordinary one"
    );
  }
  // ... and the ladder shows two beats and a bit, for comparison.
  assert.ok(worth[0].time - at > 20, "a beat within twenty seconds is nothing a ladder could not show");
});

test("BWV 645: a struck beat lights the line of sound at the verges, and a let-go one does not", () => {
  const play = roadPlaying();
  const caught = play.beats().find((one) => one.time > 30);
  const letGo = play.beats().find((one) => one.time > caught.time + 6);

  play.see(caught.time - 0.4);
  assert.strictEqual(struckLight(play.see(caught.time - 0.05).added).length, 0, "the road lit up before the beat was struck");

  play.hit(caught.time);
  const struck = play.see(caught.time + 0.15);
  const blooms = struckLight(struck.added);
  assert.ok(blooms.length >= 2, "the beat was struck and " + blooms.length + " blooms were laid");
  for (const bloom of blooms) {
    assert.ok(
      Math.abs(bloom.y + bloom.h / 2 - SOUND_Y) < bloom.h / 2 + 4,
      "a struck beat was not lit on the line of sound: " + JSON.stringify(bloom)
    );
    assert.ok(
      bloom.x <= 4 || bloom.x + bloom.w >= STAGE_WIDTH - 4,
      "a struck beat was lit away from the verges: " + JSON.stringify(bloom)
    );
  }

  // A beat nobody struck, and the light has gone out on its own by now.
  const gone = play.see(letGo.time + 1.2);
  assert.strictEqual(struckLight(gone.added).length, 0, "a beat nobody struck lit the road anyway");

  // A click with no beat near it: a dull flick at either hand, and no bloom.
  const far = play.beats().find((one) => one.time > letGo.time + 8);
  play.hit(far.time + 0.6);
  const missed = play.see(far.time + 0.65);
  assert.strictEqual(struckLight(missed.added).length, 0, "a click that caught nothing rang a bloom anyway");
  const atTheLine = missed.added.filter((box) => Math.abs(box.y + box.h / 2 - SOUND_Y) < 4);
  assert.ok(atTheLine.length > 0, "a missed click drew nothing on the line of sound");
  assert.ok(
    atTheLine.some((box) => box.alpha > 0.02),
    "a missed click drew nothing at all: " + JSON.stringify(atTheLine)
  );
  assert.ok(
    atTheLine.every((box) => box.w <= 20),
    "a missed click drew something wider than a flick: " + JSON.stringify(atTheLine)
  );
});

test("BWV 645: the pulse is never gold, because the chorale is, and never warm, because a repeat is", () => {
  const play = roadPlaying();
  const gold = play.scene.look.colours["2"]; // the line to follow wears gold on this piece
  assert.strictEqual(gold, "#ffd47a", "the chorale's gold has changed; the test should say so");
  const worth = play.beats().find((beat) => beat.bright && beat.time > 80);
  assert.ok(worth, "the chorale should mark a beat to strike");

  // The goldiest moment there is for a player: a beat the music is marking, struck.
  play.see(worth.time - 0.2);
  play.hit(worth.time);
  const frames = [play.see(worth.time + 0.1), play.see(worth.time + 0.5), play.see(120), play.see(40)];
  const isWarm = (box) => String(box.colour).indexOf(gold) >= 0 || String(box.fill).indexOf(gold) >= 0;
  const isRepeat = (box) => String(box.colour).indexOf(WARM_LINE) >= 0 || String(box.fill).indexOf(WARM_LINE) >= 0;
  for (const seen of frames) {
    assert.ok(seen.added.length > 0, "playing along drew nothing to check the colour of");
    assert.strictEqual(seen.added.filter(isWarm).length, 0, "gold light was drawn by playing along at " + seen.frame.mean);
    assert.strictEqual(seen.added.filter(isRepeat).length, 0, "warm light was drawn by playing along");
  }
});

test("BWV 645: the lamps along the road are cheap to draw, and burn nothing out on their own", () => {
  const play = roadPlaying();
  const scene = play.scene;
  const beats = play.beats();
  const luma = (spot) => 0.2126 * spot[0] + 0.7152 * spot[1] + 0.0722 * spot[2];
  let index = 0;
  let most = 0;
  let mean = 0;
  let tipped = 0;
  let rung = 0;
  let brightest = 0;
  let peak = 0;
  for (let at = 1; at < scene.data.duration; at += 1 / 6) {
    while (index < beats.length && beats[index].time < at) {
      if (at - beats[index].time < 0.3) play.hit(beats[index].time);
      index++;
    }
    play.alone.frame(at);
    const plain = play.alone.air.map(luma);
    const seen = play.see(at);
    most = Math.max(most, seen.marks);
    mean = Math.max(mean, seen.frame.mean);
    peak = Math.max(peak, seen.frame.peak);
    rung = play.score().caught;
    // No lamp is ever struck bright: a dozen of them stand within a hair of one
    // another down the road, and that is how a heap of lights becomes one smear.
    for (const box of onTheVerge(seen.added)) brightest = Math.max(brightest, box.alpha);
    // A cell may only burn out if the picture had all but burned it out already.
    play.air.forEach((spot, k) => {
      if (luma(spot) > 0.9 && plain[k] < 0.85) tipped++;
    });
  }
  assert.ok(brightest < 0.5, "a lamp is drawn at " + brightest.toFixed(2) + " of full light: the road would burn out white");
  // Not just the lamps' own doing: a struck beat lays its bloom on the line of
  // sound, where the notes are at their brightest, and the two together may not
  // pass white either.
  assert.ok(peak < 0.9, "with the pulse on the brightest cell reaches " + peak.toFixed(3) + " of full light");
  assert.ok(most > 400, "one frame draws only " + most + " marks with the pulse on: is the picture missing?");
  assert.ok(most < 1500, "one frame draws " + most + " boxes with the pulse on: that will not keep up");
  assert.ok(mean < 0.06, "the road is washed out with the pulse on: worst mean light " + mean.toFixed(4));
  assert.strictEqual(tipped, 0, tipped + " cells burned out white because of the pulse alone");
  assert.ok(rung > 20, "the player struck " + rung + " bells in " + Math.round(scene.data.duration) + " s: the harness is not striking");
});

test("BWV 645: a run lights the verges, and letting a beat go takes it back", () => {
  const play = roadPlaying();
  // The road's own version of the ladder's line getting wider: the verges of it
  // take up a light while the player stays with the piece.
  const edge = (added) =>
    added.filter((box) => box.colour === VIGIL_MARK && box.h > 300 && Math.abs(box.x + box.w / 2 - VIGIL_LEFT) < 20);
  const from = play.beats().find((one) => one.time > 60);
  const four = play.beats().slice(play.beats().indexOf(from), play.beats().indexOf(from) + 4);
  assert.strictEqual(four.length, 4, "the harness wanted four beats in a row and found " + four.length);

  play.see(from.time - 0.5);
  assert.strictEqual(edge(play.see(from.time - 0.05).added).length, 0, "the verges were lit before anything was struck");

  for (const beat of four) {
    play.hit(beat.time);
    play.see(beat.time + 0.05);
  }
  assert.strictEqual(play.score().chain, 4, "the four beats did not make a run");
  assert.ok(edge(play.see(four[3].time + 0.1).added).length > 0, "four beats in a row and the verges did not light");

  // Let one go, and it is back to plain.
  const next = play.beats().find((one) => one.time > four[3].time + 0.2);
  play.see(next.time - 0.2);
  play.see(next.time + 0.1);
  play.see(next.time + 0.4);
  assert.strictEqual(play.score().chain, 0, "letting the beat go did not end the run");
  assert.strictEqual(edge(play.see(next.time + 0.45).added).length, 0, "the verges kept their light after the run ended");
});

// --- playing along: the braid stands its beats on a ruler --------------------
//
// BWV 639 runs sideways: one phrase of four bars is exactly one screen wide, so a
// beat of this piece has a place of its own in the picture - about eighty pixels
// from the next one, and twelve of them on the screen at a time. The game's ladder
// shows two beats and falls straight down the middle of a picture whose time goes
// sideways, so the braid takes the pulse itself: a ruler of beats along the top of
// the music and along the bottom of it, where no note is ever drawn.

const BRAID_MARK = "#e8f1ff"; // src/look-braid.js: a beat stood on the ruler
const BRAID_CLEAR = 10; // the gap a beat keeps from the music
const BRAID_TICK = 22; // ... and how tall it stands when it is due
const BRAID_SOUND_X = Math.round(STAGE_WIDTH * 0.26); // the line of sound
const BRAID_GOLD = "#ffd47a"; // the chorale's own, and a phrase said again

/**
 * The look's own geometry: how fast the music crosses the screen, and where the
 * two rows of the ruler stand. Copied on purpose - a test that cannot say where a
 * beat is drawn cannot say it was drawn either.
 */
function braidAt(scene) {
  const barSeconds = scene.data.bars[1] - scene.data.bars[0];
  const margin = Math.min(150, STAGE_HEIGHT * 0.16);
  return {
    speed: Math.max(12, Math.min(150, STAGE_WIDTH / (4 * barSeconds))),
    lineX: BRAID_SOUND_X,
    top: margin - BRAID_CLEAR, // the top row grows up from here
    bottom: STAGE_HEIGHT - margin + BRAID_CLEAR, // the bottom row grows down from here
    bandTop: margin,
    bandBottom: STAGE_HEIGHT - margin,
    tall: Math.max(6, Math.min(BRAID_TICK, margin - BRAID_CLEAR * 2)),
  };
}

/** The woven picture with a player striking its beats, kept beside the same
 *  picture on its own: `see(seconds)` frames both and hands back what playing
 *  along added, which is the ruler and nothing else. */
function braidPlaying() {
  const scene = sceneOf("bwv639-ich-ruf-zu-dir");
  const picture = createStage(scene);
  const stage = createStage(scene, { play: true });
  const geo = braidAt(scene);
  return {
    scene: scene,
    geo: geo,
    painted: () => stage.painted(),
    beats: () => [...stage.beats()],
    hit: (at) => stage.hit(at),
    score: () => stage.score(),
    /** Where a second of the piece stands on the screen. */
    where: (at, now) => geo.lineX + (at - now) * geo.speed,
    see: function (seconds) {
      const plain = picture.frame(seconds);
      const count = picture.drawn.length;
      const seen = stage.frame(seconds);
      return { frame: seen, plain: plain, added: stage.drawn.slice(count), marks: stage.drawn.length };
    },
    alone: picture,
    air: stage.air,
  };
}

/** A beat on the ruler: a thin mark, and the soft light behind it. */
function onTheRuler(boxes, geo) {
  return boxes.filter(
    (box) => box.colour === BRAID_MARK && box.w <= 8 && box.h <= geo.tall + 0.01
  );
}

/** The light a struck beat lays: a contracting ring, and the only gradient the ruler draws. */
function braidStruck(boxes) {
  return boxes.filter((box) => box.colour === "(gradient)");
}

test("BWV 639: the braid takes the pulse itself, and lays no ladder over it", () => {
  const play = braidPlaying();
  assert.strictEqual(play.painted(), true, "the woven picture did not take the pulse off the game");

  const seen = play.see(20);
  assert.ok(seen.added.length > 40, "playing along drew only " + seen.added.length + " marks");

  // A beam of the ladder is a short wide bar falling down the middle of the screen.
  const beams = seen.added.filter((box) => box.w > 60 && box.h <= 3);
  assert.strictEqual(beams.length, 0, "a wide thin bar of the ladder was drawn across the braid");

  const ruler = onTheRuler(seen.added, play.geo);
  const above = ruler.filter((box) => box.y + box.h <= play.geo.bandTop);
  const below = ruler.filter((box) => box.y >= play.geo.bandBottom);
  assert.ok(above.length > 16, "only " + above.length + " marks along the top of the music");
  assert.strictEqual(
    below.length,
    above.length,
    "the two rows do not match: " + below.length + " below against " + above.length
  );
});

test("BWV 639: a beat stands on the ruler at its own place, and none between", () => {
  const play = braidPlaying();
  const at = 20;
  const seen = play.see(at);
  const ruler = onTheRuler(seen.added, play.geo);
  const coming = play.beats().filter(
    (beat) => beat.time >= at - 0.3 && play.where(beat.time, at) < STAGE_WIDTH
  );
  assert.ok(coming.length > 10, "only " + coming.length + " beats of this phrase are on the screen");

  for (const beat of coming) {
    const x = play.where(beat.time, at);
    const marks = ruler.filter((box) => Math.abs(box.x + box.w / 2 - x) < 1.5);
    assert.ok(marks.length >= 2, "nothing was drawn at the beat " + beat.time.toFixed(2) + " s (" + x.toFixed(0) + " px)");
  }

  // Halfway between two beats there is nothing to strike, and nothing drawn.
  const middle = (play.where(coming[4].time, at) + play.where(coming[5].time, at)) / 2;
  assert.strictEqual(
    ruler.filter((box) => Math.abs(box.x + box.w / 2 - middle) < 3).length,
    0,
    "there is a mark halfway between two beats, which is nobody's beat"
  );

  // And they are far enough apart to be told one from another. This is a claim
  // about the piece: a livelier one worn by this picture would have to say so.
  // Only the marks themselves count, not the soft light drawn under each of them,
  // and only one row of the pair: the two of them stand one above the other.
  const places = ruler
    .filter((box) => box.w <= 2 && box.y + box.h <= play.geo.bandTop)
    .map((box) => box.x + box.w / 2)
    .sort((a, b) => a - b);
  let nearest = 1e9;
  for (let i = 1; i < places.length; i++) nearest = Math.min(nearest, places[i] - places[i - 1]);
  assert.ok(nearest > 40, "the closest two marks on the ruler are " + nearest.toFixed(1) + " px apart");
  assert.ok(places.length > 10, "only " + places.length + " beats are stood on the ruler");
});

test("BWV 639: the ruler is outside the music, along its top and its bottom", () => {
  const play = braidPlaying();
  for (const at of [0, 20, 60, 110]) {
    const seen = play.see(at);
    // Near the end there are only a few beats left on the screen, and that is
    // honest: the piece is running out, and so is the ruler.
    assert.ok(onTheRuler(seen.added, play.geo).length > 8, "the ruler was not drawn at " + at + " s");
    for (const box of seen.added) {
      const clear = box.y + box.h <= play.geo.bandTop + 0.01 || box.y >= play.geo.bandBottom - 0.01;
      assert.ok(
        clear,
        "playing along drew over the music at " + at + " s: " + JSON.stringify(box)
      );
    }
  }
});

test("BWV 639: the phrase said again keeps its mark a screen away, which no ladder could show", () => {
  const play = braidPlaying();
  const at = 8;
  const worth = play.beats().find((beat) => beat.bright && beat.time > at);
  assert.ok(worth, "the repeat at 0:26 should mark a beat to strike");
  const away = worth.time - at;
  const ladder = 2.2 * play.beats()[0].gap; // what the game's ladder reaches, in seconds
  assert.ok(away > 5 * ladder, "this marked beat is only " + away.toFixed(1) + " s off: the test wants one a ladder could never show");

  const seen = play.see(at);
  const x = play.where(worth.time, at);
  assert.ok(x < STAGE_WIDTH, "the marked beat is not even on the screen at " + at + " s");
  const ruler = onTheRuler(seen.added, play.geo);
  const mine = ruler.filter((box) => Math.abs(box.x + box.w / 2 - x) < 1.5);
  assert.ok(mine.length >= 2, "the marked beat a whole phrase off was drawn nowhere");

  // The nearest beat that the music leaves plain, at the same distance, must stand
  // for less: taller and brighter is the only way a player can pick it out early.
  const plain = play
    .beats()
    .filter((beat) => !beat.bright && beat.time > at && Math.abs(play.where(beat.time, at) - x) < 120)
    .sort((a, b) => Math.abs(play.where(a.time, at) - x) - Math.abs(play.where(b.time, at) - x))[0];
  assert.ok(plain, "the harness wanted a plain beat near the marked one");
  const px = play.where(plain.time, at);
  const theirs = ruler.filter((box) => Math.abs(box.x + box.w / 2 - px) < 1.5);
  assert.ok(theirs.length >= 2, "the plain beat beside the marked one was drawn nowhere");
  const brightest = (boxes) => Math.max(...boxes.map((box) => box.alpha));
  const tallest = (boxes) => Math.max(...boxes.map((box) => box.h));
  assert.ok(
    brightest(mine) > 2 * brightest(theirs),
    "a marked beat is only " + brightest(mine).toFixed(3) + " against a plain " + brightest(theirs).toFixed(3)
  );
  assert.ok(
    tallest(mine) > 1.5 * tallest(theirs),
    "a marked beat stands " + tallest(mine).toFixed(1) + " px, a plain one " + tallest(theirs).toFixed(1)
  );
});

test("BWV 639: the ruler stretches where the piece slows down", () => {
  const play = braidPlaying();
  const beats = play.beats();
  const at = 100; // four bars from the end, inside the ritardando
  const seen = play.see(at);
  const ruler = onTheRuler(seen.added, play.geo);
  const gapAt = (from) => play.where(beats[from + 1].time, at) - play.where(beats[from].time, at);
  const early = gapAt(2);
  const late = gapAt(beats.length - 3);
  assert.ok(late > early * 1.2, "the last beats stand " + late.toFixed(0) + " px apart against " + early.toFixed(0) + " px: the slowing is not felt");
  assert.ok(ruler.length > 8, "so little is on the ruler near the end: " + ruler.length);
});

test("BWV 639: a struck beat lights the line of sound at both edges of the music, and a let-go one does not", () => {
  const play = braidPlaying();
  const caught = play.beats().find((one) => one.time > 30);
  const letGo = play.beats().find((one) => one.time > caught.time + 6);

  play.see(caught.time - 0.4);
  assert.strictEqual(braidStruck(play.see(caught.time - 0.05).added).length, 0, "the ruler lit up before the beat was struck");

  play.hit(caught.time);
  const struck = play.see(caught.time + 0.15);
  const blooms = braidStruck(struck.added);
  assert.ok(blooms.length >= 2, "the beat was struck and " + blooms.length + " blooms were laid");
  for (const bloom of blooms) {
    const centre = [bloom.x + bloom.w / 2, bloom.y + bloom.h / 2];
    assert.ok(Math.abs(centre[0] - play.geo.lineX) < 4, "a struck beat was lit away from the line of sound: " + JSON.stringify(bloom));
    const onARow = Math.abs(centre[1] - play.geo.top) < 3 || Math.abs(centre[1] - play.geo.bottom) < 3;
    assert.ok(onARow, "a struck beat was not lit where the ruler stands: " + JSON.stringify(bloom));
  }

  // A beat nobody struck, and the light has gone out on its own by now.
  const gone = play.see(letGo.time + 1.2);
  assert.strictEqual(braidStruck(gone.added).length, 0, "a beat nobody struck lit the ruler anyway");

  // A beat caught early is gone from the ruler, where one nobody struck keeps its
  // mark: the light moved to the line of sound, it did not double up.
  const early = play.beats().find((one) => one.time > letGo.time + 2);
  const moment = early.time - 0.2;
  play.see(moment);
  play.hit(moment);
  const caughtEarly = play.see(moment);
  const x = play.where(early.time, moment);
  assert.ok(x > 0 && x < STAGE_WIDTH, "the caught beat is not on the screen to be missed");
  assert.strictEqual(
    onTheRuler(caughtEarly.added, play.geo).filter((box) => Math.abs(box.x + box.w / 2 - x) < 1.5).length,
    0,
    "the beat was caught and its mark stayed on the ruler anyway"
  );
  const kept = play.beats().find((one) => one.time > early.time + 1.5);
  assert.ok(
    onTheRuler(caughtEarly.added, play.geo).filter((box) => Math.abs(box.x + box.w / 2 - play.where(kept.time, moment)) < 1.5).length >= 2,
    "a beat nobody struck lost its mark too"
  );

  // A click with no beat near it: a dull flick at either hand, and no bloom.
  const far = play.beats().find((one) => one.time > letGo.time + 8);
  play.hit(far.time + 0.6);
  const missed = play.see(far.time + 0.65);
  assert.strictEqual(braidStruck(missed.added).length, 0, "a click that caught nothing rang a bloom anyway");
  const flicks = missed.added.filter(
    (box) => box.colour === BRAID_MARK && box.h <= 2 && Math.abs(box.x + box.w / 2 - play.geo.lineX) < 12
  );
  assert.ok(flicks.length > 0, "a missed click drew nothing on the line of sound");
  assert.ok(
    flicks.some((box) => box.alpha > 0.02),
    "a missed click drew something at no light at all: " + JSON.stringify(flicks)
  );
  assert.ok(flicks.every((box) => box.w <= 20), "a missed click drew something wider than a flick");
});

test("BWV 639: the pulse is never gold, because the chorale is and so is a repeat", () => {
  const play = braidPlaying();
  const gold = play.scene.look.colours["1"]; // the line to follow wears gold on this piece
  assert.strictEqual(gold, BRAID_GOLD, "the chorale's gold has changed; the test should say so");
  const worth = play.beats().find((beat) => beat.bright && beat.time > 20);
  assert.ok(worth, "the repeat should mark a beat to strike");

  play.see(worth.time - 0.2);
  play.hit(worth.time);
  const frames = [play.see(worth.time + 0.1), play.see(worth.time + 0.5), play.see(60), play.see(20)];
  const isGold = (box) => String(box.colour).indexOf(BRAID_GOLD) >= 0 || String(box.fill).indexOf(BRAID_GOLD) >= 0;
  for (const seen of frames) {
    assert.ok(seen.added.length > 0, "playing along drew nothing to check the colour of");
    assert.strictEqual(seen.added.filter(isGold).length, 0, "gold light was drawn by playing along at " + seen.frame.mean.toFixed(4));
  }
});

test("BWV 639: the ruler is cheap to draw, and tips nothing over white on its own", () => {
  // Walked every sixtieth of a second, because the harness samples one point per
  // cell and a coarser grid can walk straight past the one frame where a struck
  // beat lands on a note that was already blazing. This piece is two minutes, so
  // this is the slowest thing in the folder on purpose.
  const play = braidPlaying();
  const scene = play.scene;
  const beats = play.beats();
  const luma = (spot) => 0.2126 * spot[0] + 0.7152 * spot[1] + 0.0722 * spot[2];
  let index = 0;
  let most = 0;
  let mean = 0;
  let tipped = 0;
  let rung = 0;
  let brightest = 0;
  let worstAlone = 0;
  for (let at = 1; at < scene.data.duration; at += 1 / 60) {
    while (index < beats.length && beats[index].time < at) {
      if (at - beats[index].time < 0.3) play.hit(beats[index].time);
      index++;
    }
    const seen = play.see(at);
    const plainAir = play.alone.air.map(luma); // the same second, with nobody playing
    most = Math.max(most, seen.marks);
    mean = Math.max(mean, seen.frame.mean);
    worstAlone = Math.max(worstAlone, seen.plain.mean);
    rung = play.score().caught;
    // No beat is ever struck bright: a dozen of them stand down one ruler, and a
    // heap of bright lights along a line is one white smear.
    for (const box of onTheRuler(seen.added, play.geo)) brightest = Math.max(brightest, box.alpha);
    // This picture already burns a cell out where a note crosses the line of
    // sound; a cell may only go over on the ruler's account if the music had not
    // all but done it already.
    play.air.forEach((spot, k) => {
      if (luma(spot) > 0.9 && plainAir[k] < 0.85) tipped++;
    });
  }
  assert.ok(brightest < 0.5, "a beat is drawn at " + brightest.toFixed(2) + " of full light: the ruler would burn out white");
  assert.ok(most > 200, "one frame draws only " + most + " marks with the pulse on: is the picture missing?");
  assert.ok(most < 1500, "one frame draws " + most + " boxes with the pulse on: that will not keep up");
  assert.ok(mean < worstAlone + 0.004, "the ruler costs too much light: worst mean " + mean.toFixed(4) + " against " + worstAlone.toFixed(4) + " without it");
  assert.strictEqual(tipped, 0, tipped + " cells burned out white because of the pulse alone");
  assert.ok(rung > 40, "the player struck " + rung + " bells in " + Math.round(scene.data.duration) + " s: the harness is not striking");
});

test("BWV 639: a run lights the ruler, and letting a beat go takes it back", () => {
  const play = braidPlaying();
  // The braid's own version of the ladder's line getting wider: the ruler and the
  // line of sound it is crossed by take up a light while the player stays with it.
  const edge = (added) =>
    added.filter(
      (box) => box.colour === BRAID_MARK && box.h > 300 && Math.abs(box.x + box.w / 2 - play.geo.lineX) < 12
    );
  const from = play.beats().find((one) => one.time > 60);
  const four = play.beats().slice(play.beats().indexOf(from), play.beats().indexOf(from) + 4);
  assert.strictEqual(four.length, 4, "the harness wanted four beats in a row and found " + four.length);

  play.see(from.time - 0.5);
  assert.strictEqual(edge(play.see(from.time - 0.05).added).length, 0, "the ruler was lit before anything was struck");

  for (const beat of four) {
    play.hit(beat.time);
    play.see(beat.time + 0.05);
  }
  assert.strictEqual(play.score().chain, 4, "the four beats did not make a run");
  assert.ok(edge(play.see(four[3].time + 0.1).added).length > 0, "four beats in a row and the ruler did not brighten");

  // Let one go, and it is back to plain.
  const next = play.beats().find((one) => one.time > four[3].time + 0.2);
  play.see(next.time - 0.2);
  play.see(next.time + 0.1);
  play.see(next.time + 0.4);
  assert.strictEqual(play.score().chain, 0, "letting the beat go did not end the run");
  assert.strictEqual(edge(play.see(next.time + 0.45).added).length, 0, "the ruler kept its light after the run ended");
});
