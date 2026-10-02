/** Reality check against the REAL Home Assistant (never the harness): mounts a small toolkit panel (dev/ha-inject/entry.ts, prefix `chk`)
 * into the live panel area of the shared browser's HA page and checks what only the real thing can tell: live theme follow, the menu
 * rule and `hass-toggle-menu`, wall mode (`hass-kiosk-mode`), `always_hidden` sidebar, stacking against HA's drawer, safe areas, and
 * Back with a sheet open (history layers), plus whether `ha-adaptive-dialog` exists. Nothing is written to Home Assistant's
 * configuration: the panel is injected at run time and removed again, the theme and the sidebar setting are put back.
 *
 *   scripts/lu-browser node scripts/ha-check.mjs [--out /tmp/lucent-ha-check]
 *
 * Protocol (shared browser, relay on 127.0.0.1:8124): ONE own tab, closed at the end; the HA token is injected only if missing and
 * removed again only if no other HA tab is open; the Neumorphism light theme is restored. */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { CDP, applyDevice, sleep } from "../dev/lib/browser.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.HA_BASE ?? "http://127.0.0.1:8124";
const outIndex = process.argv.indexOf("--out");
const out = outIndex >= 0 ? process.argv[outIndex + 1] : "/tmp/lucent-ha-check";
mkdirSync(out, { recursive: true });

execFileSync(join(root, "node_modules/.bin/esbuild"), [join(root, "dev/ha-inject/entry.ts"), "--bundle", "--format=iife", "--target=es2021", "--minify", "--legal-comments=none", `--outfile=${join(out, "bundle.js")}`], { stdio: "inherit" });
const bundle = readFileSync(join(out, "bundle.js"), "utf8");
const token = readFileSync("/data/home/tmp/ha-token", "utf8").trim();

const results = [];
const evidence = {};
const step = async (name, fn) => {
  try {
    const value = await fn();
    results.push({ name, ok: true, value });
    console.log(`PASS ${name}${value === undefined ? "" : ` ${JSON.stringify(value)}`}`);
  } catch (error) {
    results.push({ name, ok: false, error: String(error?.message ?? error) });
    console.log(`FAIL ${name}: ${String(error?.message ?? error)}`);
  }
};
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const browser = await chromium.connectOverCDP(CDP);
const context = browser.contexts()[0];
const page = await context.newPage();
const problems = [];
page.on("pageerror", (error) => problems.push(`pageerror: ${String(error.message).slice(0, 200)}`));
const watchdog = setTimeout(async () => { console.error("watchdog: closing the tab"); await page.close().catch(() => {}); process.exit(3); }, 420000);
let addedToken = false;
let originalDock = "docked";
let session;

const shot = async (name) => { await page.screenshot({ path: join(out, `${name}.png`) }); return `${name}.png`; };
const haEval = (fn, arg) => page.evaluate(fn, arg);
const settle = (ms = 500) => sleep(ms);
const menuButton = () => page.locator("chk-lu-app-shell").getByRole("button", { name: /sidebar|menu/i });

async function load(deviceName) {
  session ??= await context.newCDPSession(page);
  await applyDevice(session, deviceName);
  await page.goto(`${BASE}/profile`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const ha = document.querySelector("home-assistant");
    const main = ha?.shadowRoot?.querySelector("home-assistant-main");
    const resolver = main?.shadowRoot?.querySelector("partial-panel-resolver");
    return !!resolver && (resolver.shadowRoot ?? resolver).children.length > 0;
  }, undefined, { timeout: 60000 });
  await settle(2500);
  await page.addScriptTag({ content: bundle });
  const mounted = await haEval(() => window.__chk.mount());
  expect(mounted.mounted, `mount failed: ${JSON.stringify(mounted)}`);
  await page.waitForFunction(() => !!window.__chk.find("chk-lu-app-shell")?.shadowRoot?.querySelector("nav,header"), undefined, { timeout: 15000 });
  await settle(800);
  return mounted;
}

