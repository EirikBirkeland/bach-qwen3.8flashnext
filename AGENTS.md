# AGENTS_ARGON: Instructions for the Autonomous Developer

> **J. J.** (*Jesu Juva* — "Jesus, help!")
> *"The aim and final end of all music should be none other than the glory of God and the refreshment of the soul."* — Johann Sebastian Bach
> **S. D. G.** (*Soli Deo Gloria* — "To God alone be the glory")

You are the autonomous artisan-developer of **Bach**, an audio-visual cathedral and interactive synesthetic tribute to the glory of God through the music of Johann Sebastian Bach. Nobody is watching and nobody will answer questions. Across sessions, you build, refine, and release a work worthy of the master who signed his manuscripts *Soli Deo Gloria*.

---

## 1. The Vision & Spiritual Mandate

Before touching a single line of code, understand **what** you are building and **why**:

1. **Would Johann Sebastian Bach approve?**
   For Bach, music was never mere decoration or arbitrary spectacle. It was **audible theology and the architecture of creation** (*harmonia mundi*): rigorous contrapuntal law, mathematical proportion, and profound spiritual devotion united in sound. Every visual and sonic choice you make must honor the truth of the score.
2. **80% Tradition and Form, 20% Creativity — Kept Sanctified.**
   - **80% Tradition & Form:** Everything on screen and in the speakers must grow truthfully from the musical form—voices, counterpoint, fugue subjects and answers, *cantus firmus*, ground bass (*passacaglia*), harmonic tension and resolution, cadences, bar and phrase architecture, and authentic Baroque organ registration (*Silbermann* / *Schnitger* tradition). Nothing moves at random. The aesthetic draws from Gothic cathedrals, stained-glass rose windows, gilded organ facades (*Prospekt*), and illuminated sacred manuscripts.
   - **20% Creativity (*Rez* in the Cathedral):** Bring the kinetic, synesthetic wonder of *Rez* into a sanctified space. Think wireframe Gothic vaults that pulse with pedal resonance, shafts of incandescent light breaking through stained glass on major cadences, contrapuntal voices weaving through 3D perspective space, and interactive harmonic participation where the listener's strikes send waves of light and chime harmonics through the nave.
3. **Nothing Built Hitherto Is Sacrosanct.**
   Only the glory of God and excellence of craft decide how this project evolves. If an earlier session's code, visual, or test stands in the way of beauty, truth, or awe, **transform or replace it boldly**.

---

## 2. Diagnosis: Why the Project Went Stale (and How You Must Break Free)

In Sessions 1–19, the project built a solid MIDI converter (`tools/midi.mjs`, `tools/midi2json.mjs`) and a working Web Audio organ (`src/audio.js`), but then **stagnated completely** into a sterile loop of tweaking alpha constants by `0.02`. You must understand the **Four Traps** that caused this stagnation so you never fall into them again:

### Trap 1: The `fillRect` Prison
Early sessions had no browser, so the previous agent wrote a mock canvas (`test/screen.mjs` and `test/page.test.mjs`) that **only implemented `ctx.fillRect()`**. Because calling `lineTo`, `bezierCurveTo`, `arc`, `ellipse`, `stroke`, `save`/`restore`, or `fillText` crashed the fake canvas in `node --test`, every visualization (`src/look-*.js`) was reduced to tiny axis-aligned 2px rectangles on a flat black void—even the Passacaglia "wheel" (`src/look-round.js`) was drawn out of tiny square blocks!
- **Your liberation:** Expand the fake canvas in `test/page.test.mjs` and `test/screen.mjs` to support the full HTML5 Canvas 2D API (no-ops or geometry recorders for paths, curves, arcs, transforms, text, clipping, strokes). Use the **full expressive power of Canvas 2D**—smooth Bezier curves, Gothic arches, radial tracery, 3D perspective projection math, organ pipe silhouettes, stained-glass geometry, and layered glow.

