/** The measurements of the perf gate, one tab per cell (screen size x theme x CPU rate). Each step drives the scenario panel with real input (touch
 * events on touch sizes, the mouse on the others) and reads the page's own clocks; the judging is in perf-budgets.ts. Run through `scripts/lu-browser`. */
import { harnessUrl, scrollBy, sleep, tap, waitReady, withTab } from "./browser.mjs";
import { installProbe } from "./perf-page.mjs";
import { analyseTimeline } from "./perf-settle.ts";
import { maxOf, median, round } from "./perf-stats.ts";
import { pressThreadMs } from "./perf-trace.ts";

const TRACE_CATEGORIES = ["devtools.timeline", "disabled-by-default-devtools.timeline", "toplevel"];
const TABS = ["live", "library", "insights"];
const SCROLL_DISTANCE = 2500;

/** A step stopped answering: the cell is abandoned (the tab is closed) instead of retried on a wedged page. */
export class StepHung extends Error {}
/** The harness has no sample panel (not built yet, or the build left it out). */
export class ScenarioMissing extends Error {}

const fail = (message) => {
  throw new Error(message);
};
const ms = (value) => (value === null || value === undefined ? null : round(value, 1));
const summary = (values) => (values.length ? { median: ms(median(values)), min: ms(Math.min(...values)), max: ms(Math.max(...values)) } : null);

/** A layout shift right after a tap is left out of the CLS score by the browser (the user asked for the change), but a page that jumps when tapped is worth knowing about. */
function noteTapShift(ctx, step, shifts) {
  const worst = maxOf(shifts);
  if (worst !== null && worst > 0.02) ctx.notes.push(`${step}: the layout moved by up to ${round(worst, 3)} right after a tap (not counted in CLS, the browser excuses changes that follow a tap)`);
}

// ---- driving the page ---------------------------------------------------------------------------------------------------------------

const call = (ctx, name, ...args) => ctx.page.evaluate(([method, params]) => window.__perf[method](...params), [name, args]);

/** A real tap or click at viewport coordinates, then the pointer is moved out of the way. */
async function tapAt(ctx, { x, y }) {
  if (ctx.spec.touch) {
    await tap(ctx.session, x, y);
    return;
  }
  const mouse = (type) => ctx.session.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  await ctx.session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await mouse("mousePressed");
  await sleep(40);
  await mouse("mouseReleased");
  await ctx.session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
}

async function locate(ctx, name, arg) {
  const where = await call(ctx, "locate", name, arg);
  if (!where) return null;
  if (where.covered) fail(`${name}${arg === undefined ? "" : ` ${arg}`} is covered by something else at the point to press`);
  return where;
}

async function until(ctx, label, test, limitMs = 3000) {
  const deadline = Date.now() + limitMs;
  while (Date.now() < deadline) {
    if (await ctx.page.evaluate(test)) return;
    await sleep(50);
  }
  fail(`timed out waiting for ${label}`);
}

function deadline(promise, limitMs, label) {
  let timer;
  const hung = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new StepHung(`${label} did not finish in ${Math.round(limitMs / 1000)} s`)), limitMs);
  });
  return Promise.race([promise, hung]).finally(() => clearTimeout(timer));
}

/** Loads the panel in this tab (a retry starts from a fresh page; the layout shift of the page that is replaced is kept). */
async function openPanel(ctx, { replacing = false } = {}) {
  if (replacing) ctx.clsCarry += await call(ctx, "clsTotal").catch(() => 0);
  const spec = ctx.spec;
  await ctx.page.goto(harnessUrl({ scenario: "panel", theme: ctx.theme, surface: "panel", pointer: spec.touch ? undefined : "fine" }), { waitUntil: "domcontentloaded" });
  await waitReady(ctx.page, { timeout: 90000 });
  const ready = await call(ctx, "demoReady");
  if (!ready.ok) {
    const known = ready.scenarios.length ? `the harness knows: ${ready.scenarios.join(", ")}` : "the harness knows no scenario";
    throw new ScenarioMissing(`the sample panel is not on the page (${known}${ready.problems.length ? `; ${ready.problems.join("; ")}` : ""}). Build it with: scripts/lu-run node dev/build.mjs`);
  }
  await ctx.page.evaluate(() => window.__lu.settle());
  await sleep(300);
  return ready;
}

