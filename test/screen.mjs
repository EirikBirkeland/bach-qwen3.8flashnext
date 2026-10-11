// A canvas that measures light instead of showing it. It knows the little the
// page actually draws - plain colours, vertical and radial gradients, and the
// two ways they are laid down - and it adds them up on a coarse grid so a test
// can ask how bright a frame of the picture really is.
//
// It exists because nobody can see the screen from here: this is how "the notes
// are drawn, but nothing is burned white" gets checked by numbers.

import fs from "node:fs";
import vm from "node:vm";

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
    addColorStop(at, colour) {
      stops.push([at, colourOf(colour)]);
    },
    /** The colour this gradient has at one point of the screen. */
    at(x, y) {
      let along = 0;
      if (kind === "linear") {
        const rise = args[3] - args[1];
        along = rise === 0 ? 0 : (y - args[1]) / rise;
      } else {
        const radius = args[5] - args[2];
        const dx = x - args[0];
        const dy = y - args[3];
        along = (Math.sqrt(dx * dx + dy * dy) - args[2]) / (radius || 1);
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

/**
 * Watch frames of the picture and hand back the brightest one: how bright the
 * whole screen was on average, the brightest spot of it, how many cells of the
 * grid were burnt out, and how many cells there are to burn out.
 *
 * Frames are a sixtieth of a second apart unless `strideSeconds` says otherwise,
 * which is how a whole piece can be walked over without waiting for it.
 */
export function brightestFrame(piece, frames, startAt, strideSeconds) {
  const stride = strideSeconds || 1 / 60;
  const width = 1280;
  const height = 800;
  const air = [];
  for (let i = 0; i < COLS * ROWS; i++) air.push([0.02, 0.024, 0.043]); // the dark of the page

  const context = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    setTransform() {},
    fillRect(x, y, w, h) {
      const plain = colourOf(context.fillStyle);
      const blended = context.globalCompositeOperation === "lighter";
      const isGradient = context.fillStyle && typeof context.fillStyle.at === "function";
      if (!plain && !isGradient) return;
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
      return gradient("linear", args);
    },
    createRadialGradient(...args) {
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
  const source = fs.readFileSync(new URL("../src/visual.js", import.meta.url), "utf8");
  vm.runInContext(source, sandbox, { filename: "src/visual.js" });

  const look = window.Bach.createVisual(canvas);
  look.reset(piece.notes, piece.look);

  let worst = { mean: 0, peak: 0, burnt: 0, at: 0, cells: 0 };
  for (let frame = 0; frame < frames; frame++) {
    for (const spot of air) {
      spot[0] = 0.02;
      spot[1] = 0.024;
      spot[2] = 0.043;
    }
    const now = startAt + frame * stride;
    look.frame(now);
    let sum = 0;
    let peak = 0;
    let burnt = 0;
    for (const spot of air) {
      const bright = luma(spot);
      sum += bright;
      if (bright > peak) peak = bright;
      if (bright > 0.9) burnt++;
    }
    const mean = sum / air.length;
    if (mean > worst.mean) worst = { mean, peak, burnt, at: now, cells: air.length };
  }
  return worst;
}

/** The notes of a data file, as the picture wants them. */
export function notesFor(data) {
  return data.notes
    .map((row) => ({ voice: row[0], pitch: row[1], time: row[2], length: row[3] }))
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
