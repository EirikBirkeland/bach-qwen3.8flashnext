#!/usr/bin/env bash
# Mutation check: break one thing at a time and insist a test notices.
# The undo is a copy in /tmp, never `git checkout` (session 7's lesson).
set -u
cd "$(dirname "$0")/.."
mkdir -p /tmp/mut
for f in src/game.js src/pulse.js src/landmarks.js src/main.js src/audio.js src/theme.js src/touch.js src/dynamics.js src/visual.js src/look-round.js src/look-vigil.js src/look-braid.js tools/bars.mjs; do
  cp "$f" "/tmp/mut/$(basename "$f")"
done

# ONLY=braid tools/mutate.sh runs the mutations whose label mentions braid, which is
# worth knowing when one file is being worked on and a full run costs half an hour.
only="${ONLY:-}"

run() {
  label="$1"; file="$2"; expr="$3"
  if [ -n "$only" ] && [ "${label#*$only}" = "$label" ]; then return; fi
  cp "/tmp/mut/$(basename "$file")" "$file"
  perl -0pi -e "$expr" "$file"
  if cmp -s "$file" "/tmp/mut/$(basename "$file")"; then
    echo "NO PATTERN     $label - the mutation changed nothing, so the test was never asked"
  elif ! node --check "$file" >/dev/null 2>&1; then
    echo "BROKEN-SYNTAX  $label"
  elif node --test >/tmp/mut/out.txt 2>&1; then
    echo "SURVIVED     $label"
  else
    echo "caught       $(grep -c '^✖' /tmp/mut/out.txt) failing: $label"
  fi
  cp "/tmp/mut/$(basename "$file")" "$file"
}

