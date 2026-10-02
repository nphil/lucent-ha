/** The bookkeeping of a view stack, with no DOM: which views are kept alive, which one was shown last, which
 * ones must go when there are too many, and where each view was scrolled to. `LuViewStack` is a thin wrapper. */

export const DEFAULT_MAX_VIEWS = 4;
const SCROLL_MEMORY_LIMIT = 64;

/** Scroll offsets (px) remembered per view id. */
export interface ScrollMemory {
  /** `undefined` for a view that was never left (it starts at the top). */
  get(id: string): number | undefined;
  set(id: string, top: number): void;
  delete(id: string): void;
}

/** A fresh memory. It holds at most `limit` views: when a long-running display has visited more, the ones
 * not touched for longest are forgotten and start at the top again. */
export function createScrollMemory(limit = SCROLL_MEMORY_LIMIT): ScrollMemory {
  const offsets = new Map<string, number>();
  return {
    get: (id) => offsets.get(id),
    set(id, top) {
      if (!Number.isFinite(top)) return;
      offsets.delete(id); // setting it again makes it the newest entry
      offsets.set(id, Math.max(0, top));
      if (offsets.size > limit) {
        const oldest = offsets.keys().next();
        if (!oldest.done) offsets.delete(oldest.value);
      }
    },
    delete(id) {
      offsets.delete(id);
    },
  };
}

const memories = new Map<string, ScrollMemory>();

/** The memory shared by every view stack that uses `key`. It lives at module level on purpose: Home
 * Assistant re-creates a custom panel when you switch panels and after it has been hidden for a while, and
 * only module state survives that. */
export function scrollMemoryFor(key: string): ScrollMemory {
  let memory = memories.get(key);
  if (!memory) memories.set(key, (memory = createScrollMemory()));
  return memory;
}

/** What `ViewStackModel.show` decided. */
export interface ViewChange {
  /** The view that was showing and now is not; `null` when there was none or nothing changed. */
  hide: string | null;
  show: string;
  /** Views pushed out by the cap. The consumer removes them. Never contains `show`. */
  evict: string[];
  /** True when `show` was not kept alive yet (first visit, or it was evicted since). */
  first: boolean;
}

export interface ViewStackModelOptions {
  /** How many views stay alive (default 4). */
  max?: number;
  /** Where scroll offsets are kept (default: a private memory). */
  memory?: ScrollMemory;
}

export class ViewStackModel {
  /** Replace to switch to another namespace (what the element does when its `memory-key` changes). */
  memory: ScrollMemory;
  private _max = DEFAULT_MAX_VIEWS;
  private _current: string | null = null;
  /** Views kept alive, least recently shown first. The showing view is always last. */
  private readonly _mounted: string[] = [];

  constructor(options: ViewStackModelOptions = {}) {
    this.memory = options.memory ?? createScrollMemory();
    if (options.max !== undefined) this.max = options.max;
  }

  /** At least 1: the showing view always stays. */
  get max(): number {
    return this._max;
  }
  set max(value: number) {
    this._max = Number.isNaN(value) ? DEFAULT_MAX_VIEWS : Math.max(1, Math.floor(value));
  }

  /** The view that is showing, or `null`. */
  get current(): string | null {
    return this._current;
  }

  /** The views kept alive, least recently shown first. */
  get mounted(): readonly string[] {
    return this._mounted;
  }

  /** Makes `id` the showing view. */
  show(id: string): ViewChange {
    if (id === this._current) return { hide: null, show: id, evict: [], first: false };
    const hide = this._current;
    const at = this._mounted.indexOf(id);
    if (at >= 0) this._mounted.splice(at, 1);
    this._mounted.push(id);
    this._current = id;
    return { hide, show: id, evict: this.trim(), first: at < 0 };
  }

  /** Nothing shows any more (the stack's `current` was emptied). Returns the view that was showing. */
  clear(): string | null {
    const was = this._current;
    this._current = null;
    return was;
  }

  /** Pushes out the least recently shown views until at most `max` are kept alive; returns them. */
  trim(): string[] {
    return this._mounted.splice(0, Math.max(0, this._mounted.length - this._max));
  }

  /** The view's element left the page without being pushed out (the consumer removed it on its own): it no longer
   * counts against `max`. The showing view stays, and the remembered scroll offset is kept, as after an eviction.
   * Returns whether the view was dropped. */
  release(id: string): boolean {
    const at = this._mounted.indexOf(id);
    if (at < 0 || id === this._current) return false;
    this._mounted.splice(at, 1);
    return true;
  }

  saveScroll(id: string, top: number): void {
    this.memory.set(id, top);
  }

  /** Where `id` was left; `undefined` for a view that was never left, which starts at the top. */
  scrollFor(id: string): number | undefined {
    return this.memory.get(id);
  }

  /** The next time `id` is shown it starts at the top. */
  forgetScroll(id: string): void {
    this.memory.delete(id);
  }
}
