/** The bookkeeping of a view stack, with no DOM: which views are kept alive, which one was shown last, which
 * ones must go when there are too many, and where each view was scrolled to. `LuViewStack` is a thin wrapper. */
export const DEFAULT_MAX_VIEWS = 4;
const SCROLL_MEMORY_LIMIT = 64;
/** A fresh memory. It holds at most `limit` views: when a long-running display has visited more, the ones
 * not touched for longest are forgotten and start at the top again. */
export function createScrollMemory(limit = SCROLL_MEMORY_LIMIT) {
    const offsets = new Map();
    return {
        get: (id) => offsets.get(id),
        set(id, top) {
            if (!Number.isFinite(top))
                return;
            offsets.delete(id); // setting it again makes it the newest entry
            offsets.set(id, Math.max(0, top));
            if (offsets.size > limit) {
                const oldest = offsets.keys().next();
                if (!oldest.done)
                    offsets.delete(oldest.value);
            }
        },
        delete(id) {
            offsets.delete(id);
        },
    };
}
const memories = new Map();
/** The memory shared by every view stack that uses `key`. It lives at module level on purpose: Home
 * Assistant re-creates a custom panel when you switch panels and after it has been hidden for a while, and
 * only module state survives that. */
export function scrollMemoryFor(key) {
    let memory = memories.get(key);
    if (!memory)
        memories.set(key, (memory = createScrollMemory()));
    return memory;
}
export class ViewStackModel {
    constructor(options = {}) {
        this._max = DEFAULT_MAX_VIEWS;
        this._current = null;
        /** Views kept alive, least recently shown first. The showing view is always last. */
        this._mounted = [];
        this.memory = options.memory ?? createScrollMemory();
        if (options.max !== undefined)
            this.max = options.max;
    }
    /** At least 1: the showing view always stays. */
    get max() {
        return this._max;
    }
    set max(value) {
        this._max = Number.isNaN(value) ? DEFAULT_MAX_VIEWS : Math.max(1, Math.floor(value));
    }
    /** The view that is showing, or `null`. */
    get current() {
        return this._current;
    }
    /** The views kept alive, least recently shown first. */
    get mounted() {
        return this._mounted;
    }
    /** Makes `id` the showing view. */
    show(id) {
        if (id === this._current)
            return { hide: null, show: id, evict: [], first: false };
        const hide = this._current;
        const at = this._mounted.indexOf(id);
        if (at >= 0)
            this._mounted.splice(at, 1);
        this._mounted.push(id);
        this._current = id;
        return { hide, show: id, evict: this.trim(), first: at < 0 };
    }
    /** Nothing shows any more (the stack's `current` was emptied). Returns the view that was showing. */
    clear() {
        const was = this._current;
        this._current = null;
        return was;
    }
    /** Pushes out the least recently shown views until at most `max` are kept alive; returns them. */
    trim() {
        return this._mounted.splice(0, Math.max(0, this._mounted.length - this._max));
    }
    /** The view's element left the page without being pushed out (the consumer removed it on its own): it no longer
     * counts against `max`. The showing view stays, and the remembered scroll offset is kept, as after an eviction.
     * Returns whether the view was dropped. */
    release(id) {
        const at = this._mounted.indexOf(id);
        if (at < 0 || id === this._current)
            return false;
        this._mounted.splice(at, 1);
        return true;
    }
    saveScroll(id, top) {
        this.memory.set(id, top);
    }
    /** Where `id` was left; `undefined` for a view that was never left, which starts at the top. */
    scrollFor(id) {
        return this.memory.get(id);
    }
    /** The next time `id` is shown it starts at the top. */
    forgetScroll(id) {
        this.memory.delete(id);
    }
}