run "game: a caught beat is never marked taken" src/game.js 's/      pick\.taken = true;\n//'
run "game: a beat left lying about does not end the run" src/game.js 's/if \(!beats\[pointer\]\.taken\) chain = 0; .*/if (false) {}/'
run "game: drumming on one beat counts twice" src/game.js 's/        if \(beat\.taken\) continue;\n        var by = now - beat\.time;/        var by = now - beat.time;/'
run "game: a jump somewhere else breaks the run" src/game.js 's/        retarget\(now\); \/\/ moved somewhere else: no run is broken by a jump/        chain = 0;/'
run "game: the bell ignores what is sounding" src/game.js 's/beats\[i\]\.pitch = low === undefined \? 60 : bellPitch\(low\.pitch\);/beats[i].pitch = 72;/'
run "game: nothing is gold" src/game.js 's/      markTheLandmarks\(Bach[^\n]*\);\n//'
run "game: a caught beat stays on the ladder" src/game.js 's/        if \(beat\.taken\) continue;\n        var y/        var y/'
run "game: switching on does not start afresh" src/game.js 's/      on = what;\n      close\(\); \/\/ a fresh start, whichever way it is going/      on = what;/'
run "game: the score line is never written" src/game.js 's/      if \(!on \|\| beats\.length === 0\) return \"\";/      return \"\";/'
run "game: it asks for a strike even while just watching" src/game.js 's/      if \(!on \|\| beats\.length === 0\) return null;/      if (beats.length === 0) return null;/'
run "game: a catch does not lengthen the run" src/game.js 's/      chain\+\+;\n//'
run "game: the bell is struck no harder for a gold beat" src/game.js 's/var weight = \(pick\.bright \? BRIGHT : 1\) \* \(struckTrue \? TRUEST : 0\.85\);/var weight = 1;/'
run "pulse: every bar keeps the first bar's pace" src/pulse.js 's/var step = \(stop - start\) \/ perBar;/var step = (data.bars[1] - data.bars[0]) \/ perBar;/'
run "pulse: four to a bar, whatever the piece says" src/pulse.js 's/var perBar = \(data\.metre \&\& data\.metre\.beats\) \|\| 4;/var perBar = 4;/'
run "pulse: beats may fall past the end of the piece" src/pulse.js 's/        if \(at >= end\) break;\n//'
run "landmarks: any silence at all is a homecoming" src/landmarks.js 's/if \(note\.time - ended\[line\] >= gone\) found\.push\(note\);/found.push(note);/'
run "landmarks: two notes together make a chord" src/landmarks.js 's/var least = atLeast === undefined \? TOGETHER : atLeast;/var least = 2;/'
run "landmarks: a moment may be earlier than the one before it" src/landmarks.js 's/    out\.sort\(function \(a, b\) \{\n      return a\.time - b\.time;\n    \}\);\n//'
run "main: any click at all is a strike" src/main.js 's/    if \(event \&\& event\.target !== elements\.stage\) return;\n//'
run "main: the ladder is never drawn" src/main.js 's/    game\.frame\(organ\.time\(\)\);\n//'
run "main: the end of the piece says nothing about the run" src/main.js 's/elements\.endLine\.textContent = score === \"\" \? said : said \+ \" \" \+ score;/elements.endLine.textContent = said;/'
run "audio: the bell is never started" src/audio.js 's/        oscillator\.start\(at\);\n//'
run "audio: the bell is wired to nothing" src/audio.js 's/      gain\.connect\(tone\);\n//'
run "audio: the bell ignores the piece's own size" src/audio.js 's/var level = bellLevel\(touch\) \* Math\.min/var level = CHIME.level * Math.min/'
run "audio: the bell ignores the piece's own length" src/audio.js 's/var hangs = bellDecay\(touch\);/var hangs = CHIME.decay;/'
run "audio: a sizing that is none is taken at face value" src/audio.js 's/    return hangs > CHIME\.attack \+ 0\.04 \? hangs : CHIME\.decay;/    return hangs;/'
run "touch: every piece gets the same sized bell" src/touch.js 's/var level = FULL \* Math\.sqrt\(full\);/var level = FULL;/'
run "touch: every piece gets the same length of bell" src/touch.js 's/var decay = Math\.min\(LONGEST, Math\.max\(SHORTEST, RING \* beat\)\);/var decay = 1.2;/'
run "touch: a line let go exactly on a beat still counts" src/touch.js 's/if \(note\.time \+ note\.length <= at\) continue;/if (note.time + note.length < at) continue;/'
run "touch: a piece of one line at a time is credited with a tutti" src/touch.js 's/var loudest = Math\.max\(spec\.minChord, spec\.heaviestChord\(notes, spec\.registration\)\);/var loudest = Math.max(1, spec.heaviestChord(notes, spec.registration));/'
run "touch: the smallest bell is not a floor" src/touch.js 's/    if \(!\(level >= SMALLEST\)\) level = SMALLEST;\n//'
run "touch: a bell may hang as long as anything" src/touch.js 's/var decay = Math\.min\(LONGEST, Math\.max\(SHORTEST, RING \* beat\)\);/var decay = Math.max(SHORTEST, RING * beat);/'
run "game: the strike does not carry the piece's bell" src/game.js 's/organ\.chime\(pick\.pitch, null, weight, bell\);/organ.chime(pick.pitch, null, weight);/'
run "theme: the same question is asked again" src/theme.js 's/    if \(asked \&\& asked\.notes === notes \&\& asked\.gap === gap\) return answer;\n//'

