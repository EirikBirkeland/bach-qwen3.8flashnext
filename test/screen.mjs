// A canvas that measures light instead of showing it. It knows the little the
// page actually draws - plain colours, vertical and radial gradients, and the
// two ways they are laid down - and it adds them up on a coarse grid so a test
// can ask how bright a frame of the picture really is.
//
// It exists because nobody can see the screen from here: this is how "the notes
// are drawn, but nothing is burned white" gets checked by numbers.

import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert";
import { pictureScripts, gameScripts } from "./files.mjs";

const COLS = 64;
const ROWS = 40;

function colourOf(value) {
  if (typeof value !== "string") return null;
  if (value[0] === "#") {
    const n = parseInt(value.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
  }
  const m = /^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+))?\)$/.exec(value.replace(/\s+/g, ""));
  if (!m) return null;
  return [+m[1] / 255, +m[2] / 255, +m[3] / 255, m[4] === undefined ? 1 : +m[4]];
}

function gradient(kind, args) {
  const stops = [];
  return {
    // The colours it was handed, in order, so a test can tell a gold bloom from a
    // blue one: a gradient fill is otherwise just "a gradient" to the harness.
    stops: [],
    addColorStop(at, colour) {
      stops.push([at, colourOf(colour)]);
      this.stops.push(String(colour));
    },
    /** The colour this gradient has at one point of the screen. */
    at(x, y) {
      let along = 0;
      if (kind === "linear") {
        // Any direction: how far along the line from the first point to the second
        // this point lies, square-on, so a gradient drawn sideways is measured as
        // the sideways thing it is and not as its first colour everywhere.
        const across = args[2] - args[0];
        const rise = args[3] - args[1];
        const span = across * across + rise * rise;
        along = span === 0 ? 0 : ((x - args[0]) * across + (y - args[1]) * rise) / span;
      } else {
        // createRadialGradient(x0, y0, r0, x1, y1, r1). Every glow here is one
        // circle inside another, so the middle is the first pair of numbers and
        // the two radii are the third and the sixth.
        const dx = x - args[0];
        const dy = y - args[1];
        const radius = args[5] - args[2] || 1;
        along = (Math.sqrt(dx * dx + dy * dy) - args[2]) / radius;
      }
      along = Math.max(0, Math.min(1, along));
      let before = stops[0];
      let after = stops[stops.length - 1];
      for (let i = 0; i + 1 < stops.length; i++) {
        if (along >= stops[i][0] && along <= stops[i + 1][0]) {
          before = stops[i];
          after = stops[i + 1];
          break;
        }
      }
      const span = after[0] - before[0] || 1;
      const part = (along - before[0]) / span;
      const mixed = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) mixed[k] = before[1][k] + (after[1][k] - before[1][k]) * part;
      return mixed;
    },
  };
}

function luma(air) {
  return 0.2126 * air[0] + 0.7152 * air[1] + 0.0722 * air[2];
}

/** Warm light is what gold looks like: more red than blue. Cool is the other way. */
function warmth(air) {
  return air[0] - air[2];
}

const DARK = [0.02, 0.024, 0.043]; // the dark of the page

/** A gradient drawn with a nonsense number in it is nowhere, and nowhere is not a
 *  thing any of these pictures means to draw. */
function assertFiniteGradient(args) {
  for (const one of args) {
    assert.ok(Number.isFinite(one), "a gradient with a nonsense number in it: " + args);
  }
}

/**
 * A screen the picture can draw on, and the grid of light it collects. Every
 * frame starts from the same dark, so what is measured is one frame, not what a
 * trail left behind.
 *
 * `options.play` says to wire up playing along as index.html wires it - the game
 * over the piece's own beats, and the picture asked whether it wants to draw the
 * pulse in its own world. Measuring the picture *and* the pulse together is how
 * you find out what striking the beat costs in light.
 */
