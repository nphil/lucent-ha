/** The bookkeeping of a view stack, with no DOM: which views are kept alive, which one was shown last, which
 * ones must go when there are too many, and where each view was scrolled to. `LuViewStack` is a thin wrapper. */
export declare const DEFAULT_MAX_VIEWS = 4;
/** Scroll offsets (px) remembered per view id. */
export interface ScrollMemory {
    /** `undefined` for a view that was never left (it starts at the top). */
    get(id: string): number | undefined;
    set(id: string, top: number): void;
    delete(id: string): void;
}
/** A fresh memory. It holds at most `limit` views: when a long-running display has visited more, the ones
 * not touched for longest are forgotten and start at the top again. */
export declare function createScrollMemory(limit?: number): ScrollMemory;
/** The memory shared by every view stack that uses `key`. It lives at module level on purpose: Home
 * Assistant re-creates a custom panel when you switch panels and after it has been hidden for a while, and
 * only module state survives that. */
export declare function scrollMemoryFor(key: string): ScrollMemory;
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
export declare class ViewStackModel {
    /** Replace to switch to another namespace (what the element does when its `memory-key` changes). */
    memory: ScrollMemory;
    private _max;
    private _current;
    /** Views kept alive, least recently shown first. The showing view is always last. */
    private readonly _mounted;
    constructor(options?: ViewStackModelOptions);
    /** At least 1: the showing view always stays. */
    get max(): number;
    set max(value: number);
    /** The view that is showing, or `null`. */
    get current(): string | null;
    /** The views kept alive, least recently shown first. */
    get mounted(): readonly string[];
    /** Makes `id` the showing view. */
    show(id: string): ViewChange;
    /** Nothing shows any more (the stack's `current` was emptied). Returns the view that was showing. */
    clear(): string | null;
    /** Pushes out the least recently shown views until at most `max` are kept alive; returns them. */
    trim(): string[];
    /** The view's element left the page without being pushed out (the consumer removed it on its own): it no longer
     * counts against `max`. The showing view stays, and the remembered scroll offset is kept, as after an eviction.
     * Returns whether the view was dropped. */
    release(id: string): boolean;
    saveScroll(id: string, top: number): void;
    /** Where `id` was left; `undefined` for a view that was never left, which starts at the top. */
    scrollFor(id: string): number | undefined;
    /** The next time `id` is shown it starts at the top. */
    forgetScroll(id: string): void;
}
