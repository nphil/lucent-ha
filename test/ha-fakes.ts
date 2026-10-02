/** Fakes shared by the ha-*.test.ts files: a clock, a browser-faithful history, a stand-in for Home Assistant's own
 * navigate, and a small "world" that wires them to the real layer manager, navigator and tab history. */
import type { Scheduler } from "../src/core/throttle.ts";
import { createHistoryNavigator } from "../src/ha/navigate.ts";
import type { HaNavigate, HistoryNavigator } from "../src/ha/navigate.ts";
import { createLayerManager } from "../src/ha/layers.ts";
import type { LayerManager } from "../src/ha/layers.ts";
import { TabHistory } from "../src/ha/tab-history.ts";

/** A clock that only moves when the test says so. */
export class FakeClock implements Scheduler {
  time: number;
  private _nextId = 1;
  private _timers = new Map<number, { at: number; callback: () => void }>();

  constructor(start = 0) {
    this.time = start;
  }

  now(): number {
    return this.time;
  }

  setTimeout(callback: () => void, ms: number): number {
    const id = this._nextId++;
    this._timers.set(id, { at: this.time + ms, callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this._timers.delete(handle as number);
  }

  /** Timers that have not fired and were not cleared. */
  get pending(): number {
    return this._timers.size;
  }

  /** Moves time forward and runs every timer that comes due, in order (including ones those timers schedule). */
  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      let next: [number, { at: number; callback: () => void }] | undefined;
      for (const entry of this._timers) {
        if (entry[1].at <= target && (next === undefined || entry[1].at < next[1].at)) next = entry;
      }
      if (next === undefined) break;
      this._timers.delete(next[0]);
      this.time = Math.max(this.time, next[1].at);
      next[1].callback();
    }
    this.time = target;
  }
}

interface Entry {
  state: unknown;
  url: string;
}

/** A session history that behaves like the browser's where it matters here: `pushState` drops the forward entries,
 * state is cloned on the way in (a function in a state throws like in a browser), and `go`/`back`/`forward` are
 * ASYNCHRONOUS: they queue a traversal that moves and fires ONE `popstate` only when the test calls `step()` or
 * `flush()`. A traversal past either end does nothing and fires nothing. */
export class FakeHistory {
  entries: Entry[];
  index: number;
  /** Every delta ever passed to `go`/`back`/`forward`. */
  readonly traversals: number[] = [];
  /** Every popstate delivered, with the entry index it landed on. */
  readonly popstates: number[] = [];
  private _queue: number[] = [];
  private _loseNext = false;
  private _handlers = new Set<(event: { state: unknown }) => void>();

  /** `before` are older entries (the page the user came from); `first` is the entry the panel opened on. */
  constructor(first: { state?: unknown; url?: string } = {}, before: Entry[] = []) {
    this.entries = [...before, { state: structuredClone(first.state ?? null), url: first.url ?? "/" }];
    this.index = this.entries.length - 1;
  }

  get state(): unknown {
    return structuredClone(this.entries[this.index]?.state);
  }

  get url(): string {
    return this.entries[this.index]?.url ?? "";
  }

  get length(): number {
    return this.entries.length;
  }

  pushState(state: unknown, _unused: string, url?: string | URL | null): void {
    const entry = { state: structuredClone(state), url: url == null ? this.url : String(url) };
    this.entries.splice(this.index + 1);
    this.entries.push(entry);
    this.index = this.entries.length - 1;
  }

  replaceState(state: unknown, _unused: string, url?: string | URL | null): void {
    this.entries[this.index] = { state: structuredClone(state), url: url == null ? this.url : String(url) };
  }

  go(delta: number): void {
    this.traversals.push(delta);
    this._queue.push(delta);
  }

  back(): void {
    this.go(-1);
  }

  forward(): void {
    this.go(1);
  }

  /** Traversals asked for and not yet carried out. */
  get pending(): number {
    return this._queue.length;
  }

  /** The next traversal that really moves does so silently: its popstate never reaches the page. */
  loseNextPopstate(): void {
    this._loseNext = true;
  }

  /** Carries out the oldest queued traversal. False when none was queued. */
  step(): boolean {
    const delta = this._queue.shift();
    if (delta === undefined) return false;
    const target = this.index + delta;
    if (target < 0 || target >= this.entries.length) return true;
    this.index = target;
    if (this._loseNext) {
      this._loseNext = false;
      return true;
    }
    this.popstates.push(target);
    const state = structuredClone(this.entries[target]?.state);
    for (const handler of [...this._handlers]) handler({ state });
    return true;
  }

  /** Carries out every queued traversal, including ones the popstate handlers queue meanwhile. Returns how many. */
  flush(): number {
    let count = 0;
    while (this.step()) count++;
    return count;
  }

  readonly addPopstate = (handler: (event: { state: unknown }) => void): (() => void) => {
    this._handlers.add(handler);
    return () => {
      this._handlers.delete(handler);
    };
  };

  /** How many popstate listeners are attached right now. */
  get listeners(): number {
    return this._handlers.size;
  }

