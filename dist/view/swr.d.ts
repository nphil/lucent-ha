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
import type { Scheduler } from "../core/throttle.js";
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
    persist?: {
        maxAgeMs: number;
    };
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
/** Makes a cache of its own, for tests or for an app that wants its data apart from the shared cache. */
export declare function createSwrCache(options?: SwrCacheOptions): SwrCache;
/** Shows the last good answer for `key` at once and fetches a fresh one when it is old (or missing). */
export declare function swr<T>(key: string, fetcher: SwrFetcher<T>, options?: SwrOptions): SwrHandle<T>;
/** The shared cache's snapshot for `key`, without fetching. */
export declare function readSwr<T>(key: string): SwrSnapshot<T>;
/** Calls `callback` after every change of `key` in the shared cache. Returns the function that stops it. */
export declare function subscribeSwr<T>(key: string, callback: (snapshot: SwrSnapshot<T>) => void): () => void;
/** Replaces the shared cache's data for `key` now (an optimistic update); see `SwrCache.mutate`. */
export declare function mutateSwr<T>(key: string, updater: (current: T | undefined) => T): SwrSnapshot<T>;
/** Forgets `key` in the shared cache, or everything when called without a key. Call it on sign-out. */
export declare function clearSwr(key?: string): void;
