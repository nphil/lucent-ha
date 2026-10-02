#!/usr/bin/env node
/** The performance budget gate of lucent-ha: drives the sample panel of the dev harness (`?scenario=panel`) with real touch / mouse input at the nine
 * screen sizes, in a flat and a glass theme, at full speed and with the CPU slowed 4x, and checks the budgets of the plan (docs/perf.md):
 * press feedback <= 50 ms, cached tab switch <= 100 ms first / 300 ms stable, sheet open <= 220 ms, Back <= 100 ms, no long task while scrolling, CLS <= 0.02.
 *
 *   scripts/lu-browser node dev/perf-check.mjs --help
 *
 * Run it only through scripts/lu-browser (one tab, nice'd, memory-capped). The host load is read (scripts/lu-load) before and after every cell; at a one-minute
 * load of 8 or more the numbers are PROVISIONAL. It writes only to docs/perf or dev/out. */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load order matters under scripts/lu-browser's 4 GiB memory cap: Node's TypeScript stripper (the .ts modules) reserves address space, and playwright-core
// then cannot set up its TLS certificate store and the process aborts. So playwright is loaded first and the .ts modules after it.
const { DEVICES, HARNESS, THEMES } = await import("./lib/browser.mjs");
const { parseArgs, UsageError, USAGE } = await import("./lib/perf-args.ts");
const { BUDGETS, budgetsOf, judge, stepsToRun } = await import("./lib/perf-budgets.ts");
const { classifyLoad, parseLoad, QUIET_LOAD } = await import("./lib/perf-load.ts");
const { cellStatus, renderCell, renderMarkdown, resultFailed } = await import("./lib/perf-report.ts");
const { measureCell, ScenarioMissing, StepHung } = await import("./lib/perf-steps.mjs");

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exitWith = (message, code) => {
  console.error(message);
  process.exit(code);
};

let options;
try {
  options = parseArgs(process.argv.slice(2), { sizes: Object.keys(DEVICES), themes: THEMES });
} catch (error) {
  if (!(error instanceof UsageError)) throw error;
  exitWith(`${error.message}\n\n${USAGE}`, 2);
}
if (options.help) {
  console.log(USAGE);
  process.exit(0);
}

/** The one-minute load of the host: `scripts/lu-load` (over ssh), else this machine's /proc/loadavg (the same file inside the container). */
function readLoad() {
  return new Promise((done) => {
    execFile(join(repo, "scripts/lu-load"), { timeout: 8000 }, (error, stdout) => {
      const load = error ? null : parseLoad(stdout);
      if (load !== null) return done(load);
      try {
        done(parseLoad(readFileSync("/proc/loadavg", "utf8")));
      } catch {
        done(null);
      }
    });
  });
}

const outDir = resolve(repo, options.out);
const jsonPath = join(outDir, "latest.json");
const config = { runs: options.runs, passes: options.passes, sheetGate: options.sheetGate, only: [...options.only].sort() };
const order = (cell) => Object.keys(DEVICES).indexOf(cell.size) * 1000 + THEMES.indexOf(cell.theme) * 10 + (cell.cpu > 1 ? 1 : 0);

const toolkit = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version;
const result = { version: 1, generatedAt: new Date().toISOString(), toolkit, target: "harness", config, budgets: BUDGETS, cells: [] };
if (existsSync(jsonPath) && !options.force) {
  const previous = JSON.parse(readFileSync(jsonPath, "utf8"));
  if (JSON.stringify(previous.config) !== JSON.stringify(config)) {
    exitWith(`${options.out}/latest.json was made with other options (${JSON.stringify(previous.config)}); use --force to start over or --out to write elsewhere`, 2);
  }
  result.cells = previous.cells;
}

function save() {
  mkdirSync(outDir, { recursive: true });
  result.cells.sort((a, b) => order(a) - order(b));
  result.generatedAt = new Date().toISOString();
  for (const [name, text] of [["latest.json", `${JSON.stringify(result, null, 1)}\n`], ["latest.md", renderMarkdown(result)]]) {
    writeFileSync(join(outDir, `${name}.tmp`), text);
    renameSync(join(outDir, `${name}.tmp`), join(outDir, name));
  }
}