# Playing along, when a piece's own world draws the pulse: src/visual.js asks the
# look whether it wants to, src/main.js hands it over, src/game.js judges and
# hands the shot, and the wheel of BWV 582 draws a tooth per beat on its own rim.
run "game: the picture is never given the pulse" src/game.js 's/      if \(painter\) painter\(shot\);\n      else draw\(shot\);/      draw(shot);/'
run "game: the shot does not say which beat was struck" src/game.js 's/lit\.push\(\{ at: now, when: pick\.time, /lit.push({ at: now, when: null, /'
run "game: a run never grows the light" src/game.js 's/run: Math\.min\(1, chain \/ RUN\)/run: 0/'
run "game: a strike keeps burning after you travel back" src/game.js 's/        if \(back\) lit = \[\];\n//'
run "visual: the look is never asked whether it draws the pulse" src/visual.js 's/        return active && typeof active\.pulse === "function" \? active\.pulse : null;/        return null;/'
run "main: the picture is never asked to take the pulse" src/main.js 's/        game\.paint\(visual\.pulse\(\)\);\n//'
run "wheel: it keeps the game's ladder after all" src/look-round.js 's/return \{ reset: reset, frame: frame, pulse: pulse \};/return { reset: reset, frame: frame };/'
run "wheel: no teeth at all" src/look-round.js 's/0\.05 \+ 0\.3 \* near \* near/0.001/'
run "wheel: teeth drawn past what the wheel shows" src/look-round.js 's/        if \(away > view\.ahead\) break;\n//'
run "wheel: a beat the music is marking is no different" src/look-round.js 's/          beat\.bright \? MARK : COOL,/          COOL,/'
run "wheel: a struck beat is not lit" src/look-round.js 's/        if \(faded <= 0\.01\) continue;/        if (faded > 0) continue;/'
run "wheel: a struck beat is lit gold, which is the ground's colour" src/look-round.js 's/          one\.kind === "gold" \? MARK : COOL,/          GOLD,/'
run "wheel: the rim does not brighten for a run" src/look-round.js 's/      if \(shot\.run > 0\.02\) ring\(view\.outer, 2 \+ 4 \* shot\.run, COOL, 0\.015 \+ 0\.05 \* shot\.run\);//'
run "wheel: a tooth is laid over a note already shining" src/look-round.js 's/        if \(shining\(here\.x, here\.y\)\) continue;\n//'
run "wheel: the record of what is lit is a dot, not the ground its light covers" src/look-round.js 's/var reach = Math\.max\(CELL \/ 2, size\);/var reach = 0;/'
run "wheel: the record of what is lit is never cleared" src/look-round.js 's/^      spots = \{\};\n//m'
run "wheel: a note does not share its spot with the next one" src/look-round.js 's/var share = shining\(lit\.x, lit\.y\) \? 0\.5 : 1;/var share = 1;/'

# The bar grid: a MIDI file cannot say it opened with a pickup, so the converter
# reads that off the end of the piece (tools/bars.mjs). Get it wrong and a whole
# piece's pulse sits half a beat off the music, which is what it did to BWV 645.
run "bars: a pickup is never noticed" tools/bars.mjs 's/  return short > 0 && short \* 2 < bar \? short : 0;/  return 0;/'
run "bars: judged by the last bar, not the middle one" tools/bars.mjs 's/gaps\[Math.floor\(gaps.length \/ 2\)\]/gaps[gaps.length - 1]/'
run "bars: any short last bar is taken for a pickup" tools/bars.mjs 's/short \* 2 < bar/short < bar/'
run "bars: two bar lines are enough to judge by" tools/bars.mjs 's/if \(starts.length < 3\) return 0;//'

