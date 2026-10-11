// The picture, in plain numbers. Nobody can see the screen from here, so this
// measures light instead: what each piece's look is made of, how bright it gets
// at its busiest, how dark it goes at its quietest, whether any of it is burnt
// out white, and whether a repeat shows up as warmer light.
//
//   node tools/look.mjs              # every piece
//   node tools/look.mjs bwv639       # one piece
//
// The canvas that does the measuring is in test/screen.mjs, and it is what the
// tests in test/picture.test.mjs check against, so what is printed here and what
// a test insists on are the same numbers.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { brightestFrame, warmestFrame, notesFor, busiestSecond } from "../test/screen.mjs";
import { barTable, loadPiece } from "./shape.mjs";

const root = new URL("..", import.meta.url);
const at = (where) => fileURLToPath(new URL(where, root));

function piecesListed() {
  const source = fs.readFileSync(at("src/pieces.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.Bach.pieces;
}

/** What the picture for a piece is handed: the notes, and how to wear them. */
function sceneFor(piece) {
  const data = JSON.parse(fs.readFileSync(at("data/" + piece.slug + ".json"), "utf8"));
  const colours = {};
  const roles = {};
  for (const index in piece.voices) {
    colours[index] = piece.voices[index].colour;
    roles[index] = piece.voices[index].role || "inner";
  }
  const look = piece.look || {};
  return {
    notes: notesFor(data, roles),
    look: {
      name: look.name,
      phrase: look.phrase,
      pitchLow: data.pitchRange[0],
      pitchHigh: data.pitchRange[1],
      colours: colours,
      bars: data.bars,
    },
    data: data,
    piece: piece,
  };
}

function spoken(look) {
  if (!look || !look.name) return "fall (the page's default)";
  return look.name + (look.phrase ? ", " + look.phrase + " bars to a screen" : "");
}

/** The quietest second of the piece, in mean light. */
function quietestFrame(scene, duration) {
  let worst = null;
  for (let at = 0; at < duration; at += 2) {
    const seen = brightestFrame(scene, 1, at);
    if (!worst || seen.mean < worst.mean) worst = Object.assign({ at: at }, seen);
  }
  return worst;
}

function report(slug) {
  const piece = piecesListed().find((one) => one.slug === slug);
  if (!piece) {
    console.log("no piece called " + slug + " is on the card");
    return;
  }
  const scene = sceneFor(piece);
  const duration = scene.data.duration;
  const loud = busiestSecond(scene.data);
  const busy = brightestFrame(scene, 60, loud);
  const quiet = quietestFrame(scene, duration);
  const over = brightestFrame(scene, Math.ceil(duration / 6) + 1, 0.5, 6);
  const warm = warmestFrame(scene, Math.ceil(duration / 6) + 1, 0.5, 6);

  console.log(path.basename(slug) + " - " + piece.title);
  console.log("  looks: " + spoken(piece.look));
  console.log(
    "  fullest second (" + clock(loud) + "): mean light " + busy.mean.toFixed(4) + ", brightest spot " +
      busy.peak.toFixed(2) + ", " + busy.burnt + " of " + busy.cells + " cells burnt out"
  );
  console.log(
    "  quietest (about " + clock(quiet.at) + "): mean light " + quiet.mean.toFixed(4) + ", brightest spot " + quiet.peak.toFixed(2)
  );
  console.log(
    "  all the way through, worst frame: mean " + over.mean.toFixed(4) + " at " + clock(over.at) + ", burnt out " + over.burnt
  );
  console.log("  warmest light (gold minus blue): " + warm.warm.toFixed(4) + " at " + clock(warm.at));

  const shape = loadPiece(slug);
  const asked = piece.look && piece.look.phrase;
  const phrases = asked || 4;
  const table = barTable(shape);
  console.log(
    "  " + table.length + " bars of " + shape.barSeconds + "s; a phrase is taken as " + phrases + " bars" +
      (asked ? " (what the piece asks)" : " (nothing was asked, so four)")
  );
  const echoes = phraseEchoesFor(scene, phrases);
  if (echoes.length > 0) {
    console.log(
      "  said again: " +
        echoes.map((echo) => "at " + clock(echo.at) + " (of what was heard at " + clock(echo.again) + ", " + echo.matched + ")").join(", ")
    );
  } else {
    // Only a claim about whole phrases starting on these bar lines. A repeat that
    // does not line up with the grid - BWV 645 brings its opening ritornello back
    // whole, six bars long, but starting at bar 24 - is not seen from here.
    console.log(
      "  no stretch of " + phrases + " whole bars beginning on the grid is played twice over" +
        " (a repeat that starts between the phrases is invisible from here)"
    );
  }
}

function phraseEchoesFor(scene, phrases) {
  const source = fs.readFileSync(at("src/echoes.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.Bach.phraseEchoes(scene.notes, scene.look.bars, phrases);
}

function clock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
}

const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const list = wanted.length > 0 ? wanted : piecesListed().map((piece) => piece.slug);
for (const slug of list) {
  const match = piecesListed().find((piece) => piece.slug === slug || piece.slug.indexOf(slug) >= 0);
  report(match ? match.slug : slug);
  console.log("");
}