try {
  const answer = await fetch(`${HARNESS}/harness.html`, { signal: AbortSignal.timeout(5000) });
  if (!answer.ok) throw new Error(`HTTP ${answer.status}`);
} catch (error) {
  exitWith(`the dev harness does not answer at ${HARNESS} (${error.message}). It runs as the service lucent-harness (docs/harness.md); nothing is started from here.`, 2);
}

const steps = stepsToRun(options.only);
const wanted = budgetsOf(options.only);
const plan = [];
for (const size of options.sizes) for (const theme of options.themes) for (const cpu of options.cpu) plan.push({ size, theme, cpu, key: `${size}|${theme}|${cpu}` });
const todo = plan.filter((cell) => !result.cells.some((done) => done.key === cell.key));
console.log(`${plan.length} cells (${plan.length - todo.length} already in ${options.out}), steps: ${steps.join(", ")}, ${options.runs} run(s) each, quiet = load below ${QUIET_LOAD}${options.requireQuiet ? " (required)" : ""}`);

for (const cell of todo) {
  const before = await readLoad();
  if (options.requireQuiet && !(before !== null && before < QUIET_LOAD)) {
    save();
    exitWith(`refusing to run: the host load is ${before ?? "unknown"} (needs to be below ${QUIET_LOAD}); ${result.cells.length} cell(s) saved in ${options.out}`, 3);
  }
  console.log(`\n>> ${cell.key} (load ${before ?? "unknown"})`);
  const started = Date.now();
  let measured;
  try {
    measured = await measureCell({ size: cell.size, theme: cell.theme, cpu: cell.cpu, opts: options, steps, wanted: new Set(options.only) });
  } catch (error) {
    save();
    if (error instanceof ScenarioMissing) exitWith(error.message, 2);
    if (error instanceof StepHung) exitWith(`watchdog: ${error.message}; the tab was closed, ${result.cells.length} cell(s) saved in ${options.out}`, 3);
    throw error;
  }
  const after = await readLoad();
  const load = classifyLoad(before, after);
  if (options.requireQuiet && !load.quiet) {
    save();
    exitWith(`discarded ${cell.key}: the host load rose to ${after ?? "unknown"} while it ran; ${result.cells.length} cell(s) saved in ${options.out}`, 3);
  }
  const stepErrors = { ...measured.stepErrors };
  if (stepErrors.sheet) stepErrors.back = stepErrors.sheet;
  const finished = {
    key: cell.key, size: cell.size, width: DEVICES[cell.size].width, height: DEVICES[cell.size].height, theme: cell.theme, cpu: cell.cpu,
    startedAt: new Date(started).toISOString(), seconds: Math.round((Date.now() - started) / 1000), load, provisional: !load.quiet, calibrationMs: measured.calibrationMs,
    page: measured.page, metrics: measured.metrics, verdicts: judge(measured.metrics, { cpu: cell.cpu, quiet: load.quiet, wanted, stepErrors, violations: measured.violations, labels: { sheetOpen: options.sheetGate === "done" ? "sheet open, tap to enter motion finished" : "sheet open, tap to sheet on screen" } }),
    flaky: measured.flaky, notes: measured.notes, details: measured.details, raw: measured.raw,
  };
  result.cells.push(finished);
  save();
  console.log(renderCell(finished));
}

if (!result.cells.length) exitWith("nothing to measure", 2);
const counts = { PASS: 0, FAIL: 0, PROVISIONAL: 0 };
for (const cell of result.cells) counts[cellStatus(cell)] += 1;
console.log(`\n${result.cells.length} cells: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.PROVISIONAL} PROVISIONAL. Written to ${options.out}/latest.json and latest.md`);
process.exit(resultFailed(result) ? 1 : 0);
