#!/usr/bin/env bash
# Mutation check: break one thing at a time and insist a test notices.
# The undo is a copy in /tmp, never `git checkout` (session 7's lesson).
set -u
cd "$(dirname "$0")/.."
mkdir -p /tmp/mut
for f in src/game.js src/pulse.js src/landmarks.js src/main.js src/audio.js src/theme.js; do
  cp "$f" "/tmp/mut/$(basename "$f")"
done

run() {
  label="$1"; file="$2"; expr="$3"
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
run "theme: the same question is asked again" src/theme.js 's/    if \(asked \&\& asked\.notes === notes \&\& asked\.gap === gap\) return answer;\n//'

echo "--- restoring ---"
for f in src/game.js src/pulse.js src/landmarks.js src/main.js src/audio.js src/theme.js; do
  cp "/tmp/mut/$(basename "$f")" "$f"
done
node --test 2>&1 | grep -E "^ℹ (tests|pass|fail)"
