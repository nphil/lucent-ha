// This import must stay first: it wraps matchMedia before any toolkit code can read the pointer class.
import "./pointer-override.ts";
import { buildProblems, builtAt, scenarioLoaders, specimenLoaders, toolkitLoaders, type BuildProblem, type Loader } from "lucent-dev:index";
import type { LuElementClass } from "../src/core/element.ts";
import { defineElements } from "../src/define.ts";
import { HaFrame } from "./ha-frame.ts";
import { HaPanelCustom, PANEL_PREFIX } from "./ha-panel.ts";
import { HaCard, HaIcon, HaSvgIcon } from "./ha-standins.ts";
import { applyTheme, installHaDefaults } from "./ha-theme.ts";
import { HARNESS_CSS } from "./harness-css.ts";
import { LuHarness, parseParams, type DockedSidebar } from "./harness-api.ts";
import { MockHa } from "./mock-hass.ts";
import { setPointerMode } from "./pointer-override.ts";
import { HxCell, HxPage } from "./specimen-page.ts";

/** Home Assistant's `narrow`: the viewport is 870px wide or less (src/layouts/home-assistant-main.ts). */
const NARROW_QUERY = "(max-width: 870px)";

/** A toolkit element class: has a non-empty static `luName`. The area barrels export classes, helpers and types alike. */
function isElementClass(value: unknown): value is LuElementClass {
  if (typeof value !== "function") return false;
  const luName: unknown = Reflect.get(value, "luName");
  return typeof luName === "string" && luName !== "";
}

/** Loads every module of a list; one that throws while loading is reported on the page and skipped. */
async function loadAll<T>(loaders: Loader<T>[], problems: BuildProblem[]): Promise<{ name: string; module: T }[]> {
  const settled = await Promise.allSettled(loaders.map((loader) => loader.load()));
  return settled.flatMap((result, index) => {
    const name = loaders[index]?.name ?? "?";
    if (result.status === "fulfilled") return [{ name, module: result.value }];
    problems.push({ file: name, message: `failed while loading: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}` });
    return [];
  });
}

function captureErrors(lu: LuHarness): void {
  window.addEventListener("error", (event) => lu.errors.push(`${event.message} (${event.filename}:${event.lineno})`));
  window.addEventListener("unhandledrejection", (event) => lu.errors.push(`unhandled rejection: ${String(event.reason)}`));
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    lu.errors.push(args.map(String).join(" "));
    original(...args);
  };
}

function defineOnce(tag: string, constructor: CustomElementConstructor): void {
  if (!customElements.get(tag)) customElements.define(tag, constructor);
}