# The long view of BWV 645 plants a lamp on its verge for every beat, and keeps the
# marked ones lit however far off they are - the one thing a ladder two beats tall
# could never do. It draws no rule about lamps standing too near one another: the
# piece keeps its own lamps 2.3 px apart at the tightest, and a test says so.
run "road: it keeps the game's ladder after all" src/look-vigil.js 's/return \{ reset: reset, frame: frame, pulse: pulse \};/return { reset: reset, frame: frame };/'
run "road: no lamps at all" src/look-vigil.js 's/        lamp\(left, y, size, MARK, strength\);\n        lamp\(right, y, size, MARK, strength\);\n//'
run "road: a lamp is burned bright enough to whiten the road" src/look-vigil.js 's/0\.1 \+ 0\.35 \* close \* close/0.1 + 1.4 * close * close/'
run "road: a lamp at every beat, however far off to pick out" src/look-vigil.js 's/        if \(away > BEATS \* gap && !beat\.bar && !beat\.bright\) continue;\n//'
run "road: a marked beat far off loses its lamp unless it opens a bar" src/look-vigil.js 's/&& !beat\.bar && !beat\.bright\)/&& !beat\.bar\)/'
run "road: a beat that has gone by keeps its lamp down the verge" src/look-vigil.js 's/        if \(away < 0\) continue;.*\n//'
run "road: a struck beat lays no light on the line of sound" src/look-vigil.js 's/\(one\.truest \? 0\.13 : 0\.09\) \* faded/0.001 * faded/'
run "road: a struck beat lights gold, which is the chorale's colour" src/look-vigil.js 's/bloom\(left, view\.line, reach, MARK,/bloom(left, view.line, reach, "#ffd47a",/'
run "road: a click that caught nothing is silent" src/look-vigil.js 's/          ctx\.globalAlpha = 0\.05 \* faded;/          ctx.globalAlpha = 0;/'
run "road: the verges do not light up for a long run" src/look-vigil.js 's/      if \(shot\.run > 0\.02\) \{/      if (false) {/'