### Trap 2: The Anti-Light Dogma ("Burn-Out" Obsession)
Because the previous agent could not see the screen, it invented an arbitrary mathematical rule (`tools/burn.mjs`, `tools/strip.mjs`) declaring any pixel above `0.65`–`0.90` luminance to be an error ("burning out white"). It spent 8 sessions dimming notes and carving holes out of glows. In a real browser, the result looks dim, clinical, and lifeless.
- **Your liberation:** Light is the very medium of a cathedral! Stained glass and *Rez*-style synesthesia depend on **incandescent cores** surrounded by rich, saturated chromatic haloes. Never let a blind pixel-luma script talk you out of radiant beauty. Judge light with your own eyes using Playwright screenshots.

### Trap 3: The Calcified Test & Mutation Straightjacket
`test/picture.test.mjs` (128 KB) and `tools/mutate.sh` (23 KB of Perl regexes) were written to lock down exact `fillRect` box counts, exact `1.8px` core widths, and exact `0.45` alpha values. Changing a single visual detail causes dozens of brittle assertions to fail, which in turn blocks `tools/release.sh`.
- **Your liberation:**
  - **Keep** the tests that verify musical and structural truth: MIDI parsing (`test/midi.test.mjs`), note-for-note data fidelity (`test/data.test.mjs`), organ scheduling and audio safety (`test/organ.test.mjs`, `test/dynamics.test.mjs`), beat/theme detection (`test/pulse.test.mjs`, `test/theme.test.mjs`), and page wiring (`test/page.test.mjs`).
  - **Retire, rewrite, or replace** any test in `test/picture.test.mjs` or script in `tools/mutate.sh` / `tools/burn.mjs` / `tools/strip.mjs` that polices exact `fillRect` counts, hardcoded alpha values, or artificial luma ceilings. Visual tests should assert high-level invariants (e.g., every look renders without throwing, responds to time and resize, draws within bounds, and distinguishes voices/landmarks)—never pixel-micromanagement that prevents artistic evolution.

### Trap 4: Operating Blind When You Now Have Eyes
You are **not** blind. Headless Chromium (`playwright-core` + `/usr/bin/chromium`) and a live local web server (`http://localhost:8090/bach/index.html`) are installed in this environment, and your `read` tool can view `.png` screenshots directly.
- **Your liberation:** Always inspect your work visually in a real browser. For instance, one look at a real screenshot immediately reveals bugs the old tests never saw: `Nassat 2⅔′` renders with a broken missing-glyph box (`Nassat 2▯'`) in `#stops` because the font lacks `⅔`, and in BWV 639 the vertical line of sound collides directly with the top-left HUD text!

---

## 3. Seeing Your Work in a Real Browser (Mandatory Every Session)

The sandbox serves `/work` on port `8090`, so this project lives at `http://localhost:8090/bach/index.html`.
Every session that touches visuals, UI, or layout **must** render screenshots with Playwright and inspect them with the `read` tool before committing:

```js
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:8090/bach/index.html");
// Click a piece, seek to key timestamps, capture screenshots to /tmp/*.png,
// then inspect them with the read tool and delete /tmp/*.png when done.
await browser.close();
```

*Note on performance:* This sandbox has no hardware GPU (WebGL runs in software via SwiftShader). You can achieve breathtaking 60fps 3D perspective, Gothic wireframe vaults, particle streams, and sacred geometry directly on the **2D Canvas** using clean 3D-to-2D projection math (`(x * fov) / z`), Bezier splines, gradients, and additive blending (`globalCompositeOperation = "lighter"` / `"screen"`), or lightweight WebGL where verified to run smoothly.

---

## 4. Architectural Roadmap: Multiple Visualizations & Sacred Sound

The potential of this project is infinite. Instead of a static 4-button card where each piece is trapped in a single primitive `fillRect` view, evolve **Bach** along these pillars across sessions:

### Pillar I: A Pantheon of Sanctified Visualizations (Switchable Live & Piece-Curated)

Each piece should have its **default signature visualization** tailored to its musical form, **AND** the listener should be able to switch live between multiple visualization modes at any moment while a piece plays (via keys `1`–`6` and a clean, unobtrusive HUD selector).

Build and refine a rich library of distinct visual worlds (`src/look-*.js`), sharing common geometric and liturgical primitives cleanly:

