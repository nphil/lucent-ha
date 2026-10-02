/** Browser helpers shared by dev/shot.mjs, dev/screenshots.mjs and the perf checks. Node only; run through `scripts/lu-browser`.
 *
 * The browser is the SHARED Chromium (CDP 127.0.0.1:43977) that Nitin watches: every run opens ONE tab of its own, closes it in a
 * `finally` (and by a watchdog if a page wedges), and never touches another tab. */
import { chromium } from "playwright-core";
import devices from "../devices.json" with { type: "json" };

export const HARNESS = process.env.HARNESS_URL ?? "http://127.0.0.1:4180";
export const CDP = process.env.LU_CDP ?? "http://127.0.0.1:43977";
export const DEVICES = devices;
export const THEMES = ["flat-light", "flat-dark", "glass-light", "glass-dark"];
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `/harness.html?...` for the given URL parameters (docs/harness.md); undefined, false and empty values are left out. */
export function harnessUrl(params = {}, path = "/harness.html") {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === false || value === "") continue;
    query.set(key, value === true ? "1" : String(value));
  }
  const text = query.toString();
  return `${HARNESS}${path}${text ? `${path.includes("?") ? "&" : "?"}${text}` : ""}`;
}

/** Sets the tab to a device of the matrix: size, mobile/touch emulation, hidden scrollbars for touch, optional pixel ratio and CPU throttle. */
export async function applyDevice(session, device, { dpr = 1, cpu = 1 } = {}) {
  const spec = typeof device === "string" ? DEVICES[device] : device;
  if (!spec) throw new Error(`unknown device "${device}" (known: ${Object.keys(DEVICES).join(", ")})`);
  await session.send("Emulation.setDeviceMetricsOverride", { width: spec.width, height: spec.height, deviceScaleFactor: dpr, mobile: spec.touch, screenWidth: spec.width, screenHeight: spec.height });
  await session.send("Emulation.setTouchEmulationEnabled", spec.touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await session.send("Emulation.setScrollbarsHidden", { hidden: spec.touch }).catch(() => {});
  await session.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  return spec;
}

/** Collects what the page complains about: console errors and warnings, uncaught errors, failed requests. A "ResizeObserver loop" message is
 * a layout settling over two frames, not a failure: it is kept apart in `notes`. */
export function watchConsole(page) {
  const seen = { errors: [], warnings: [], notes: [] };
  const error = (text) => (text.includes("ResizeObserver loop") ? seen.notes : seen.errors).push(text.slice(0, 300));
  page.on("console", (message) => {
    if (message.type() === "error") error(message.text());
    else if (message.type() === "warning") seen.warnings.push(message.text().slice(0, 300));
  });
  page.on("pageerror", (failure) => error(`uncaught: ${String(failure)}`));
  page.on("requestfailed", (request) => seen.errors.push(`request failed: ${request.url().slice(0, 160)} (${request.failure()?.errorText})`));
  return seen;
}

/** Waits for `window.__luReady` (fonts loaded, every specimen set up, Lit elements updated, two frames painted). */
export async function waitReady(page, { timeout = 45000 } = {}) {
  await page.waitForFunction(() => window.__luReady === true, undefined, { timeout });
}

/** Loads a harness URL in the tab and waits until it is ready. */
export async function open(page, url, options) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitReady(page, options);
}

/** Switches the emulated Home Assistant theme in the open page (no reload) and waits for the page to settle. */
export async function applyTheme(page, name) {
  await page.evaluate(async (theme) => { window.__lu.setTheme(theme); await window.__lu.settle(); }, name);
}

/** One tab of the shared browser for the duration of `run`; always closed afterwards.
 * `run({ page, session, spec, seen })` gets the Playwright page, a raw CDP session, the device spec and the console collector. */
export async function withTab({ device, dpr = 1, cpu = 1, reducedMotion = false, timeoutMs = 240000 } = {}, run) {
  const browser = await chromium.connectOverCDP(CDP);
  const context = browser.contexts()[0];
  if (!context) throw new Error(`the browser at ${CDP} has no default context`);
  const page = await context.newPage();
  // A wedged page can block the shared browser for everybody: close the tab and leave after the deadline.
  const watchdog = setTimeout(async () => {
    console.error(`watchdog: closing the tab after ${timeoutMs} ms`);
    await page.close().catch(() => {});
    process.exit(3);
  }, timeoutMs);
  try {
    const session = await context.newCDPSession(page);
    const spec = device ? await applyDevice(session, device, { dpr, cpu }) : undefined;
    if (reducedMotion) await session.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    return await run({ page, session, spec, seen: watchConsole(page) });
  } finally {
    clearTimeout(watchdog);
    await page.close().catch(() => {});
    await browser.close().catch(() => {}); // only disconnects: the shared browser keeps running
  }
}

/** A real finger tap at viewport coordinates (touch devices). */
export async function tap(session, x, y) {
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  await sleep(40);
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Scrolls the page by `dy` CSS px the way the device does: finger drags on touch sizes, wheel gestures on the others. */
export async function scrollBy(session, spec, dy, { speed = 1400, xFraction = 0.6 } = {}) {
  const { width, height, touch } = spec;
  const x = Math.round(width * xFraction);
  if (!touch) {
    await session.send("Input.synthesizeScrollGesture", { x, y: Math.round(height * 0.7), yDistance: -dy, speed, gestureSourceType: "mouse", preventFling: true });
    return;
  }
  const direction = dy > 0 ? 1 : -1;
  let remaining = Math.abs(dy);
  while (remaining > 1) {
    const segment = Math.min(remaining, height * 0.55);
    const startY = Math.round(direction > 0 ? height * 0.8 : height * 0.25);
    const steps = Math.max(3, Math.round((segment / speed) * 60));
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: startY, id: 1 }] });
    for (let step = 1; step <= steps; step++) {
      await sleep(1000 / 60);
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: Math.round(startY - (direction * segment * step) / steps), id: 1 }] });
    }
    await sleep(90);
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    remaining -= segment;
    await sleep(30);
  }
}
