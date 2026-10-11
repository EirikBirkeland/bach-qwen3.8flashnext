# Bach: instructions for the agent

You are the sole developer of this project. Nobody is watching and nobody will answer questions.
You develop it autonomously, one improvement per session, across many sessions.

## Where things are

- `PLAN.md` is the idea and the milestone list. It is the source of truth for what to build.
- `NOTES.md` is your memory between sessions. You start every session with no recollection of the last one.
- `CHANGELOG.md` lists releases.
- `music/` holds Bach's organ pieces as MIDI files. `music/SOURCES.md` says where each came from and its licence.
- `OVERLORDS_REQUESTS` holds the owner's requests. They come before the plan.
- The project is served as static files. The owner opens `index.html` in a browser. There is no build step.

## Every session

1. If there is no git repository here yet, run `git init` and make a first commit of what is in the folder.
2. Read `NOTES.md` (create it if missing), then `OVERLORDS_REQUESTS`, then the part of `PLAN.md` for the current milestone.
3. Run `git status` and `git log --oneline -15` to see where things stand.
4. Pick ONE thing: an open request from the owner, else the next unchecked item of the current milestone, or a bug you find. Bugs come first.
5. Do it with small, targeted edits. Never rewrite a whole file to change part of it.
6. Verify it (see below). If verification fails, fix it or revert with `git checkout -- <file>`.
7. Tick the item in `PLAN.md` if it is truly done.
8. Commit: `git add -A && git commit -m "<what changed, in plain words>"`.
9. Append to `NOTES.md`: what you did, anything surprising, and what should come next.
10. Stop. The next session continues.

## Verifying

There is no browser here and you cannot hear. Be strict with what you can check:

- `node --check <file>` on every JavaScript file you touched.
- `node --test` must pass once tests exist.
- Check the music by numbers: note counts, durations, the length of a piece in seconds, which notes sound together.
  A converted piece must match its MIDI file note for note.
- Re-read your diff with `git diff` before committing. Look for typos, undefined names, and broken imports.

Never commit code that fails these checks.

## Releases

Release early and often. A release is how the owner sees your work: a menu page lists every release and lets
them open any version. Make one whenever something visible or audible has improved, even a small step.

To release:

1. Commit your work so the tree is clean.
2. Pick the version: `0.<milestone>.<patch>`, for example `0.2.3`. The very first release is `0.0.1`.
3. Add an entry at the top of `CHANGELOG.md`: the version, the date, and a few plain lines on what is new.
4. Run `tools/release.sh <version> "<one line summary>"`.

The script runs the checks, copies the playable project into `releases/v<version>/`, adds it to
`releases/releases.json` (which the menu reads), commits, and tags. If it refuses, fix what it reports.
If the page starts loading files from a new top-level folder, add that folder to the copy list in the script.
Never edit or delete an existing folder under `releases/`: old versions must stay openable as they were.

## Quality bar

After the first release, nothing here is rushed. There is no deadline. Days of work are expected.

- Take as many sessions as an item needs. A small thing done properly beats a big thing done roughly.
- No stubs, no placeholders, no "TODO: implement later", no half-working feature left reachable.
- Before building on a piece of code, read it. Do not guess what a function does.
- Prefer clear code over clever code. Small functions with honest names. Future sessions have to read it cold.
- Write for a person: the words on screen are short and plain. Name things the way a player would.
- If a session ends with the item unfinished, commit nothing broken: note the state in `NOTES.md` and
  continue next session.

## Hard rules

- Stay inside this folder. Do not touch anything outside it.
- No external libraries and no CDNs. The sound is made in code with the browser's Web Audio.
- The only downloaded material is Bach's music as note data, from sources that are public domain or freely
  licensed (for example mutopiaproject.org). Record every file you add in `music/SOURCES.md` with its address and licence.
- Do not delete `PLAN.md`, `AGENTS.md`, `NOTES.md`, `CHANGELOG.md`, `music/`, `releases/`, or `.git`.
- Never rewrite git history: no `reset --hard` on commits, no force anything, no amending old commits.
- Keep the page working at every commit. A half-built feature stays unreachable until it works.
- If a plan item turns out to be a bad idea, say why in `NOTES.md`, mark it `[skipped]` in `PLAN.md`, and move on.
- Do not ask questions. Decide, write the decision in `NOTES.md`, and continue.
