/** Screenshots (and measurements) of the harness page in the shared browser.
 *
 *   scripts/lu-browser node dev/shot.mjs --theme flat-light --device phone --out /tmp/phone.png
 *
 * Run `--help` for every option. One tab per run, always closed; several themes/devices in one run share that tab. */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DEVICES, THEMES, applyDevice, harnessUrl, open, sleep, withTab } from "./lib/browser.mjs";

const HELP = `shot.mjs: screenshot the lucent-ha harness page in the shared browser.

  scripts/lu-browser node dev/shot.mjs [options]

Which page
  --theme <name[,name]>    flat-light (default) | flat-dark | glass-light | glass-dark | all
  --device <name[,name]>   ${Object.keys(DEVICES).join(" | ")} | all   (default desktop)
  --viewport <WxH>         a custom size instead of --device (desktop emulation, or touch with --touch)
  --group <name>           only that group's specimens (shell, view, sheet, ha, controls, content, state, grid, image, audio)
  --only <id[,id]>         only these specimens
  --scenario <id>          mount dev/scenarios/<id>.ts as the panel instead of the specimen page
  --plain                  no toolbar, labels or environment cells (clean shots)
  --pointer <auto|touch|fine>   force the toolkit's pointer class (default: fine on non-touch sizes, because headless Chrome has no
                           mouse and would report none; touch sizes report coarse by themselves)
  --sidebar <docked|auto|always_hidden>   the user's Home Assistant sidebar setting
  --kiosk                  wall mode: hass-kiosk-mode on, sidebar becomes a drawer
  --surface <dashboard|panel>   wallpaper behind the cards (default dashboard)
  --safe <t,r,b,l>         safe-area insets in px, e.g. 47,0,34,0 (notch)
  --dir <ltr|rtl>
  --ha-dialog              register the ha-adaptive-dialog stand-in
  --url <path?query>       any harness URL instead of the options above (e.g. /harness.html/live?theme=glass-dark)

How to shoot
  --dpr <n>                device pixel ratio (default 1)
  --cpu <n>                CPU throttle rate, 4 = four times slower (default 1)
  --reduced-motion         emulate prefers-reduced-motion: reduce
  --full-page              the whole scrollable page, not just the viewport
  --cell <id>              only that specimen cell
  --wait <ms>              extra settle time before the shot (default 150)
  --open-drawer            open Home Assistant's sidebar drawer first
  --eval '<js>'            run JS in the page after it is ready and print the result as JSON (async allowed; use window.__lu)
  --out <file>             PNG path; with several themes/devices use {theme} and {device} (default dev/out/shot-{theme}-{device}.png)
  --strict                 exit 1 when the page logged a console error
  --help

Prints one line per shot, the console errors/warnings of the page, and the --eval result.`;

function parse(argv) {
  const options = {};
  for (let at = 0; at < argv.length; at++) {
    const arg = argv[at];
    if (!arg.startsWith("--")) throw new Error(`unexpected argument "${arg}" (see --help)`);
    const key = arg.slice(2);
    const next = argv[at + 1];
    if (next === undefined || next.startsWith("--")) options[key] = true;
    else {
      options[key] = next;
      at += 1;
    }
  }
  return options;
}

const list = (value, all, fallback) => (value === undefined ? [fallback] : value === "all" ? all : String(value).split(","));

let options;
try {
  options = parse(process.argv.slice(2));
} catch (error) {
  console.error(String(error.message));
  process.exit(2);
}
if (options.help) {
  console.log(HELP);
  process.exit(0);
}

const themes = list(options.theme, THEMES, "flat-light");
const sizes = options.viewport
  ? [`${options.viewport}`]
  : list(options.device, Object.keys(DEVICES), "desktop");
