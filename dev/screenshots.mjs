/** The full matrix: 4 emulated themes x 9 sizes of the specimen page (and of every app scenario, once dev/scenarios has some).
 *
 *   scripts/lu-browser node dev/screenshots.mjs [--out docs/specimen] [--force] [--theme a,b] [--device a,b] [--no-scenarios]
 *
 * One tab, sequential, DPR 1 at every size (also 2560x1440). Files that already exist are kept unless --force, so an interrupted
 * run continues where it stopped. Names: <theme>-<device>-specimen.png (the whole plain specimen page) and <theme>-<device>-<scenario>.png
 * (the scenario's first screen). A specimen page taller than 12000 px (Chrome cannot paint a taller picture) continues in
 * <theme>-<device>-specimen-2.png, -3.png, ... `index.json` in the output folder lists every file with its size and the page's console errors. */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DEVICES, THEMES, applyDevice, harnessUrl, open, sleep, withTab } from "./lib/browser.mjs";

const options = {};
const argv = process.argv.slice(2);
for (let at = 0; at < argv.length; at++) {
  const key = argv[at].replace(/^--/, "");
  const next = argv[at + 1];
  if (next === undefined || next.startsWith("--")) options[key] = true;
  else {
    options[key] = next;
    at += 1;
  }
}
if (options.help) {
  console.log("usage: scripts/lu-browser node dev/screenshots.mjs [--out docs/specimen] [--force] [--theme a,b] [--device a,b] [--no-scenarios]");
  process.exit(0);
}

const out = resolve(typeof options.out === "string" ? options.out : "docs/specimen");
const themes = typeof options.theme === "string" ? options.theme.split(",") : THEMES;
const sizes = typeof options.device === "string" ? options.device.split(",") : Object.keys(DEVICES);
for (const theme of themes) if (!THEMES.includes(theme)) throw new Error(`unknown theme "${theme}"`);
for (const size of sizes) if (!DEVICES[size]) throw new Error(`unknown device "${size}"`);
mkdirSync(out, { recursive: true });

const indexFile = join(out, "index.json");
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : { shots: [] };
const record = (shot) => {
  index.shots = [...index.shots.filter((other) => other.file !== shot.file), shot].sort((a, b) => (a.file < b.file ? -1 : 1));
  writeFileSync(indexFile, `${JSON.stringify(index, null, 1)}\n`);
};

/** Tallest piece of the page one picture may hold: Chrome refuses to paint more than 16384 px in one image. */
const MAX_PIECE = 12000;

/** Photographs the whole page as <base>.png, or as <base>.png, <base>-2.png ... when it is taller than MAX_PIECE. Returns the files. */
async function photographPage(page, width, base) {
  const height = await page.evaluate(() => document.scrollingElement.scrollHeight);
  const files = [];
  for (let top = 0, piece = 1; top < height; top += MAX_PIECE, piece += 1) {
    const file = piece === 1 ? `${base}.png` : `${base}-${piece}.png`;
    await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: top, width, height: Math.min(MAX_PIECE, height - top) } });
    files.push(file);
  }
  return files;
}

let taken = 0;
let kept = 0;
let errorsSeen = 0;
await withTab({ dpr: 1, timeoutMs: 1800000 }, async ({ page, session, seen }) => {
  for (const size of sizes) {
    const spec = await applyDevice(session, size, { dpr: 1 });
    for (const theme of themes) {
      const specimenFile = `${theme}-${size}-specimen.png`;
      let scenarios = [];
      // The scenario ids come from the page itself; a first look at the plain page also tells us whether any exist.
      const wantSpecimen = options.force === true || !existsSync(join(out, specimenFile));
      const before = seen.errors.length;
      const url = (extra = {}) => harnessUrl({ theme: theme === "flat-light" ? undefined : theme, plain: true, pointer: spec.touch ? undefined : "fine", ...extra });
      await open(page, url());
      scenarios = options["no-scenarios"] ? [] : await page.evaluate(() => window.__lu.scenarios.map((scenario) => scenario.id));
      if (wantSpecimen) {
        await sleep(150);
        const files = await photographPage(page, spec.width, join(out, `${theme}-${size}-specimen`));
        const errors = [...new Set([...seen.errors.slice(before), ...(await page.evaluate(() => window.__lu.errors))])];
        errorsSeen += errors.length;
        record({ file: specimenFile, parts: files.map((file) => file.slice(out.length + 1)), theme, device: size, kind: "specimen", viewport: `${spec.width}x${spec.height}`, bytes: files.reduce((sum, file) => sum + statSync(file).size, 0), errors });
        taken += 1;
        console.log(`[${taken + kept}] ${specimenFile}${files.length > 1 ? ` (+${files.length - 1} more pieces)` : ""}${errors.length ? `  console errors: ${errors.length}` : ""}`);
      } else kept += 1;
      for (const id of scenarios) {
        const file = `${theme}-${size}-${id}.png`;
        if (options.force !== true && existsSync(join(out, file))) {
          kept += 1;
          continue;
        }
        const scenarioBefore = seen.errors.length;
        await open(page, url({ scenario: id }));
        await sleep(150);
        await page.screenshot({ path: join(out, file) });
        const errors = [...new Set([...seen.errors.slice(scenarioBefore), ...(await page.evaluate(() => window.__lu.errors))])];
        errorsSeen += errors.length;
        record({ file, parts: [file], theme, device: size, kind: id, viewport: `${spec.width}x${spec.height}`, bytes: statSync(join(out, file)).size, errors });
        taken += 1;
        console.log(`[${taken + kept}] ${file}${errors.length ? `  console errors: ${errors.length}` : ""}`);
      }
    }
  }
});
console.log(`done: ${taken} taken, ${kept} kept (already there), ${errorsSeen} console error(s). Index: ${indexFile}`);
