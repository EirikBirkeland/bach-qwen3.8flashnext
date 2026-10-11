// Playing along: being there when the beat arrives.
//
// Nothing here can hear the bell or see the ladder, but it can say what a strike
// counted for, what note the bell rang, and where a beat was drawn - which is
// most of what a player would notice gone wrong. The claims about the real pieces
// are the ones the design rests on: that the bell takes its note from the harmony
// that is actually sounding, and that the ladder keeps the same pace whatever the
// piece's tempo is.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";
import { gameScripts } from "./files.mjs";
import { loadPieces, rolesFor } from "./render.mjs";

const root = new URL("..", import.meta.url);

const sandbox = vm.createContext({ window: { innerWidth: 1280, innerHeight: 800 } });
for (const file of gameScripts()) {
  vm.runInContext(fs.readFileSync(new URL(file, root), "utf8"), sandbox, { filename: file });
}
const Bach = sandbox.window.Bach;

const plain = (list) => [...list];

function dataOf(slug) {
  return JSON.parse(fs.readFileSync(new URL("data/" + slug + ".json", root), "utf8"));
}

/** The notes of a data file, as the page hands them to the game - with the line
 *  each one belongs to, because the size of a bell is worked out from that. */
function notesOf(slug) {
  const data = dataOf(slug);
  const roles = rolesFor(loadPieces().find((piece) => piece.slug === slug));
  const at = data.format.indexOf.bind(data.format);
  return data.notes
    .map((row) => ({
      voice: row[at("voice")],
      pitch: row[at("pitch")],
      time: row[at("time")],
      length: row[at("duration")],
      velocity: row[at("velocity")],
      role: roles[String(row[at("voice")])] || "inner",
    }))
    .sort((a, b) => a.time - b.time || a.pitch - b.pitch);
}

function note(voice, pitch, time, length) {
  return { voice: voice, pitch: pitch, time: time, length: length };
}

/** A canvas that writes down every box of light it was asked for. */
function fakeCanvas() {
  const drawn = { rects: [], gradients: 0, glows: [] };
  const stops = { addColorStop() {} };
  const ctx = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    fillRect(x, y, width, height) {
      for (const one of [x, y, width, height]) {
        assert.ok(Number.isFinite(one), "a box of light with a nonsense number in it: " + [x, y, width, height]);
      }
      drawn.rects.push({ x: x, y: y, w: width, h: height, fill: ctx.fillStyle, alpha: ctx.globalAlpha });
    },
    createRadialGradient(x, y, from, x2, y2, to) {
      for (const one of [x, y, from, x2, y2, to]) {
        assert.ok(Number.isFinite(one), "a glow centred on a nonsense number: " + [x, y, from, x2, y2, to]);
      }
      drawn.gradients += 1;
      drawn.glows.push({ x: x, y: y, to: to, alpha: ctx.globalAlpha });
      return stops;
    },
    createLinearGradient() {
      drawn.gradients += 1;
      return stops;
    },
  };
  return {
    tag: "canvas",
    drawn: drawn,
    getContext(kind) {
      assert.strictEqual(kind, "2d");
      return ctx;
    },
  };
}

/** The organ, as far as the game meets it: it is told what note to ring, and how
 *  big a bell the piece asks for. */
function fakeOrgan() {
  const rung = [];
  return {
    rung: rung,
    chime(pitch, when, weight, touch) {
      assert.ok(pitch >= 12 && pitch <= 108, "a bell was asked for an impossible note: " + pitch);
      assert.ok(weight > 0 && weight <= 1.5 + 0.001, "a bell was struck too hard: " + weight);
      assert.ok(
        Number.isFinite(touch.level) && touch.level > 0 && touch.level < 0.2,
        "the game handed the bell a size that is none: " + JSON.stringify(touch)
      );
      assert.ok(
        Number.isFinite(touch.decay) && touch.decay > 0.05 && touch.decay < 4,
        "the game handed the bell a length that is none: " + JSON.stringify(touch)
      );
      rung.push({ pitch: pitch, weight: weight, touch: touch });
    },
  };
}

/** A game over a small piece: four beats a bar, one second a beat, one low note held. */
function smallGame() {
  const organ = fakeOrgan();
  const canvas = fakeCanvas();
  const game = Bach.createGame(canvas, organ);
  const data = { metre: { beats: 4, beat: 4 }, bars: [0, 4, 8], duration: 9 };
  const notes = [note(1, 48, 0, 20), note(2, 60, 0, 20)];
  game.open(notes, data);
  game.enable(true);
  return { game: game, organ: organ, canvas: canvas, data: data, notes: notes };
}