export function createStage(piece, options) {
  const play = !!(options && options.play);
  const width = 1280;
  const height = 800;
  const air = [];
  for (let i = 0; i < COLS * ROWS; i++) air.push(DARK.slice());
  const drawn = []; // every box the picture drew in the last frame

  const context = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    setTransform() {},
    fillRect(x, y, w, h) {
      // A box with a nonsense number in it is invisible rather than wrong, and a
      // picture can lose a whole device that way without any other test noticing.
      // A box covering the whole screen is a wipe and gets away with it.
      if (!(x <= 0 && y <= 0 && w >= width && h >= height)) {
        for (const one of [x, y, w, h]) {
          assert.ok(Number.isFinite(one), "a box of light with a nonsense number in it: " + [x, y, w, h]);
        }
      }
      const plain = colourOf(context.fillStyle);
      const blended = context.globalCompositeOperation === "lighter";
      const isGradient = context.fillStyle && typeof context.fillStyle.at === "function";
      if (!plain && !isGradient) return;
      if (drawn.length < 20000)
        drawn.push({
          x: x,
          y: y,
          w: w,
          h: h,
          alpha: context.globalAlpha,
          // What it was filled with, as far as a plain colour goes: a look's gold
          // and its blue look the same in numbers of light, and a test that cannot
          // tell them apart cannot check a thing is warm.
          colour: plain ? context.fillStyle : "(gradient)",
          // ... and what it was filled with when it was a gradient: its own
          // colours, which is how a bloom can be checked for being gold.
          fill: plain ? context.fillStyle : context.fillStyle.stops.join(" "),
        });
      const left = Math.max(0, x);
      const right = Math.min(width, x + w);
      const top = Math.max(0, y);
      const bottom = Math.min(height, y + h);
      for (let row = 0; row < ROWS; row++) {
        const py = (row + 0.5) * (height / ROWS);
        if (py < top || py > bottom) continue;
        for (let col = 0; col < COLS; col++) {
          const px = (col + 0.5) * (width / COLS);
          if (px < left || px > right) continue;
          const colour = plain || context.fillStyle.at(px, py);
          const alpha = colour[3] * context.globalAlpha;
          if (!(alpha > 0)) continue;
          const spot = air[row * COLS + col];
          for (let k = 0; k < 3; k++) {
            spot[k] = blended ? Math.min(1, spot[k] + alpha * colour[k]) : spot[k] * (1 - alpha) + colour[k] * alpha;
          }
        }
      }
    },
    createLinearGradient(...args) {
      assertFiniteGradient(args);
      return gradient("linear", args);
    },
    createRadialGradient(...args) {
      assertFiniteGradient(args);
      return gradient("radial", args);
    },
    beginPath() {},
    arc() {},
    fill() {},
  };

  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => context,
  };

  const window = {
    devicePixelRatio: 1,
    innerWidth: width,
    innerHeight: height,
    addEventListener() {},
  };
  const sandbox = vm.createContext({ window, console });
  const scripts = pictureScripts();
  if (play) {
    for (const file of gameScripts()) if (scripts.indexOf(file) < 0) scripts.push(file);
  }
  for (const file of scripts) {
    const source = fs.readFileSync(new URL("../" + file, import.meta.url), "utf8");
    vm.runInContext(source, sandbox, { filename: file });
  }

  const look = window.Bach.createVisual(canvas);
  look.reset(piece.notes, piece.look);

  // Playing along, wired the way the page wires it: the game judges the strikes
  // and the picture may take the pulse off its hands. The organ is a stand-in
  // that writes down every bell it was asked for, because nothing here can hear.
  const rung = [];
  let game = null;
  if (play) {
    assert.ok(piece.data, "playing along needs the piece's own bar lines and metre");
    game = window.Bach.createGame(canvas, {
      chime: function (pitch, when, weight, touch) {
        rung.push({ pitch: pitch, weight: weight, level: touch && touch.level, decay: touch && touch.decay });
      },
    });
    game.open(piece.notes, piece.data);
    game.paint(look.pulse());
    game.enable(true);
  }
  return {
    air: air,
    drawn: drawn,
    // The same Bach the picture is reading its looks out of, so a test can ask the
    // page's own finders about the notes it is drawing - about the very note
    // objects the picture was handed, which is what lets it mark them.
    bach: window.Bach,
    /** One frame, measured: how bright the screen was all over, at its brightest
     *  spot, how much of it was gold rather than blue, and how much was burnt out. */
    frame: function (now) {
      for (const spot of air) spot.slice(0, 3).forEach((value, k) => (spot[k] = DARK[k]));
      drawn.length = 0;
      look.frame(now);
      if (game) game.frame(now);
      let mean = 0;
      let peak = 0;
      let burnt = 0;
      let warm = 0;
      for (const spot of air) {
        const bright = luma(spot);
        mean += bright;
        warm += warmth(spot);
        if (bright > peak) peak = bright;
        if (bright > 0.9) burnt++;
      }
      return {
        mean: mean / air.length,
        peak: peak,
        burnt: burnt,
        warm: warm / air.length,
        cells: air.length,
      };
    },
    /** The player struck something at this second of the piece. */
    hit: function (at) {
      assert.ok(game, "this stage is not playing along");
      return game.hit(at);
    },
    /** Whether the piece's own picture is drawing the pulse, or the game's ladder is. */
    painted: function () {
      assert.ok(game, "this stage is not playing along");
      return game.painted();
    },
    /** The bells the stand-in organ was asked for. */
    rung: rung,
    beats: function () {
      assert.ok(game, "this stage is not playing along");
      return game.beats();
    },
    score: function () {
      assert.ok(game, "this stage is not playing along");
      return game.numbers();
    },
  };
}
/**
 * Watch frames of the picture and hand back the one that scores highest on
 * `ranking` - which is how the brightest frame, or the goldiest one, gets found.
 *
 * Frames are a sixtieth of a second apart unless `strideSeconds` says otherwise,
 * which is how a whole piece can be walked over without waiting for it.
 */
