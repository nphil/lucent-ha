/* History LAYERS: every modal layer (sheet, picker, focused camera, visit ...) is one history entry, so the system
 * Back button closes the top layer first and only then leaves the page. Tabs never grow history (tab-history.ts).
 *
 * How it works, in five rules:
 *  1. Opening a layer pushes ONE history entry that keeps the URL and the old state, and adds `lu.layer = {id, seq}`.
 *     `seq` only ever grows, so "which layers are still ahead of me" is a comparison, not a count.
 *  2. Whenever history moves (`popstate`), every open layer whose entry is now AHEAD of us (bigger `seq`) closes,
 *     top first, with the reason "back". That covers Back, Back twice, a long-press Back jump and the browser
 *     skipping entries it considers automatic.
 *  3. Closing from the UI (`handle.close`) runs `onClose` right now so the exit animation starts at once, then
 *     pops the layer's entries with ONE `history.go(-n)`. The popstate that causes finds nothing left to close.
 *  4. Entries whose layer is gone (closed by `navigate`, left by a reload, reached by Forward) are "leftovers":
 *     landing on one steps back once more, so they are skipped without anyone seeing them. A manager that starts
 *     while a leftover is the current entry (the page was reloaded with a sheet open) steps over it at once.
 *  5. `go()` is asynchronous. While one of ours is under way, later history writes (the next layer, a navigation)
 *     wait for it (`whenSettled`), otherwise the late traversal would undo them. A lost popstate cannot wedge this:
 *     the wait ends by itself after POP_TIMEOUT_MS. */
import { realScheduler } from "../core/throttle.ts";
import type { Scheduler } from "../core/throttle.ts";
import { addLocationChangedListener, addPopstateListener } from "./browser.ts";
import { layerSeqOf, withLu } from "./history-state.ts";
import { reportAsync } from "./report-error.ts";

/** Why a layer closed. `"back"`: system Back or Forward moved history. `"navigate"`: `navigate()` replaced the page.
 * `"api"`: code closed it. Anything else is the caller's own word (a sheet passes "scrim", "escape", "swipe" ...). */
export type LayerCloseReason = "back" | "api" | "navigate" | string;

export interface LayerHandle {
  readonly id: string;
  /** True from `pushLayer` until the layer closes, by whatever route. */
  readonly open: boolean;
  /** Closes this layer and every layer above it (default reason "api"). Does nothing when it is already closed. */
  close(reason?: LayerCloseReason): void;
}

/** Everything the manager touches in the outside world, so tests can hand it a fake history. */
export interface LayerEnv {
  history: Pick<History, "state" | "pushState" | "go">;
  /** Calls `handler` for every `popstate`; returns the function that stops listening. */
  addPopstate(handler: (event: { state: unknown }) => void): () => void;
  /** Calls `handler` when somebody else navigated (Home Assistant fires `location-changed`); returns the stop function. */
  addLocationChanged(handler: () => void): () => void;
  clock: Scheduler;
  /** Receives errors thrown by `onClose` callbacks and by `pushState` itself. */
  onError(error: unknown): void;
}

export interface LayerManager {
  /** Bumped when the shape of this object changes, so a second bundle on the page can tell if it can share it. */
  readonly apiVersion: 1;
  pushLayer(id: string, onClose: (reason: LayerCloseReason) => void): LayerHandle;
  closeTopLayer(reason?: LayerCloseReason): boolean;
  layerDepth(): number;
  /** For `navigate()`: closes every open layer (top first) and leaves their history entries where they are; the
   * navigation's own push or replace is the history operation. Returns how many history entries those layers
   * occupy, for a caller that wants to go back past them. */
  releaseLayers(reason: LayerCloseReason): number;
  /** Null when no history change of ours is under way; otherwise a promise that resolves once the last one landed. */
  whenSettled(): Promise<void> | null;
  /** Stops listening and forgets everything (tests; the page-wide manager is never disposed). */
  dispose(): void;
}

/** How long we wait for the popstate of a `history.go()` we issued before carrying on without it. */
export const POP_TIMEOUT_MS = 1000;

const API_VERSION = 1;
const SHARED_KEY = Symbol.for("lucent-ha:layers");

interface Layer {
  readonly id: string;
  readonly onClose: (reason: LayerCloseReason) => void;
  /** 0 until the layer's history entry exists. */
  seq: number;
  open: boolean;
  pushed: boolean;
}

/** History writes in order. Layers closed before their push ran are skipped. A pop only happens while the current
 * entry still is the one it was planned from (`top`, the number of the highest layer entry it removes): if history
 * moved on without us, those entries are leftovers and going back would undo somebody else's navigation. */