test("while nobody is playing along, nothing is asked and nothing is drawn", () => {
  const organ = fakeOrgan();
  const canvas = fakeCanvas();
  const game = Bach.createGame(canvas, organ);
  game.open([note(1, 48, 0, 9)], { metre: { beats: 4, beat: 4 }, bars: [0, 4], duration: 8 });
  assert.strictEqual(game.hit(1), null, "a click in the dark asked for nothing");
  game.frame(1);
  assert.strictEqual(canvas.drawn.rects.length, 0, "just watching draws no ladder");
  assert.strictEqual(game.line(), "", "and says nothing about a run nobody is on");
});

test("a beat struck on time is caught, and the bell rings its note", () => {
  const { game, organ } = smallGame();
  const struck = game.hit(1);
  assert.strictEqual(struck.kind, "true");
  assert.strictEqual(game.numbers().caught, 1);
  assert.strictEqual(game.numbers().chain, 1);
  assert.strictEqual(organ.rung.length, 1);
  // The lowest note sounding is 48, two octaves up is 72.
  assert.strictEqual(organ.rung[0].pitch, 72);
});

test("a little early still counts, a lot early is only a click", () => {
  const { game, organ } = smallGame();
  assert.strictEqual(game.hit(0.75).kind, "near", "a quarter of a second early is still the beat");
  assert.strictEqual(organ.rung.length, 1);
  assert.strictEqual(game.hit(2.4).kind, "stray", "more than that is nothing at all");
  assert.strictEqual(organ.rung.length, 1, "and it rang no bell");
});

test("one beat is caught once, and drumming on it is not a run", () => {
  const { game } = smallGame();
  assert.strictEqual(game.hit(1).kind, "true");
  assert.strictEqual(game.hit(1.02).kind, "stray");
  assert.strictEqual(game.numbers().chain, 0, "the second click gave the run back");
  assert.strictEqual(game.numbers().caught, 1, "but the beat was only caught the once");
});

test("the run grows while the beats are caught, and ends when one is let go", () => {
  const { game } = smallGame();
  game.hit(0);
  // Frames kept coming, a quarter of a second apart, as they do on a screen.
  for (let t = 0.25; t <= 4.5; t += 0.25) {
    if (t === 1 || t === 2 || t === 3) game.hit(t);
    game.frame(t);
  }
  assert.strictEqual(game.numbers().caught, 4);
  assert.strictEqual(game.numbers().best, 4);
  assert.strictEqual(game.numbers().chain, 0, "letting a beat go ends the run");
});

test("moving somewhere else in the piece does not end the run", () => {
  const { game } = smallGame();
  game.hit(0);
  game.hit(1);
  game.frame(1.2);
  assert.strictEqual(game.numbers().chain, 2);
  game.frame(6.2); // twelve seconds along, the old beats are nobody's business
  assert.strictEqual(game.numbers().chain, 2, "a jump is not a missed beat");
});

test("the bell takes its note from what is sounding, and stays in register", () => {
  const organ = fakeOrgan();
  const game = Bach.createGame(fakeCanvas(), organ);
  // A pedal note that lets go halfway through the piece, over a manual one.
  game.open([note(1, 60, 0, 20), note(3, 36, 0, 2.5)], { metre: { beats: 4, beat: 4 }, bars: [0, 4], duration: 8 });
  game.enable(true);
  game.hit(1);
  game.hit(3);
  assert.strictEqual(organ.rung[0].pitch, 60, "while the pedal sounds, the bell is its octave above the octave");
  assert.strictEqual(organ.rung[1].pitch, 84, "after it lets go, the manual is the lowest thing there is");
  assert.ok(game.bell(24) >= 60, "a pedal C becomes a bell, not a rumble");
  assert.ok(game.bell(96) <= 91, "and a top C becomes a bell, not a squeak");
});

test("the ladder's pace comes from the piece's own beat", () => {
  const slow = Bach.createGame(fakeCanvas(), fakeOrgan());
  const quick = Bach.createGame(fakeCanvas(), fakeOrgan());
  slow.open([], dataOf("bwv639-ich-ruf-zu-dir"));
  quick.open([], dataOf("bwv565-toccata-and-fugue-d-minor"));
  const slowPace = slow.pace();
  const quickPace = quick.pace();
  assert.ok(slowPace.gap > quickPace.gap * 1.5, "one of these is a far slower piece than the other");
  // ... and yet the same number of beats fit on the ladder in both.
  assert.ok(Math.abs(slowPace.look / slowPace.gap - quickPace.look / quickPace.gap) < 0.001);
  assert.ok(slowPace.look / slowPace.gap > 1.5, "at least a beat and a half is coming, so you can see it");
});

