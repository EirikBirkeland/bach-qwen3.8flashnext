// The page runs here against a stand-in browser: a small fake document, a fake
// canvas, and a fake Web Audio that counts what it is asked for. It cannot tell
// whether the page is beautiful, but it does catch a missing name, a node that
// is never connected, an envelope that is scheduled backwards, and notes that
// never reach the organ.

import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("..", import.meta.url); // the project folder

function gradient(colours) {
  return {
    addColorStop(at, colour) {
      assert.ok(typeof at === "number" && at >= 0 && at <= 1, "a gradient stop is outside the bar: " + at);
      assert.ok(
        /^#[0-9a-f]{3}$|^#[0-9a-f]{6}$|^rgba?\([\d.,\s]+\)$/.test(String(colour)),
        "an unusable colour was handed to the canvas: " + colour
      );
      colours.push(colour);
    },
  };
}

function fakeCanvas(colours) {
  const drawn = { fillRects: 0, gradients: 0, rects: [] };
  const context = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    setTransform() {},
    fillRect(x, y, w, h) {
      drawn.fillRects++;
      // The colour is kept with the box: a test can tell a wipe of the whole
      // screen from one small bar of light.
      drawn.rects.push([x, y, w, h, context.fillStyle]);
    },
    createLinearGradient() {
      drawn.gradients++;
      return gradient(colours);
    },
    createRadialGradient() {
      drawn.gradients++;
      return gradient(colours);
    },
    beginPath() {},
    arc() {},
    fill() {},
  };
  return {
    tag: "canvas",
    width: 0,
    height: 0,
    style: {},
    getContext(kind) {
      assert.strictEqual(kind, "2d");
      return context;
    },
    drawn,
  };
}

function fakeParam(events) {
  const param = {
    value: 0,
    cancelScheduledValues() {
      return param;
    },
    setValueAtTime(value, at) {
      events.push({ at, value, kind: "set" });
      return param;
    },
    linearRampToValueAtTime(value, at) {
      events.push({ at, value, kind: "linear" });
      return param;
    },
    exponentialRampToValueAtTime(value, at) {
      if (value <= 0) throw new Error("an exponential ramp may not end at zero");
      events.push({ at, value, kind: "exponential" });
      return param;
    },
  };
  return param;
}

function fakeAudio(audio) {
  function newParam() {
    const events = [];
    audio.params.push(events);
    return fakeParam(events);
  }
  function node(extra) {
    return Object.assign(
      {
        connections: [],
        connect(target) {
          this.connections.push(target);
        },
        disconnect() {},
      },
      extra
    );
  }
  function reaches(from, target, depth) {
    if (from === target) return true;
    if (depth > 14 || !from.connections) return false;
    for (const next of from.connections) {
      if (reaches(next, target, depth + 1)) return true;
    }
    return false;
  }
  audio.reaches = reaches;
  const context = {
    sampleRate: 44100,
    currentTime: 0,
    state: "running",
    destination: node({}),
    resume() {
      context.state = "running";
    },
    createBuffer(channels, length) {
      audio.bufferLength = length;
      const data = [];
      for (let i = 0; i < channels; i++) data.push(new Float32Array(length));
      audio.bufferData = data;
      return { getChannelData: (i) => data[i], length };
    },
    createPeriodicWave(real, imag) {
      assert.ok(imag.length > 3, "a stop with that few harmonics is a beep");
      audio.waves += 1;
      return { wave: audio.waves };
    },
    createGain() {
      audio.gains += 1;
      const gain = node({ gain: newParam(), isGain: true });
      audio.gainNodes.push(gain);
      return gain;
    },
    createOscillator() {
      audio.oscillators += 1;
      const osc = node({
        frequency: newParam(),
        detune: newParam(),
        setPeriodicWave(wave) {
          assert.ok(wave && wave.wave, "a pipe was given no stop to speak with");
          osc.wave = wave;
        },
        start(at) {
          // No time given means "right now", which is legal in Web Audio.
          const when = at === undefined ? context.currentTime : at;
          osc.startAt = when;
          assert.ok(typeof when === "number" && when >= 0, "a pipe was told to start before now");
          audio.started += 1;
          audio.startTimes.push(when);
        },
        stop(at) {
          // Stopping a pipe that was queued up ahead is allowed: it simply never
          // gets to sound.
          const when = at === undefined ? context.currentTime : at;
          assert.ok(typeof when === "number" && when >= 0, "a pipe was told to stop at a strange time");
          osc.stopAt = when;
          audio.stopped += 1;
        },
      });
      audio.pipes.push(osc);
      return osc;
    },
    createBiquadFilter() {
      return node({ type: "", frequency: fakeParam([]), Q: { value: 0 } });
    },
    createDynamicsCompressor() {
      return node({
        threshold: fakeParam([]),
        knee: fakeParam([]),
        ratio: fakeParam([]),
        attack: fakeParam([]),
        release: fakeParam([]),
      });
    },
    createConvolver() {
      audio.convolver = node({ buffer: null });
      return audio.convolver;
    },
  };
  return context;
}

