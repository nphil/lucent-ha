/** The sample panel: a whole Home Assistant panel built only from the toolkit's `<spec-lu-*>` elements, with a fake wildlife-camera server that
 * needs no network. It is the proving ground for the toolkit (any awkward corner shows up here), the target of `dev/perf-check.mjs` and the
 * worked example the README links to. Open it with `http://127.0.0.1:4180/harness.html?scenario=panel`.
 *
 * Reading order: this file is the panel (address, data, shell, sheets); `panel/` next to it holds the pages (`live-view.ts`, `library-view.ts`,
 * `insights-view.ts`, `visit-page.ts`), the sheets (`species-sheet.ts`, `sheets.ts`) and the fake server (`data.ts`). See docs/scenario-panel.md. */
import { LitElement, html, nothing } from "lit";
import type { PropertyValues, TemplateResult } from "lit";
import { guard } from "lit/directives/guard.js";
import { repeat } from "lit/directives/repeat.js";
import {
  BASE_CSS, ReconnectController, TabHistory, clearSwr, deepActiveElement, findScroller, goBack, isTextEntry, layerDepth, mutateSwr, navigate, readSwr,
  showToast, subscribeSwr, swr,
} from "../../src/index.ts";
import type {
  HaRoute, HomeAssistant, LuAppShell, LuDestination, LuNav, LuNavigateDetail, LuViewEventDetail, LuViewStack, ToastOptions,
} from "../../src/index.ts";
import { MDI_PATHS } from "../mdi-subset.ts";
import type { Scenario } from "../scenario-types.ts";
import { backend, errorText } from "./panel/data.ts";
import { installDriver } from "./panel/driver.ts";
import type { DemoSurface } from "./panel/driver.ts";
import { insightsView } from "./panel/insights-view.ts";
import type { Preview } from "./panel/insights-view.ts";
import { STEP, libraryView } from "./panel/library-view.ts";
import type { Filter } from "./panel/library-view.ts";
import { liveView } from "./panel/live-view.ts";
import { isTab, parseRoute, routePath, sameRoute, TABS } from "./panel/route.ts";
import { helpSheet, pickerSheet } from "./panel/sheets.ts";
import { speciesSheet } from "./panel/species-sheet.ts";
import { PANEL_CSS } from "./panel/styles.ts";
import { KEY } from "./panel/types.ts";
import type { Camera, Insights, Kind, Page, Route, Species, Status, Tab, Visit, VisitPage } from "./panel/types.ts";
import { visitPage } from "./panel/visit-page.ts";

/** An icon as raw SVG path data: no icon font and no Home Assistant needed (the other icons are `mdi:` names, which Home Assistant draws). */
function iconPath(name: string): string {
  const path = MDI_PATHS[name];
  if (!path) throw new Error(`dev/mdi-subset.ts has no icon "${name}"`);
  return path;
}

const DESTINATIONS: readonly { id: Tab; label: string; icon: string }[] = [
  { id: "live", label: "Live", icon: iconPath("cctv") },
  { id: "library", label: "Library", icon: iconPath("paw") },
  { id: "insights", label: "Insights", icon: iconPath("heart-pulse") },
];

const KINDS: readonly Kind[] = ["seen", "heard"];
/** Data counts as fresh for 30 seconds; after that a page asks again when it is shown. */
const SWR = { maxAgeMs: 30_000 } as const;
const DEFAULT_CLIP = 10;
const DEFAULT_SENSITIVITY = 60;

type Message = Record<string, unknown>;

const sameHaRoute = (value: unknown, old: unknown): boolean => {
  const a = value as HaRoute | undefined;
  const b = old as HaRoute | undefined;
  return a?.prefix === b?.prefix && a?.path === b?.path;
};

