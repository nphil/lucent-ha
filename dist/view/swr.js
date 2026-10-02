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
import { realScheduler } from "../core/throttle.js";
const DEFAULT_MAX_AGE_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 100;
/** Stored copies are written this long after the last change, so a burst of loads is one write. */
const PERSIST_DELAY_MS = 400;
const STORAGE_PREFIX = "lucent-ha.swr.";
class Snapshot {
    constructor(data, error, loading, updatedAt, freshness, now) {
        this.data = data;
        this.error = error;
        this.loading = loading;
        this.updatedAt = updatedAt;
        this._freshness = freshness;
        this._now = now;
    }
    /** Worked out when read: data gets old without anything else changing. */
    get stale() {
        return this.data !== undefined && (this.error !== undefined || this._now() - (this.updatedAt ?? 0) >= this._freshness.maxAgeMs);
    }
}
class Handle extends Snapshot {
    constructor(from, freshness, now, pending, revalidate) {
        super(from.data, from.error, from.loading, from.updatedAt, freshness, now);
        this.pending = pending;
        this.revalidate = revalidate;
    }
}
/** One running fetch. */
class InFlight {
    constructor() {
        this.controller = new AbortController();
        this.done = new Promise((resolve) => {
            this._resolve = resolve;
        });
    }
    /** Ends the request for whoever waits on `done`. A replaced request passes the newer one's promise on. */
    finish(result) {
        this._resolve(result);
    }
}
class Entry {
    constructor(now) {
        this.restored = false;
        this.freshness = { maxAgeMs: DEFAULT_MAX_AGE_MS };
        this.listeners = new Set();
        this.snapshot = new Snapshot(undefined, undefined, false, undefined, this.freshness, now);
    }
}
const EMPTY = new Snapshot(undefined, undefined, false, undefined, { maxAgeMs: DEFAULT_MAX_AGE_MS }, Date.now);
class Cache {
    constructor(options) {
        /** Least recently used first. */
        this._entries = new Map();
        this._dirty = new Set();
        this._writeTimer = null;
        this._scheduler = options.scheduler ?? realScheduler;
        this._storage = options.storage;
        this._maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
        this._now = () => this._scheduler.now();
    }
    swr(key, fetcher, options = {}) {
        const entry = this._register(key, fetcher, options);
        if (!entry.request && this._due(entry))
            this._start(key, entry);
        return this._handle(key, entry, fetcher, options);
    }
    read(key) {
        return (this._entries.get(key)?.snapshot ?? EMPTY);
    }
    subscribe(key, callback) {
        const entry = this._ensure(key);
        entry.listeners.add(callback);
        return () => {
            entry.listeners.delete(callback);
            const idle = entry.listeners.size === 0 && entry.data === undefined && entry.error === undefined && !entry.request;
            if (idle && this._entries.get(key) === entry)
                this._entries.delete(key);
        };
    }
    mutate(key, updater) {
        const next = updater(this._entries.get(key)?.snapshot.data);
        const entry = this._ensure(key);
        const dropped = entry.request;
        entry.request = undefined;
        entry.data = next;
        if (next !== undefined)
            entry.updatedAt ??= this._now();
        this._markDirty(key, entry);
        this._publish(key, entry);
        if (dropped) {
            dropped.controller.abort();
            dropped.finish(entry.snapshot);
        }
        return entry.snapshot;
    }
    clear(key) {
        if (key === undefined) {
            for (const known of [...this._entries.keys()])
                this.clear(known);
            this._removeStored();
            return;
        }
        this._dirty.delete(key);
        this._removeStored(key);
        const entry = this._entries.get(key);
        if (!entry)
            return;
        const dropped = entry.request;
        entry.request = undefined;
        entry.data = undefined;
        entry.updatedAt = undefined;
        entry.error = undefined;
        entry.failedAt = undefined;
        this._publish(key, entry);
        if (entry.listeners.size === 0)
            this._entries.delete(key);
        if (dropped) {
            dropped.controller.abort();
            dropped.finish(entry.snapshot);
        }
    }
    /** The entry for `key`, created if needed, and now the most recently used. */
    _ensure(key) {
        let entry = this._entries.get(key);
        if (entry) {
            this._entries.delete(key);
        }
        else {
            entry = new Entry(this._now);
        }
        this._entries.set(key, entry);
        this._evictOldest(key);
        return entry;
    }
    /** Keeps memory bounded on a display that runs for weeks: forgets the least recently used keys nobody
     * listens to. (Their stored copies stay and are read back on demand.) */
    _evictOldest(keep) {
        for (const [key, entry] of this._entries) {
            if (this._entries.size <= this._maxEntries)
                return;
            if (key !== keep && entry.listeners.size === 0 && !entry.request)
                this._entries.delete(key);
        }
    }
    _register(key, fetcher, options) {
        const entry = this._ensure(key);
        entry.fetcher = fetcher;
        entry.freshness.maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
        entry.persist = options.persist;
        if (entry.persist && !entry.restored)
            this._restore(key, entry, entry.persist.maxAgeMs);
        return entry;
    }
    /** Time to fetch: never fetched, or the last fetch (good or failed) is at least `maxAgeMs` ago. */
    _due(entry) {
        const settledAt = Math.max(entry.updatedAt ?? Number.NEGATIVE_INFINITY, entry.failedAt ?? Number.NEGATIVE_INFINITY);
        return this._now() - settledAt >= entry.freshness.maxAgeMs;
    }
    _handle(key, entry, fetcher, options) {
        return new Handle(entry.snapshot, entry.freshness, this._now, entry.request?.done, () => this._start(key, this._register(key, fetcher, options)).done);
    }
    /** Starts a request for `entry`, replacing a running one. */
    _start(key, entry) {
        const fetcher = entry.fetcher;
        const previous = entry.request;
        const request = new InFlight();
        entry.request = request;
        if (previous) {
            previous.controller.abort();
            previous.finish(request.done);
        }
        this._publish(key, entry);
        void this._run(key, entry, request, fetcher);
        return request;
    }
    async _run(key, entry, request, fetcher) {
        let data;
        try {
            data = await fetcher(request.controller.signal);
        }
        catch (error) {
            if (entry.request !== request)
                return; // replaced or cleared meanwhile: this answer no longer matters
            entry.request = undefined;
            entry.error = error === undefined ? new Error("The request failed.") : error;
            entry.failedAt = this._now();
            this._publish(key, entry);
            request.finish(entry.snapshot);
            return;
        }
        if (entry.request !== request)
            return;
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
    _publish(key, entry) {
        entry.snapshot = new Snapshot(entry.data, entry.error, entry.request !== undefined, entry.updatedAt, entry.freshness, this._now);
        for (const callback of [...entry.listeners]) {
            if (!entry.listeners.has(callback))
                continue; // unsubscribed by an earlier subscriber just now
            try {
                callback(entry.snapshot);
            }
            catch (error) {
                console.error(`lucent-ha: a subscriber to swr key "${key}" threw.`, error);
            }
        }
    }
    /** Brings back a stored copy that is younger than `maxAgeMs`, if there is no data in memory yet. */
    _restore(key, entry, maxAgeMs) {
        entry.restored = true;
        if (!this._storage || entry.data !== undefined)
            return;
        const stored = readStored(this._storage, key);
        if (!stored)
            return;
        if (this._now() - stored.at < maxAgeMs) {
            entry.data = stored.data;
            entry.updatedAt = stored.at;
            this._publish(key, entry);
        }
        else {
            this._removeStored(key);
        }
    }
    _markDirty(key, entry) {
        if (!entry.persist || !this._storage)
            return;
        this._dirty.add(key);
        this._writeTimer ??= this._scheduler.setTimeout(() => this._flush(), PERSIST_DELAY_MS);
    }
    _flush() {
        const storage = this._storage;
        const keys = [...this._dirty];
        this._dirty.clear();
        this._writeTimer = null;
        if (!storage)
            return;
        for (const key of keys) {
            const entry = this._entries.get(key);
            if (!entry?.persist)
                continue;
            try {
                if (entry.data === undefined)
                    storage.removeItem(STORAGE_PREFIX + key);
                else
                    storage.setItem(STORAGE_PREFIX + key, JSON.stringify({ at: entry.updatedAt, data: entry.data }));
            }
            catch {
                // Storage is full or blocked, or the data cannot be written as JSON: the screen works the same without the copy.
            }
        }
    }
    /** Removes the stored copy of `key`, or every stored copy when called without a key. */
    _removeStored(key) {
        const storage = this._storage;
        if (!storage)
            return;
        try {
            if (key !== undefined) {
                storage.removeItem(STORAGE_PREFIX + key);
                return;
            }
            const ours = [];
            for (let index = 0; index < storage.length; index++) {
                const name = storage.key(index);
                if (name?.startsWith(STORAGE_PREFIX))
                    ours.push(name);
            }
            for (const name of ours)
                storage.removeItem(name);
        }
        catch {
            // Storage is blocked: there is nothing stored to remove.
        }
    }
}
function readStored(storage, key) {
    try {
        const raw = storage.getItem(STORAGE_PREFIX + key);
        if (raw === null)
            return undefined;
        const record = JSON.parse(raw);
        if (record && typeof record.at === "number" && record.data !== undefined)
            return { at: record.at, data: record.data };
    }
    catch {
        // Unreadable or corrupt copy: treated as no copy.
    }
    return undefined;
}
/** Makes a cache of its own, for tests or for an app that wants its data apart from the shared cache. */
export function createSwrCache(options = {}) {
    return new Cache(options);
}
let shared;
/** The cache behind `swr`, `readSwr` and the other functions below. Made on first use (never at import), with
 * `localStorage` for `persist` when the browser allows it. */
function sharedCache() {
    if (!shared) {
        let storage;
        try {
            storage = typeof localStorage === "undefined" ? undefined : localStorage;
        }
        catch {
            storage = undefined; // blocked storage (private mode, sandboxed frame) throws when touched
        }
        shared = new Cache({ storage });
    }
    return shared;
}
/** Shows the last good answer for `key` at once and fetches a fresh one when it is old (or missing). */
export function swr(key, fetcher, options) {
    return sharedCache().swr(key, fetcher, options);
}
/** The shared cache's snapshot for `key`, without fetching. */
export function readSwr(key) {
    return sharedCache().read(key);
}
/** Calls `callback` after every change of `key` in the shared cache. Returns the function that stops it. */
export function subscribeSwr(key, callback) {
    return sharedCache().subscribe(key, callback);
}
/** Replaces the shared cache's data for `key` now (an optimistic update); see `SwrCache.mutate`. */
export function mutateSwr(key, updater) {
    return sharedCache().mutate(key, updater);
}
/** Forgets `key` in the shared cache, or everything when called without a key. Call it on sign-out. */
export function clearSwr(key) {
    sharedCache().clear(key);
}