type Operation = { kind: "push"; layer: Layer } | { kind: "pop"; count: number; top: number };

class Layers implements LayerManager {
  readonly apiVersion = API_VERSION;

  private _env: LayerEnv;
  private _stack: Layer[] = [];
  private _queue: Operation[] = [];
  private _waiting = false;
  private _timer: unknown = null;
  private _pumping = false;
  private _settled: Array<() => void> = [];
  private _callbacks: Array<{ layer: Layer; reason: LayerCloseReason }> = [];
  private _draining = false;
  private _nextSeq: number;
  private _stopListening: () => void;
  private _stopLocation: () => void;

  constructor(env: LayerEnv) {
    this._env = env;
    // Sequence numbers start at the clock, so a page loaded later always numbers above entries an earlier
    // page life left in the same history (they survive reloads).
    this._nextSeq = Math.max(1, Math.floor(env.clock.now()));
    this._stopListening = env.addPopstate((event) => this._onPopstate(event.state));
    this._stopLocation = env.addLocationChanged(() => this._onLocationChanged());
    // No layer can be open yet, so a layer entry that is current right now was left by an earlier page life (a reload,
    // a restored or duplicated tab). The page looks like its base page; step over the entry so one Back press leaves.
    const current = layerSeqOf(env.history.state);
    if (current > 0) {
      this._queue.push({ kind: "pop", count: 1, top: current });
      this._pump();
    }
  }

  pushLayer(id: string, onClose: (reason: LayerCloseReason) => void): LayerHandle {
    const layer: Layer = { id, onClose, seq: 0, open: true, pushed: false };
    this._stack.push(layer);
    this._queue.push({ kind: "push", layer });
    this._pump();
    return {
      id,
      get open() {
        return layer.open;
      },
      close: (reason = "api") => this._close(layer, reason),
    };
  }

  closeTopLayer(reason: LayerCloseReason = "api"): boolean {
    const top = this._stack[this._stack.length - 1];
    if (top === undefined) return false;
    this._close(top, reason);
    return true;
  }

  layerDepth(): number {
    return this._stack.length;
  }

  releaseLayers(reason: LayerCloseReason): number {
    const released = this._stack.splice(0);
    let entries = 0;
    for (const layer of released) {
      layer.open = false;
      if (layer.pushed) entries++;
    }
    this._notifyClosed(released.reverse(), reason);
    this._pump();
    return entries;
  }

  whenSettled(): Promise<void> | null {
    if (!this._waiting && this._queue.length === 0) return null;
    return new Promise<void>((resolve) => {
      this._settled.push(resolve);
    });
  }

  dispose(): void {
    this._stopListening();
    this._stopLocation();
    this._endWait();
    this._stack = [];
    this._queue = [];
    this._resolveSettled();
  }

  /** UI close: the layer and everything above it go now; their entries are popped with one `go(-n)`. */
  private _close(layer: Layer, reason: LayerCloseReason): void {
    const at = this._stack.indexOf(layer);
    if (at < 0) return;
    const removed = this._stack.splice(at);
    let entries = 0;
    let top = 0;
    for (const gone of removed) {
      gone.open = false;
      if (gone.pushed) {
        entries++;
        top = Math.max(top, gone.seq);
      }
    }
    if (entries > 0) {
      const last = this._queue[this._queue.length - 1];
      if (last?.kind === "pop") last.count += entries;
      else this._queue.push({ kind: "pop", count: entries, top });
    }
    this._notifyClosed(removed.reverse(), reason);
    this._pump();
  }

  /** History moved (by the user, by us, or by other code): bring the open layers in line with where it landed. */
  private _onPopstate(state: unknown): void {
    this._endWait();
    const landed = layerSeqOf(state);
    const ahead = this._stack.filter((layer) => layer.pushed && layer.seq > landed);
    if (ahead.length > 0) {
      this._stack = this._stack.filter((layer) => !ahead.includes(layer));
      for (const layer of ahead) layer.open = false;
    }
    // An entry whose layer is gone is a leftover: step over it. Unless a pop we already queued is about to leave it
    // (closing several layers one after another lands on each of their entries on the way down).
    const leftover =
      landed > 0 && !this._stack.some((layer) => layer.pushed && layer.seq === landed) && !this._queue.some((operation) => operation.kind === "pop");
    if (leftover) this._queue.unshift({ kind: "pop", count: 1, top: landed });
    this._notifyClosed(ahead.reverse(), "back");
    this._pump();
  }