export class SamplePanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    // Home Assistant hands a new `route` object on every update; only a different address counts as a change.
    route: { attribute: false, hasChanged: (value: unknown, old: unknown) => !sameHaRoute(value, old) },
    _current: { state: true },
    _alive: { state: true },
    _filter: { state: true },
    _visible: { state: true },
    _wall: { state: true },
    _speciesOpen: { state: true },
    _sheetSpecies: { state: true },
    _pickerOpen: { state: true },
    _pickerFor: { state: true },
    _query: { state: true },
    _helpOpen: { state: true },
    _preview: { state: true },
    _clip: { state: true },
    _sensitivity: { state: true },
    _busy: { state: true },
    _confirming: { state: true },
    _muted: { state: true },
    _more: { state: true },
  };

  static styles = [BASE_CSS, PANEL_CSS];

  /** Home Assistant's `hass`, `narrow` and `route`, set by Home Assistant (the harness) after the element exists. */
  declare hass: HomeAssistant | undefined;
  declare narrow: boolean;
  declare route: HaRoute | undefined;
  /** What the address says right now. The address is the single source of truth for page, species sheet and visit. */
  declare _current: Route;
  /** The views that have been opened and are kept alive (the view stack keeps at most `max` of them). */
  declare _alive: Page[];
  declare _filter: Filter;
  declare _visible: number;
  declare _wall: boolean;
  declare _speciesOpen: boolean;
  /** Whose species sheet is drawn; kept until the sheet has finished closing, so it does not blank mid-exit. */
  declare _sheetSpecies: string;
  declare _pickerOpen: boolean;
  /** The visit "What was it?" is about (`latest` = the newest one). */
  declare _pickerFor: string;
  declare _query: string;
  declare _helpOpen: boolean;
  declare _preview: Preview;
  declare _clip: number;
  declare _sensitivity: number;
  declare _busy: "" | "saving" | "deleting";
  declare _confirming: boolean;
  declare _muted: string[];
  declare _more: Record<Kind, boolean>;

  /** "connected" | "grace" | "lost": for 10 seconds after a drop the last data stays and a quiet strip says so. */
  private readonly _link = new ReconnectController(this, { getHass: () => this.hass });
  private _linkSeen = this._link.state;
  private _tabs: TabHistory | undefined;
  private _destinations: LuDestination[] = [];
  /** The visit the detail page shows (it keeps showing it while another tab is open). */
  private _lastVisit = "";
  private readonly _messages = new Map<string, Message>();
  private readonly _follows = new Map<string, () => void>();
  private _stopBackend: (() => void) | undefined;
  private _stopDriver: (() => void) | undefined;
  private _renders = 0;
  private _evicted: string[] = [];
  private _painted = false;
  private _resolvePainted: () => void = () => undefined;
  private readonly _whenPainted = new Promise<void>((resolve) => (this._resolvePainted = resolve));

  constructor() {
    super();
    this.narrow = false;
    this._current = { page: "live", species: "", visit: "" };
    this._alive = [];
    this._filter = "all";
    this._visible = STEP;
    this._wall = false;
    this._speciesOpen = false;
    this._sheetSpecies = "";
    this._pickerOpen = false;
    this._pickerFor = "latest";
    this._query = "";
    this._helpOpen = false;
    this._preview = "loading";
    this._clip = DEFAULT_CLIP;
    this._sensitivity = DEFAULT_SENSITIVITY;
    this._busy = "";
    this._confirming = false;
    this._muted = [];
    this._more = { seen: false, heard: false };
  }

  // ---- life cycle ----------------------------------------------------------------------------------------------------------------

  connectedCallback(): void {
    super.connectedCallback();
    // Home Assistant tells the panel about address changes through `route`, but `?s=` is not part of it: listen to the address itself.
    window.addEventListener("location-changed", this._onLocation);
    window.addEventListener("popstate", this._onLocation);
    window.addEventListener("keydown", this._onKey);
    this._stopBackend = backend.subscribe(() => this.requestUpdate());
    this._stopDriver = installDriver(this._surface());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("location-changed", this._onLocation);
    window.removeEventListener("popstate", this._onLocation);
    window.removeEventListener("keydown", this._onKey);
    this._stopBackend?.();
    this._stopDriver?.();
    for (const stop of this._follows.values()) stop();
    this._follows.clear();
    this._tabs?.dispose();
    this._tabs = undefined;
  }

  /** `hass` changes constantly in Home Assistant (every state of the house). The panel only looks at what the shell reads from it (menu button,
   * wall mode) and, through `ReconnectController`, the connection; everything else costs nothing. */
  protected shouldUpdate(changed: PropertyValues<this>): boolean {
    // The connection's own event asks for an update in the same breath as the `hass` that says it dropped, and Lit merges the two: the update
    // then looks like "only hass changed". The link state is checked first for that reason.
    if (this._link.state !== this._linkSeen) return true;
    if (changed.size !== 1 || !changed.has("hass")) return true;
    const before = changed.get("hass") as HomeAssistant | undefined;
    const now = this.hass;
    return !before || !now || before.kioskMode !== now.kioskMode || before.dockedSidebar !== now.dockedSidebar
      || before.auth?.external?.config?.hasSidebar !== now.auth?.external?.config?.hasSidebar || before.language !== now.language;
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("route")) this._syncRoute();
    if (changed.has("hass") && this.hass && changed.get("hass") === undefined) this._loadRoute();
    // Back from a dropped connection: whatever the page shows may be old now.
    const link = this._link.state;
    if (link === "connected" && this._linkSeen !== "connected") this._loadRoute(true);
    this._linkSeen = link;
  }

  protected updated(): void {
    if (this._painted || !this._shown()) return;
    this._painted = true;
    requestAnimationFrame(() => requestAnimationFrame(() => this._resolvePainted()));
  }

  // ---- the address ---------------------------------------------------------------------------------------------------------------

  private _onLocation = (): void => this._syncRoute();

  private _syncRoute(): void {
    const prefix = this.route?.prefix;
    if (prefix === undefined) return;
    const next = parseRoute(prefix, location.pathname, location.search);
    this._destinations = DESTINATIONS.map((item) => ({ ...item, href: routePath(prefix, { page: item.id }, location.search) }));
    this._tabs ??= new TabHistory({ defaultId: "live", initialId: next.page === "visit" ? "live" : next.page });
    this._apply(next);
  }

  /** Makes `next` the current route. The panel calls this itself when something is tapped (the page changes in that very frame), and again
   * when the address reports the same change a moment later (nothing happens then). */
  private _apply(next: Route): void {
    const previous = this._current;
    if (this._alive.includes(next.page) && sameRoute(previous, next)) return;
    if (next.page === "visit") {
      // A detail page reuses one view for different visits: the next visit starts at the top, not where the last one was left.
      if (next.visit !== this._lastVisit) {
        this._stack()?.forgetScroll("visit");
        if (previous.page === "visit") findScroller(this).scrollTo(0);
      }
      this._lastVisit = next.visit;
    }
    // New views go after the ones already rendered, so nothing above the one you are on can move.
    if (!this._alive.includes(next.page)) this._alive = [...this._alive, next.page];
    this._speciesOpen = next.species !== "";
    if (next.species) this._sheetSpecies = next.species;
    this._current = next;
    this._loadRoute();
  }

  private _href(target: { page: Page; species?: string; visit?: string }): string {
    return routePath(this.route?.prefix ?? "", target, location.search);
  }

  private _stack(): LuViewStack | null {
    return this.renderRoot?.querySelector<LuViewStack>("spec-lu-view-stack") ?? null;
  }

  private _shell(): LuAppShell | null {
    return this.renderRoot?.querySelector<LuAppShell>("spec-lu-app-shell") ?? null;
  }

  // ---- data: `swr` asks hass, remembers the answer at module level and tells the panel when it changes ---------------------------------

  private _call<T>(message: Message): Promise<T> {
    const callWS = this.hass?.callWS;
    return callWS ? callWS<T>(message) : Promise.reject(new Error("Home Assistant is not connected."));
  }

  /** Asks for `message`'s answer under `key`: nothing happens while the data is fresh or being fetched. */
  private _fetch(key: string, message: Message, force = false): void {
    if (!this.hass) return;
    this._messages.set(key, message);
    if (!this._follows.has(key)) {
      this._follows.set(key, subscribeSwr(key, () => {
        this.requestUpdate();
        // The detail page asks for more visits of the same species once it knows the species.
        if (key === KEY.visit(this._lastVisit) && this._current.page === "visit") this._loadRoute();
      }));
    }
    const handle = swr(key, () => this._call(message), SWR);
    if (force) void handle.revalidate();
  }

  private _revalidate(...keys: string[]): void {
    for (const key of keys) {
      const message = this._messages.get(key);
      if (message) this._fetch(key, message, true);
    }
  }

  private _fetchVisits(species: string): void {
    for (const kind of KINDS) this._fetch(KEY.visits(species, kind), { type: "sample-panel/visits", species, kind });
  }

  /** Loads what the page you are on needs. Cheap to call often. */
  private _loadRoute(force = false): void {
    const { page, species, visit } = this._current;
    if (page === "live") this._fetch(KEY.cameras, { type: "sample-panel/cameras" }, force);
    else if (page === "library") {
      this._fetch(KEY.species, { type: "sample-panel/species" }, force);
      if (species) this._fetchVisits(species);
    } else if (page === "insights") this._fetch(KEY.insights, { type: "sample-panel/insights" }, force);
    else if (visit) {
      this._fetch(KEY.visit(visit), { type: "sample-panel/visit", id: visit }, force);
      const data = readSwr<Visit | null>(KEY.visit(visit)).data;
      if (data) this._fetch(KEY.visits(data.species, data.kind), { type: "sample-panel/visits", species: data.species, kind: data.kind }, force);
    }
  }

  /** The page you are on has its first data (or its first error) on screen. */
  private _shown(): boolean {
    const { page, visit } = this._current;
    const key = page === "live" ? KEY.cameras : page === "library" ? KEY.species : page === "insights" ? KEY.insights : KEY.visit(visit);
    const snapshot = readSwr<unknown>(key);
    return snapshot.data !== undefined || snapshot.error !== undefined;
  }

  // ---- what the user does -------------------------------------------------------------------------------------------------------

  private _onNavigate = (event: CustomEvent<LuNavigateDetail>): void => this._goTab(event.detail.id);

  private _goTab(id: string): void {
    if (!isTab(id)) return;
    const path = this._href({ page: id });
    const fromVisit = this._current.page === "visit";
    const tabs = this._tabs;
    this._apply({ page: id, species: "", visit: "" });
    if (!tabs) navigate(this, path);
    // Tab history does not know about detail pages: a tab tap on the tab the visit was opened from has to go back instead.
    else if (fromVisit && tabs.current === id) goBack(this, path);
    else tabs.select(id, path, this);
  }

  private _onBack = (): void => goBack(this, this._href({ page: "live" }));

  private _openSpecies = (name: string): void => {
    this._apply({ page: "library", species: name, visit: "" });
    navigate(this, this._href({ page: "library", species: name }));
  };

  private _openVisit = (id: string): void => {
    this._apply({ page: "visit", species: "", visit: id });
    navigate(this, this._href({ page: "visit", visit: id }));
  };

  private _openCamera = (camera: Camera): void => {
    if (camera.sighting) this._openVisit(camera.sighting.visit);
    else this._say({ message: `${camera.name} has not seen anything today.` });
  };

  /** The finger went down on a species tile: start loading what the sheet will show, so it opens already filled in. */
  private _warmSpecies = (name: string): void => this._fetchVisits(name);

  private _warmVisit = (id: string): void => this._fetch(KEY.visit(id), { type: "sample-panel/visit", id });

  private _onSpeciesClose = (): void => {
    this._speciesOpen = false;
    this._sheetSpecies = "";
    // The sheet closed itself (button, Escape, scrim, swipe): take its entry out of the address. When Back or a link already did, nothing is left to do.
    if (this._current.species) goBack(this, this._href({ page: "library" }));
  };

  private _onFilter = (value: Filter): void => {
    this._filter = value;
    this._visible = STEP;
  };

  private _onMore = (): void => {
    this._visible += STEP;
  };

  private _moreVisits = async (kind: Kind): Promise<void> => {
    const species = this._sheetSpecies;
    const key = KEY.visits(species, kind);
    const next = readSwr<VisitPage>(key).data?.next;
    if (!next || this._more[kind]) return;
    this._more = { ...this._more, [kind]: true };
    try {
      const page = await this._call<VisitPage>({ type: "sample-panel/visits", species, kind, before: next });
      mutateSwr<VisitPage>(key, (current) => ({ items: [...(current?.items ?? []), ...page.items], next: page.next }));
    } catch (error) {
      this._say({ message: `Couldn't load more: ${errorText(error)}`, kind: "error", actionLabel: "Try again", onAction: () => void this._moreVisits(kind) });
    } finally {
      this._more = { ...this._more, [kind]: false };
    }
  };

  private _toggleMute = (): void => {
    const species = this._sheetSpecies;
    const muted = this._muted.includes(species);
    const set = (on: boolean): void => {
      this._muted = on ? [...this._muted, species] : this._muted.filter((name) => name !== species);
    };
    set(!muted);
    this._say({ message: muted ? `Alerts for ${species} are back on` : `Muted alerts for ${species}`, kind: "success", actionLabel: "Undo", onAction: () => set(muted) });
  };

  // ---- correcting a visit: shown at once, saved behind it, undone with one tap --------------------------------------------------

  private _openPicker = (visitId = "latest"): void => {
    this._pickerFor = visitId;
    this._query = "";
    this._pickerOpen = true;
    this._fetch(KEY.visit(visitId), { type: "sample-panel/visit", id: visitId });
    this._fetch(KEY.species, { type: "sample-panel/species" });
  };

  private _pick = (choice: string): void => {
    const visit = readSwr<Visit | null>(KEY.visit(this._pickerFor)).data;
    if (!visit) return;
    this._pickerOpen = false;
    if (choice === "not_animal") this._change(visit, visit.species, "corrected", "Marked as not an animal");
    else if (choice === "unknown") this._change(visit, visit.species, "corrected", "Marked as not sure");
    else this._change(visit, choice, "corrected", `Corrected to ${choice}`);
  };

  private _confirm = (): void => {
    const visit = readSwr<Visit | null>(KEY.visit(this._lastVisit)).data;
    if (visit) this._change(visit, visit.species, "confirmed", `Confirmed ${visit.species}`);
  };

  /** Sets a visit's species and status. The page shows it immediately (`mutateSwr`), the server confirms behind it, and only then does the toast
   * offer Undo; a failed save puts the old values back and says so. */
  private _change(visit: Visit, species: string, status: Status, message: string): void {
    const before = { species: visit.species, status: visit.status };
    void this._save(visit.id, { species, status }, before).then((saved) => {
      if (saved) this._say({ message, kind: "success", actionLabel: "Undo", onAction: () => void this._save(visit.id, before, { species, status }) });
    });
  }

  private async _save(id: string, next: { species: string; status: Status }, previous: { species: string; status: Status }): Promise<boolean> {
    this._show(id, next);
    try {
      await this._call({ type: "sample-panel/visit/set", id, ...next });
      this._revalidate(KEY.species, KEY.insights, KEY.cameras, KEY.visit(id), KEY.visit("latest"));
      return true;
    } catch (error) {
      this._show(id, previous);
      this._say({ message: `Couldn't save that: ${errorText(error)}`, kind: "error", actionLabel: "Try again", onAction: () => void this._save(id, next, previous) });
      return false;
    }
  }

  /** The visit looks like this from now on, everywhere it is on screen. */
  private _show(id: string, state: { species: string; status: Status }): void {
    for (const key of [KEY.visit(id), KEY.visit("latest")]) {
      const current = readSwr<Visit | null>(key).data;
      if (current && current.id === id) mutateSwr<Visit | null>(key, () => ({ ...current, ...state }));
    }
  }

  private _delete = async (): Promise<void> => {
    const visit = readSwr<Visit | null>(KEY.visit(this._lastVisit)).data;
    if (!visit || this._busy) return;
    this._busy = "deleting";
    try {
      await this._call({ type: "sample-panel/visit/delete", id: visit.id });
      mutateSwr<Visit | null>(KEY.visit(visit.id), () => null);
      this._revalidate(KEY.species, KEY.insights, KEY.cameras, KEY.visits(visit.species, visit.kind));
      goBack(this, this._href({ page: "live" }));
      this._say({ message: `Deleted the ${visit.species} visit` });
    } catch (error) {
      this._say({ message: `Couldn't delete it: ${errorText(error)}`, kind: "error" });
    } finally {
      this._busy = "";
    }
  };

  // ---- the Insights controls ----------------------------------------------------------------------------------------------------

  private _confirmAll = async (): Promise<void> => {
    this._confirming = true;
    try {
      const result = await this._call<{ confirmed: number }>({ type: "sample-panel/review/confirm" });
      this._revalidate(KEY.insights);
      this._say({ message: `Confirmed ${result.confirmed} sightings`, kind: "success" });
    } catch (error) {
      this._say({ message: `Couldn't confirm them: ${errorText(error)}`, kind: "error", actionLabel: "Try again", onAction: () => void this._confirmAll() });
    } finally {
      this._confirming = false;
    }
  };

  private _simulate = async (): Promise<void> => {
    try {
      const visit = await this._call<Visit>({ type: "sample-panel/simulate" });
      this._revalidate(KEY.species, KEY.cameras, KEY.insights);
      this._say({ message: `A ${visit.species} was just ${visit.kind} at ${visit.cameraName}`, kind: "success" });
    } catch (error) {
      this._say({ message: `Couldn't add it: ${errorText(error)}`, kind: "error" });
    }
  };

  private _resetWorld = async (): Promise<void> => {
    try {
      await this._call({ type: "sample-panel/reset" });
      clearSwr();
      this._visible = STEP;
      this._loadRoute();
      this._say({ message: "The sample data is back to how it started", kind: "success" });
    } catch (error) {
      this._say({ message: `Couldn't reset: ${errorText(error)}`, kind: "error" });
    }
  };

  private _resetSettings = (): void => {
    this._clip = DEFAULT_CLIP;
    this._sensitivity = DEFAULT_SENSITIVITY;
  };

  // ---- small things ----------------------------------------------------------------------------------------------------------------

  /** A toast. Raised from the open sheet when there is one (a modal sheet switches everything outside itself off, so an Undo outside it could not be
   * pressed), from the shell otherwise. */
  private _say(toast: ToastOptions): void {
    const from = this.renderRoot?.querySelector("spec-lu-sheet[open]") ?? this._shell() ?? this;
    showToast(from, toast);
  }

  private _onKey = (event: KeyboardEvent): void => {
    if (event.key !== "?" || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTextEntry(deepActiveElement()) || layerDepth() > 0 || this._speciesOpen) return;
    event.preventDefault();
    this._helpOpen = true;
  };

  private _onShown = (): void => {
    // Coming back to a page: ask again, in case what it shows has got old.
    this._loadRoute();
  };

  private _onEvict = (event: CustomEvent<LuViewEventDetail>): void => {
    this._alive = this._alive.filter((id) => id !== event.detail.id);
    this._evicted.push(event.detail.id);
  };

  // ---- what the perf tool drives -----------------------------------------------------------------------------------------------

  private _surface(): DemoSurface {
    return {
      ready: () => this._whenPainted,
      destinations: () => TABS.slice(),
      current: () => this._current.page,
      navItem: (id) => {
        const nav = this._shell()?.renderRoot.querySelector<LuNav>("spec-lu-nav");
        return nav?.renderRoot.querySelectorAll(".item")[TABS.findIndex((tab) => tab === id)] ?? null;
      },
      openSpecies: (name) => {
        const first = name ?? readSwr<Species[]>(KEY.species).data?.find((item) => this._filter === "all" || (this._filter === "seen" ? item.seen : item.heard))?.name;
        if (first) this._openSpecies(first);
      },
      speciesTile: (index = 0) => this.renderRoot.querySelectorAll('[data-demo="species-tile"]')[index] ?? null,
      openPicker: () => this._openPicker(),
      pickerButton: () => this.renderRoot.querySelector('[data-demo="picker-open"]'),
      sheetOpen: () => this._speciesOpen || this._pickerOpen || this._helpOpen,
      scrollRoot: () => {
        const root = document.scrollingElement ?? document.documentElement;
        return { top: root.scrollTop, height: root.scrollHeight };
      },
      speciesCount: () => this.renderRoot.querySelectorAll('[data-demo="species-tile"]').length,
      stats: () => ({ renders: this._renders, viewsMounted: [...this._alive], evicted: [...this._evicted] }),
    };
  }

  // ---- drawing -------------------------------------------------------------------------------------------------------------------

  private _renderView(id: Page): TemplateResult {
    switch (id) {
      case "live": {
        const cameras = readSwr<Camera[]>(KEY.cameras);
        return html`<div data-view="live">${guard([cameras], () => liveView({ cameras, onOpen: this._openCamera, onRetry: () => this._revalidate(KEY.cameras) }))}</div>`;
      }
      case "library": {
        const species = readSwr<Species[]>(KEY.species);
        return html`<div data-view="library">${guard([species, this._filter, this._visible], () => libraryView({
          species, filter: this._filter, visible: this._visible, onFilter: this._onFilter, onMore: this._onMore, onOpen: this._openSpecies,
          onWarm: this._warmSpecies, onRetry: () => this._revalidate(KEY.species),
        }))}</div>`;
      }
      case "insights": {
        const insights = readSwr<Insights>(KEY.insights);
        const armed = backend.failArmed;
        return html`<div data-view="insights">${guard([insights, this._preview, this._clip, this._sensitivity, armed, this._confirming], () => insightsView({
          insights, preview: this._preview, clip: this._clip, sensitivity: this._sensitivity, failArmed: armed, confirming: this._confirming,
          onOpenVisit: this._openVisit,
          onRetry: () => this._revalidate(KEY.insights),
          onPreview: (value) => { this._preview = value; },
          onClip: (value) => { this._clip = value; },
          onSensitivity: (value, committed) => {
            this._sensitivity = value;
            if (committed) this._say({ message: `Sensitivity set to ${value}%`, id: "sensitivity" });
          },
          onSave: () => this._say({ message: `Saved: ${this._clip} s clips at ${this._sensitivity}% sensitivity`, kind: "success" }),
          onReset: this._resetSettings,
          onDiscard: () => {
            this._resetSettings();
            this._say({ message: "Changes discarded" });
          },
          onHelp: () => { this._helpOpen = true; },
          onToggleFail: () => backend.failNext(!backend.failArmed),
          onReload: () => this._revalidate(KEY.insights),
          onSimulate: this._simulate,
          onResetWorld: this._resetWorld,
          onPreviewRetry: () => this._say({ message: "Retry pressed: a real page would ask again now" }),
          onConfirmAll: this._confirmAll,
        }))}</div>`;
      }
      default: {
        const visit = readSwr<Visit | null>(KEY.visit(this._lastVisit));
        const found = visit.data;
        const related = found ? readSwr<VisitPage>(KEY.visits(found.species, found.kind)) : undefined;
        return html`<div data-view="visit">${guard([visit, related, this._lastVisit, this._busy], () => visitPage({
          id: this._lastVisit, visit, related, busy: this._busy, onConfirm: this._confirm, onWrong: () => this._openPicker(this._lastVisit), onDelete: this._delete,
          onOpenVisit: this._openVisit, onWarm: this._warmVisit, onBrowse: () => this._goTab("library"),
          onRetry: () => this._revalidate(KEY.visit(this._lastVisit), ...(found ? [KEY.visits(found.species, found.kind)] : [])),
        }))}</div>`;
      }
    }
  }

  private _renderConnection(): TemplateResult | typeof nothing {
    const state = this._link.state;
    if (state === "connected") return nothing;
    // The last data stays. The strip sits in the shell's bottom slot, so appearing and going away moves nothing on the page.
    return html`<spec-lu-state slot="bottom" kind="stale" .since=${this._link.lastConnectedAt} message=${state === "grace" ? "Reconnecting…" : "Offline"}></spec-lu-state>`;
  }

  protected render(): TemplateResult {
    this._renders += 1;
    const page = this._current.page;
    const sheetSpecies = this._sheetSpecies;
    const speciesList = readSwr<Species[]>(KEY.species);
    return html`
      <spec-lu-app-shell .hass=${this.hass} ?narrow=${this.narrow} ?wall=${this._wall} heading=${page === "visit" ? "Visit" : "Sample panel"} nav-label="Sample sections"
          leading=${page === "visit" ? "back" : "auto"} .destinations=${this._destinations} current=${page === "visit" ? "" : page}
          @lu-navigate=${this._onNavigate} @lu-back=${this._onBack} @lu-wall-change=${(event: CustomEvent<{ wall: boolean }>) => { this._wall = event.detail.wall; }}>
        <spec-lu-button slot="actions" kind="quiet" icon-only icon=${this._wall ? "mdi:fullscreen-exit" : "mdi:fullscreen"} label=${this._wall ? "Leave wall mode" : "Wall mode"} data-demo="wall-toggle" @click=${() => { this._wall = !this._wall; }}></spec-lu-button>
        <spec-lu-button slot="actions" kind="quiet" icon-only icon="mdi:tag-outline" label="What was it?" title="What was it?" data-demo="picker-open" @click=${() => this._openPicker()}></spec-lu-button>
        <spec-lu-button slot="actions" class="link-out" kind="quiet" icon-only icon="mdi:open-in-new" label="Open elsewhere" href="https://example.com/" target="_blank"></spec-lu-button>
        ${this._renderConnection()}
        <spec-lu-view-stack .current=${page} max="4" memory-key="sample-panel" @lu-view-shown=${this._onShown} @lu-view-evict=${this._onEvict}>
          ${repeat(this._alive, (id) => id, (id) => this._renderView(id))}
        </spec-lu-view-stack>
        ${speciesSheet({
          open: this._speciesOpen, name: sheetSpecies, species: speciesList.data?.find((item) => item.name === sheetSpecies),
          seen: sheetSpecies ? readSwr<VisitPage>(KEY.visits(sheetSpecies, "seen")) : undefined,
          heard: sheetSpecies ? readSwr<VisitPage>(KEY.visits(sheetSpecies, "heard")) : undefined,
          loadingMore: this._more, muted: this._muted.includes(sheetSpecies), onClose: this._onSpeciesClose, onOpenVisit: this._openVisit, onWarm: this._warmVisit,
          onMore: this._moreVisits, onRetry: (kind) => this._revalidate(KEY.visits(sheetSpecies, kind)), onMute: this._toggleMute,
        })}
        ${pickerSheet({
          open: this._pickerOpen, visit: this._pickerOpen ? readSwr<Visit | null>(KEY.visit(this._pickerFor)) : undefined, species: speciesList, query: this._query,
          onClose: () => { this._pickerOpen = false; }, onQuery: (value) => { this._query = value; }, onPick: this._pick,
          onRetry: () => this._revalidate(KEY.visit(this._pickerFor), KEY.species),
        })}
        ${helpSheet({ open: this._helpOpen, onClose: () => { this._helpOpen = false; } })}
      </spec-lu-app-shell>`;
  }
}

if (!customElements.get("spec-demo-panel")) customElements.define("spec-demo-panel", SamplePanel);

export const scenario: Scenario = {
  id: "panel",
  title: "Sample panel",
  create() {
    // The fake server answers `hass.callWS`, and goes quiet when the harness drops the websocket.
    const lu = window.__lu;
    backend.online = () => lu.mock.connection.connected !== false;
    for (const type of backend.types) lu.mock.onWS(type, (message) => backend.call({ ...message, type }));
    return document.createElement("spec-demo-panel");
  },
};