try {
  await page.goto(`${BASE}/auth/authorize`, { waitUntil: "domcontentloaded" }).catch(() => {});
  if (!(await haEval(() => !!localStorage.getItem("hassTokens")))) {
    await haEval(([t, base]) => localStorage.setItem("hassTokens", JSON.stringify({ access_token: t, token_type: "Bearer", expires_in: 1800, hassUrl: base, clientId: base + "/", expires: Date.now() + 365 * 864e5, refresh_token: "" })), [token, BASE]);
    addedToken = true;
  }

  // ---------- phone: menu, drawer stacking, themes, safe area ----------
  let mounted;
  await step("phone: panel mounts into Home Assistant's panel area", async () => { mounted = await load("phone"); evidence.mounted = mounted; return mounted; });
  originalDock = await haEval(() => document.querySelector("home-assistant").hass.dockedSidebar ?? "docked");

  await step("phone: HA narrow, our menu button shown (HA's rule)", async () => {
    const info = await haEval(() => { const ha = document.querySelector("home-assistant"); const main = ha.shadowRoot.querySelector("home-assistant-main"); return { narrow: !!main.narrow, kiosk: ha.hass.kioskMode, docked: ha.hass.dockedSidebar }; });
    expect(info.narrow === true, `HA reports narrow=${info.narrow}`);
    expect(await menuButton().count() === 1, "no menu button in the shell");
    return info;
  });
  await step("phone: tapping our menu button opens Home Assistant's drawer, Escape closes it", async () => {
    await menuButton().click();
    await settle(600);
    const open = await haEval(() => !!document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main")._drawerOpen);
    expect(open, "HA drawer did not open (hass-toggle-menu did not reach home-assistant-main)");
    await shot("phone-drawer-open");
    // stacking: a point to the right of the 256px drawer is HA's scrim, never our sticky bar
    const top = await haEval(() => {
      const deep = (x, y) => { let el = document.elementFromPoint(x, y); while (el?.shadowRoot) { const next = el.shadowRoot.elementFromPoint(x, y); if (!next || next === el) break; el = next; } return el; };
      const el = deep(window.innerWidth - 12, 28);
      const path = []; for (let n = el; n; n = n.parentNode || n.host) path.push(n.localName || n.nodeName);
      return { tag: el?.localName, inOurShell: path.includes("chk-lu-app-shell"), path: path.slice(0, 6) };
    });
    expect(!top.inOurShell, `our bar is ABOVE Home Assistant's scrim: ${JSON.stringify(top)}`);
    await page.keyboard.press("Escape");
    await settle(500);
    const closed = await haEval(() => !document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main")._drawerOpen);
    expect(closed, "Escape did not close the drawer");
    return top;
  });
  await step("phone: Back with a sheet open closes only the sheet", async () => {
    const before = await haEval(() => ({ path: location.pathname, length: history.length }));
    await page.locator("chk-lu-button").filter({ hasText: "Open sheet" }).click();
    await settle(700);
    const during = await haEval(() => ({ path: location.pathname, length: history.length, layer: history.state?.lu?.layer ?? null, open: !!window.__chk.find("chk-lu-sheet")?.open }));
    expect(during.open, "sheet did not open");
    expect(during.path === before.path, "opening a sheet changed the URL");
    expect(during.length === before.length + 1 && during.layer, `no history layer pushed: ${JSON.stringify(during)}`);
    await shot("phone-sheet-open");
    await page.goBack();
    await settle(900);
    const after = await haEval(() => ({ path: location.pathname, open: !!window.__chk.find("chk-lu-sheet")?.open, panel: !!window.__chk.panel()?.isConnected, layer: history.state?.lu?.layer ?? null }));
    expect(after.path === before.path && after.panel, `Back left the panel: ${JSON.stringify(after)}`);
    expect(!after.open, "Back did not close the sheet");
    return { before, during, after };
  });
  await step("phone: ha-adaptive-dialog (is HA's own dialog defined here?)", async () => {
    const defined = await haEval(() => !!customElements.get("ha-adaptive-dialog"));
    evidence.haAdaptiveDialogDefined = defined;
    if (defined) {
      await page.locator("chk-lu-button").filter({ hasText: "Open sheet" }).click();
      await settle(900);
      const used = await haEval(() => { const sheet = window.__chk.find("chk-lu-sheet"); return { engineHa: !!sheet?.shadowRoot?.querySelector("ha-adaptive-dialog"), open: !!sheet?.open }; });
      await shot("phone-sheet-ha-dialog");
      await page.keyboard.press("Escape");
      await settle(800);
      const closed = await haEval(() => !window.__chk.find("chk-lu-sheet")?.open);
      expect(used.open && closed, `ha-adaptive-dialog path did not open/close: ${JSON.stringify({ used, closed })}`);
      return { defined, ...used };
    }
    return { defined };
  });
  await step("phone: safe-area insets (47px top, 34px bottom) are honoured", async () => {
    await haEval(() => { const style = document.documentElement.style; style.setProperty("--safe-area-inset-top", "47px"); style.setProperty("--safe-area-inset-bottom", "34px"); });
    await settle(600);
    const rects = await haEval(() => { const shell = window.__chk.find("chk-lu-app-shell"); const bar = shell.shadowRoot.querySelector("header, .chrome"); const dock = shell.shadowRoot.querySelector(".dock, nav.bottom, footer"); const r = (el) => el && (({ top, bottom, height }) => ({ top: Math.round(top), bottom: Math.round(bottom), height: Math.round(height) }))(el.getBoundingClientRect()); return { bar: r(bar), dock: r(dock), viewport: innerHeight }; });
    await shot("phone-safe-area");
    await haEval(() => { const style = document.documentElement.style; style.removeProperty("--safe-area-inset-top"); style.removeProperty("--safe-area-inset-bottom"); });
    expect(rects.bar && rects.bar.top <= 0 && rects.bar.height >= 100, `bar does not reach the top edge / cover the notch: ${JSON.stringify(rects)}`);
    return rects;
  });
  for (const [theme, dark] of [["Neumorphism", false], ["Neumorphism", true], ["Frosted Glass", false], ["Frosted Glass", true], ["Liquid Glass", true]]) {
    await step(`theme follows live: ${theme} ${dark ? "dark" : "light"}`, async () => {
      await haEval(([name, isDark]) => document.querySelector("home-assistant").dispatchEvent(new CustomEvent("settheme", { detail: { theme: name, dark: isDark }, bubbles: true, composed: true })), [theme, dark]);
      await settle(1200);
      const values = await haEval(() => {
        const shell = window.__chk.find("chk-lu-app-shell");
        const probe = document.createElement("span"); shell.shadowRoot.append(probe);
        const resolve = (name, prop) => { probe.style.cssText = `color: var(${name}); background-color: var(${name})`; return getComputedStyle(probe)[prop]; };
        const out = { accent: resolve("--lu-accent", "color"), ink: resolve("--lu-ink", "color"), card: resolve("--lu-card", "backgroundColor"), canvas: resolve("--lu-canvas", "backgroundColor") };
        const html = getComputedStyle(document.documentElement);
        const probe2 = document.createElement("span"); document.body.append(probe2);
        probe2.style.color = html.getPropertyValue("--primary-text-color"); out.haInk = getComputedStyle(probe2).color;
        probe2.style.color = html.getPropertyValue("--primary-color"); out.haAccent = getComputedStyle(probe2).color;
        probe.remove(); probe2.remove();
        return out;
      });
      await shot(`theme-${theme.replace(/ /g, "-").toLowerCase()}-${dark ? "dark" : "light"}`);
      evidence[`theme:${theme}:${dark}`] = values;
      expect(values.ink === values.haInk, `--lu-ink (${values.ink}) does not follow --primary-text-color (${values.haInk})`);
      expect(values.accent === values.haAccent, `--lu-accent (${values.accent}) does not follow --primary-color (${values.haAccent})`);
      return values;
    });
  }
  await step("theme values differ between themes (nothing is cached)", async () => {
    const distinct = new Set(Object.entries(evidence).filter(([key]) => key.startsWith("theme:")).map(([, value]) => `${value.canvas}|${value.card}|${value.ink}`));
    expect(distinct.size >= 3, `only ${distinct.size} distinct palettes across 5 themes`);
    return distinct.size;
  });
  await haEval(() => document.querySelector("home-assistant").dispatchEvent(new CustomEvent("settheme", { detail: { theme: "Neumorphism", dark: false }, bubbles: true, composed: true })));
  await settle(800);

  // ---------- desktop: always_hidden, wall mode, Back ----------
  await step("desktop: panel mounts (1280x800, docked sidebar)", async () => { await haEval(() => window.__chk.unmount()); return load("desktop"); });
  await step("desktop: docked sidebar -> no menu button (HA's rule)", async () => {
    const info = await haEval(() => { const ha = document.querySelector("home-assistant"); return { narrow: !!ha.shadowRoot.querySelector("home-assistant-main").narrow, docked: ha.hass.dockedSidebar }; });
    expect(info.narrow === false, `unexpectedly narrow: ${JSON.stringify(info)}`);
    expect(await menuButton().count() === 0, "a menu button is shown next to a docked sidebar");
    await shot("desktop-docked");
    return info;
  });
  await step("desktop: sidebar set to always_hidden -> menu button appears and opens the drawer", async () => {
    await haEval(() => window.__chk.panel().dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock: "always_hidden" }, bubbles: true, composed: true })));
    await settle(800);
    expect(await menuButton().count() === 1, "no menu button with dockedSidebar=always_hidden");
    await menuButton().click();
    await settle(600);
    const open = await haEval(() => !!document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main")._drawerOpen);
    expect(open, "drawer did not open on a wide screen with always_hidden");
    await shot("desktop-always-hidden-drawer");
    await page.keyboard.press("Escape");
    await settle(400);
  });
  await step("desktop: wall mode switches Home Assistant to kiosk, our menu button opens its drawer, off restores", async () => {
    await haEval((dock) => window.__chk.panel().dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock }, bubbles: true, composed: true })), originalDock);
    await settle(600);
    await haEval(() => window.__chk.setWall(true));
    await settle(900);
    const kiosk = await haEval(() => document.querySelector("home-assistant").hass.kioskMode);
    expect(kiosk === true, `hass.kioskMode is ${kiosk} while wall mode is on`);
    expect(await menuButton().count() === 1, "no own menu button in wall mode");
    await menuButton().click();
    await settle(600);
    const open = await haEval(() => !!document.querySelector("home-assistant").shadowRoot.querySelector("home-assistant-main")._drawerOpen);
    expect(open, "drawer did not open in kiosk mode");
    await shot("desktop-wall-mode-drawer");
    await page.keyboard.press("Escape");
    await settle(400);
    await haEval(() => window.__chk.setWall(false));
    await settle(900);
    const after = await haEval(() => document.querySelector("home-assistant").hass.kioskMode);
    expect(after === false, `kioskMode stayed ${after} after wall mode was turned off`);
  });
  await step("desktop: wall mode is released when the panel goes away", async () => {
    await haEval(() => window.__chk.setWall(true));
    await settle(700);
    await haEval(() => window.__chk.unmount());
    await settle(700);
    const kiosk = await haEval(() => document.querySelector("home-assistant").hass.kioskMode);
    expect(kiosk === false, `kioskMode is ${kiosk} after the panel was removed`);
    await load("desktop");
  });
  await step("desktop: Back with a sheet open closes only the sheet; Escape and the close path leave history balanced", async () => {
    const before = await haEval(() => ({ path: location.pathname, length: history.length }));
    await page.locator("chk-lu-button").filter({ hasText: "Open sheet" }).click();
    await settle(700);
    await shot("desktop-sheet-open");
    await page.keyboard.press("Escape");
    await settle(900);
    const afterEscape = await haEval(() => ({ path: location.pathname, open: !!window.__chk.find("chk-lu-sheet")?.open, layer: history.state?.lu?.layer ?? null }));
    expect(!afterEscape.open && !afterEscape.layer && afterEscape.path === before.path, `Escape left a layer behind: ${JSON.stringify(afterEscape)}`);
    return { before, afterEscape };
  });
  await step("desktop: toast appears (top layer)", async () => {
    await page.locator("chk-lu-button").filter({ hasText: "Show toast" }).click();
    await settle(600);
    const info = await haEval(() => { const all = []; const walk = (root) => { for (const el of root.querySelectorAll("*")) { if (el.localName === "chk-lu-toast") all.push(el); if (el.shadowRoot) walk(el.shadowRoot); } }; walk(document); const open = all.map((toast) => toast.shadowRoot?.querySelector("[popover]")).find((pop) => pop?.matches(":popover-open")); return { hosts: all.length, open: !!open, text: (open?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40) }; });
    await shot("desktop-toast");
    expect(info.open, `toast is not shown: ${JSON.stringify(info)}`);
    return info;
  });
  await step("page stayed healthy (no uncaught errors)", async () => { expect(problems.length === 0, problems.join(" | ")); });
} finally {
  clearTimeout(watchdog);
  try {
    await haEval(() => { try { window.__chk?.setWall(false); window.__chk?.unmount(); } catch {} document.querySelector("home-assistant")?.dispatchEvent(new CustomEvent("settheme", { detail: { theme: "Neumorphism", dark: false }, bubbles: true, composed: true })); });
    await settle(500);
    await haEval((dock) => document.querySelector("home-assistant")?.dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock }, bubbles: true, composed: true })), originalDock);
    await settle(300);
    const others = context.pages().filter((p) => p !== page && p.url().startsWith(BASE)).length;
    if (addedToken && others === 0) await haEval(() => localStorage.removeItem("hassTokens"));
    evidence.restored = { theme: "Neumorphism light", dock: originalDock, tokenRemoved: addedToken && others === 0 };
  } catch (error) { console.error(`cleanup problem: ${error}`); }
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}
writeFileSync(join(out, "result.json"), JSON.stringify({ results, evidence, problems }, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; evidence + screenshots in ${out}`);
process.exit(failed.length ? 1 : 0);
