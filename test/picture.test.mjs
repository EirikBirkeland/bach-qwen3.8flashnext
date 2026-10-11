// The picture, measured by numbers. The notes have to be drawn, the screen has
// to stay dark with bright light on it, and nothing may burn out white. Nobody
// can see the screen from here, so this is as close as the checking gets to
// looking at it. The canvas that does the measuring is in screen.mjs; where each
// note's bar of light lands is checked in page.test.mjs.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";
import { brightestFrame, notesFor, busiestSecond } from "./screen.mjs";

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

// What the screen holds when nothing is played at all: the dark of the page, the
// line of sound, and the slow halo behind it.
const silence = brightestFrame(
  { notes: [], look: { pitchLow: 36, pitchHigh: 92, colours: { 1: "#ffd47a" } } },
  60,
  5
);

for (const piece of piecesListed()) {
  const data = JSON.parse(fs.readFileSync(new URL("data/" + piece.slug + ".json", root), "utf8"));
  const look = {
    pitchLow: data.pitchRange[0],
    pitchHigh: data.pitchRange[1],
    colours: coloursFor(piece),
  };
  const scene = { notes: notesFor(data), look };
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