  /** Somebody else navigated (a sidebar tap, a link Home Assistant handled): layers cannot outlive that. When the
   * current entry is no longer the highest layer's own, close them all without touching history. */
  private _onLocationChanged(): void {
    let top: Layer | undefined;
    for (const layer of this._stack) if (layer.pushed) top = layer;
    if (top === undefined || layerSeqOf(this._env.history.state) === top.seq) return;
    this.releaseLayers("navigate");
  }

  /** Runs queued history writes one at a time; a pop holds the queue until its popstate (or the timeout). */
  private _pump(): void {
    if (this._pumping) return;
    this._pumping = true;
    try {
      while (!this._waiting && this._queue.length > 0) {
        const operation = this._queue.shift();
        if (operation?.kind === "push") this._writeEntry(operation.layer);
        else if (operation?.kind === "pop") this._startPop(operation.count, operation.top);
      }
    } finally {
      this._pumping = false;
    }
    if (!this._waiting && this._queue.length === 0) this._resolveSettled();
  }

  private _writeEntry(layer: Layer): void {
    if (!layer.open) return;
    const { history } = this._env;
    const seq = Math.max(this._nextSeq, layerSeqOf(history.state) + 1);
    try {
      history.pushState(withLu(history.state, { layer: { id: layer.id, seq } }), "");
    } catch (error) {
      // The layer still works; it just has no entry for Back to close.
      this._env.onError(error);
      return;
    }
    layer.seq = seq;
    layer.pushed = true;
    this._nextSeq = seq + 1;
  }

  private _startPop(count: number, top: number): void {
    if (layerSeqOf(this._env.history.state) !== top) return;
    this._waiting = true;
    this._timer = this._env.clock.setTimeout(() => {
      this._timer = null;
      this._waiting = false;
      this._pump();
    }, POP_TIMEOUT_MS);
    this._env.history.go(-count);
  }

  private _endWait(): void {
    if (this._timer !== null) this._env.clock.clearTimeout(this._timer);
    this._timer = null;
    this._waiting = false;
  }

  private _resolveSettled(): void {
    for (const resolve of this._settled.splice(0)) resolve();
  }

  /** Calls `onClose` once per layer, top first, one callback at a time: a callback that closes or opens layers
   * only queues more work for this loop, it never runs another callback inside itself. */
  private _notifyClosed(layers: Layer[], reason: LayerCloseReason): void {
    for (const layer of layers) this._callbacks.push({ layer, reason });
    if (this._draining) return;
    this._draining = true;
    try {
      for (let next = this._callbacks.shift(); next !== undefined; next = this._callbacks.shift()) {
        try {
          next.layer.onClose(next.reason);
        } catch (error) {
          this._env.onError(error);
        }
      }
    } finally {
      this._draining = false;
    }
  }
}

/** A layer manager of its own on the given environment (tests). The browser defaults fill in what is left out. */
export function createLayerManager(env: Partial<LayerEnv> = {}): LayerManager {
  return new Layers({
    history: env.history ?? window.history,
    addPopstate: env.addPopstate ?? addPopstateListener,
    addLocationChanged: env.addLocationChanged ?? addLocationChangedListener,
    clock: env.clock ?? realScheduler,
    onError: env.onError ?? reportAsync,
  });
}

/** The ONE manager of this page. The first copy of the toolkit that needs it creates it and parks it on
 * `globalThis`; every later bundle reuses it, so two panels never both react to the same Back press. */
export function sharedLayerManager(): LayerManager {
  const scope = globalThis as unknown as Record<symbol, LayerManager | undefined>;
  const existing = scope[SHARED_KEY];
  if (existing === undefined) {
    const created = createLayerManager();
    scope[SHARED_KEY] = created;
    return created;
  }
  if (existing.apiVersion !== API_VERSION) {
    throw new Error(`lucent-ha: the page already has a layer manager with apiVersion ${String(existing.apiVersion)}, this copy needs ${API_VERSION}`);
  }
  return existing;
}

/** Opens a layer: one history entry, so system Back closes it. `onClose` runs once, whoever closes the layer;
 * play the exit animation there. */
export function pushLayer(id: string, onClose: (reason: LayerCloseReason) => void): LayerHandle {
  return sharedLayerManager().pushLayer(id, onClose);
}

/** Closes the top layer (default reason "api"). Returns true when there was one. */
export function closeTopLayer(reason?: LayerCloseReason): boolean {
  return sharedLayerManager().closeTopLayer(reason);
}

/** How many layers are open right now. */
export function layerDepth(): number {
  return sharedLayerManager().layerDepth();
}