/** Runs one step; a failure is retried on a fresh page up to twice and reported as flaky when a retry helped. */
async function runStep(ctx, name, body) {
  let failure;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const value = await deadline(body(), ctx.stepLimitMs, name);
      if (attempt > 1) ctx.flaky.push(name);
      return value;
    } catch (error) {
      if (error instanceof StepHung || error instanceof ScenarioMissing) throw error;
      failure = error;
      ctx.notes.push(`${name}: attempt ${attempt} failed: ${error.message}`);
      await deadline(openPanel(ctx, { replacing: true }), ctx.stepLimitMs, `${name} (reload)`);
    }
  }
  ctx.stepErrors[name] = failure.message;
  return undefined;
}

// ---- tab switches -------------------------------------------------------------------------------------------------------------------

/** Taps a tab of the navigation and records how the screen reacts. */
async function switchTab(ctx, id) {
  const where = await locate(ctx, "nav-tab", id);
  if (!where) fail(`the ${id} tab is not drawn`);
  await call(ctx, "begin", "tab");
  await tapAt(ctx, where);
  const rec = await call(ctx, "end");
  if (!rec.clicked) fail(`the tap on the ${id} tab did not arrive as a click`);
  if (rec.current !== id) fail(`after tapping the ${id} tab the panel shows ${rec.current}`);
  const settle = analyseTimeline({ t0: rec.t0, mutations: rec.mutations, animationFrames: rec.animationFrames, shifts: rec.shifts, images: rec.images, frames: rec.frames, until: rec.until });
  if (settle.firstMs === null) fail(`nothing on screen changed after tapping the ${id} tab`);
  return { id, firstMs: settle.firstMs, stableMs: settle.stableMs, settled: settle.settled, ended: rec.why, renders: rec.renders - rec.rendersAtStart, picturesPending: rec.pending, shift: round(rec.shiftValue, 4), firstChange: rec.where[0] ?? null };
}

async function showTab(ctx, id) {
  if ((await call(ctx, "current")) === id) return;
  await switchTab(ctx, id);
  await sleep(400);
}

async function stepTabs(ctx) {
  const uncached = [];
  for (const id of ["library", "insights"]) {
    uncached.push(await switchTab(ctx, id));
    await sleep(600);
  }
  const cached = [];
  const order = ["live", "library", "insights", "live", "insights", "library"];
  for (let run = 0; run < ctx.opts.runs; run++) {
    for (const id of order) {
      cached.push(await switchTab(ctx, id));
      await sleep(450);
    }
  }
  ctx.raw.tabs = { uncached, cached };
  ctx.metrics.tabFirst = ms(median(cached.map((sample) => sample.firstMs)));
  ctx.metrics.tabStable = ms(median(cached.map((sample) => sample.stableMs)));
  const unsettled = cached.filter((sample) => !sample.settled).length;
  if (unsettled) ctx.notes.push(`tabs: ${unsettled} of ${cached.length} cached switches never went quiet within the recording (their stable time is where the recording ended)`);
  const rows = [];
  for (const [label, list] of [["first visit (not gated)", uncached], ["cached", cached]]) {
    for (const id of TABS) {
      const mine = list.filter((sample) => sample.id === id);
      if (!mine.length) continue;
      const first = summary(mine.map((sample) => sample.firstMs));
      const stable = summary(mine.map((sample) => sample.stableMs));
      rows.push([label, id, mine.length, first.median, first.max, stable.median, stable.max, mine.map((sample) => sample.renders).join("/"), maxOf(mine.map((sample) => sample.shift))]);
    }
  }
  ctx.details.push({ title: "Tab switches (ms from the tap)", columns: ["visit", "to", "n", "first med", "first max", "stable med", "stable max", "renders", "layout shift"], rows });
  noteTapShift(ctx, "tabs", [...uncached, ...cached].map((sample) => sample.shift));
}

// ---- presses ------------------------------------------------------------------------------------------------------------------------

