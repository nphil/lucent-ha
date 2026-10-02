/** A small stale-while-revalidate cache, so a screen paints from memory first and refreshes behind it.
 *
 * Home Assistant re-creates a custom panel when you switch panels and after it has been hidden for a while,
 * and only module-level state survives that. `swr(key, fetcher)` keeps the last good answer for `key` at
 * module level: the new panel asks again, gets the old answer at once, and a fresh one replaces it when it
 * arrives. Rules:
 *  - callers asking for one key at the same time share ONE request;
 *  - data older than `maxAgeMs` is shown first and fetched again in the background;
 *  - a failed fetch keeps the last good data and records the error: the screen is never blanked;
 *  - a request that was replaced meanwhile (`revalidate`, `mutateSwr`, `clearSwr`) is aborted and its late
 *    answer is dropped, so an old answer can never overwrite a newer one;
 *  - `persist` also keeps a copy in storage (like Kestrel's 6 h snapshot), so a reloaded page paints from it. */

import { realScheduler } from "../core/throttle.ts";
import type { Scheduler } from "../core/throttle.ts";

/** Loads the data. Pass `signal` on (`fetch(url, { signal })`) so a replaced request really stops. */
export type SwrFetcher<T> = (signal: AbortSignal) => Promise<T> | T;

/** The part of `localStorage` the cache uses. */
export type SwrStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export interface SwrOptions {
  /** How long fetched data counts as fresh, in ms (default 30 000). A key is fetched again by `swr()` once it
   * is this old, and a failed key is retried by `swr()` no sooner than this after the failure. */
  maxAgeMs?: number;
  /** Keep a copy in storage as well. A copy older than `maxAgeMs` (here: how long a saved copy may be used,
   * e.g. 6 h when signed links expire after 12 h) is ignored. Needs a `storage` on the cache; the shared
   * cache uses `localStorage`. Data must survive `JSON.stringify`. */
  persist?: { maxAgeMs: number };
}

/** What the cache knows about one key. A new object after every change, so `===` tells you whether anything
 * changed. */
export interface SwrSnapshot<T> {
  /** The last good data; `undefined` until a fetch succeeded (a fetch that returns `undefined` counts as no data). */
  readonly data: T | undefined;
  /** Why the last fetch failed; `undefined` while the last fetch worked. */
  readonly error: unknown;
  /** A request is running right now. */
  readonly loading: boolean;
  /** There is data, but it is older than `maxAgeMs` or the last fetch failed: show it with a "may be out of date" hint. */
  readonly stale: boolean;
  /** When the server last confirmed `data` (ms since 1970); for restored data, when it was saved. */
  readonly updatedAt: number | undefined;
}

/** What `swr()` returns: the snapshot at the time of the call, plus ways to wait for or repeat the fetch. */
export interface SwrHandle<T> extends SwrSnapshot<T> {
  /** The request that is running (started by this call or by an earlier one), or `undefined` when the data is
   * fresh. Resolves with the snapshot when the request is done; never rejects. */
  readonly pending: Promise<SwrSnapshot<T>> | undefined;
  /** Fetches again now, replacing a request that is still running. Resolves like `pending`. */
  revalidate(): Promise<SwrSnapshot<T>>;
}

export interface SwrCache {
  swr<T>(key: string, fetcher: SwrFetcher<T>, options?: SwrOptions): SwrHandle<T>;
  /** The snapshot for `key` without fetching anything (empty for an unknown key). */
  read<T>(key: string): SwrSnapshot<T>;
  /** Calls `callback` after every change of `key`. Returns the function that stops it. */
  subscribe<T>(key: string, callback: (snapshot: SwrSnapshot<T>) => void): () => void;
  /** Replaces the data now (an optimistic update). A request that is running is dropped: its answer was
   * asked for before this change and could overwrite it. Call `revalidate()` once your write is done. */
  mutate<T>(key: string, updater: (current: T | undefined) => T): SwrSnapshot<T>;
  /** Forgets `key` (data, error, running request, stored copy), or everything when called without a key. */
  clear(key?: string): void;
}

export interface SwrCacheOptions {
  /** The clock and timers (default: the real ones). */
  scheduler?: Scheduler;
  /** Where `persist` copies go (default: none). */
  storage?: SwrStorage;
  /** Keys kept in memory (default 100). Beyond that the keys used longest ago go, unless something subscribed to them. */
  maxEntries?: number;
}

const DEFAULT_MAX_AGE_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 100;
/** Stored copies are written this long after the last change, so a burst of loads is one write. */
const PERSIST_DELAY_MS = 400;
const STORAGE_PREFIX = "lucent-ha.swr.";

