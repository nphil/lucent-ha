import type { Scheduler } from "../core/throttle.js";
export type ToastKind = "info" | "success" | "error";
/** What to tell the user. `onAction` + `actionLabel` together make an action button (Undo, Retry). */
export interface ToastOptions {
    message: string;
    /** Icon + colour: `info` (default, no icon), `success` (check), `error` (alert; stays longer). */
    kind?: ToastKind;
    /** Text of the action button. Without `onAction` there is no button. */
    actionLabel?: string;
    /** Runs once when the action button is pressed; the toast closes first. */
    onAction?(): void;
    /** Milliseconds on screen. Default 4000 (error 8000); a toast with an action stays at least 5000. 0 = until dismissed. */
    durationMs?: number;
    /** A second toast with the same id replaces the first (shown or waiting) instead of queueing behind it. */
    id?: string;
}
/** Returned by `showToast` / `LuToast.show`: close that one toast, wherever it is (shown or waiting). */
export interface ToastHandle {
    readonly id: string;
    dismiss(): void;
}
/** The toast on screen, as the element draws it. */
export interface ShownToast {
    readonly id: string;
    readonly message: string;
    readonly kind: ToastKind;
    /** Text of the action button, "" when the toast has no usable action. */
    readonly actionLabel: string;
    /** Resolved time on screen in ms; 0 = until dismissed. */
    readonly durationMs: number;
    /** Changes every time a toast is shown or replaced, so a view can restart its enter motion. */
    readonly generation: number;
}
/** Times on screen (ms). A toast with an action is Lucent's Undo: at least 5 s. */
export declare const TOAST_DURATION: {
    readonly standard: 4000;
    readonly action: 5000;
    readonly error: 8000;
};
/** A fresh toast id. One counter for the whole page, so ids from different callers never collide. */
export declare function nextToastId(): string;
/** The time a toast stays: the default for its kind, an explicit `durationMs` (0 or Infinity = until dismissed), and never
 * less than 5 s when it carries an action. */
export declare function resolveToastDuration(kind: ToastKind | undefined, durationMs: number | undefined, hasAction: boolean): number;
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
export declare class ToastQueue {
    private readonly _scheduler;
    private readonly _onChange;
    private _current;
    private _waiting;
    private _generation;
    private _timer;
    private _deadline;
    private _remaining;
    private readonly _holds;
    constructor(options?: {
        scheduler?: Scheduler;
        onChange?: (current: ShownToast | null) => void;
    });
    /** The toast on screen, or null. */
    get current(): ShownToast | null;
    /** How many toasts are waiting behind the one on screen. */
    get pending(): number;
    /** Shows `options` now, or queues it behind the toast on screen. A toast without a message is ignored. */
    show(options: ToastOptions): ToastHandle;
    /** Closes the toast with this id (the one on screen, or a waiting one); with no id, the one on screen. */
    dismiss(id?: string): void;
    /** Holds the clock for `source` ("pointer", "focus", ...). The time left is kept until every source has let go. */
    pause(source: string): void;
    resume(source: string): void;
    /** Runs the action of the toast on screen (Undo): the toast closes, then the callback runs, once. Returns whether it ran. */
    runAction(): boolean;
    /** Takes every toast that is not finished (the one on screen, then the waiting ones) out of the queue, as options that
     * can be shown again somewhere else: a sheet hands its toasts to the page when it closes. Their time starts again. */
    takeAll(): ToastOptions[];
    /** Drops the toast on screen and everything waiting, and stops the clock. */
    clear(): void;
    private _present;
    private _closeCurrent;
    private _arm;
    private _clearTimer;
}