async function main(): Promise<void> {
  const params = parseParams(location.search);
  if (location.pathname === "/") history.replaceState(history.state, "", `${PANEL_PREFIX}${location.search}${location.hash}`);
  document.documentElement.dataset.hxSurface = params.surface;
  installHaDefaults();
  const style = document.createElement("style");
  style.textContent = HARNESS_CSS;
  document.head.append(style);
  applyTheme(params.theme);
  setPointerMode(params.pointer);

  const mock = new MockHa({ dockedSidebar: params.sidebar, kioskMode: params.kiosk, externalSidebar: params.external, theme: params.theme });
  const lu = new LuHarness(params, mock);
  window.__lu = lu;
  captureErrors(lu);
  if (params.safe) lu.setSafeArea(params.safe);
  if (params.dir === "rtl") lu.setDirection("rtl");

  // Home Assistant's own elements first, then the toolkit under the prefix `spec` (tags are spec-lu-*).
  defineOnce("ha-svg-icon", HaSvgIcon);
  defineOnce("ha-icon", HaIcon);
  defineOnce("ha-card", HaCard);
  defineOnce("ha-panel-custom", HaPanelCustom);
  defineOnce("ha-frame", HaFrame);
  defineOnce("hx-cell", HxCell);
  defineOnce("hx-page", HxPage);
  // Dynamic on purpose: the stand-in must exist only when the URL asks for it, so a toolkit that checks `customElements.get("ha-adaptive-dialog")` sees what it sees without Home Assistant's dialog.
  if (params.haDialog) await import("./ha-dialog-standin.ts");

  lu.builtAt = builtAt;
  lu.problems = [...buildProblems];
  const toolkit = await loadAll(toolkitLoaders, lu.problems);
  const classes = new Set<LuElementClass>();
  for (const { module } of toolkit) for (const value of Object.values(module)) if (isElementClass(value)) classes.add(value);
  if (classes.size > 0) {
    try {
      lu.registry = defineElements("spec", [...classes]);
    } catch (error) {
      lu.problems.push({ file: "defineElements('spec', ...)", message: error instanceof Error ? error.message : String(error) });
    }
  }
  if (!customElements.get("spec-lu-root")) lu.problems.push({ file: "src/shell/root.ts", message: "spec-lu-root is not registered, so specimens render without the Lucent tokens (every specimen is wrapped in it)" });
  lu.loaded.push(...toolkit.map(({ name }) => `src/${name}`));

  const owners = new Map<string, string>();
  for (const { name, module } of await loadAll(specimenLoaders, lu.problems)) {
    if (!Array.isArray(module.specimens)) {
      lu.problems.push({ file: name, message: "does not export `specimens: Specimen[]`" });
      continue;
    }
    lu.loaded.push(name);
    for (const specimen of module.specimens) {
      const owner = owners.get(specimen.id);
      if (owner) lu.problems.push({ file: name, message: `specimen id "${specimen.id}" is already used by ${owner}; the second one is left out` });
      else {
        owners.set(specimen.id, name);
        lu.specimens.push(specimen);
      }
    }
  }

  const scenarios = (await loadAll(scenarioLoaders, lu.problems)).map(({ module }) => module.scenario);
  lu.scenarios = scenarios.map(({ id, title }) => ({ id, title }));
  const scenario = params.scenario ? scenarios.find(({ id }) => id === params.scenario) : undefined;
  if (params.scenario && !scenario) lu.problems.push({ file: `?scenario=${params.scenario}`, message: `no scenario with that id (known: ${scenarios.map(({ id }) => id).join(", ") || "none"})` });

  // Home Assistant's chrome around the panel.
  const frame = document.createElement("ha-frame") as HaFrame;
  const host = document.createElement("ha-panel-custom") as HaPanelCustom;
  frame.append(host);
  lu.frame = frame;
  lu.host = host;
  host.handleSafeArea = params.handleSafeArea;
  host.create = () => {
    if (scenario) return scenario.create();
    const page = document.createElement("hx-page") as HxPage;
    page.lu = lu;
    return page;
  };
  const narrowQuery = matchMedia(NARROW_QUERY);
  const push = (): void => {
    frame.hass = host.hass = mock.hass;
    frame.narrow = host.narrow = narrowQuery.matches;
    host.refresh();
  };
  // What the `home-assistant` root element does with these events (src/state/sidebar-mixin.ts).
  mock.subscribe(() => {
    push();
    lu.announce();
  });
  narrowQuery.addEventListener("change", () => {
    push();
    lu.announce();
  });
  frame.addEventListener("hass-dock-sidebar", (event) => mock.update({ dockedSidebar: (event as CustomEvent<{ dock: DockedSidebar }>).detail.dock }));
  window.addEventListener("hass-kiosk-mode", (event) => mock.update({ kioskMode: (event as CustomEvent<{ enable: boolean }>).detail.enable }));
  for (const name of ["location-changed", "popstate"]) window.addEventListener(name, () => host.refresh());
  push();
  document.body.append(frame);

  await lu.settle();
  window.__luReady = true;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`harness failed to start: ${message}`);
  document.body.append(Object.assign(document.createElement("pre"), { textContent: `lucent-ha harness failed to start:\n${message}`, style: "color:#b00020;padding:16px;white-space:pre-wrap" }));
});
