// How much light a picture lays on one strip of the screen, measured where it lays it.
//
// tools/burn.mjs measures the screen as a grid of 64 x 40 cells and reads every cell
// at its middle. That is a fair reading of a whole screen of light and a poor one of a
// thread 1.8 pixels wide: a thread can pass between two cells and be read as nothing at
// all, which is how a picture can look clean there and be white where its notes really
// are. This walks a piece and, at the pixel each struck note draws its brightest thread
// on, adds up what the picture laid there - the notes' own light, and the ground under
// it: the line of sound, a bar line crossing it, the horizon's haze. One note's worth of
// light is the most a thread can be; more than that is white rather than louder, and
// losing the colour is the loss, since the colour is what says which voice is singing.
//
//   node tools/strip.mjs                    # every piece, one frame every sixth
//   node tools/strip.mjs bwv565 0.0166666   # one piece, a sixtieth
//
// It asks about a note struck on a line of sound drawn across the screen, so it can only
// answer for the pictures that draw notes as bars across such a line - the long view, the
// fugue picture, the plain falling one. The wheel turns and the braid runs sideways: for
// those the question is different, and their own tests answer it, so this says so and
// moves on.

import { createStage, notesFor, colourOf, luma } from "../test/screen.mjs";
import { loadPieces, loadData, rolesFor } from "../test/render.mjs";

const WIDTH = 1280;
const HEIGHT = 800;
const SOUND = 0.86; // where src/look-vigil.js, src/look-subject.js and src/look-fall.js strike
const NARROW = 40; // wider than this and the box is a flare or a band across the screen, not a note

/** What the picture for a piece is handed: the notes, and how to wear them. */
function sceneFor(piece) {
  const data = loadData(piece.slug);
  const colours = {};
  for (const index in piece.voices) colours[index] = piece.voices[index].colour;
  const look = piece.look || {};
  return {
    slug: piece.slug,
    name: look.name,
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

/** What a drawn box is made of: its colour, and how much of it was laid down. */
function laid(box) {
  if (box.colour === "(gradient)") {
    // A gradient is read at the first of its colours that has any light in it, which is
    // what the middle of these glows is.
    const lit = box.fill.split(" ").map(colourOf).filter((one) => one && one[3] > 0);
    if (lit.length === 0) return null;
    return { rgb: lit[0], share: lit[0][3] * box.alpha };
  }
  const plain = colourOf(box.colour);
  if (!plain) return null;
  return { rgb: plain, share: plain[3] * box.alpha };
}

const wanted = process.argv[2] || "";
const stride = Number(process.argv[3] || 1 / 6);

for (const piece of loadPieces()) {
  if (wanted && piece.slug.indexOf(wanted) < 0) continue;
  const scene = sceneFor(piece);
  if (["vigil", "subject", "fall"].indexOf(scene.name) < 0) {
    console.log(scene.slug + ": its notes are not bars across a line of sound, so this asks the wrong question");
    continue;
  }
  const margin = Math.min(120, WIDTH * 0.12);
  const span = Math.max(1, scene.look.pitchHigh - scene.look.pitchLow);
  const xFor = (pitch) => margin + ((pitch - scene.look.pitchLow) / span) * (WIDTH - margin * 2);
  const worn = Object.keys(scene.look.colours).map((key) => scene.look.colours[key]);
  const row = Math.round(HEIGHT * SOUND) + 0.5; // the row the line of sound itself is drawn on
  const stage = createStage(scene);
  let notes = { light: 0, pitch: 0, at: 0 };
  let all = { light: 0, pitch: 0, at: 0 };
  let over = 0;
  let asked = 0;
  let index = 0;
  for (let at = 1; at < scene.data.duration; at += stride) {
    stage.frame(at);
    // Every note struck since the last frame: that is where a thread is being laid now.
    while (index < scene.notes.length && scene.notes[index].time < at) {
      const note = scene.notes[index];
      index++;
      if (at - note.time > stride) continue; // struck a while back, and not a strike now
      const x = xFor(note.pitch);
      asked++;
      let own = 0;
      let total = 0;
      for (const box of stage.drawn) {
        if (x < box.x || x > box.x + box.w || row < box.y || row > box.y + box.h) continue;
        const one = laid(box);
        if (!one) continue;
        const light = luma([one.rgb[0] * one.share, one.rgb[1] * one.share, one.rgb[2] * one.share]);
        total += light;
        if (worn.indexOf(box.colour) >= 0 && box.w <= NARROW) own += light;
      }
      if (own > notes.light) notes = { light: own, at: at, pitch: note.pitch };
      if (total > all.light) all = { light: total, at: at, pitch: note.pitch };
      if (own > 0.9) over++;
    }
  }
  console.log(scene.slug + " - " + piece.title);
  console.log("  " + asked + " struck notes looked at, one frame every " + stride.toFixed(4) + " s");
  console.log(
    "  most light the notes themselves lay on one strip: " + notes.light.toFixed(3) +
      " (pitch " + notes.pitch + " at " + notes.at.toFixed(2) + " s)"
  );
  console.log(
    "  with the ground under the line of sound added: " + all.light.toFixed(3) +
      " (pitch " + all.pitch + " at " + all.at.toFixed(2) + " s)"
  );
  console.log("  struck notes laid over full light: " + over);
}
