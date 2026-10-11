// The bit that joins everything: a click wakes the audio, the notes are loaded,
// the organ starts, and every frame the picture is asked for the current second.

window.Bach = window.Bach || {};

(function (Bach) {
  var organ = Bach.createOrgan();
  var visual = null;
  var prepared = null;
  var current = null;
  var pieceDuration = 0;
  var timer = 0;
  var state = "idle"; // idle, loading, playing, done

  var elements = {};
  ["card", "stage", "hud", "end", "pieces", "nowTitle", "nowTime", "voices", "stop", "again", "menu", "progress", "status", "endLine"].forEach(
    function (id) {
      elements[id] = document.getElementById(id);
    }
  );

  function show(which) {
    ["card", "hud", "end"].forEach(function (name) {
      elements[name].classList.toggle("shown", name === which);
    });
  }

  function clockText(seconds) {
    var whole = Math.max(0, Math.floor(seconds));
    var minutes = Math.floor(whole / 60);
    var rest = whole % 60;
    return minutes + ":" + (rest < 10 ? "0" : "") + rest;
  }

  /** The note data for a piece, loaded when it is first asked for. */
  var loaded = {};
  function loadData(piece) {
    if (loaded[piece.slug]) return Promise.resolve(loaded[piece.slug]);
    return new Promise(function (resolve, reject) {
      if (window.BachData && window.BachData[piece.slug]) {
        loaded[piece.slug] = window.BachData[piece.slug];
        resolve(loaded[piece.slug]);
        return;
      }
      var script = document.createElement("script");
      script.src = piece.file;
      script.onload = function () {
        var data = window.BachData && window.BachData[piece.slug];
        if (!data) {
          reject(new Error("no notes came from " + piece.file));
          return;
        }
        loaded[piece.slug] = data;
        resolve(data);
      };
      script.onerror = function () {
        reject(new Error("the page could not open " + piece.file));
      };
      document.head.appendChild(script);
    });
  }

  function voiceName(piece, voice) {
    var known = piece.voices ? piece.voices[voice.index] : null;
    if (known && known.name) return known.name;
    return voice.name || "Voice " + voice.index;
  }

  function coloursFor(piece) {
    var colours = {};
    for (var index in piece.voices) {
      if (Object.prototype.hasOwnProperty.call(piece.voices, index)) {
        colours[index] = piece.voices[index].colour;
      }
    }
    return colours;
  }

  function fillVoices(piece, data) {
    var colours = coloursFor(piece);
    elements.voices.innerHTML = "";
    data.voices.forEach(function (voice) {
      var dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = colours[voice.index] || "#9fb4d8";
      var label = document.createElement("span");
      label.textContent = voiceName(piece, voice);
      var line = document.createElement("div");
      line.className = "voice";
      line.appendChild(dot);
      line.appendChild(label);
      elements.voices.appendChild(line);
    });
  }

  function start(piece) {
    if (state === "loading") return;
    state = "loading";
    current = piece;
    elements.status.textContent = "opening the notes…";
    elements.card.classList.add("dim");
    organ.open();
    loadData(piece)
      .then(function (data) {
        prepared = organ.prepare(data);
        pieceDuration = data.duration;
        if (!visual) visual = Bach.createVisual(elements.stage);
        visual.reset(prepared.notes, {
          pitchLow: data.pitchRange[0],
          pitchHigh: data.pitchRange[1],
          colours: coloursFor(piece),
        });
        elements.nowTitle.textContent = piece.title + " " + piece.subtitle;
        fillVoices(piece, data);
        elements.status.textContent = "";
        elements.card.classList.remove("dim");
        show("hud");
        state = "playing";
        organ.play(prepared, 0);
        timer = requestAnimationFrame(loop);
      })
      .catch(function (error) {
        elements.status.textContent = error.message;
        elements.card.classList.remove("dim");
        show("card");
        state = "idle";
      });
  }

  function loop() {
    if (state !== "playing") return;
    organ.pump();
    var now = organ.time();
    visual.frame(now);
    elements.nowTime.textContent = clockText(now) + " / " + clockText(pieceDuration);
    elements.progress.style.width = Math.min(100, (now / pieceDuration) * 100) + "%";
    if (now >= pieceDuration + 1.5) {
      finish();
      return;
    }
    timer = requestAnimationFrame(loop);
  }

  function finish() {
    state = "done";
    cancelAnimationFrame(timer);
    elements.endLine.textContent = current.title + " is finished.";
    show("end");
  }

  function backToMenu() {
    cancelAnimationFrame(timer);
    if (organ.isPlaying()) organ.stop();
    state = "idle";
    show("card");
  }

  function buildList() {
    Bach.pieces.forEach(function (piece) {
      var button = document.createElement("button");
      button.className = "piece";
      button.type = "button";
      var title = document.createElement("span");
      title.className = "piece-title";
      title.textContent = piece.title;
      var subtitle = document.createElement("span");
      subtitle.className = "piece-subtitle";
      subtitle.textContent = piece.subtitle;
      button.appendChild(title);
      button.appendChild(subtitle);
      button.addEventListener("click", function () {
        start(piece);
      });
      elements.pieces.appendChild(button);
    });
  }

  elements.stop.addEventListener("click", backToMenu);
  elements.again.addEventListener("click", function () {
    start(current);
  });
  elements.menu.addEventListener("click", backToMenu);

  buildList();
  show("card");
})(window.Bach);