function makeElement(tag, id) {
  const element = {
    tag,
    id: id || "",
    children: [],
    style: {},
    className: "",
    textContent: "",
    handlers: {},
    shownClasses: new Set(),
    classList: {
      add(name) {
        element.shownClasses.add(name);
      },
      remove(name) {
        element.shownClasses.delete(name);
      },
      toggle(name, on) {
        if (on) element.shownClasses.add(name);
        else element.shownClasses.delete(name);
      },
      contains(name) {
        return element.shownClasses.has(name);
      },
    },
    appendChild(child) {
      element.children.push(child);
      return child;
    },
    addEventListener(kind, handler) {
      element.handlers[kind] = element.handlers[kind] || [];
      element.handlers[kind].push(handler);
    },
    click(extra) {
      assert.ok(element.handlers.click, "#" + element.id + " has nothing to click");
      for (const handler of element.handlers.click) handler(Object.assign({ type: "click" }, extra));
    },
  };
  Object.defineProperty(element, "innerHTML", {
    set(value) {
      assert.strictEqual(value, "", "this page only ever clears innerHTML");
      element.children = [];
    },
  });
  return element;
}

function makePage() {
  const colours = [];
  const audio = {
    currentTime: 0,
    oscillators: 0,
    started: 0,
    stopped: 0,
    startTimes: [],
    pipes: [],
    gains: 0,
    gainNodes: [],
    waves: 0,
    params: [],
    convolver: null,
    bufferLength: 0,
    bufferData: null,
  };
  const elements = {};
  const frames = [];
  const canvas = fakeCanvas(colours);
  audio.context = fakeAudio(audio);

  const window = {
    devicePixelRatio: 2,
    innerWidth: 1280,
    innerHeight: 800,
    listeners: {},
    addEventListener(kind, handler) {
      window.listeners[kind] = (window.listeners[kind] || []).concat(handler);
    },
    AudioContext: function () {
      return audio.context;
    },
  };

  const document = {
    head: makeElement("head", "head"),
    createElement(tag) {
      if (tag === "canvas") return fakeCanvas(colours);
      return makeElement(tag);
    },
    getElementById(id) {
      if (id === "stage") return canvas;
      if (!elements[id]) elements[id] = makeElement("div", id);
      return elements[id];
    },
  };

  const context = vm.createContext({
    window,
    document,
    console,
    Promise,
    setTimeout,
    clearTimeout,
    requestAnimationFrame(handler) {
      frames.push(handler);
      return frames.length;
    },
    cancelAnimationFrame() {
      frames.length = 0;
    },
  });

  const page = {
    window,
    document,
    canvas,
    audio,
    colours,
    elements,
    frames,
    context,
    run(file) {
      const source = fs.readFileSync(new URL(file, root), "utf8");
      vm.runInContext(source, context, { filename: file });
    },
    /** Hand a <script> tag the file it asks for, the way a browser would. */
    loadScriptTag(tag) {
      const source = fs.readFileSync(new URL(tag.src, root), "utf8");
      vm.runInContext(source, context, { filename: tag.src });
      if (tag.onload) tag.onload({ type: "load" });
    },
    nextFrame(stepSeconds) {
      assert.ok(frames.length > 0, "the page asked for no more frames");
      const handler = frames.shift();
      audio.context.currentTime += stepSeconds;
      handler(audio.context.currentTime);
    },
    playFrames(count, stepSeconds) {
      for (let i = 0; i < count; i++) page.nextFrame(stepSeconds);
    },
    press(key, target) {
      assert.ok(window.listeners.keydown, "nothing on the page listens for the keyboard");
      const event = {
        key: key,
        target: target || {},
        prevented: false,
        preventDefault() {
          this.prevented = true;
        },
      };
      for (const handler of window.listeners.keydown) handler(event);
      return event;
    },
    /** Seconds shown on the clock in the corner, like "1:23 / 9:32". */
    clockSeconds() {
      const match = /^(\d+):(\d\d) \/ (\d+):(\d\d)$/.exec(elements.nowTime.textContent || "");
      assert.ok(match, "the clock does not read like a clock: " + elements.nowTime.textContent);
      return Number(match[1]) * 60 + Number(match[2]);
    },
  };

  // Any script the page adds to the head is a data file: serve it from disk.
  const head = document.head;
  const append = head.appendChild.bind(head);
  head.appendChild = function (child) {
    const added = append(child);
    if (child.src) page.loadScriptTag(child);
    return added;
  };

  return page;
}