# The braid of BWV 639 stands a beat on a ruler along the top of its music and the
# bottom of it - the two places a note is never drawn - and keeps the beat the piece
# marks for itself taller and brighter, however far off it is.
run "braid: it keeps the game's ladder after all" src/look-braid.js 's/return \{ reset: reset, frame: frame, pulse: pulse \};/return { reset: reset, frame: frame };/'
run "braid: no beats on the ruler at all" src/look-braid.js 's/        stand\(x, ruler\.crown - CLEAR, tall, wide, strength, true\);\n        stand\(x, ruler\.base \+ CLEAR, tall, wide, strength, false\);\n//'
run "braid: only the top row is drawn" src/look-braid.js 's/        stand\(x, ruler\.base \+ CLEAR, tall, wide, strength, false\);\n//'
run "braid: the beats are drawn over the music" src/look-braid.js 's/        stand\(x, ruler\.crown - CLEAR, tall, wide, strength, true\);/        stand(x, ruler.crown + 80, tall, wide, strength, true);/'
run "braid: a beat is drawn at the wrong place on the ruler" src/look-braid.js 's/var x = ruler\.lineX \+ away \* pace;/var x = ruler.lineX + away * pace * 0.6;/'
run "braid: a beat the music is marking is no different" src/look-braid.js 's/var rank = beat\.bright \? 1 : beat\.bar \? 0\.6 : 0\.42;/var rank = beat.bar ? 0.6 : 0.42;/'
run "braid: a marked beat is no brighter than a plain one" src/look-braid.js 's/\(beat\.bright \? 0\.15 : beat\.bar \? 0\.09 : 0\.055\) \+ \(beat\.bright \? 0\.2 : 0\.15\) \* near/(beat.bar ? 0.09 : 0.055) + 0.15 * near/'
run "braid: a beat is struck too bright to stand beside its neighbours" src/look-braid.js 's/\+ \(beat\.bright \? 0\.2 : 0\.15\) \* near;/+ (beat.bright ? 0.75 : 0.15) * near;/'
run "braid: a caught beat keeps its mark" src/look-braid.js 's/        if \(beat\.taken\) continue;.*\n//'
run "braid: a struck beat lays no light on the line of sound" src/look-braid.js 's/\(one\.truest \? 0\.12 : 0\.08\) \* faded/0.001 * faded/'
run "braid: a struck beat is lit gold, which is the chorale's colour" src/look-braid.js 's|ring\(ruler\.lineX, ruler\.crown - CLEAR, reach, MARK,|ring(ruler.lineX, ruler.crown - CLEAR, reach, "#ffd47a",|'
run "braid: a click that caught nothing is silent" src/look-braid.js 's/          ctx\.globalAlpha = 0\.05 \* faded;/          ctx.globalAlpha = 0;/'
run "braid: the ruler does not brighten for a long run" src/look-braid.js 's/      if \(shot\.run > 0\.02\) \{/      if (false) {/'
# How a piece is played, note by note: the arch of a phrase, a thin moment played
# fuller than a full one, and a line brought out when it is taken up again.
run "dynamics: a phrase is played flat" src/dynamics.js 's/  function arch\(place\) \{/  function arch(place) { if (place >= 0) return 1;/'
run "dynamics: a phrase never grows, only begins held back" src/dynamics.js 's/    return ARCH.start \+ \(ARCH.peak - ARCH.start\) \* \(p \/ ARCH.peakAt\);/    return ARCH.start;/'
run "dynamics: a cadence is played as loud as the middle of a phrase" src/dynamics.js 's/      return ARCH.peak \+ \(ARCH.end - ARCH.peak\) \* \(\(p - ARCH.peakAt\) \/ \(1 - ARCH.peakAt\)\);/      return ARCH.peak;/'
run "dynamics: nothing is ever played up or down for its thinness" src/dynamics.js 's/  function body\(count, reference\) \{/  function body(count, reference) { if (count >= 0) return 1;/'
run "dynamics: a single line is played up as far as it likes" src/dynamics.js 's/    if \(lift > THINNEST\) return THINNEST;\n//'
run "dynamics: a tutti is never held back" src/dynamics.js 's/    if \(lift < FULLEST\) return FULLEST;\n//'
run "dynamics: the usual fullness is the loudest moment, not the middle" src/dynamics.js 's/    var reference = middle\(counts\);/    var reference = Math.max.apply(null, counts);/'
run "dynamics: a whole ensemble out of a silence counts as an entry" src/dynamics.js 's/>= RETURN && going\[i\] > 0\)/>= RETURN)/'
run "dynamics: any break in a line is a homecoming" src/dynamics.js 's/\] >= RETURN && going\[i\] > 0\)/] > 0 && going[i] > 0)/'
run "dynamics: an entry keeps its lift for ever" src/dynamics.js 's/        if \(since >= ENTRY_EASE\) \{/        if (false) {/'
run "dynamics: nothing caps what the three rules say together" src/dynamics.js 's/      if \(shade > LARGEST\) shade = LARGEST;\n//'
run "dynamics: nothing floors them either" src/dynamics.js 's/      if \(shade < SMALLEST\) shade = SMALLEST;\n//'
run "dynamics: a piece with no bar grid is given an arch anyway" src/dynamics.js 's/    if \(!bars \|\| bars.length < 2 \|\| !\(phrase > 0\)\) return null;\n//'
run "audio: the organ never asks how a piece should be played" src/audio.js 's/var shades = Bach\.dynamics
/var shades = Bach.nothingshade
/'
run "audio: the shaping never reaches the pipes" src/audio.js 's/      var base = playing\.gain \* struck\(note\.velocity\) \* shadeOf\(note\);/      var base = playing.gain * struck(note.velocity);/'
run "audio: the shaping is left out of the weight the ceiling is planned from" src/audio.js 's/    return total \* struck\(note\.velocity\) \* shadeOf\(note\);/    return total * struck(note.velocity);/'
run "audio: the bar grid is not handed to the shaping" src/audio.js 's/bars: data\.bars, duration: data\.duration/bars: null, duration: data.duration/'


echo "--- restoring ---"
for f in src/game.js src/pulse.js src/landmarks.js src/main.js src/audio.js src/theme.js src/touch.js src/dynamics.js src/visual.js src/look-round.js src/look-vigil.js src/look-braid.js tools/bars.mjs; do
  cp "/tmp/mut/$(basename "$f")" "$f"
done
node --test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
