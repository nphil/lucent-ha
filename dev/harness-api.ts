/** `window.__lu`: the control surface of the harness, shared by the toolbar, the URL parameters and any script that drives the page
 * (`dev/shot.mjs --eval`, perf checks, a specimen's `setup`). Every setter changes the live page without a reload and keeps the URL in
 * step (`history.replaceState`, no new history entry), so a reload or a pasted URL reproduces the state. */
import type { BuildProblem } from "lucent-dev:index";
import type { LucentRegistry } from "../src/define.ts";
import type { HomeAssistant } from "../src/ha/types.ts";
import { VERSION } from "../src/version.ts";
import type { HaFrame } from "./ha-frame.ts";
import { THEME_NAMES, applyTheme, isThemeName, type ThemeName } from "./ha-theme.ts";
import { haNavigate, type HaPanelCustom, type NavigateOptions } from "./ha-panel.ts";
import type { MockHa } from "./mock-hass.ts";
import { getPointerMode, setPointerMode, type PointerMode } from "./pointer-override.ts";
import type { Specimen } from "./specimen-types.ts";

export type Surface = "dashboard" | "panel";
export type DockedSidebar = NonNullable<HomeAssistant["dockedSidebar"]>;
/** CSS order: top, right, bottom, left (px). */
export type SafeInsets = readonly [top: number, right: number, bottom: number, left: number];

/** The URL parameters (docs/harness.md). Defaults are what the page does without them. */
export interface HarnessParams {
  theme: ThemeName;
  /** Only this group's specimens. */
  group: string | undefined;
  /** Only these specimen ids. */
  only: string[];
  pointer: PointerMode;
  safe: SafeInsets | undefined;
  /** No toolbar, no labels, no environment cells: clean screenshots. */
  plain: boolean;
  surface: Surface;
  sidebar: DockedSidebar;
  kiosk: boolean;
  /** The Companion app draws its own sidebar. */
  external: boolean;
  /** Register the `ha-adaptive-dialog` stand-in. */
  haDialog: boolean;
  scenario: string | undefined;
  dir: "ltr" | "rtl";
  /** The panel config says `handle_safe_area`: the container does not pad. */
  handleSafeArea: boolean;
}

const flag = (value: string | null): boolean => value === "1" || value === "true";

export function parseParams(search: string): HarnessParams {
  const query = new URLSearchParams(search);
  const theme = query.get("theme");
  const pointer = query.get("pointer");
  const sidebar = query.get("sidebar");
  const safe = query.get("safe")?.split(",").map(Number);
  return {
    theme: isThemeName(theme) ? theme : "flat-light",
    group: query.get("group") || undefined,
    only: (query.get("only") ?? "").split(",").filter(Boolean),
    pointer: pointer === "touch" || pointer === "fine" ? pointer : "auto",
    safe: safe?.length === 4 && safe.every((value) => Number.isFinite(value)) ? (safe as unknown as SafeInsets) : undefined,
    plain: flag(query.get("plain")),
    surface: query.get("surface") === "panel" ? "panel" : "dashboard",
    sidebar: sidebar === "auto" || sidebar === "always_hidden" ? sidebar : "docked",
    kiosk: flag(query.get("kiosk")),
    external: flag(query.get("external")),
    haDialog: flag(query.get("ha-dialog")),
    scenario: query.get("scenario") || undefined,
    dir: query.get("dir") === "rtl" ? "rtl" : "ltr",
    handleSafeArea: flag(query.get("handle-safe-area")),
  };
}

export class LuHarness extends EventTarget {
  readonly version = VERSION;
  readonly themes = THEME_NAMES;
  readonly mock: MockHa;
  /** Uncaught errors, unhandled rejections and `console.error` calls, oldest first. */
  readonly errors: string[] = [];
  /** Browser messages that are not errors, e.g. "ResizeObserver loop completed with undelivered notifications" (a layout settling over two frames). */
  readonly notes: string[] = [];
  /** Build-time skips plus load/registration failures, shown as a banner on the page. */
  problems: BuildProblem[] = [];
  /** Every specimen that loaded. */
  specimens: Specimen[] = [];
  /** The scenarios that loaded (mount one with `?scenario=<id>`). */
  scenarios: { id: string; title: string }[] = [];
  /** The specimen files and toolkit modules that loaded. */
  loaded: string[] = [];
  registry: LucentRegistry | undefined;
  builtAt = "";
  frame!: HaFrame;
  host!: HaPanelCustom;
  params: HarnessParams;
  private themeName: ThemeName;
  private safeInsets: SafeInsets | undefined;

  constructor(params: HarnessParams, mock: MockHa) {
    super();
    this.params = params;
    this.mock = mock;
    this.themeName = params.theme;
    this.safeInsets = params.safe;
  }

  get hass(): HomeAssistant {
    return this.mock.hass;
  }

  get theme(): ThemeName {
    return this.themeName;
  }

  get pointer(): PointerMode {
    return getPointerMode();
  }