interface Freshness {
  maxAgeMs: number;
}

class Snapshot<T> implements SwrSnapshot<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly loading: boolean;
  readonly updatedAt: number | undefined;
  private readonly _freshness: Freshness;
  private readonly _now: () => number;

  constructor(data: T | undefined, error: unknown, loading: boolean, updatedAt: number | undefined, freshness: Freshness, now: () => number) {
    this.data = data;
    this.error = error;
    this.loading = loading;
    this.updatedAt = updatedAt;
    this._freshness = freshness;
    this._now = now;
  }

  /** Worked out when read: data gets old without anything else changing. */
  get stale(): boolean {
    return this.data !== undefined && (this.error !== undefined || this._now() - (this.updatedAt ?? 0) >= this._freshness.maxAgeMs);
  }
}

class Handle<T> extends Snapshot<T> implements SwrHandle<T> {
  readonly pending: Promise<SwrSnapshot<T>> | undefined;
  readonly revalidate: () => Promise<SwrSnapshot<T>>;

  constructor(from: Snapshot<T>, freshness: Freshness, now: () => number, pending: Promise<SwrSnapshot<T>> | undefined, revalidate: () => Promise<SwrSnapshot<T>>) {
    super(from.data, from.error, from.loading, from.updatedAt, freshness, now);
    this.pending = pending;
    this.revalidate = revalidate;
  }
}

/** One running fetch. */
class InFlight<T> {
  readonly controller = new AbortController();
  /** Settles with the snapshot once this request is done, replaced or dropped. */
  readonly done: Promise<SwrSnapshot<T>>;
  private _resolve!: (snapshot: SwrSnapshot<T> | Promise<SwrSnapshot<T>>) => void;

  constructor() {
    this.done = new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  /** Ends the request for whoever waits on `done`. A replaced request passes the newer one's promise on. */
  finish(result: SwrSnapshot<T> | Promise<SwrSnapshot<T>>): void {
    this._resolve(result);
  }
}

class Entry<T> {
  data: T | undefined;
  updatedAt: number | undefined;
  error: unknown;
  failedAt: number | undefined;
  request: InFlight<T> | undefined;
  fetcher: SwrFetcher<T> | undefined;
  persist: SwrOptions["persist"];
  restored = false;
  readonly freshness: Freshness = { maxAgeMs: DEFAULT_MAX_AGE_MS };
  readonly listeners = new Set<(snapshot: SwrSnapshot<T>) => void>();
  snapshot: Snapshot<T>;

  constructor(now: () => number) {
    this.snapshot = new Snapshot<T>(undefined, undefined, false, undefined, this.freshness, now);
  }
}

const EMPTY = new Snapshot<never>(undefined, undefined, false, undefined, { maxAgeMs: DEFAULT_MAX_AGE_MS }, Date.now);

class Cache implements SwrCache {
  private readonly _scheduler: Scheduler;
  private readonly _storage: SwrStorage | undefined;
  private readonly _maxEntries: number;
  private readonly _now: () => number;
  /** Least recently used first. */
  private readonly _entries = new Map<string, Entry<unknown>>();
  private readonly _dirty = new Set<string>();
  private _writeTimer: unknown = null;

  constructor(options: SwrCacheOptions) {
    this._scheduler = options.scheduler ?? realScheduler;
    this._storage = options.storage;
    this._maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this._now = () => this._scheduler.now();
  }

  swr<T>(key: string, fetcher: SwrFetcher<T>, options: SwrOptions = {}): SwrHandle<T> {
    const entry = this._register(key, fetcher, options);
    if (!entry.request && this._due(entry)) this._start(key, entry);
    return this._handle(key, entry, fetcher, options);
  }

  read<T>(key: string): SwrSnapshot<T> {
    return (this._entries.get(key)?.snapshot ?? EMPTY) as SwrSnapshot<T>;
  }

  subscribe<T>(key: string, callback: (snapshot: SwrSnapshot<T>) => void): () => void {
    const entry = this._ensure<T>(key);
    entry.listeners.add(callback);
    return () => {
      entry.listeners.delete(callback);
      const idle = entry.listeners.size === 0 && entry.data === undefined && entry.error === undefined && !entry.request;
      if (idle && this._entries.get(key) === entry) this._entries.delete(key);
    };
  }

  mutate<T>(key: string, updater: (current: T | undefined) => T): SwrSnapshot<T> {
    const next = updater(this._entries.get(key)?.snapshot.data as T | undefined);
    const entry = this._ensure<T>(key);
    const dropped = entry.request;
    entry.request = undefined;
    entry.data = next;
    if (next !== undefined) entry.updatedAt ??= this._now();
    this._markDirty(key, entry);
    this._publish(key, entry);
    if (dropped) {
      dropped.controller.abort();
      dropped.finish(entry.snapshot);
    }
    return entry.snapshot;
  }

