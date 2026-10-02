import { realScheduler } from "../core/throttle.js";
/** Times on screen (ms). A toast with an action is Lucent's Undo: at least 5 s. */
export const TOAST_DURATION = { standard: 4000, action: 5000, error: 8000 };
let counter = 0;
/** A fresh toast id. One counter for the whole page, so ids from different callers never collide. */
export function nextToastId() {
    counter += 1;
    return `lu-toast-${counter}`;
}
/** The time a toast stays: the default for its kind, an explicit `durationMs` (0 or Infinity = until dismissed), and never
 * less than 5 s when it carries an action. */
export function resolveToastDuration(kind, durationMs, hasAction) {
    let ms = kind === "error" ? TOAST_DURATION.error : TOAST_DURATION.standard;
    if (durationMs !== undefined && !Number.isNaN(durationMs) && durationMs >= 0) {
        if (durationMs === 0 || durationMs === Infinity)
            return 0;
        ms = durationMs;
    }
    return hasAction ? Math.max(ms, TOAST_DURATION.action) : ms;
}
/** The toast timeline, with no DOM: one toast on screen at a time, the rest wait in the order they came.
 *
 * - A toast with the same `id` as the one on screen replaces it (the time starts again); the same id as a waiting one
 *   replaces that one in its place.
 * - `pause(source)` / `resume(source)` stop and restart the clock for as long as anyone holds it (the pointer is over the
 *   toast, focus is inside it, the tab is hidden); the time left is kept, not restarted.
 * - The action runs once, after the toast has closed.
 * - Every toast on screen has a generation number; a timer that fires late for an older one never closes a newer one.
 *
 * Time comes from the injected `Scheduler`, so tests drive it with a fake clock. */
export class ToastQueue {
    constructor(options = {}) {
        this._current = null;
        this._waiting = [];
        this._generation = 0;
        this._timer = null;
        this._deadline = 0;
        this._remaining = 0;
        this._holds = new Set();
        this._scheduler = options.scheduler ?? realScheduler;
        this._onChange = options.onChange;
    }
    /** The toast on screen, or null. */
    get current() {
        return this._current?.toast ?? null;
    }
    /** How many toasts are waiting behind the one on screen. */
    get pending() {
        return this._waiting.length;
    }
    /** Shows `options` now, or queues it behind the toast on screen. A toast without a message is ignored. */
    show(options) {
        const id = options.id ?? nextToastId();
        const handle = { id, dismiss: () => this.dismiss(id) };
        if (!options.message)
            return handle;
        const label = options.actionLabel ?? "";
        const onAction = options.onAction;
        const hasAction = label !== "" && onAction !== undefined;
        const entry = {
            id,
            message: options.message,
            kind: options.kind ?? "info",
            actionLabel: hasAction ? label : "",
            onAction: hasAction ? onAction : undefined,
            durationMs: resolveToastDuration(options.kind, options.durationMs, hasAction),
        };
        if (this._current?.toast.id === id) {
            this._present(entry);
            return handle;
        }
        const waitingAt = this._waiting.findIndex((waiting) => waiting.id === id);
        if (waitingAt >= 0)
            this._waiting[waitingAt] = entry;
        else if (this._current)
            this._waiting.push(entry);
        else
            this._present(entry);
        return handle;
    }
    /** Closes the toast with this id (the one on screen, or a waiting one); with no id, the one on screen. */
    dismiss(id) {
        if (id === undefined || this._current?.toast.id === id) {
            if (this._current)
                this._closeCurrent();
            return;
        }
        this._waiting = this._waiting.filter((entry) => entry.id !== id);
    }
    /** Holds the clock for `source` ("pointer", "focus", ...). The time left is kept until every source has let go. */
    pause(source) {
        if (this._holds.has(source))
            return;
        const wasRunning = this._holds.size === 0;
        this._holds.add(source);
        if (wasRunning && this._timer !== null) {
            this._remaining = Math.max(0, this._deadline - this._scheduler.now());
            this._clearTimer();
        }
    }
    resume(source) {
        if (!this._holds.delete(source) || this._holds.size > 0)
            return;
        if (this._current && this._current.toast.durationMs > 0)
            this._arm(this._remaining);
    }
    /** Runs the action of the toast on screen (Undo): the toast closes, then the callback runs, once. Returns whether it ran. */
    runAction() {
        const action = this._current?.entry.onAction;
        if (!action)
            return false;
        // The toast is gone before the callback runs, so pressing Undo twice can never run it twice.
        this._closeCurrent();
        action();
        return true;
    }
    /** Takes every toast that is not finished (the one on screen, then the waiting ones) out of the queue, as options that
     * can be shown again somewhere else: a sheet hands its toasts to the page when it closes. Their time starts again. */
    takeAll() {
        const taken = this._current ? [this._current.entry, ...this._waiting] : [...this._waiting];
        this.clear();
        return taken.map((entry) => ({ id: entry.id, message: entry.message, kind: entry.kind, actionLabel: entry.actionLabel, onAction: entry.onAction, durationMs: entry.durationMs }));
    }
    /** Drops the toast on screen and everything waiting, and stops the clock. */
    clear() {
        this._clearTimer();
        this._waiting = [];
        this._holds.clear();
        if (this._current) {
            this._current = null;
            this._onChange?.(null);
        }
    }
    _present(entry) {
        this._clearTimer();
        this._generation += 1;
        this._current = {
            toast: { id: entry.id, message: entry.message, kind: entry.kind, actionLabel: entry.actionLabel, durationMs: entry.durationMs, generation: this._generation },
            entry,
        };
        this._remaining = entry.durationMs;
        if (entry.durationMs > 0 && this._holds.size === 0)
            this._arm(entry.durationMs);
        this._onChange?.(this._current.toast);
    }
    _closeCurrent() {
        this._clearTimer();
        this._current = null;
        const next = this._waiting.shift();
        if (next)
            this._present(next);
        else
            this._onChange?.(null);
    }
    _arm(ms) {
        this._clearTimer();
        const generation = this._generation;
        this._deadline = this._scheduler.now() + ms;
        this._timer = this._scheduler.setTimeout(() => {
            if (this._current?.toast.generation !== generation)
                return;
            this._timer = null;
            this._closeCurrent();
        }, ms);
    }
    _clearTimer() {
        if (this._timer === null)
            return;
        this._scheduler.clearTimeout(this._timer);
        this._timer = null;
    }
}
