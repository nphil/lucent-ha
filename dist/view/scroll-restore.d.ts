/** Puts a scroller back at a remembered offset when a view comes back (Kestrel's restore, made reusable).
 *
 * A view that comes back is often still filling in: images arrive, a skeleton is replaced by rows, so the
 * page is shorter than it was and the offset cannot be reached yet. So the restorer
 *   - lands on the offset as soon as the content is tall enough, and keeps it there on every frame while the
 *     content height is still changing (until the height has been unchanged for `settleMs`),
 *   - tells the host to switch the browser's own scroll anchoring off while it works (`onActiveChange`),
 *   - stops the moment the user wheels, touches, clicks or presses a key: it never fights the user,
 *   - gives up after `deadlineMs` and lands as close as the content allows.
 * The top (offset 0) needs none of that: one jump, no holding. */
/** The scroller as the restorer sees it. */
export interface RestoreScroller {
    readonly top: number;
    scrollTo(top: number): void;
    /** The largest offset the content allows right now (content height minus visible height). It grows while
     * content loads; `Infinity` when it cannot be measured. */
    maxTop(): number;
}
/** The browser, as the restorer sees it (replaced by a fake clock and frames in tests). */
export interface RestoreEnv {
    /** Milliseconds on a monotonic clock. */
    now(): number;
    /** Calls back once before the next paint. Returns the function that cancels it. */
    frame(callback: () => void): () => void;
    /** Calls back whenever the user wheels, touches, clicks or presses a key. Returns the stop function. */
    onUserInput(callback: () => void): () => void;
}
/** The content height must stay unchanged this long (ms) before a restore counts as done. */
export declare const SETTLE_MS = 160;
/** A restore that is still going after this long (ms) gives up. */
export declare const DEADLINE_MS = 1500;
export interface ScrollRestorerOptions {
    env?: RestoreEnv;
    settleMs?: number;
    deadlineMs?: number;
    /** Called with `true` when a restore starts holding the offset and with `false` when it ends, for any reason. */
    onActiveChange?: (active: boolean) => void;
}
/** The real browser: `performance.now`, `requestAnimationFrame` and capturing window listeners. */
export declare function browserRestoreEnv(): RestoreEnv;
export declare class ScrollRestorer {
    private readonly _env;
    private readonly _settleMs;
    private readonly _deadlineMs;
    private readonly _onActiveChange?;
    private _run;
    constructor(options?: ScrollRestorerOptions);
    /** True while an offset is being held. */
    get active(): boolean;
    /** Brings `scroller` to `target` px (a negative or non-finite target means the top), replacing any restore
     * that is still running. Lands immediately when the content is already tall enough, so the first paint
     * after a view switch is already in the right place. */
    begin(scroller: RestoreScroller, target: number): void;
    /** Stops holding the offset. Returns the offset that was still being restored, or `null` when no restore
     * was running (or the user ended it by scrolling, in which case the scroller's own position is the truth). */
    cancel(): number | null;
    private _step;
}
