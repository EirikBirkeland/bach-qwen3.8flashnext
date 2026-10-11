// Which picture a piece wears, and the drawing every picture shares.
//
// A look is a function of the canvas that hands back { reset, frame }. The looks
// live in src/look-*.js and add themselves to Bach.looks; src/pieces.js says
// which one each piece wears. This file only picks one out and keeps the canvas
// the right size for the window.
//
// Depends on nothing but window; see index.html for the load order.

window.Bach = window.Bach || {};

(function (Bach) {
  // The dark the page is drawn on, and the colours a voice may fall back to if a
  // piece does not say what it wants to wear.
  var DARK = "#05060b";
  var FALL_BACK = ["#ffd47a", "#79e2ff", "#c39bff", "#ff9bb0", "#9dff9b"];

  Bach.DARK = DARK;
  Bach.looks = {};

  /**
   * The canvas, kept the right size for the window. Width and height come back in
   * ordinary pixels; the drawing is scaled by the display's own ratio so it
   * stays sharp on a screen that packs its dots close.
   */
  function createScreen(canvas) {
    var ctx = canvas.getContext("2d");
    var watchers = [];
    var width = 1;
    var height = 1;

    /** Start again from an empty, dark canvas. */
    function wipe() {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = DARK;
      ctx.fillRect(0, 0, width, height);
    }

    function resize() {
      var ratio = window.devicePixelRatio || 1;
      width = Math.max(320, window.innerWidth);
      height = Math.max(240, window.innerHeight);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      // The canvas is wiped when it is sized, so lay the dark down again and let
      // the look forget where its last frame was.
      wipe();
      for (var i = 0; i < watchers.length; i++) watchers[i]();
    }

    window.addEventListener("resize", resize);
    resize();

    return {
      ctx: ctx,
      width: function () {
        return width;
      },
      height: function () {
        return height;
      },
      /** Do this whenever the window changes size. */
      onResize: function (what) {
        watchers.push(what);
      },
      wipe: wipe,
      /**
       * Lay a veil of dark over the last frame instead of clearing it, so what is
       * still moving leaves a trail behind it.
       */
      veil: function (strength) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(5,6,11," + strength + ")";
        ctx.fillRect(0, 0, width, height);
      },
    };
  }

  Bach.createScreen = createScreen;

  /**
   * What colour a voice wears. Anything not named on the card gets one of the
   * leftover colours, so a new voice is never invisible.
   */
  Bach.colourPicker = function (colours) {
    var palette = colours || {};
    var spare = [];
    for (var key in palette) {
      if (Object.prototype.hasOwnProperty.call(palette, key)) spare.push(palette[key]);
    }
    return function (voice, index) {
      if (palette[voice]) return palette[voice];
      if (palette[String(voice)]) return palette[String(voice)];
      return spare[index % spare.length] || FALL_BACK[index % FALL_BACK.length];
    };
  };

  /**
   * The picture for whatever piece is playing. `reset` picks the look that piece
   * wears and hands it the notes; `frame` draws one moment of it. Looks are kept
   * once made, so choosing another piece does not build the drawing again.
   */
  function createVisual(canvas) {
    var made = {};
    var active = null;

    return {
      reset: function (notes, look) {
        var name = (look && look.name) || "fall";
        if (!Bach.looks[name]) name = "fall";
        if (!made[name]) made[name] = Bach.looks[name](canvas);
        active = made[name];
        active.reset(notes, look || {});
      },
      frame: function (now) {
        if (active) active.frame(now);
      },
      /**
       * The picture's own way of drawing the player's pulse, or nothing. A piece
       * whose time goes round, or recedes to a horizon, has no more use for a
       * straight ladder of beats than it has for falling notes: it can put the
       * pulse in its own world, and src/game.js hands it over if this says so.
       */
      pulse: function () {
        return active && typeof active.pulse === "function" ? active.pulse : null;
      },
    };
  }

  Bach.createVisual = createVisual;
})(window.Bach);
