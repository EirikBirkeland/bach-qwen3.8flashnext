// Which source files make the page, read off the folder and the page itself.
//
// Three tests need to run the page's scripts in a sandbox, and each one keeping
// its own list of file names is three chances to forget the newest picture - which
// is how a look can sit in src/ loaded by nothing and tested by nobody.

import fs from "node:fs";

const root = new URL("..", import.meta.url);

/** The scripts index.html loads, in the order it loads them. */
export function pageScripts() {
  const html = fs.readFileSync(new URL("index.html", root), "utf8");
  return [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((found) => found[1]);
}

/** Every picture the folder has, as src/look-*.js. */
export function lookScripts() {
  return fs
    .readdirSync(new URL("src", root))
    .filter((name) => name.indexOf("look-") === 0 && name.slice(-3) === ".js")
    .sort()
    .map((name) => "src/" + name);
}

/** What a picture needs to exist: the drawing it shares, the repeat finder, and
 *  every picture there is. */
export function pictureScripts() {
  return ["src/visual.js", "src/echoes.js"].concat(lookScripts());
}