  clear(key?: string): void {
    if (key === undefined) {
      for (const known of [...this._entries.keys()]) this.clear(known);
      this._removeStored();
      return;
    }
    this._dirty.delete(key);
    this._removeStored(key);
    const entry = this._entries.get(key);
    if (!entry) return;
    const dropped = entry.request;
    entry.request = undefined;
    entry.data = undefined;
    entry.updatedAt = undefined;
    entry.error = undefined;
    entry.failedAt = undefined;
    this._publish(key, entry);
    if (entry.listeners.size === 0) this._entries.delete(key);
    if (dropped) {
      dropped.controller.abort();
      dropped.finish(entry.snapshot);
    }
  }

  /** The entry for `key`, created if needed, and now the most recently used. */
  private _ensure<T>(key: string): Entry<T> {
    let entry = this._entries.get(key);
    if (entry) {
      this._entries.delete(key);
    } else {
      entry = new Entry<unknown>(this._now);
    }
    this._entries.set(key, entry);
    this._evictOldest(key);
    return entry as Entry<T>;
  }

  /** Keeps memory bounded on a display that runs for weeks: forgets the least recently used keys nobody
   * listens to. (Their stored copies stay and are read back on demand.) */
  private _evictOldest(keep: string): void {
    for (const [key, entry] of this._entries) {
      if (this._entries.size <= this._maxEntries) return;
      if (key !== keep && entry.listeners.size === 0 && !entry.request) this._entries.delete(key);
    }
  }

  private _register<T>(key: string, fetcher: SwrFetcher<T>, options: SwrOptions): Entry<T> {
    const entry = this._ensure<T>(key);
    entry.fetcher = fetcher;
    entry.freshness.maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    entry.persist = options.persist;
    if (entry.persist && !entry.restored) this._restore(key, entry, entry.persist.maxAgeMs);
    return entry;
  }

  /** Time to fetch: never fetched, or the last fetch (good or failed) is at least `maxAgeMs` ago. */
  private _due<T>(entry: Entry<T>): boolean {
    const settledAt = Math.max(entry.updatedAt ?? Number.NEGATIVE_INFINITY, entry.failedAt ?? Number.NEGATIVE_INFINITY);
    return this._now() - settledAt >= entry.freshness.maxAgeMs;
  }

  private _handle<T>(key: string, entry: Entry<T>, fetcher: SwrFetcher<T>, options: SwrOptions): SwrHandle<T> {
    return new Handle(entry.snapshot, entry.freshness, this._now, entry.request?.done, () => this._start(key, this._register(key, fetcher, options)).done);
  }

  /** Starts a request for `entry`, replacing a running one. */
  private _start<T>(key: string, entry: Entry<T>): InFlight<T> {
    const fetcher = entry.fetcher as SwrFetcher<T>;
    const previous = entry.request;
    const request = new InFlight<T>();
    entry.request = request;
    if (previous) {
      previous.controller.abort();
      previous.finish(request.done);
    }
    this._publish(key, entry);
    void this._run(key, entry, request, fetcher);
    return request;
  }

  private async _run<T>(key: string, entry: Entry<T>, request: InFlight<T>, fetcher: SwrFetcher<T>): Promise<void> {
    let data: T;
    try {
      data = await fetcher(request.controller.signal);
    } catch (error) {
      if (entry.request !== request) return; // replaced or cleared meanwhile: this answer no longer matters
      entry.request = undefined;
      entry.error = error === undefined ? new Error("The request failed.") : error;
      entry.failedAt = this._now();
      this._publish(key, entry);
      request.finish(entry.snapshot);
      return;
    }
    if (entry.request !== request) return;
    entry.request = undefined;
    entry.data = data;
    entry.updatedAt = this._now();
    entry.error = undefined;
    entry.failedAt = undefined;
    this._markDirty(key, entry);
    this._publish(key, entry);
    request.finish(entry.snapshot);
  }

  /** New snapshot, then tell the subscribers. A subscriber that throws is reported and does not stop the others. */
  private _publish<T>(key: string, entry: Entry<T>): void {
    entry.snapshot = new Snapshot(entry.data, entry.error, entry.request !== undefined, entry.updatedAt, entry.freshness, this._now);
    for (const callback of [...entry.listeners]) {
      if (!entry.listeners.has(callback)) continue; // unsubscribed by an earlier subscriber just now
      try {
        callback(entry.snapshot);
      } catch (error) {
        console.error(`lucent-ha: a subscriber to swr key "${key}" threw.`, error);
      }
    }
  }