/** One press (pointer down, no release that acts), timed two ways: wall clock to the painted frame, and the main thread's CPU time from a trace. */
async function pressOnce(ctx, control, traced) {
  const where = await locate(ctx, control.name, control.arg);
  if (!where) return null;
  if (!ctx.spec.touch) {
    await ctx.session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: where.x, y: where.y });
    await sleep(120);
  }
  await call(ctx, "armPress", control.name, control.arg);
  if (traced) await ctx.browser.startTracing(ctx.page, { categories: TRACE_CATEGORIES });
  let events = [];
  let result;
  try {
    if (ctx.spec.touch) await ctx.session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: where.x, y: where.y, id: 1 }] });
    else await ctx.session.send("Input.dispatchMouseEvent", { type: "mousePressed", x: where.x, y: where.y, button: "left", clickCount: 1 });
    result = await call(ctx, "pressResult");
    if (traced) await sleep(260);
  } finally {
    if (traced) events = JSON.parse((await ctx.browser.stopTracing()).toString()).traceEvents ?? [];
  }
  if (ctx.spec.touch) await ctx.session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  else {
    await call(ctx, "muteNextClick");
    await ctx.session.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: where.x, y: where.y, button: "left", clickCount: 1 });
    await ctx.session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  }
  await sleep(150);
  if (!result) fail(`no pointerdown reached ${control.name}`);
  if (!traced) return { wallMs: result.ms, changed: result.changed };
  const thread = pressThreadMs(events);
  if (!thread.found) fail(`the trace of the ${control.name} press has no pointerdown`);
  return { wallMs: result.ms, changed: result.changed, threadMs: thread.ms };
}

/** Presses a control `runs` times, each time right after pressing something inert in the same state (the floor of what a press costs on this page now). */
async function pressControl(ctx, control, inert) {
  const rows = { wall: [], floorWall: [], thread: [], floorThread: [], changed: [] };
  for (let run = 0; run < ctx.opts.runs; run++) {
    for (const traced of [false, true]) {
      const floor = await pressOnce(ctx, inert, traced);
      const sample = await pressOnce(ctx, control, traced);
      if (!sample) return { control: control.label, skipped: "not on the page" };
      if (traced) {
        rows.thread.push(sample.threadMs);
        if (floor) rows.floorThread.push(floor.threadMs);
      } else {
        rows.wall.push(sample.wallMs);
        rows.changed.push(sample.changed);
        if (floor) rows.floorWall.push(floor.wallMs);
      }
    }
  }
  const noFeedback = rows.changed.filter((changed) => !changed).length > rows.changed.length / 2;
  return {
    control: control.label, wallMs: ms(median(rows.wall)), wallMax: ms(Math.max(...rows.wall)), floorWallMs: rows.floorWall.length ? ms(median(rows.floorWall)) : null,
    threadMs: ms(median(rows.thread)), threadMax: ms(Math.max(...rows.thread)), floorThreadMs: rows.floorThread.length ? ms(median(rows.floorThread)) : null, noFeedback, samples: rows,
  };
}

const PRESS_PLAN = [
  { tab: "live", controls: [{ label: "nav tab", name: "nav-tab", arg: "library", required: true }, { label: "camera tile", name: "camera-tile" }, { label: "app bar button", name: "picker-button", required: true }] },
  { tab: "library", controls: [{ label: "species tile", name: "species-tile", arg: 0, required: true }, { label: "filter option", name: "segmented-option" }, { label: "show more button", name: "species-more" }] },
  { tab: "insights", controls: [{ label: "button", name: "insights-button" }, { label: "row", name: "insights-row" }] },
];
const INERT = { label: "heading", name: "shell-heading" };