for (const theme of themes) if (!THEMES.includes(theme)) throw new Error(`unknown theme "${theme}" (known: ${THEMES.join(", ")})`);
for (const size of sizes) if (!options.viewport && !DEVICES[size]) throw new Error(`unknown device "${size}" (known: ${Object.keys(DEVICES).join(", ")})`);
const dpr = Number(options.dpr ?? 1);
const cpu = Number(options.cpu ?? 1);
const wanted = options.out !== undefined || options.eval === undefined;
const pattern = typeof options.out === "string" ? options.out : "dev/out/shot-{theme}-{device}.png";
if (wanted && themes.length * sizes.length > 1 && !(pattern.includes("{theme}") || pattern.includes("{device}"))) {
  console.error("several shots need {theme} and/or {device} in --out so they do not overwrite each other");
  process.exit(2);
}

/** The device spec for a name of the matrix or a custom --viewport WxH (desktop emulation unless --touch). */
function specFor(size) {
  if (!options.viewport) return DEVICES[size];
  const [width, height] = size.split("x").map(Number);
  if (!width || !height) throw new Error(`--viewport must look like 390x844, got "${size}"`);
  return { width, height, touch: options.touch === true, label: `custom ${size}` };
}

const params = (theme, spec) => ({
  theme: theme === "flat-light" ? undefined : theme,
  group: options.group,
  only: options.only,
  scenario: options.scenario,
  plain: options.plain === true,
  pointer: options.pointer ?? (spec.touch ? undefined : "fine"),
  sidebar: options.sidebar,
  kiosk: options.kiosk === true,
  surface: options.surface,
  safe: options.safe,
  dir: options.dir,
  "ha-dialog": options["ha-dialog"] === true,
});

let failed = false;
await withTab({ dpr, cpu, reducedMotion: options["reduced-motion"] === true, timeoutMs: 300000 }, async ({ page, session, seen }) => {
  for (const size of sizes) {
    const spec = specFor(size);
    await applyDevice(session, spec, { dpr, cpu });
    for (const theme of themes) {
      const before = { errors: seen.errors.length, warnings: seen.warnings.length, notes: seen.notes.length };
      const url = typeof options.url === "string" ? harnessUrl({ theme: theme === "flat-light" ? undefined : theme }, options.url) : harnessUrl(params(theme, spec));
      await open(page, url);
      if (options["open-drawer"]) await page.evaluate(async () => { window.__lu.openDrawer(true); await window.__lu.settle(); });
      const label = `${theme} ${size} (${spec.width}x${spec.height}${dpr === 1 ? "" : ` @${dpr}x`})`;
      if (options.eval !== undefined) {
        // Runs BEFORE the shot, so it can also set the scene (open a sheet, switch the theme, scroll) for the picture.
        const result = await page.evaluate(`(async () => (${options.eval}))()`);
        console.log(`eval [${label}]: ${JSON.stringify(result, null, 2)}`);
        await page.evaluate(() => window.__lu.settle());
      }
      await sleep(Number(options.wait ?? 150));
      if (wanted) {
        const file = resolve(pattern.replaceAll("{theme}", theme).replaceAll("{device}", size));
        mkdirSync(dirname(file), { recursive: true });
        if (typeof options.cell === "string") await page.locator(`hx-cell[data-id="${options.cell}"]`).screenshot({ path: file });
        else await page.screenshot({ path: file, fullPage: options["full-page"] === true });
        console.log(`saved ${file}  [${label}]`);
      }
      const inPage = await page.evaluate(() => ({ errors: window.__lu?.errors ?? [], notes: window.__lu?.notes ?? [] }));
      const errors = [...new Set([...seen.errors.slice(before.errors), ...inPage.errors])];
      const warnings = seen.warnings.slice(before.warnings);
      const notes = new Set([...seen.notes.slice(before.notes), ...inPage.notes]).size;
      if (notes > 0) console.log(`  note: ${notes} "ResizeObserver loop" message(s): the layout settled over two frames (not an error)`);
      console.log(errors.length ? `  console errors (${errors.length}): ${JSON.stringify(errors.slice(0, 5))}` : `  no console errors${warnings.length ? `, ${warnings.length} warning(s): ${JSON.stringify(warnings.slice(0, 3))}` : ""}`);
      if (errors.length) failed = true;
    }
  }
});
if (failed && options.strict) process.exit(1);