function measure(piece, frames, startAt, strideSeconds, ranking) {
  const stride = strideSeconds || 1 / 60;
  const stage = createStage(piece);
  let worst = { mean: 0, peak: 0, burnt: 0, warm: 0, at: 0, cells: 0 };
  let bestScore = -Infinity;
  for (let frame = 0; frame < frames; frame++) {
    const now = startAt + frame * stride;
    const seen = stage.frame(now);
    const score = ranking(seen);
    if (score > bestScore) {
      bestScore = score;
      worst = Object.assign({ at: now }, seen);
    }
  }
  return worst;
}

/** The frame of a piece that lights the most of the screen. */
export function brightestFrame(piece, frames, startAt, strideSeconds) {
  return measure(piece, frames, startAt, strideSeconds, (seen) => seen.mean);
}

/** The frame of a piece that is goldiest overall - warm light minus cool light. */
export function warmestFrame(piece, frames, startAt, strideSeconds) {
  return measure(piece, frames, startAt, strideSeconds, (seen) => seen.warm);
}

/**
 * The notes of a data file, as the picture and the game want them.
 *
 * `roles` is what src/pieces.js calls each voice - "melody", "inner", "pedal".
 * On the page the picture is handed the organ's own notes, which carry their
 * role (see toObjects in src/audio.js, done the same way here), so that a look
 * can give the line to follow a different weight from the line under it. The
 * measuring has to hand the same notes, or it measures a different picture. The
 * loadness comes along for the same reason: how big a bell a piece can carry is
 * worked out from it, and a harness that hands none gets the smallest bell there
 * is without anyone noticing.
 */
export function notesFor(data, roles) {
  const at = data.format.indexOf.bind(data.format);
  return data.notes
    .map((row) => ({
      voice: row[at("voice")],
      pitch: row[at("pitch")],
      time: row[at("time")],
      length: row[at("duration")],
      velocity: row[at("velocity")],
      role: (roles && roles[String(row[at("voice")])]) || "inner",
    }))
    .sort((a, b) => a.time - b.time);
}

/** A second where as many notes as possible are sounding at once. */
export function busiestSecond(data) {
  const notes = notesFor(data);
  const starts = notes.map((note) => note.time);
  const ends = notes.map((note) => note.time + note.length).sort((a, b) => a - b);
  const seen = (times, upTo) => {
    // how many of the sorted times are at or before upTo
    let low = 0;
    let high = times.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (times[middle] <= upTo) low = middle + 1;
      else high = middle;
    }
    return low;
  };
  let best = 0;
  let bestCount = -1;
  for (let second = 0; second < data.duration; second += 0.5) {
    const count = seen(starts, second) - seen(ends, second);
    if (count > bestCount) {
      bestCount = count;
      best = second;
    }
  }
  return best;
}