test("a beat that the music is marking is gold, and rings for more", () => {
  const data = dataOf("bwv639-ich-ruf-zu-dir");
  const organ = fakeOrgan();
  const game = Bach.createGame(fakeCanvas(), organ);
  game.open(notesOf("bwv639-ich-ruf-zu-dir"), data);
  game.enable(true);
  const gold = plain(game.beats()).filter((beat) => beat.bright);
  assert.ok(gold.length >= 1, "the chorale's opening phrase comes back at 0:25, and that is a beat");
  assert.ok(gold.length <= 4, "and it is not a thing that happens every other beat: " + gold.length + " of them");
  const struck = game.hit(gold[0].time);
  assert.strictEqual(struck.bright, "tune");
  assert.strictEqual(struck.kind, "true");
  assert.ok(organ.rung[organ.rung.length - 1].weight > 1, "a gold beat rings louder than an ordinary one");
});

/** A game over a real piece of music, switched on and ready to be asked about it. */
function over(slug) {
  const organ = fakeOrgan();
  const game = Bach.createGame(fakeCanvas(), organ);
  game.open(notesOf(slug), dataOf(slug));
  game.enable(true);
  return { game: game, organ: organ };
}

test("each piece decides how big its own bell is, and the game hands that over", () => {
  const chorale = over("bwv639-ich-ruf-zu-dir"); // three voices going on every beat
  const toccata = over("bwv565-toccata-and-fugue-d-minor"); // ... and often exactly one
  const passacaglia = over("bwv582-passacaglia-c-minor"); // ... and the fastest beat here

  assert.ok(
    chorale.game.touch().level > toccata.game.touch().level,
    "a bell over a full chorale has to be bigger than one over a bare line: " +
      chorale.game.touch().level.toFixed(3) +
      " against " +
      toccata.game.touch().level.toFixed(3)
  );
  assert.ok(
    chorale.game.touch().decay > passacaglia.game.touch().decay,
    "a bell in a slow piece carries and one in a fast piece is gone: " +
      chorale.game.touch().decay.toFixed(2) +
      " against " +
      passacaglia.game.touch().decay.toFixed(2)
  );

  chorale.game.hit(plain(chorale.game.beats())[0].time);
  assert.strictEqual(
    chorale.organ.rung[chorale.organ.rung.length - 1].touch,
    chorale.game.touch(),
    "the strike did not carry the piece's own bell with it"
  );
});

test("the ladder is drawn where the beats are", () => {
  const { game, canvas } = smallGame();
  const now = 0.5;
  canvas.drawn.rects.length = 0;
  game.frame(now);
  const coming = plain(game.beats()).filter((beat) => beat.time > now && beat.time - now < game.pace().look);
  assert.strictEqual(coming.length, 2, "a beat and a bit is coming: " + coming.length);
  for (const beat of coming) {
    const where = game.place(beat, now);
    // A beat is drawn centred on its own second, so a box may start half a
    // hairline above it or below.
    const bar = canvas.drawn.rects.filter((one) => Math.abs(one.y - where.y) <= 1 && one.fill === "#bcd0f0");
    assert.ok(bar.length > 0, "nothing was drawn at y " + where.y + " for the beat at " + beat.time);
    assert.ok(where.y < 800 - 96, "a beat still to come is above the line of the catch");
  }
  const gone = plain(game.beats()).find((beat) => beat.time < now - 0.3);
  assert.ok(game.place(gone, now).y > 800 - 96, "and one already struck is below it");
});

test("a caught beat is gone from the ladder and lights the line instead", () => {
  const { game, canvas } = smallGame();
  const now = 0.95;
  const beat = plain(game.beats()).find((one) => one.time === 1);
  game.hit(1);
  canvas.drawn.rects.length = 0;
  game.frame(now);
  const where = game.place(beat, now);
  assert.strictEqual(
    canvas.drawn.rects.filter((one) => Math.abs(one.y - where.y) <= 1).length,
    0,
    "the beat you caught is not still hanging there"
  );
  assert.ok(canvas.drawn.gradients > 0, "and its light was laid on the line");
});