  /** Brings back a stored copy that is younger than `maxAgeMs`, if there is no data in memory yet. */
  private _restore<T>(key: string, entry: Entry<T>, maxAgeMs: number): void {
    entry.restored = true;
    if (!this._storage || entry.data !== undefined) return;
    const stored = readStored(this._storage, key);
    if (!stored) return;
    if (this._now() - stored.at < maxAgeMs) {
      entry.data = stored.data as T;
      entry.updatedAt = stored.at;
      this._publish(key, entry);
    } else {
      this._removeStored(key);
    }
  }

  private _markDirty<T>(key: string, entry: Entry<T>): void {
    if (!entry.persist || !this._storage) return;
    this._dirty.add(key);
    this._writeTimer ??= this._scheduler.setTimeout(() => this._flush(), PERSIST_DELAY_MS);
  }

  private _flush(): void {
    const storage = this._storage;
    const keys = [...this._dirty];
    this._dirty.clear();
    this._writeTimer = null;
    if (!storage) return;
    for (const key of keys) {
      const entry = this._entries.get(key);
      if (!entry?.persist) continue;
      try {
        if (entry.data === undefined) storage.removeItem(STORAGE_PREFIX + key);
        else storage.setItem(STORAGE_PREFIX + key, JSON.stringify({ at: entry.updatedAt, data: entry.data }));
      } catch {
        // Storage is full or blocked, or the data cannot be written as JSON: the screen works the same without the copy.
      }
    }
  }

  /** Removes the stored copy of `key`, or every stored copy when called without a key. */
  private _removeStored(key?: string): void {
    const storage = this._storage;
    if (!storage) return;
    try {
      if (key !== undefined) {
        storage.removeItem(STORAGE_PREFIX + key);
        return;
      }
      const ours: string[] = [];
      for (let index = 0; index < storage.length; index++) {
        const name = storage.key(index);
        if (name?.startsWith(STORAGE_PREFIX)) ours.push(name);
      }
      for (const name of ours) storage.removeItem(name);
    } catch {
      // Storage is blocked: there is nothing stored to remove.
    }
  }
}

function readStored(storage: SwrStorage, key: string): { at: number; data: unknown } | undefined {
  try {
    const raw = storage.getItem(STORAGE_PREFIX + key);
    if (raw === null) return undefined;
    const record = JSON.parse(raw) as { at?: unknown; data?: unknown } | null;
    if (record && typeof record.at === "number" && record.data !== undefined) return { at: record.at, data: record.data };
  } catch {
    // Unreadable or corrupt copy: treated as no copy.
  }
  return undefined;
}

/** Makes a cache of its own, for tests or for an app that wants its data apart from the shared cache. */
export function createSwrCache(options: SwrCacheOptions = {}): SwrCache {
  return new Cache(options);
}

let shared: SwrCache | undefined;

/** The cache behind `swr`, `readSwr` and the other functions below. Made on first use (never at import), with
 * `localStorage` for `persist` when the browser allows it. */
function sharedCache(): SwrCache {
  if (!shared) {
    let storage: SwrStorage | undefined;
    try {
      storage = typeof localStorage === "undefined" ? undefined : localStorage;
    } catch {
      storage = undefined; // blocked storage (private mode, sandboxed frame) throws when touched
    }
    shared = new Cache({ storage });
  }
  return shared;
}

/** Shows the last good answer for `key` at once and fetches a fresh one when it is old (or missing). */
export function swr<T>(key: string, fetcher: SwrFetcher<T>, options?: SwrOptions): SwrHandle<T> {
  return sharedCache().swr(key, fetcher, options);
}

/** The shared cache's snapshot for `key`, without fetching. */
export function readSwr<T>(key: string): SwrSnapshot<T> {
  return sharedCache().read<T>(key);
}

/** Calls `callback` after every change of `key` in the shared cache. Returns the function that stops it. */
export function subscribeSwr<T>(key: string, callback: (snapshot: SwrSnapshot<T>) => void): () => void {
  return sharedCache().subscribe(key, callback);
}

/** Replaces the shared cache's data for `key` now (an optimistic update); see `SwrCache.mutate`. */
export function mutateSwr<T>(key: string, updater: (current: T | undefined) => T): SwrSnapshot<T> {
  return sharedCache().mutate(key, updater);
}

/** Forgets `key` in the shared cache, or everything when called without a key. Call it on sign-out. */
export function clearSwr(key?: string): void {
  sharedCache().clear(key);
}