const SCRIPTS = ["src/pieces.js", "src/audio.js", "src/visual.js", "src/main.js"];

function openPage() {
  const page = makePage();
  for (const file of SCRIPTS) page.run(file);
  return page;
}

function settled() {
  // Let the promise that loads the notes finish its turn.
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test("the page lists the pieces and starts the organ on a click", async () => {
  const page = openPage();
  const listed = [...page.window.Bach.pieces];
  assert.ok(listed.length >= 4, "the owner gave four pieces, the page offers " + listed.length);
  assert.strictEqual(page.elements.card.classList.contains("shown"), true, "the card is what you see first");
  assert.strictEqual(page.elements.pieces.children.length, listed.length, "each piece should offer a button");

  page.elements.pieces.children[0].click();
  await settled();

  assert.strictEqual(page.audio.context.state, "running", "the audio was not opened");
  assert.ok(page.audio.waves > 1, "the organ built one single stop for everything");
  assert.ok(page.audio.convolver && page.audio.convolver.buffer, "there is no room to sound in");
  assert.ok(page.audio.bufferLength > 44100, "the room is shorter than a second");
  assert.strictEqual(page.elements.hud.classList.contains("shown"), true, "the player did not appear");

  for (let frame = 0; frame < 90; frame++) page.nextFrame(1 / 60);
  const seconds = 90 / 60;
  assert.ok(page.audio.started > 0, "nothing was handed to the organ");
  assert.match(page.elements.nowTime.textContent, /^0:0\d \/ \d/);
  assert.ok(Number(seconds) > 0);
  assert.ok(page.canvas.drawn.fillRects > 200, "the picture is not being drawn");

  const speakers = page.audio.context.destination;
  assert.ok(
    page.audio.gainNodes.some((gain) => page.audio.reaches(gain, speakers, 0)),
    "no note is wired through to the speakers"
  );
  assert.ok(page.audio.reaches(page.audio.convolver, speakers, 0), "the room is wired away from the speakers");
  assert.ok(
    page.audio.gainNodes.some((gain) => gain.connections.indexOf(page.audio.convolver) >= 0),
    "nothing is ever sent to the room"
  );
  assert.ok(page.audio.bufferData[0].some((sample) => sample !== 0), "the room is silent: its impulse is all zeros");
});

test("every piece on the list plays, and names its voices", async () => {
  const page = openPage();
  const pieces = [...page.window.Bach.pieces];

  for (const piece of pieces) {
    const before = page.audio.started;
    const beforeStarts = page.audio.startTimes.length;
    const atStart = page.audio.context.currentTime;
    page.elements.pieces.children[pieces.indexOf(piece)].click();
    await settled();
    for (let frame = 0; frame < 120; frame++) page.nextFrame(1 / 60); // two seconds

    assert.ok(page.audio.started > before, piece.slug + " handed nothing to the organ");
    assert.match(page.elements.nowTitle.textContent, new RegExp(piece.title), piece.slug + " did not say its name");
    assert.ok(page.window.BachData[piece.slug], piece.slug + " never loaded its notes");

    // The voice lines on screen are the voices of this piece, by their real names.
    const data = page.window.BachData[piece.slug];
    const lines = page.elements.voices.children.map((line) => line.children.map((part) => part.textContent).join(""));
    assert.strictEqual(lines.length, data.voices.length, piece.slug + " shows the wrong number of voices");
    for (const voice of data.voices) {
      const named = piece.voices[voice.index] && piece.voices[voice.index].name;
      assert.ok(lines.includes(named), piece.slug + " voice " + voice.index + " is not named on screen");
    }

    // Nothing was drawn outside the picture, and the notes were handed over on time.
    const width = page.canvas.width / 2;
    const height = page.canvas.height / 2;
    const off = page.canvas.drawn.rects.filter((r) => r[0] < -40 || r[0] > width + 40 || r[1] > height + 60);
    assert.strictEqual(off.length, 0, piece.slug + " drew " + off.length + " bars off the screen");

    const starts = page.audio.startTimes.slice(beforeStarts).sort((a, b) => a - b);
    for (const row of data.notes) {
      if (row[2] > 2) break;
      const wanted = atStart + 0.06 + row[2];
      assert.ok(
        starts.some((at) => at >= wanted - 0.002 && at <= wanted + 0.008),
        piece.slug + " forgot the note at " + row[2] + " s"
      );
    }

    page.elements.stop.click();
    assert.strictEqual(page.elements.card.classList.contains("shown"), true, piece.slug + " would not let go");
  }
});

test("every note that is due gets a pipe, and the envelopes are in order", async () => {
  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();

  // Four seconds in: everything scheduled so far must have been started.
  for (let frame = 0; frame < 240; frame++) page.nextFrame(1 / 60);
  assert.strictEqual(page.audio.started, page.audio.oscillators, "a pipe was made but never started");
  assert.ok(page.audio.started > 40, "four seconds of music is more than " + page.audio.started + " pipes");

  for (const events of page.audio.params) {
    for (let i = 1; i < events.length; i++) {
      assert.ok(
        events[i].at >= events[i - 1].at - 1e-9,
        "an envelope was scheduled out of order: " + JSON.stringify(events.map((e) => e.at))
      );
    }
  }
});

test("a note that ends as another starts counts as one, not two", () => {
  const organ = openPage().window.Bach.createOrgan();
  // 0.1 + 0.2 is not quite 0.3 in a computer, which would make the first note look
  // like it is still sounding when the other two begin, and so make the organ
  // think three notes sound at once when only two do.
  const data = {
    format: ["voice", "pitch", "time", "duration", "velocity"],
    duration: 1,
    notes: [
      [1, 60, 0.1, 0.2, 0.7],
      [1, 64, 0.3, 0.4, 0.7],
      [2, 67, 0.3, 0.4, 0.7],
    ],
  };
  assert.strictEqual(organ.prepare(data).busiest, 2, "a hand-over between notes was counted twice");
});

test("the picture stays on the screen", async () => {
  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();
  for (let frame = 0; frame < 120; frame++) page.nextFrame(1 / 60);

  const width = page.canvas.width / 2; // the fake canvas is drawn at two ratio
  const height = page.canvas.height / 2;
  const off = page.canvas.drawn.rects.filter((r) => r[0] < -40 || r[0] > width + 40 || r[1] > height + 60);
  assert.strictEqual(off.length, 0, off.length + " bars were drawn off the screen, first at " + JSON.stringify(off[0]));
  const horizon = Math.round(height * 0.72);
  const nearLine = page.canvas.drawn.rects.filter((r) => Math.abs(r[1] - horizon) < 400);
  assert.ok(nearLine.length > 20, "nothing is being drawn around the line of sound");
});

test("notes reach the organ when the piece says they should", async () => {
  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();
  for (let frame = 0; frame < 240; frame++) page.nextFrame(1 / 60); // four seconds

  const data = page.window.BachData["bwv565-toccata-and-fugue-d-minor"];
  const starts = page.audio.startTimes.slice().sort((a, b) => a - b);
  // Playback was told to begin 0.06 s after the clock was at zero.
  let checked = 0;
  for (const row of data.notes) {
    const time = row[2];
    if (time > 4) break;
    const wanted = 0.06 + time;
    const found = starts.some((at) => at >= wanted - 0.002 && at <= wanted + 0.008);
    assert.ok(found, "nothing was started for the note at " + time + " s");
    checked++;
  }
  assert.ok(checked > 20, "only " + checked + " notes were checked");
});

test("stop silences the organ and goes back to the card", async () => {
  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();
  for (let frame = 0; frame < 60; frame++) page.nextFrame(1 / 60);
  const startedBefore = page.audio.started;
  assert.ok(startedBefore > 0, "nothing to silence");

  page.elements.stop.click();
  assert.strictEqual(page.elements.hud.classList.contains("shown"), false, "the player is still up");
  assert.strictEqual(page.elements.card.classList.contains("shown"), true, "the card did not come back");
  assert.ok(page.audio.stopped > 0, "no pipe was told to stop");
  assert.strictEqual(page.frames.length, 0, "the page is still asking for frames");
  page.audio.stopped = 0;
  for (let frame = 0; frame < 20; frame++) {
    page.audio.context.currentTime += 1 / 60;
  }
  assert.strictEqual(page.audio.started, startedBefore, "the organ kept playing after the stop");
});

test("the piece ends and offers it again", async () => {
  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();
  for (let frame = 0; frame < 30; frame++) page.nextFrame(1 / 60);

  const data = page.window.BachData["bwv565-toccata-and-fugue-d-minor"];
  page.audio.context.currentTime = data.duration + 2;
  page.nextFrame(1 / 60);
  assert.strictEqual(page.elements.end.classList.contains("shown"), true, "the end card did not appear");
  assert.match(page.elements.endLine.textContent, /Toccata and Fugue/);
});

test("every part of the page that main.js reaches for is in the html", () => {
  // The stand-in document will invent any element it is asked for, so a button
  // missing from the real page would only show up here.
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const script = fs.readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const wanted = new Set([...script.matchAll(/elements\.([A-Za-z]\w*)/g)].map((m) => m[1]));
  assert.ok(wanted.size >= 15, "found only " + wanted.size + " parts of the page in main.js");
  for (const name of wanted) {
    assert.ok(ids.has(name), "main.js reaches for #" + name + ", which the page does not have");
  }
  assert.ok(ids.has("stage"), "the page has no canvas to draw on");
});

test("pause rests the music and resume picks it up where it left off", async () => {
  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();
  page.playFrames(720, 1 / 60); // twelve seconds, where the toccata is in full flight
  const at = page.clockSeconds();
  assert.ok(at >= 11, "twelve seconds in, the clock says " + at);

  const restedAt = page.audio.context.currentTime - 0.06; // where in the piece the organ stands
  page.elements.pause.click();
  assert.strictEqual(page.elements.pause.textContent, "Resume");
  assert.strictEqual(page.elements.hud.classList.contains("shown"), true, "the player went away on pause");

  const startedWhileRested = page.audio.started;
  const pipesAtRest = page.audio.pipes.length;
  page.playFrames(120, 1 / 60);
  assert.strictEqual(page.audio.pipes.length, pipesAtRest, "pipes were made while the piece was rested");
  assert.strictEqual(page.audio.started, startedWhileRested, "the organ played while it was rested");
  assert.strictEqual(page.clockSeconds(), at, "the clock went on while the piece was rested");
  const drawnWhileRested = page.canvas.drawn.fillRects;
  page.nextFrame(1 / 60);
  assert.ok(page.canvas.drawn.fillRects > drawnWhileRested, "the picture was dropped while rested");

  const whenResume = page.audio.context.currentTime;
  const startsBefore = page.audio.startTimes.length;
  page.elements.pause.click();
  assert.strictEqual(page.elements.pause.textContent, "Pause");
  page.playFrames(60, 1 / 60);
  assert.ok(page.audio.started > startedWhileRested, "nothing started up again after resume");

  const data = page.window.BachData["bwv565-toccata-and-fugue-d-minor"];
  const starts = page.audio.startTimes.slice(startsBefore).sort((a, b) => a - b);
  // The data file holds the notes voice by voice, so the times have to be put in
  // order before asking what was due.
  const times = data.notes.map((row) => row[2]).sort((a, b) => a - b);
  const due = times.filter((time) => time > restedAt + 0.05 && time <= restedAt + 0.9);
  assert.ok(due.length > 3, "only " + due.length + " notes were due after the rest");
  for (const time of due) {
    const wanted = whenResume + 0.06 + (time - restedAt);
    assert.ok(
      starts.some((at2) => at2 >= wanted - 0.002 && at2 <= wanted + 0.01),
      "the note at " + time + " s did not come back at its second"
    );
  }
});

test("a note still held when the music comes back is taken up again", () => {
  const page = openPage();
  const organ = page.window.Bach.createOrgan();
  organ.open();
  const prepared = organ.prepare({
    format: ["voice", "pitch", "time", "duration", "velocity"],
    duration: 12,
    notes: [
      [1, 48, 0, 4, 0.7], // held right through the pick-up point
      [2, 60, 3, 1, 0.7], // sounds across it too
      [3, 72, 6, 1, 0.7], // still to come
    ],
  });

  organ.play(prepared, 0);
  organ.pump();
  assert.strictEqual(page.audio.started, 4, "only the two notes within reach should be handed over");

  page.audio.context.currentTime = 3.5;
  const restedAt = organ.stop();
  assert.ok(Math.abs(restedAt - 3.44) < 1e-9, "stopping said the piece stood at " + restedAt + " s");
  assert.ok(Math.abs(organ.time() - restedAt) < 1e-9, "the organ moved on after it was quieted");

  const before = page.audio.pipes.length;
  const resumedAt = page.audio.context.currentTime;
  organ.play(prepared, restedAt);
  const takenUp = page.audio.pipes.slice(before);
  assert.strictEqual(takenUp.length, 4, "the two notes still held were not both taken up again");
  for (const osc of takenUp) {
    const sounding = osc.stopAt - osc.startAt;
    // What was left of the note (4 - 3.44) plus its release and the safety gap.
    assert.ok(Math.abs(sounding - (4 - restedAt) - 0.12) < 0.001, "the held note was given " + sounding + " s");
  }

  page.audio.context.currentTime = 6;
  organ.pump();
  const wanted = resumedAt + 0.06 + (6 - restedAt);
  assert.ok(
    page.audio.startTimes.some((at) => at >= wanted - 0.002 && at <= wanted + 0.01),
    "the note still to come did not arrive at its own second"
  );
});

test("clicking the line below moves into the piece", async () => {
  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();
  page.playFrames(60, 1 / 60);

  const data = page.window.BachData["bwv565-toccata-and-fugue-d-minor"];
  const target = 120; // seconds
  const clicked = page.audio.context.currentTime;
  page.elements.seek.click({ clientX: (target / data.duration) * page.window.innerWidth });

  assert.ok(Math.abs(page.clockSeconds() - target) <= 1, "the clock did not go to " + target + " s");
  const wantedWidth = (target / data.duration) * 100;
  const shownWidth = parseFloat(page.elements.progress.style.width);
  assert.ok(Math.abs(shownWidth - wantedWidth) < 0.5, "the line says " + shownWidth + "%, wanted " + wantedWidth);

  const next = data.notes.find((row) => row[2] > target + 0.5);
  assert.ok(next, "no note after " + target + " s to look for");
  page.playFrames(60, 1 / 60);
  const wanted = clicked + 0.06 + (next[2] - target);
  assert.ok(
    page.audio.startTimes.some((at) => at >= wanted - 0.002 && at <= wanted + 0.01),
    "the note at " + next[2] + " s did not come at its second after the jump"
  );
});

test("space rests the piece and the arrows move through it", async () => {
  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();
  page.playFrames(300, 1 / 60); // five seconds

  page.press(" ");
  assert.strictEqual(page.elements.pause.textContent, "Resume", "space did not rest the music");
  const rested = page.clockSeconds();
  const pipes = page.audio.pipes.length;
  page.playFrames(60, 1 / 60);

  page.press("ArrowRight");
  assert.strictEqual(page.audio.pipes.length, pipes, "the organ played while rested");
  assert.strictEqual(page.clockSeconds(), rested + 10, "the right arrow did not travel ten seconds");

  page.press("ArrowLeft");
  assert.strictEqual(page.clockSeconds(), rested, "the left arrow did not come back");

  page.playFrames(30, 1 / 60);
  page.press(" ");
  assert.strictEqual(page.elements.pause.textContent, "Pause", "space did not start the music again");
  const started = page.audio.started;
  page.playFrames(30, 1 / 60);
  assert.ok(page.audio.started > started, "the organ stayed quiet after space");
  assert.ok(page.clockSeconds() > rested - 1, "the clock is not running again");

  page.press("Home");
  assert.strictEqual(page.clockSeconds(), 0, "Home did not go back to the start");

  // The browser gives the space bar to a button that still has the focus, so the
  // page must not take it as well and toggle twice.
  const focusedButton = page.elements.pause;
  focusedButton.tagName = "BUTTON";
  const before = page.audio.started;
  const event = page.press(" ", focusedButton);
  assert.strictEqual(page.elements.pause.textContent, "Pause", "space was taken twice, by the page and its button");
  page.playFrames(30, 1 / 60);
  assert.ok(page.audio.started > before, "the music stopped for no reason when a button had the focus");

  // The page never scrolls, but the browser would try to on the space bar.
  focusedButton.tagName = "DIV";
  assert.strictEqual(page.press(" ").prevented, true, "space was left to the browser to scroll with");
  page.press(" ");
});

test("restart starts the piece again, rested or not", async () => {
  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();
  page.playFrames(300, 1 / 60);
  page.elements.restart.click();
  assert.strictEqual(page.clockSeconds(), 0, "restart left the clock at " + page.clockSeconds());
  page.playFrames(120, 1 / 60);
  assert.ok(page.clockSeconds() >= 1, "the piece did not carry on after the restart");

  page.press(" ");
  page.playFrames(30, 1 / 60);
  page.elements.restart.click();
  assert.strictEqual(page.elements.pause.textContent, "Pause", "restart left the button saying Resume");
  assert.strictEqual(page.clockSeconds(), 0, "restart while rested left the clock somewhere else");
  const started = page.audio.started;
  page.playFrames(60, 1 / 60);
  assert.ok(page.audio.started > started, "restart while rested stayed quiet");
});

test("a jump back puts the picture back there", async () => {
  const target = 40; // seconds

  const fresh = openPage();
  fresh.elements.pieces.children[0].click();
  await settled();
  const data = fresh.window.BachData["bwv565-toccata-and-fugue-d-minor"];
  fresh.playFrames(Math.round((target + 0.06) * 60), 1 / 60);
  const beforeFresh = fresh.canvas.drawn.fillRects;
  fresh.nextFrame(1 / 60);
  const drawnAtTarget = fresh.canvas.drawn.fillRects - beforeFresh;
  assert.ok(drawnAtTarget > 30, "a page at " + target + " s draws almost nothing: " + drawnAtTarget);

  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();
  page.playFrames(Math.round((target + 60) * 60), 1 / 60); // a minute further on
  page.elements.seek.click({ clientX: (target / data.duration) * page.window.innerWidth });
  const beforeJump = page.canvas.drawn.fillRects;
  page.nextFrame(1 / 60);
  const drawnAfterJump = page.canvas.drawn.fillRects - beforeJump;
  assert.ok(
    drawnAfterJump >= drawnAtTarget * 0.9,
    "after jumping back the picture drew " + drawnAfterJump + " marks where " + drawnAtTarget + " belong"
  );
  const wiped = page.canvas.drawn.rects
    .slice(-drawnAfterJump)
    .some((r) => r[4] === "#05060b" && r[2] >= page.canvas.width / 2 - 1);
  assert.ok(wiped, "the old picture was left under the new one");
});

test("every note sounding now has a bar of light at its pitch", async () => {
  const page = openPage();
  page.elements.pieces.children[0].click();
  await settled();
  const data = page.window.BachData["bwv565-toccata-and-fugue-d-minor"];
  page.playFrames(2400, 1 / 60); // forty seconds in

  const before = page.canvas.drawn.rects.length;
  page.nextFrame(1 / 60);
  const now = page.audio.context.currentTime - 0.06; // where the piece stands
  const drawn = page.canvas.drawn.rects.slice(before);
  assert.ok(drawn.length > 30, "one frame drew only " + drawn.length + " marks: the notes are not being drawn");

  const width = page.canvas.width / 2; // the fake canvas is drawn at two ratio
  const height = page.canvas.height / 2;
  const horizon = Math.round(height * 0.72);
  const margin = Math.min(120, width * 0.12);
  const low = data.pitchRange[0];
  const span = data.pitchRange[1] - low;
  const xFor = (pitch) => margin + ((pitch - low) / span) * (width - margin * 2);
  const spines = drawn.filter((r) => Math.abs(r[2] - 2.2) < 0.01); // the bright core of a bar

  const due = [];
  for (const row of data.notes) {
    const pitch = row[1];
    const time = row[2];
    const length = row[3];
    if (time > now || time + length < now) continue;
    due.push({ pitch: pitch, seconds: length });
  }
  assert.ok(due.length >= 4, "at " + now.toFixed(2) + " s only " + due.length + " notes are sounding; look elsewhere");

  const longest = due.reduce((a, b) => (a.seconds >= b.seconds ? a : b));
  const shortest = due.reduce((a, b) => (a.seconds <= b.seconds ? a : b));
  assert.ok(longest.seconds > shortest.seconds, "the moment picked has no short note to compare with");

  const heights = [];
  for (const note of due) {
    const x = xFor(note.pitch) - 1.1;
    const crossing = spines.filter((r) => Math.abs(r[0] - x) < 0.01 && r[1] <= horizon && r[1] + r[3] >= horizon);
    assert.ok(
      crossing.length > 0,
      "nothing crosses the line of sound for the note at pitch " + note.pitch + " sounding at " + now.toFixed(2) + " s"
    );
    heights.push({ seconds: note.seconds, height: Math.max.apply(null, crossing.map((r) => r[3])) });
  }

  // A bar is the note: the longer the note, the taller its light.
  const ofLongest = heights.filter((h) => h.seconds === longest.seconds)[0].height;
  const ofShortest = heights.filter((h) => h.seconds === shortest.seconds)[0].height;
  assert.ok(ofLongest > ofShortest, "a long note drew a shorter bar than a short one: " + ofLongest + " against " + ofShortest);
});

test("a crowded frame stays cheap enough to draw sixty times a second", async () => {
  const page = openPage();
  const pieces = [...page.window.Bach.pieces];
  const heaviest = pieces[pieces.length - 1]; // the Passacaglia has the most notes on screen at once
  page.elements.pieces.children[pieces.length - 1].click();
  await settled();
  page.playFrames(2, 1 / 60);

  const data = page.window.BachData[heaviest.slug];
  page.elements.seek.click({ clientX: (420 / data.duration) * page.window.innerWidth });
  page.nextFrame(1 / 60);

  const beforeRects = page.canvas.drawn.fillRects;
  const beforeGradients = page.canvas.drawn.gradients;
  page.nextFrame(1 / 60);
  const rects = page.canvas.drawn.fillRects - beforeRects;
  const gradients = page.canvas.drawn.gradients - beforeGradients;
  console.log("    crowded frame:", rects, "boxes and", gradients, "gradients for", heaviest.slug);
  assert.ok(rects > 100, "a crowded frame only draws " + rects + " marks: is the picture missing again?");
  assert.ok(rects < 1500, "one frame draws " + rects + " boxes: that will not keep up with the music");
  assert.ok(gradients < 600, "one frame makes " + gradients + " gradients: that will not keep up with the music");
});