test("a caught beat lays its light on the line of sound", () => {
  const { game, canvas } = smallGame();
  game.hit(1);
  canvas.drawn.rects.length = 0;
  canvas.drawn.glows.length = 0;
  game.frame(1.1);
  const sound = 800 - 96; // where a caught beat lands, in this harness's screen
  const glow = canvas.drawn.glows.filter((one) => one.y === sound);
  assert.ok(glow.length >= 2, "the run's glow and the strike's light both want to be on the line: " + glow.length);
  const struck = glow[glow.length - 1];
  assert.ok(struck.to > 40, "the light of a struck beat was tiny: " + struck.to);
  assert.ok(struck.alpha > 0.05, "and faint: " + struck.alpha);
});

test("a strike that caught nothing says so quietly", () => {
  const { game, canvas } = smallGame();
  game.hit(1.6); // nowhere near a beat
  canvas.drawn.rects.length = 0;
  canvas.drawn.glows.length = 0;
  game.frame(1.65);
  assert.strictEqual(canvas.drawn.glows.length, 1, "a missed strike lays no bloom, only the run's glow");
  const marks = canvas.drawn.rects.filter((one) => one.alpha < 0.1 && one.h === 2 && one.w === 18);
  assert.strictEqual(marks.length, 2, "two small marks at the ends of the line, and nothing more");
});

test("the words say the plain thing", () => {
  const { game } = smallGame();
  game.hit(0);
  game.hit(1);
  game.hit(2.2); // a fifth of a second early: caught, but not struck true
  assert.strictEqual(game.line(), "3 in a row · best 3 · 3 of 12");
  assert.strictEqual(game.numbers().truest, 2, "two of them were on the second, one was not");
  assert.strictEqual(
    game.summary(),
    "You were there for 3 of 12 beats · longest run 3 · 2 of them struck true."
  );
});

test("nothing is claimed about a piece nobody struck", () => {
  const { game } = smallGame();
  game.frame(1);
  assert.strictEqual(game.summary(), "", "the end of a piece says nothing about a game that was not played");
});

test("switching to play along starts the count afresh", () => {
  const { game } = smallGame();
  game.hit(0);
  game.hit(1);
  assert.strictEqual(game.numbers().chain, 2);
  game.enable(false);
  assert.strictEqual(game.enabled(), false);
  assert.strictEqual(game.hit(2), null, "and while it is off, a click is only a click");
  game.enable(true);
  assert.strictEqual(game.numbers().caught, 0, "coming back starts again");
  assert.strictEqual(game.numbers().chain, 0);
});

test("a piece's own picture can take the pulse off the game, and give it back", () => {
  const { game, canvas } = smallGame();
  const asked = [];
  game.paint((shot) => {
    asked.push({
      now: shot.now,
      beats: shot.beats.length,
      gap: shot.gap,
      ahead: shot.ahead,
      run: shot.run,
      strikes: shot.strikes.length,
    });
  });
  assert.strictEqual(game.painted(), true, "the game does not say it handed the pulse over");
  game.hit(1);
  canvas.drawn.rects.length = 0;
  game.frame(1.2);
  assert.strictEqual(canvas.drawn.rects.length, 0, "the ladder was drawn as well as the piece's own pulse");
  assert.strictEqual(asked.length, 1, "the picture was not asked for this frame");
  assert.strictEqual(asked[0].beats, 12, "the picture was not handed the piece's beats");
  assert.strictEqual(asked[0].gap, 1, "nor how long they are");
  assert.ok(asked[0].ahead > 1, "nor how far ahead they are worth showing");
  assert.strictEqual(asked[0].strikes, 1, "nor what the player struck");
  assert.ok(Math.abs(asked[0].run - 1 / 16) < 1e-9, "a run of one is a sixteenth of the way to a long one");

  game.paint(null);
  assert.strictEqual(game.painted(), false, "the ladder did not come back");
  canvas.drawn.rects.length = 0;
  game.frame(1.4);
  assert.ok(canvas.drawn.rects.length > 0, "with nothing to paint the pulse with, nothing was drawn");
});

test("a strike says which beat it caught, not only when it landed", () => {
  const { game } = smallGame();
  let shot = null;
  game.paint((one) => {
    shot = one;
  });
  game.hit(2.05); // the beat at 2, struck a whisker late
  game.frame(2.1);
  let strike = shot.strikes[shot.strikes.length - 1];
  assert.strictEqual(strike.when, 2, "a picture that wants to light the beat needs to know which one it was");
  assert.strictEqual(strike.kind, "cool");
  assert.strictEqual(strike.truest, true);

  game.hit(2.6); // nowhere near a beat: it is a click and nothing more
  game.frame(2.65);
  strike = shot.strikes[shot.strikes.length - 1];
  assert.strictEqual(strike.kind, "stray");
  assert.strictEqual(strike.when, null, "a click that caught no beat has no beat to point at");
});
