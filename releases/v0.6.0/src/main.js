// The bit that joins everything: a click wakes the audio, the notes are loaded,
// the organ starts, and every frame the picture is asked for the current second.

window.Bach = window.Bach || {};

(function (Bach) {
  var organ = Bach.createOrgan();
  var visual = null;
  var game = null;
  var prepared = null;
  var current = null;
  var currentData = null;
  var activeLookName = "fall";
  var pieceDuration = 0;
  var timer = 0;
  var state = "idle"; // idle, loading, playing, paused, done

  var elements = {};
  ["card", "stage", "hud", "end", "pieces", "nowTitle", "nowTime", "stops", "voices", "lookHint", "pause", "restart", "stop", "again", "menu", "seek", "progress", "status", "endLine", "play", "score", "views"].forEach(
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

  /** The clock and the line along the bottom, both telling where you are. */
  function showTime() {
    var now = organ.time();
    elements.nowTime.textContent = clockText(now) + " / " + clockText(pieceDuration);
    if (pieceDuration > 0) elements.progress.style.width = Math.min(100, (now / pieceDuration) * 100) + "%";
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

  /**
   * Which line is which, so the organ knows what to draw for each: the line to
   * follow gets the melody stops, the pedal line gets the big pipes.
   */
  function rolesFor(piece) {
    var roles = {};
    for (var index in piece.voices) {
      if (Object.prototype.hasOwnProperty.call(piece.voices, index)) {
        roles[index] = piece.voices[index].role || "inner";
      }
    }
    return roles;
  }

  /**
   * What the organ is playing with, in the words a player would use: one line
   * for the ranks drawn on the manuals, one for the ones on the pedals.
   */
  function describeStops(groups) {
    return groups
      .map(function (group) {
        return group.line + ": " + group.stops.join(", ");
      })
      .join("\n");
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
    if (state === "loading" || state === "playing" || state === "paused") return;
    state = "loading";
    current = piece;
    elements.status.textContent = "opening the notes…";
    elements.card.classList.add("dim");
    organ.open();
    loadData(piece)
      .then(function (data) {
        var look = piece.look || {};
        currentData = data;
        activeLookName = look.name || "fall";
        // The card says how many bars a phrase takes here, and the organ needs that
        // to know how to breathe: src/dynamics.js shapes the piece phrase by phrase.
        prepared = organ.prepare(data, rolesFor(piece), look.phrase);
        pieceDuration = data.duration;
        if (!visual) visual = Bach.createVisual(elements.stage);
        if (!game) game = Bach.createGame(elements.stage, organ);
        visual.reset(prepared.notes, {
          name: look.name,
          pitchLow: data.pitchRange[0],
          pitchHigh: data.pitchRange[1],
          colours: coloursFor(piece),
          bars: data.bars,
          phrase: look.phrase,
          duration: data.duration,
        });
        game.open(prepared.notes, data);
        // Some pieces would rather show their pulse in their own world than have a
        // ladder laid over it: the picture says so by having a way to draw it.
        game.paint(visual.pulse());
        describeGame();
        highlightView(activeLookName);
        elements.nowTitle.textContent = piece.title + " " + piece.subtitle;
        elements.stops.textContent = describeStops(prepared.stops);
        elements.lookHint.textContent = look.hint || "";
        fillVoices(piece, data);
        elements.status.textContent = "";
        elements.card.classList.remove("dim");
        elements.pause.textContent = "Pause";
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

  /**
   * The button that says what it does: play along with the pulse of the piece,
   * or just watch it. The piece plays the same either way.
   */
  function describeGame() {
    elements.play.textContent = game.enabled() ? "Just watch" : "Play along";
    elements.score.textContent = game.line();
  }

  function toggleGame() {
    game.toggle();
    describeGame();
  }

  function highlightView(name) {
    if (!elements.views) return;
    var buttons = elements.views.children;
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle("active", buttons[i].LookName === name);
    }
  }

  /**
   * Switch the active visualization live while a piece plays or rests.
   */
  function switchLook(name) {
    if ((state !== "playing" && state !== "paused") || !prepared || !currentData || !current || !visual) return;
    if (!Bach.looks || !Bach.looks[name]) return;
    var look = current.look || {};
    activeLookName = name;
    visual.reset(prepared.notes, {
      name: name,
      pitchLow: currentData.pitchRange[0],
      pitchHigh: currentData.pitchRange[1],
      colours: coloursFor(current),
      bars: currentData.bars,
      phrase: look.phrase,
      duration: currentData.duration,
    });
    if (game) game.paint(visual.pulse());
    highlightView(name);
    var entry = (Bach.catalog || []).find(function (item) {
      return item.name === name;
    });
    elements.lookHint.textContent = name === look.name && look.hint ? look.hint : (entry && entry.hint) || look.hint || "";
    visual.frame(organ.time());
    if (game) game.frame(organ.time());
  }

  function cycleLook() {
    var list = Bach.catalog || [];
    if (list.length === 0) return;
    var idx = 0;
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === activeLookName) {
        idx = (i + 1) % list.length;
        break;
      }
    }
    switchLook(list[idx].name);
  }

  /**
   * Rest the music where it is. The pipes are quieted and the picture holds
   * still; the piece stays open, ready to be picked up again.
   */
  function pause() {
    if (state !== "playing") return;
    organ.stop(); // leaves the organ holding the place it got to
    state = "paused";
    elements.pause.textContent = "Resume";
  }

  function resume() {
    if (state !== "paused") return;
    organ.play(prepared, organ.time());
    state = "playing";
    elements.pause.textContent = "Pause";
  }

  function togglePause() {
    if (state === "playing") pause();
    else if (state === "paused") resume();
  }

  /** Move to any point in the piece, whether it is sounding or rested. */
  function moveTo(seconds) {
    if (state !== "playing" && state !== "paused") return;
    var at = Math.max(0, Math.min(pieceDuration, seconds));
    if (state === "playing") organ.play(prepared, at);
    else organ.stop(at); // stay rested, but over there
    showTime();
  }

  function restart() {
    if (state === "paused") {
      state = "playing";
      elements.pause.textContent = "Pause";
    }
    moveTo(0);
  }

  function loop() {
    if (state !== "playing" && state !== "paused") return;
    organ.pump(); // does nothing while the piece is rested
    visual.frame(organ.time());
    game.frame(organ.time());
    var said = game.line();
    if (said !== elements.score.textContent) elements.score.textContent = said;
    showTime();
    if (organ.time() >= pieceDuration + 1.5) {
      finish();
      return;
    }
    timer = requestAnimationFrame(loop);
  }

  function finish() {
    state = "done";
    cancelAnimationFrame(timer);
    var said = current.title + " is finished.";
    var score = game.summary();
    elements.endLine.textContent = score === "" ? said : said + " " + score;
    show("end");
  }

  function backToMenu() {
    cancelAnimationFrame(timer);
    if (organ.isPlaying()) organ.stop();
    elements.stops.textContent = "";
    elements.lookHint.textContent = "";
    state = "idle";
    drawPortalMandala();
    show("card");
  }

  /**
   * Draws a contemplative Gothic Cathedral Rose Window and pipe-organ filigree
   * on the background stage while the portal card is shown.
   */
  function drawPortalMandala() {
    if (!elements.stage || typeof elements.stage.getContext !== "function") return;
    var ctx = elements.stage.getContext("2d");
    if (!ctx || typeof ctx.arc !== "function") return;
    var ratio = window.devicePixelRatio || 1;
    var width = Math.max(320, window.innerWidth || 1280);
    var height = Math.max(240, window.innerHeight || 800);
    if (elements.stage.width !== Math.floor(width * ratio)) {
      elements.stage.width = Math.floor(width * ratio);
      elements.stage.height = Math.floor(height * ratio);
      elements.stage.style.width = width + "px";
      elements.stage.style.height = height + "px";
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#05060b";
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.fill();

    ctx.globalCompositeOperation = "lighter";
    var cx = width * 0.5;
    var cy = height * 0.5;
    var outerR = Math.min(width, height) * 0.43;

    // Concentric Gothic Rose rings
    var radii = [0.22, 0.48, 0.74, 0.94, 1.0];
    for (var r = 0; r < radii.length; r++) {
      ctx.strokeStyle = r % 2 === 0 ? "#ffd47a" : "#79e2ff";
      ctx.lineWidth = r === 4 ? 1.4 : 0.9;
      ctx.globalAlpha = r === 4 ? 0.14 : 0.07;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR * radii[r], 0, Math.PI * 2);
      ctx.stroke();
    }

    // 24 radiating stained-glass petal lancets
    var petals = 24;
    for (var i = 0; i < petals; i++) {
      var a0 = (i / petals) * Math.PI * 2;
      var aMid = ((i + 0.5) / petals) * Math.PI * 2;
      var a1 = ((i + 1) / petals) * Math.PI * 2;
      ctx.strokeStyle = i % 2 === 0 ? "#ffd47a" : "#bcd0f0";
      ctx.lineWidth = 0.85;
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a0) * outerR * 0.22, cy + Math.sin(a0) * outerR * 0.22);
      ctx.quadraticCurveTo(
        cx + Math.cos(aMid) * outerR * 1.04,
        cy + Math.sin(aMid) * outerR * 1.04,
        cx + Math.cos(a1) * outerR * 0.22,
        cy + Math.sin(a1) * outerR * 0.22
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  var ARROW_STEP = 10; // seconds an arrow key travels

  /**
   * A strike, wherever it came from: a click on the picture itself, or the Enter
   * key. A click on anything the page offers - the buttons, the line along the
   * bottom - is that thing being used, not the player striking.
   */
  function strike() {
    if (state !== "playing" || !game) return;
    game.hit(organ.time());
    describeGame();
  }

  function clicked(event) {
    if (event && event.target !== elements.stage) return;
    strike();
  }

  function keyPressed(event) {
    if (state !== "playing" && state !== "paused") return;
    // A button that still has the focus takes the space bar for itself, which is
    // what it is there for; taking it too would toggle twice.
    var onAButton = String((event.target && event.target.tagName) || "").toUpperCase() === "BUTTON";
    if (event.key === " ") {
      if (onAButton) return;
      togglePause();
    } else if (event.key === "ArrowRight") {
      moveTo(organ.time() + ARROW_STEP);
    } else if (event.key === "ArrowLeft") {
      moveTo(organ.time() - ARROW_STEP);
    } else if (event.key === "Home") {
      restart();
    } else if (event.key === "Enter") {
      if (onAButton) return; // the button was being used, not the player striking
      strike();
      return;
    } else if (event.key === "p" || event.key === "P") {
      toggleGame();
      return;
    } else if (event.key === "v" || event.key === "V") {
      cycleLook();
      return;
    } else if (event.key >= "1" && event.key <= "6" && Bach.catalog) {
      var pickLook = Bach.catalog[Number(event.key) - 1];
      if (pickLook) switchLook(pickLook.name);
      return;
    } else if (event.key === "Escape") {
      backToMenu();
      return;
    } else {
      return;
    }
    // The page never scrolls, but the browser would try to on space and arrows.
    if (typeof event.preventDefault === "function") event.preventDefault();
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
    if (elements.views && Bach.catalog) {
      Bach.catalog.forEach(function (entry) {
        var btn = document.createElement("button");
        btn.className = "view-btn";
        btn.type = "button";
        btn.textContent = entry.key + " · " + entry.label;
        btn.LookName = entry.name;
        btn.addEventListener("click", function () {
          switchLook(entry.name);
        });
        elements.views.appendChild(btn);
      });
    }
  }

  elements.stop.addEventListener("click", backToMenu);
  elements.play.addEventListener("click", toggleGame);
  elements.again.addEventListener("click", function () {
    start(current);
  });
  elements.menu.addEventListener("click", backToMenu);
  elements.pause.addEventListener("click", togglePause);
  elements.restart.addEventListener("click", restart);
  elements.seek.addEventListener("click", function (event) {
    if (typeof event.clientX !== "number") return;
    var across = window.innerWidth || 1;
    moveTo((event.clientX / across) * pieceDuration);
  });
  window.addEventListener("keydown", keyPressed);
  window.addEventListener("click", clicked);

  buildList();
  drawPortalMandala();
  show("card");
})(window.Bach);