/** Folds the per-control press results of this cell into the two gate numbers and the detail table. */
function recordPresses(ctx, results) {
  ctx.raw.press = [...(ctx.raw.press ?? []), ...results];
  const measured = ctx.raw.press.filter((entry) => !entry.skipped);
  ctx.metrics.pressWall = maxOf(measured.map((entry) => entry.wallMs));
  ctx.metrics.pressThread = maxOf(measured.map((entry) => entry.threadMs));
  const blank = measured.filter((entry) => entry.noFeedback).map((entry) => entry.control);
  if (blank.length) ctx.violations.pressWall = `no visible feedback: ${blank.join(", ")}`;
  ctx.details = ctx.details.filter((table) => table.title !== "Press feedback");
  ctx.details.push({
    title: "Press feedback",
    columns: ["control", "wall med ms", "wall max", "wall floor", "thread med ms", "thread max", "thread floor", "feedback"],
    rows: ctx.raw.press.map((entry) => (entry.skipped
      ? [entry.control, "skipped", "", "", "", "", "", entry.skipped]
      : [entry.control, entry.wallMs, entry.wallMax, entry.floorWallMs ?? "-", entry.threadMs, entry.threadMax, entry.floorThreadMs ?? "-", entry.noFeedback ? "NONE" : "seen"])),
  });
}

async function stepPress(ctx) {
  const results = [];
  for (const group of PRESS_PLAN) {
    await showTab(ctx, group.tab);
    await call(ctx, "scrollTo", 0);
    await sleep(300);
    for (const control of group.controls) {
      const result = await pressControl(ctx, control, INERT);
      if (result.skipped && control.required) fail(`${control.label} (${control.name}) is not on the page`);
      if (result.skipped) ctx.notes.push(`press: ${control.label} was not found and was skipped`);
      results.push(result);
    }
  }
  recordPresses(ctx, results);
}

// ---- sheets and Back ---------------------------------------------------------------------------------------------------------------

const sheetClosed = () => !window.__lu.demo.sheetOpen() && window.__lu.demo.layerDepth() === 0;

async function openSheetBy(ctx, control) {
  const where = await locate(ctx, control.name, control.arg);
  if (!where) fail(`${control.label} is not on the page`);
  await call(ctx, "begin", "sheet");
  await tapAt(ctx, where);
  const rec = await call(ctx, "end");
  if (!rec.clicked) fail(`the tap on the ${control.label} did not arrive as a click`);
  if (rec.doneAt === null || rec.why === "cap") fail(`the sheet did not finish opening after the ${control.label} tap`);
  if (rec.visibleAt === null) fail(`the sheet never appeared after the ${control.label} tap`);
  return { doneMs: rec.doneAt - rec.t0, shownMs: rec.visibleAt - rec.t0, shift: rec.shiftValue };
}

async function backBy(ctx) {
  await call(ctx, "begin", "back");
  await call(ctx, "goBack");
  const rec = await call(ctx, "end");
  if (rec.doneAt === null || rec.why === "cap") fail("Back did not close the sheet");
  await until(ctx, "the sheet to be gone", sheetClosed, 4000);
  await sleep(350);
  return { backMs: rec.doneAt - rec.t0, shift: rec.shiftValue };
}

/** Back the way the browser does it: a history traversal started from outside the page (CDP). The time includes the round trip of that command. */
async function systemBack(ctx) {
  const history = await ctx.session.send("Page.getNavigationHistory");
  const previous = history.entries[history.currentIndex - 1];
  if (!previous) fail("there is no history entry to go back to");
  await call(ctx, "begin", "back");
  const sentAt = Date.now();
  await ctx.session.send("Page.navigateToHistoryEntry", { entryId: previous.id });
  await call(ctx, "markBack", sentAt);
  const rec = await call(ctx, "end");
  if (rec.doneAt === null || rec.why === "cap") fail("the system Back did not close the sheet");
  await until(ctx, "the sheet to be gone", sheetClosed, 4000);
  await sleep(350);
  return { backMs: rec.doneAt - rec.t0 };
}

