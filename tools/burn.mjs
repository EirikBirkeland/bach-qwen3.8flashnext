// Which cells of a picture go over white, and whose fault it is.
//
// Nobody can see the screen, so the light is measured on a grid of 64 x 40 cells
// instead. This walks a piece twice over, once with nobody playing and once with
// every beat struck, in lockstep, and blames a cell only if the playing one goes
// over 0.9 of full light while the picture alone stayed under 0.85. That is the
// only honest way to point at a struck beat: the pictures already have bright
// places, and a note crossing the line of sound is brighter than anything the
// player's pulse draws.
//
//   node tools/burn.mjs                     # every piece, a sixth of a second
//   node tools/burn.mjs bwv582 0.0166666    # one piece, a sixtieth
//
// The stride matters more than it looks. The frames where a struck beat and a
// struck note land on one spot last hundredths of a second, and a grid a second
// wide walks straight past them - which is how the Passacaglia's wheel carried two
// burnt-out cells for three sessions. A sixth is what the tests use; a sixtieth
// takes about a minute and a half for the Passacaglia and has found one more.

import { createStage, notesFor } from "../test/screen.mjs";
import { loadPieces, loadData, rolesFor } from "../test/render.mjs";

const luma = (spot) => 0.2126 * spot[0] + 0.7152 * spot[1] + 0.0722 * spot[2];

/** What the picture for a piece is handed: the notes, and how to wear them. */
function sceneFor(piece) {
  const data = loadData(piece.slug);
  const colours = {};
  for (const index in piece.voices) colours[index] = piece.voices[index].colour;
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
      colours: colours,
      bars: data.bars,
      duration: data.duration,
    },
  };
}

function walk(scene, stride) {
  const alone = createStage(scene);
  const stage = createStage(scene, { play: true });
  const beats = [...stage.beats()];
  let index = 0;
  let tipped = 0;
  let frames = 0;
  let framesAloneBurnt = 0;
  let most = 0;
  let meanAlone = 0;
  let meanPlay = 0;
  const where = [];
  for (let at = 1; at < scene.data.duration; at += stride) {
    while (index < beats.length && beats[index].time < at) {
      if (at - beats[index].time < 0.3) stage.hit(beats[index].time);
      index++;
    }
    const aloneSeen = alone.frame(at);
    const plain = alone.air.map(luma);
    let aloneBurnt = 0;
    for (const bright of plain) if (bright > 0.9) aloneBurnt++;
    if (aloneBurnt) framesAloneBurnt++;
    const seen = stage.frame(at);
    frames++;
    most = Math.max(most, stage.drawn.length);
    meanAlone = Math.max(meanAlone, aloneSeen.mean);
    meanPlay = Math.max(meanPlay, seen.mean);
    stage.air.forEach((spot, cell) => {
      const bright = luma(spot);
      if (bright <= 0.9 || plain[cell] >= 0.85) return;
      tipped++;
      if (where.length < 6) {
        where.push(
          "cell " + (cell % 64) + "," + Math.floor(cell / 64) + " at " + at.toFixed(2) + " s (the picture alone had " + plain[cell].toFixed(2) + " there, playing has " + bright.toFixed(2) + ")"
        );
      }
    });
  }
  return {
    frames: frames,
    tipped: tipped,
    where: where,
    framesAloneBurnt: framesAloneBurnt,
    most: most,
    meanAlone: meanAlone,
    meanPlay: meanPlay,
    caught: stage.score().caught,
  };
}

const wanted = process.argv[2] || "";
const stride = Number(process.argv[3] || 1 / 6);

for (const piece of loadPieces()) {
  if (wanted && piece.slug.indexOf(wanted) < 0) continue;
  const scene = sceneFor(piece);
  const seen = walk(scene, stride);
  console.log(piece.slug + " - " + piece.title);
  console.log(
    "  " + seen.frames + " frames, one every " + stride.toFixed(4) + " s, " + seen.caught + " beats struck"
  );
  console.log(
    "  worst frame: mean light " + seen.meanPlay.toFixed(4) + " with the pulse on, " + seen.meanAlone.toFixed(4) +
      " without, " + seen.most + " marks drawn (the page's budget is 1500)"
  );
  console.log(
    "  frames where the picture alone is over 0.9 somewhere: " + seen.framesAloneBurnt + " of " + seen.frames
  );
  console.log("  cells tipped over white by the pulse alone: " + seen.tipped);
  for (const one of seen.where) console.log("    " + one);
}