  private _locationHandlers = new Set<() => void>();

  /** The window's `location-changed` event, which Home Assistant fires after it navigated. */
  readonly addLocationChanged = (handler: () => void): (() => void) => {
    this._locationHandlers.add(handler);
    return () => {
      this._locationHandlers.delete(handler);
    };
  };

  fireLocationChanged(): void {
    for (const handler of [...this._locationHandlers]) handler();
  }

  /** How many location-changed listeners are attached right now. */
  get locationListeners(): number {
    return this._locationHandlers.size;
  }
}

export interface FakeHaOptions {
  /** `modern` stores `data` and a `from` path like Home Assistant 2026.9; `legacy` drops both (older versions). */
  flavor?: "modern" | "legacy";
  /** Resolve false instead of navigating (a dialog would not close). */
  refuse?: boolean;
}

/** A stand-in for `ha-panel-custom.navigate`, copied in shape from Home Assistant's `common/navigate.ts`: asynchronous,
 * replaces `history.state` wholesale, and announces `location-changed` once the entry is in place. */
export function fakeHaNavigate(history: FakeHistory, events: EventTarget, options: FakeHaOptions = {}): HaNavigate {
  const modern = (options.flavor ?? "modern") === "modern";
  /** Home Assistant's `buildHistoryState`: the data plus the path we came from. */
  const build = (data: Record<string, unknown> | undefined, from: string | undefined): unknown => (from === undefined ? (data ?? null) : { ...data, from });
  return async (path, navigateOptions) => {
    await Promise.resolve();
    await Promise.resolve();
    if (options.refuse) return false;
    const replace = navigateOptions.replace === true;
    const current = (history.state ?? {}) as { root?: boolean; from?: string };
    if (replace) {
      // A first entry keeps only `root`; a replaced entry keeps its predecessor (`from`).
      const data = current.root ? { root: true } : navigateOptions.data;
      history.replaceState(modern ? build(data, current.from) : current.root ? { root: true } : null, "", path);
    } else {
      history.pushState(modern ? build(navigateOptions.data, history.url) : null, "", path);
    }
    events.dispatchEvent(new CustomEvent("location-changed", { detail: { replace } }));
    return true;
  };
}

export interface LocationChange {
  replace: boolean;
  url: string;
  state: unknown;
}

export interface World {
  clock: FakeClock;
  history: FakeHistory;
  events: EventTarget;
  errors: unknown[];
  layers: LayerManager;
  navigator: HistoryNavigator;
  /** Every `location-changed`, with the history as it was at that moment. */
  locationChanges: LocationChange[];
  /** The element a test passes as `from` so the navigator finds the fake Home Assistant above it. */
  panel: EventTarget;
  makeTabs(options: { defaultId: string; initialId?: string }): TabHistory;
}

export interface WorldOptions {
  /** The entry the panel opened on. */
  first?: { state?: unknown; url?: string };
  /** An existing history to run on: a reloaded page keeps its entries and gets new managers. */
  history?: FakeHistory;
  /** What the clock says when the page starts (a reload happens later than the first page life). */
  clockStart?: number;
  /** `none`: no Home Assistant above the panel (a card, the dev harness). */
  ha?: FakeHaOptions | "none";
}

/** Everything wired together on one fake history: the real layer manager, the real navigator, the real tab history. */
export function createWorld(options: WorldOptions = {}): World {
  const clock = new FakeClock(options.clockStart ?? 1000);
  const history = options.history ?? new FakeHistory(options.first ?? { url: "/kestrel/live" }, [{ state: null, url: "/lovelace/0" }]);
  const events = new EventTarget();
  const errors: unknown[] = [];
  const onError = (error: unknown): void => {
    errors.push(error);
  };
  const locationChanges: LocationChange[] = [];
  events.addEventListener("location-changed", (event) => {
    locationChanges.push({ replace: (event as CustomEvent<{ replace: boolean }>).detail.replace, url: history.url, state: history.state });
  });
  const layers = createLayerManager({
    history,
    addPopstate: history.addPopstate,
    addLocationChanged: (handler) => {
      events.addEventListener("location-changed", handler);
      return () => events.removeEventListener("location-changed", handler);
    },
    clock,
    onError,
  });
  const panel = new EventTarget();
  const haNavigate = options.ha === "none" ? null : fakeHaNavigate(history, events, options.ha ?? {});
  const navigator = createHistoryNavigator({
    history,
    layers,
    onError,
    announce: (replace) => {
      events.dispatchEvent(new CustomEvent("location-changed", { detail: { replace } }));
    },
    findHaNavigate: (from) => (from === panel ? haNavigate : null),
  });
  return {
    clock,
    history,
    events,
    errors,
    layers,
    navigator,
    locationChanges,
    panel,
    makeTabs: (tabOptions) => new TabHistory({ ...tabOptions, env: { history, addPopstate: history.addPopstate, navigator, onError } }),
  };
}

/** Lets queued promise callbacks run (the fake Home Assistant navigates after a couple of microtasks). */
export async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