async function stepSheet(ctx) {
  const species = { shown: [], done: [], back: [], shift: [] };
  const picker = { shown: [], done: [], back: [], shift: [] };
  const system = [];
  /** One round: open by tapping `control`, let it rest, (optionally press its close button), go Back. */
  const round_ = async (control, into, { pressClose = false } = {}) => {
    const opened = await openSheetBy(ctx, control);
    into.shown.push(opened.shownMs);
    into.done.push(opened.doneMs);
    into.shift.push(opened.shift);
    await sleep(500);
    if (pressClose) recordPresses(ctx, [await pressControl(ctx, { label: "sheet close button", name: "sheet-close" }, { label: "sheet title", name: "sheet-title" })]);
    const back = await backBy(ctx);
    into.back.push(back.backMs);
    into.shift.push(back.shift);
  };
  await showTab(ctx, "library");
  await call(ctx, "scrollTo", 0);
  await sleep(300);
  const tile = { label: "species tile", name: "species-tile", arg: 0 };
  for (let run = 0; run < ctx.opts.runs; run++) await round_(tile, species, { pressClose: run === ctx.opts.runs - 1 && ctx.wanted.has("press") });
  await openSheetBy(ctx, tile);
  await sleep(500);
  system.push((await systemBack(ctx)).backMs);
  await showTab(ctx, "live");
  await call(ctx, "scrollTo", 0);
  await sleep(300);
  const button = { label: "app bar button", name: "picker-button" };
  for (let run = 0; run < ctx.opts.runs; run++) await round_(button, picker);
  ctx.raw.sheet = { species, picker, systemBackMs: system };
  // Gated: how soon the sheet is on screen and entering. The finished enter motion takes motion.layer (220 ms) by design, so "tap to fully open" can never be under 220 ms.
  const gate = ctx.opts.sheetGate === "done" ? "done" : "shown";
  ctx.metrics.sheetOpen = ms(maxOf([median(species[gate]), median(picker[gate])]));
  ctx.metrics.back = ms(maxOf([median(species.back), median(picker.back)]));
  const row = (label, list) => [label, list.length, ms(median(list)), ms(Math.max(...list)), ms(Math.min(...list))];
  ctx.details.push({
    title: "Sheets and Back (ms from the tap / from history.back)",
    columns: ["what", "n", "median", "max", "min"],
    rows: [
      row(`species sheet on screen${gate === "shown" ? " (gated)" : ""}`, species.shown), row(`species sheet enter motion finished${gate === "done" ? " (gated)" : ""}`, species.done), row("species sheet, Back (history.back)", species.back),
      row(`What was it? sheet on screen${gate === "shown" ? " (gated)" : ""}`, picker.shown), row(`What was it? enter motion finished${gate === "done" ? " (gated)" : ""}`, picker.done), row("What was it? sheet, Back (history layer)", picker.back),
      row("species sheet, system Back via CDP (includes the command's round trip, not gated)", system),
    ],
  });
  noteTapShift(ctx, "sheets", [...species.shift, ...picker.shift]);
}

// ---- scrolling ---------------------------------------------------------------------------------------------------------------------