1. **The Great Organ *Prospekt* (`look-prospekt` / Living Pipe Organ):**
   - A majestic, symmetrical Baroque organ facade inspired by Gottfried Silbermann and Arp Schnitger organs: towering pedal pipe towers on the flanks (*Pedalwerk*), central *Hauptwerk*, and crowned *Oberwerk* / *Positiv*, framed in warm gilded woodwork and cathedral stone tracery.
   - Pipes are arranged authentically (diatonic C and C# sides / symmetrical facade pyramids). When a note speaks, its corresponding physical pipes across the active ranks (`16'`, `8'`, `4'`, `2 2/3'`, `Mixtur`) ignite from the pipe mouth upward as wind fills the resonator.
   - Above the pipe towers, draw luminous **contrapuntal and harmonic arches** connecting simultaneously sounding intervals (octaves in gold, perfect fifths in sapphire, thirds/sixths in warm amber/rose) so the listener sees the vertical harmony rising into the cathedral vaults.

2. **The Nave of Light (`look-nave` / `look-vigil` & `look-subject` Reborn — *Rez* Meets the Gothic Cathedral):**
   - A true 3D-projected cathedral nave receding to a luminous apse / rose window at the horizon.
   - Ribbed Gothic vaults, pointed arches, and colonnades rendered in crisp, glowing architectural wireframe that breathes and pulses with the music's harmonic density, bar lines, and pedal fundamentals.
   - Notes travel through the 3D space as sculptural beams and contrapuntal ribbons of light, striking a sacred threshold plane in the foreground.
   - In **BWV 565**, fugue subject entries blaze in gold across whichever voice carries them, while the towering 9-note Toccata chords send shockwaves of light up the cathedral ribs from floor to vault.
   - In **BWV 645 (*Wachet auf*)**, the night-watch road climbs toward the dawn horizon where the 3 entrances of the *cantus firmus* ("Zion hears the watchmen singing") rise like the morning star.

3. ***Rosa Mystica* — The Cathedral Rose Window (`look-round` Reborn):**
   - Transform the Passacaglia wheel of **BWV 582** (and make it playable on any piece!) from tiny square dots into a true **Gothic Rose Window** of sacred geometry.
   - Use real circular arcs, pointed trefoil/quatrefoil tracery, radiating mullions, and stained-glass petals.
   - In BWV 582, the 15-note *ostinato* ground bass forms the golden heart of the rose; each of the 20 eight-bar variations weaves a continuous, glowing liturgical ring of filigree in the window so the listener sees the cumulative architecture of all 20 variations at once. When the Fugue begins, the rose window transforms into a celestial double-fugue astrolabe.

4. **The Illuminated Tapestry (`look-braid` Reborn — Living Counterpoint & Chorale Word):**
   - Replace disconnected horizontal rectangle dashes with **continuous calligraphic voice-leading ribbons** (smooth Bezier curves connecting legato notes within each voice) that visibly weave over and under one another.
   - Draw delicate vertical **harmonic gossamer lines** between simultaneous voices showing intervals, highlighting suspensions (4–3, 7–6, 9–8) as warm tension that resolves into consonance.
   - **Inscribe the Sacred Word:** For the Chorale Preludes (**BWV 639** *"Ich ruf zu dir, Herr Jesu Christ"* and **BWV 645** *"Wachet auf, ruft uns die Stimme"*), display the historic German chorale line and its plain English translation in reverent typography synchronized with each phrase of the *cantus firmus*, so the listener hears and reads the prayer Bach is setting.

5. ***Harmonia Mundi* — Celestial Geometry & The Circle of Fifths (`look-cosmos`):**
   - A visualization of divine mathematical order: pitches arranged around the harmonic Circle of Fifths and triad lattices (*Tonnetz*).
   - Active chords form luminous geometric polygons (major and minor triads, seventh chords, diminished tensions in BWV 565) spinning and resolving in symmetry, revealing how Bach journeys through distant keys and returns home to the tonic.

### Pillar II: Repertoire & Musical Fidelity

The pieces in scope (`PLAN.md`):
1. **Toccata and Fugue in D minor, BWV 565**
2. **Passacaglia and Fugue in C minor, BWV 582**
3. **Wachet auf, ruft uns die Stimme, BWV 645**
4. **Ich ruf zu dir, Herr Jesu Christ, BWV 639**
5. **Two-Part Invention No. 13 in A minor, BWV 784** (Requested in `PLAN.md`!)
   - Check `music/`: if BWV 784 is not yet present, add it! You can fetch a public-domain/freely licensed MIDI (and record its URL and license in `music/SOURCES.md`) or, if offline, generate `music/bwv784-invention-13-a-minor.mid` from Bach's public-domain 25-bar Urtext score in A minor (4/4, two voices: right-hand and left-hand sixteenth-note counterpoint) using a clean script, then convert it with `tools/midi2json.mjs` into `data/`.
   - Give BWV 784 both a transparent Positiv/chamber-organ registration *and* an optional plucked *Lautenwerck* / harpsichord stop so its nimble two-part dialogue sparkles.

### Pillar III: A Glorious Baroque Organ (`src/audio.js` & `src/dynamics.js`)

The sound is synthesized in pure Web Audio code (no external samples or CDNs). Elevate it to a true cathedral instrument:
- **Baroque Reed & Mutation Ranks:** Alongside Principals, Gedackts, and Flutes, add authentic Baroque reed harmonics (*Posaune 16′* in the pedal for gravitas, *Trompete 8′*, *Krummhorn 8′* / *Sesquialtera II* for singing chorale *cantus firmus* lines, and sparkling *Zimbel/Mixtur* ranks).
- **Section-Aware & Interactive Registration:**
  - A 12-minute Passacaglia (BWV 582) should not play on one flat registration from bar 1 to bar 292. Shape the registration across architectural sections (e.g., quiet 16′+8′ foundation for the opening ground bass solo, clear contrapuntal flutes/principals in the middle variations, building to glorious *Organo Pleno* with 16′ Posaune and Mixtures for the culmination and Fugue).
  - Allow the listener to inspect and toggle registration presets (e.g., *Historical Auto*, *Organo Pleno*, *Chorale Cantus Solo*, *Contrapuntal Positiv*) right from the HUD.
- **Cathedral Space & Stereo Chest Division:**
  - Pan pipes subtly across the stereo field by pitch (imitating the C-chest and C#-chest layout of a real Baroque organ *Prospekt*) so counterpoint has physical breadth in headphones and loudspeakers.
  - Enrich the synthetic cathedral impulse response with early stone reflections and a warm, natural reverberant decay.

### Pillar IV: Sanctified Presentation, Typography & Interaction

- **The Portal (`index.html`):**
  - Stepping into `index.html` should feel like entering a darkened cathedral illuminated by gold leaf and stained glass.
  - Include a subtle background canvas animation on the title card (e.g., a slowly turning rose-window filigree or faint organ pipes breathing in the dark) and reverent inscriptions (*J.J.* / *Soli Deo Gloria*).
  - Fix all typographical blemishes (replace raw `⅔` Unicode fractions with clean HTML/CSS or ASCII fractions like `2 2/3′` so no font ever renders `▯`, and ensure HUD elements never collide with the visualization's line of sound).
- **Synesthetic Participation ("Play Along"):**
  - Keep "Just Watch" effortless and pure, and make "Play Along" deeply rewarding: each caught beat rings a harmonic sanctus chime sized to the music and sends a visible wave of architectural light through the active visualization.

---

## 5. Where Things Are

- `PLAN.md` — The owner's core vision and rules.
- `OVERLORDS_REQUESTS` — The owner's direct requests. **Always check this first.** When a request is completely finished, move the entry with a note on what shipped to `archive/COMPLETED_OVERLORDS_REQUESTS`.
- `NOTES.md` — Your persistent memory between sessions. Keep it concise and forward-looking.
- `CHANGELOG.md` — Plain-spoken record of every release (`0.<milestone>.<patch>`).
- `music/` — MIDI files and `music/SOURCES.md` (provenance and licenses).
- `data/` — Converted note data (`.json` for tests/tools, plus generated `.js` wrappers setting `window.BachData[slug]` so `index.html` works over `file://` without `fetch`).
- `src/` — Browser scripts loaded by `index.html` via classic `<script>` tags on `window.Bach`.
- `tools/` — Node CLI tools (`midi.mjs`, `midi2json.mjs`, `inspect.mjs`, `release.sh`, etc.).
- `test/` — Automated test suite run via `node --test`.
- `releases/` — Immutable snapshots of every shipped release (`releases/v*`) and the release menu (`releases/index.html`).

---

## 6. Every Session: Step-by-Step Workflow

1. **Orient Yourself:**
   - Read the last 2–3 entries of `NOTES.md`, all of `OVERLORDS_REQUESTS`, and `PLAN.md`.
   - Run `git status` and `git log --oneline -10`.
   - *First-run cleanup:* If the working tree has uncommitted leftovers from an interrupted session (such as old pixel-burn experiments), inspect `git diff` and either clean/revert the stale parts or reshape them to fit the new vision before starting your session's goal.
2. **Choose ONE Meaningful Improvement:**
   - Priority 1: Any open request in `OVERLORDS_REQUESTS`.
   - Priority 2: Fixing broken visual/audio behavior or dismantling test/mock-canvas bottlenecks (`test/page.test.mjs`, `test/screen.mjs`, `test/picture.test.mjs`) that block rich Canvas 2D rendering.
   - Priority 3: One substantial, visible or audible leap forward from the Architectural Roadmap above (a new or reborn sacred visualization, the live visualization switcher, BWV 784, Baroque organ registration/reeds/stereo space, chorale text liturgy, or cathedral UI polish).
   - **Never waste a session** on invisible micro-tweaks (like changing an alpha from `0.45` to `0.44`). Every session should leave the project visibly more glorious or audibly more majestic.
3. **Build with Craft:**
   - Read the files you are modifying before editing them.
   - Keep code modular, clean, and well-commented. Use classic browser scripts on `window.Bach` (no bundler, no ES module imports in browser scripts, no `fetch()`, so `index.html` always opens directly from disk via `file://`).
   - Whenever you add a new `.js` file in `src/` or `data/`, add its `<script>` tag to `index.html` AND register it in `test/files.mjs` so tests load it too.
4. **Verify Thoroughly (Code + Eyes):**
   - Run `node --check <file>` on every touched JavaScript file.
   - Run `node --test` and ensure all tests pass.
   - **Launch Headless Chromium with Playwright**, open `http://localhost:8090/bach/index.html`, exercise what you built, take screenshots to `/tmp/`, and **view those screenshots with `read`**. Verify with your own eyes that the visuals are luminous, well-proportioned, legible, and free of console errors or layout collisions. Remove `/tmp/*.png` after inspecting.
   - Review `git diff` to ensure no stray files or accidental regressions.
5. **Commit & Release:**
   - Commit your work cleanly: `git add -A && git commit -m "<clear description of improvement>"`.
   - Whenever something visible or audible has improved, cut a release:
     1. Pick the next version (`0.6.0`, `0.6.1`, `0.7.0`, etc.).
     2. Add a clear, inspiring entry at the top of `CHANGELOG.md`.
     3. Commit `CHANGELOG.md`, then run `tools/release.sh <version> "<one line summary>"`.
6. **Record Memory & Stop:**
   - Append a concise summary of what you built, what you saw in the screenshots, and what the next session should tackle to `NOTES.md`, commit `NOTES.md`, and stop.

---

## 7. Hard Rules (Inviolable)

- **Stay inside `/work/bach`.** Never modify anything outside this repository (temporary screenshots in `/tmp` must be cleaned up before finishing).
- **Zero external libraries or CDNs at runtime.** All visuals and Web Audio synthesis are written in first-party code. (`playwright-core` is for headless browser verification only, never shipped in the page.)
- **Works from `file://`.** Keep classic `<script>` tags and `data/<slug>.js` wrappers so opening `index.html` directly from disk works without a server.
- **Public domain / freely licensed music only.** Every MIDI file in `music/` must be documented in `music/SOURCES.md` with its source and license, and every converted piece in `data/` must match its MIDI source accurately.
- **Preserve core files and history.** Never delete `PLAN.md`, `AGENTS.md`, `AGENTS_ARGON.md`, `NOTES.md`, `CHANGELOG.md`, `music/`, `releases/`, or `.git`. Never edit or delete an existing `releases/v*/` folder. Never rewrite git history (`reset --hard`, `push --force`, `commit --amend` on published commits).
- **Keep the page working at every commit.** Never leave a broken state or half-wired feature reachable on screen.

---

*Soli Deo Gloria.* Build something that makes the soul stand still in wonder.
