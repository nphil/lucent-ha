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
export const SETTLE_MS = 160;
/** A restore that is still going after this long (ms) gives up. */
export const DEADLINE_MS = 1500;

export interface ScrollRestorerOptions {
  env?: RestoreEnv;
  settleMs?: number;
  deadlineMs?: number;
  /** Called with `true` when a restore starts holding the offset and with `false` when it ends, for any reason. */
  onActiveChange?: (active: boolean) => void;
}

const USER_INPUT_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

/** The real browser: `performance.now`, `requestAnimationFrame` and capturing window listeners. */
export function browserRestoreEnv(): RestoreEnv {
  return {
    now: () => performance.now(),
    frame(callback) {
      const id = requestAnimationFrame(callback);
      return () => cancelAnimationFrame(id);
    },
    onUserInput(callback) {
      for (const name of USER_INPUT_EVENTS) window.addEventListener(name, callback, { capture: true, passive: true });
      return () => {
        for (const name of USER_INPUT_EVENTS) window.removeEventListener(name, callback, { capture: true });
      };
    },
  };
}

interface Run {
  readonly scroller: RestoreScroller;
  readonly target: number;
  readonly deadline: number;
  /** The `maxTop` seen on the previous frame, and since when it has not changed. */
  lastMax: number;
  stableSince: number;
  cancelFrame?: () => void;
  stopInput: () => void;
}

export class ScrollRestorer {
  private readonly _env: RestoreEnv;
  private readonly _settleMs: number;
  private readonly _deadlineMs: number;
  private readonly _onActiveChange?: (active: boolean) => void;
  private _run: Run | null = null;

  constructor(options: ScrollRestorerOptions = {}) {
    this._env = options.env ?? browserRestoreEnv();
    this._settleMs = options.settleMs ?? SETTLE_MS;
    this._deadlineMs = options.deadlineMs ?? DEADLINE_MS;
    this._onActiveChange = options.onActiveChange;
  }

  /** True while an offset is being held. */
  get active(): boolean {
    return this._run !== null;
  }

  /** Brings `scroller` to `target` px (a negative or non-finite target means the top), replacing any restore
   * that is still running. Lands immediately when the content is already tall enough, so the first paint
   * after a view switch is already in the right place. */
  begin(scroller: RestoreScroller, target: number): void {
    this.cancel();
    const wanted = Number.isFinite(target) ? Math.max(0, target) : 0;
    if (wanted === 0) {
      if (scroller.top !== 0) scroller.scrollTo(0);
      return;
    }
    const now = this._env.now();
    const run: Run = {
      scroller,
      target: wanted,
      deadline: now + this._deadlineMs,
      lastMax: Number.NaN,
      stableSince: now,
      stopInput: this._env.onUserInput(() => this.cancel()),
    };
    this._run = run;
    this._onActiveChange?.(true);
    this._step(run);
  }

  /** Stops holding the offset. Returns the offset that was still being restored, or `null` when no restore
   * was running (or the user ended it by scrolling, in which case the scroller's own position is the truth). */
  cancel(): number | null {
    const run = this._run;
    if (!run) return null;
    this._run = null;
    run.cancelFrame?.();
    run.stopInput();
    this._onActiveChange?.(false);
    return run.target;
  }

  private _step(run: Run): void {
    if (this._run !== run) return;
    const now = this._env.now();
    const max = run.scroller.maxTop();
    if (max !== run.lastMax) {
      run.lastMax = max;
      run.stableSince = now;
    }
    const reachable = run.target <= max + 1;
    if (reachable && Math.abs(run.scroller.top - run.target) > 0.5) run.scroller.scrollTo(run.target);
    const settled = reachable && now - run.stableSince >= this._settleMs;
    if (settled || now > run.deadline) {
      if (!reachable) run.scroller.scrollTo(max);
      this.cancel();
      return;
    }
    run.cancelFrame = this._env.frame(() => this._step(run));
  }
}