async function stepScroll(ctx) {
  await showTab(ctx, "library");
  for (let more = 0; more < 4; more++) {
    const info = await call(ctx, "scrollInfo");
    if (info.height - info.viewport >= SCROLL_DISTANCE + 300) break;
    const where = await locate(ctx, "species-more");
    if (!where) break;
    await tapAt(ctx, where);
    await sleep(1400);
  }
  await call(ctx, "scrollTo", 0);
  await sleep(600);
  const origin = new URL(ctx.page.url()).origin;
  const passes = [];
  for (let pass = 0; pass < ctx.opts.passes; pass++) {
    const down = pass % 2 === 0;
    const info = await call(ctx, "scrollInfo");
    const room = down ? info.height - info.viewport - info.top : info.top;
    const distance = Math.min(SCROLL_DISTANCE, Math.floor(room));
    if (distance < 400) {
      ctx.notes.push(`scroll: pass ${pass + 1} skipped, only ${distance} px of page to travel`);
      continue;
    }
    const from = await call(ctx, "now");
    await scrollBy(ctx.session, ctx.spec, down ? distance : -distance);
    const to = await call(ctx, "now");
    await sleep(350);
    const seen = await call(ctx, "slice", from - 30, to + 300);
    const after = await call(ctx, "scrollInfo");
    let own = 0;
    let other = 0;
    const others = {};
    for (const frame of seen.loaf) {
      for (const script of frame.scripts) {
        if (script.url.startsWith(origin)) own += script.d;
        else {
          other += script.d;
          others[script.url || "(no url)"] = (others[script.url || "(no url)"] ?? 0) + script.d;
        }
      }
    }
    passes.push({ pass: pass + 1, direction: down ? "down" : "up", asked: distance, travelled: Math.round(Math.abs(after.top - info.top)), longTasks: seen.longTasks, longFrames: seen.loaf.length, worstFrameMs: Math.round(maxOf(seen.loaf.map((frame) => frame.d)) ?? 0), toolkitScriptMs: Math.round(own), otherScriptMs: Math.round(other), otherScripts: others, cls: seen.cls });
    await sleep(300);
  }
  if (!passes.length) fail("the page was too short to scroll");
  const short = passes.filter((entry) => entry.travelled < entry.asked * 0.6);
  if (short.length) ctx.notes.push(`scroll: ${short.length} pass(es) travelled less than 60% of the distance (${short.map((entry) => `${entry.travelled}/${entry.asked}`).join(", ")})`);
  ctx.raw.scroll = passes;
  ctx.metrics.scrollLongTask = Math.max(0, ...passes.flatMap((entry) => entry.longTasks));
  ctx.details.push({
    title: "Scrolling the Library",
    columns: ["pass", "way", "travelled px", "long tasks (ms)", "long frames", "worst frame ms", "toolkit script ms", "other script ms"],
    rows: passes.map((entry) => [entry.pass, entry.direction, entry.travelled, entry.longTasks.join(" ") || "none", entry.longFrames, entry.worstFrameMs, entry.toolkitScriptMs, entry.otherScriptMs]),
  });
}

// ---- one cell ----------------------------------------------------------------------------------------------------------------------

/** Measures one cell in one tab. Returns what was measured; `stepErrors` names the steps that could not be measured. */
export async function measureCell({ size, theme, cpu, opts, steps, wanted }) {
  const cellMs = opts.cellTimeout * 1000;
  return withTab({ device: size, cpu, timeoutMs: cellMs }, async ({ page, session, spec, seen }) => {
    const ctx = {
      page, session, spec, theme, cpu, opts, wanted, browser: page.context().browser(),
      stepLimitMs: Math.round(cellMs * 0.6), raw: {}, metrics: {}, details: [], notes: [], flaky: [], stepErrors: {}, violations: {}, clsCarry: 0,
    };
    await page.addInitScript(installProbe);
    const ready = await openPanel(ctx);
    const calibrationMs = await call(ctx, "calibrate");
    const facts = await call(ctx, "facts");
    const pageFacts = { readyMs: Math.round(ready.readyAt), firstContentfulPaintMs: facts.firstContentfulPaintMs === null ? null : Math.round(facts.firstContentfulPaintMs), scriptKB: Math.round(facts.scriptBytes / 1024), nodesAtStart: facts.nodes, imagesAtStart: facts.images };
    const stepFns = { tabs: stepTabs, press: stepPress, sheet: stepSheet, scroll: stepScroll };
    for (const name of steps) await runStep(ctx, name, () => stepFns[name](ctx));
    const end = await call(ctx, "facts");
    const demoStats = await page.evaluate(() => window.__lu.demo.stats());
    ctx.metrics.cls = round(ctx.clsCarry + (await call(ctx, "clsTotal")), 4);
    const clsAll = round(ctx.clsCarry + (await call(ctx, "clsAllTotal")), 4);
    const problems = [...seen.errors, ...end.pageErrors];
    if (problems.length) ctx.notes.push(`the page reported errors: ${problems.slice(0, 3).join(" | ")}`);
    return {
      calibrationMs,
      page: { ...pageFacts, nodesAtEnd: end.nodes, imagesAtEnd: end.images, imagesLoadedAtEnd: end.imagesLoaded, clsIncludingTapShifts: clsAll, viewsMounted: demoStats.viewsMounted.join("+"), evictedViews: demoStats.evicted.length, renders: demoStats.renders },
      metrics: ctx.metrics, stepErrors: ctx.stepErrors, violations: ctx.violations, flaky: ctx.flaky, notes: ctx.notes, details: ctx.details, raw: ctx.raw,
    };
  });
}
