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
  const drawn = { fillRects: 0, rects: [] };
  const context = {
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    setTransform() {},
    fillRect(x, y, w, h) {
      drawn.fillRects++;
      drawn.rects.push([x, y, w, h]);
    },
    createLinearGradient() {
      return gradient(colours);
    },
    createRadialGradient() {
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
    click() {
      assert.ok(element.handlers.click, "#" + element.id + " has nothing to click");
      for (const handler of element.handlers.click) handler({ type: "click" });
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
  assert.strictEqual(page.window.Bach.pieces.length, 1);
  assert.strictEqual(page.elements.card.classList.contains("shown"), true, "the card is what you see first");
  assert.strictEqual(page.elements.pieces.children.length, 1, "each piece should offer a button");

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