  get safeArea(): SafeInsets | undefined {
    return this.safeInsets;
  }

  get surface(): Surface {
    return document.documentElement.dataset.hxSurface === "panel" ? "panel" : "dashboard";
  }

  /** Switches the emulated Home Assistant theme live (the toolkit's `--lu-*` tokens follow; nothing is reloaded). */
  setTheme(name: ThemeName): void {
    this.themeName = name;
    applyTheme(name);
    this.mock.setTheme(name);
    this.announce();
  }

  /** `auto` = what the browser reports; `touch` / `fine` force the toolkit's pointer class (see dev/pointer-override.ts). */
  setPointer(mode: PointerMode): void {
    setPointerMode(mode);
    this.announce();
  }

  /** Home Assistant's `--app-safe-area-inset-*` (what the Companion app sets): `undefined` = no insets. */
  setSafeArea(insets: SafeInsets | undefined): void {
    this.safeInsets = insets;
    const root = document.documentElement.style;
    (["top", "right", "bottom", "left"] as const).forEach((side, index) => {
      const value = insets?.[index];
      if (value === undefined) root.removeProperty(`--app-safe-area-inset-${side}`);
      else root.setProperty(`--app-safe-area-inset-${side}`, `${value}px`);
    });
    this.announce();
  }

  setSurface(surface: Surface): void {
    document.documentElement.dataset.hxSurface = surface;
    this.announce();
  }

  /** The user's sidebar setting (`docked` = 256px, `auto` = 56px icons, `always_hidden` = drawer on every width). */
  setSidebar(dockedSidebar: DockedSidebar): void {
    this.mock.update({ dockedSidebar });
  }

  /** What a wall-display panel does: the `hass-kiosk-mode` window event (the sidebar becomes a drawer). */
  setKiosk(enable: boolean): void {
    window.dispatchEvent(new CustomEvent("hass-kiosk-mode", { detail: { enable } }));
  }

  /** Home Assistant sets the direction as an attribute AND inline on <html> (its default stylesheet says `direction: ltr`, which beats the attribute). */
  setDirection(dir: "ltr" | "rtl"): void {
    const root = document.documentElement;
    root.dir = dir;
    root.style.direction = dir;
    root.style.setProperty("--direction", dir);
    root.style.setProperty("--float-start", dir === "ltr" ? "left" : "right");
    root.style.setProperty("--float-end", dir === "ltr" ? "right" : "left");
    this.announce();
  }

  openDrawer(open = true): void {
    this.frame.setDrawer(open);
  }

  navigate(path: string, options?: NavigateOptions): void {
    haNavigate(path, options);
  }

  /** Every element matching `selector`, looking through open shadow roots (`document.querySelector` stops at the first shadow boundary). */
  queryAll(selector: string, root: ParentNode = document): Element[] {
    const found: Element[] = [];
    const visit = (scope: ParentNode): void => {
      found.push(...scope.querySelectorAll(selector));
      for (const element of scope.querySelectorAll("*")) if (element.shadowRoot) visit(element.shadowRoot);
    };
    visit(root);
    return found;
  }

  query(selector: string, root: ParentNode = document): Element | null {
    return this.queryAll(selector, root)[0] ?? null;
  }

  /** Resolves when fonts are loaded, every cell's `setup` is done, every Lit element has finished updating and two frames have painted. */
  async settle(): Promise<void> {
    await document.fonts.ready;
    await Promise.allSettled(this.queryAll("hx-cell").map((cell) => (cell as { ready?: Promise<void> }).ready));
    for (let pass = 0; pass < 3; pass++) {
      const updates = this.queryAll("*").flatMap((element) => {
        const update = (element as { updateComplete?: unknown }).updateComplete;
        return update instanceof Promise ? [update] : [];
      });
      await Promise.allSettled(updates);
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }

  /** Tells the page and the URL that something changed. */
  announce(): void {
    this.syncUrl();
    this.dispatchEvent(new Event("change"));
  }

  /** Mirrors the live settings into the query string (only those that differ from the defaults). */
  private syncUrl(): void {
    const url = new URL(location.href);
    const set = (key: string, value: string | undefined): void => {
      if (value === undefined) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    };
    set("theme", this.themeName === "flat-light" ? undefined : this.themeName);
    set("pointer", this.pointer === "auto" ? undefined : this.pointer);
    set("safe", this.safeInsets?.join(","));
    set("surface", this.surface === "dashboard" ? undefined : this.surface);
    set("sidebar", this.hass.dockedSidebar === "docked" ? undefined : this.hass.dockedSidebar);
    set("kiosk", this.hass.kioskMode ? "1" : undefined);
    set("dir", document.documentElement.dir === "rtl" ? "rtl" : undefined);
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (next !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, "", next);
  }
}

declare global {
  interface Window {
    __lu: LuHarness;
    /** True when the page is rendered and still: fonts loaded, every specimen set up, two frames painted. */
    __luReady?: boolean;
  }
}
