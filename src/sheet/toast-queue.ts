import { realScheduler } from "../core/throttle.ts";
import type { Scheduler } from "../core/throttle.ts";

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
export const TOAST_DURATION = { standard: 4000, action: 5000, error: 8000 } as const;

let counter = 0;

/** A fresh toast id. One counter for the whole page, so ids from different callers never collide. */
export function nextToastId(): string {
  counter += 1;
  return `lu-toast-${counter}`;
}

/** The time a toast stays: the default for its kind, an explicit `durationMs` (0 or Infinity = until dismissed), and never
 * less than 5 s when it carries an action. */
export function resolveToastDuration(kind: ToastKind | undefined, durationMs: number | undefined, hasAction: boolean): number {
  let ms: number = kind === "error" ? TOAST_DURATION.error : TOAST_DURATION.standard;
  if (durationMs !== undefined && !Number.isNaN(durationMs) && durationMs >= 0) {
    if (durationMs === 0 || durationMs === Infinity) return 0;
    ms = durationMs;
  }
  return hasAction ? Math.max(ms, TOAST_DURATION.action) : ms;
}

interface Entry {
  id: string;
  message: string;
  kind: ToastKind;
  actionLabel: string;
  onAction: (() => void) | undefined;
  durationMs: number;
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
  private readonly _scheduler: Scheduler;
  private readonly _onChange: ((current: ShownToast | null) => void) | undefined;
  private _current: { toast: ShownToast; entry: Entry } | null = null;
  private _waiting: Entry[] = [];
  private _generation = 0;
  private _timer: unknown = null;
  private _deadline = 0;
  private _remaining = 0;
  private readonly _holds = new Set<string>();

  constructor(options: { scheduler?: Scheduler; onChange?: (current: ShownToast | null) => void } = {}) {
    this._scheduler = options.scheduler ?? realScheduler;
    this._onChange = options.onChange;
  }

  /** The toast on screen, or null. */
  get current(): ShownToast | null {
    return this._current?.toast ?? null;
  }

  /** How many toasts are waiting behind the one on screen. */
  get pending(): number {
    return this._waiting.length;
  }

  /** Shows `options` now, or queues it behind the toast on screen. A toast without a message is ignored. */
  show(options: ToastOptions): ToastHandle {
    const id = options.id ?? nextToastId();
    const handle: ToastHandle = { id, dismiss: () => this.dismiss(id) };
    if (!options.message) return handle;
    const label = options.actionLabel ?? "";
    const onAction = options.onAction;
    const hasAction = label !== "" && onAction !== undefined;
    const entry: Entry = {
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
    if (waitingAt >= 0) this._waiting[waitingAt] = entry;
    else if (this._current) this._waiting.push(entry);
    else this._present(entry);
    return handle;
  }

  /** Closes the toast with this id (the one on screen, or a waiting one); with no id, the one on screen. */
  dismiss(id?: string): void {
    if (id === undefined || this._current?.toast.id === id) {
      if (this._current) this._closeCurrent();
      return;
    }
    this._waiting = this._waiting.filter((entry) => entry.id !== id);
  }

  /** Holds the clock for `source` ("pointer", "focus", ...). The time left is kept until every source has let go. */
  pause(source: string): void {
    if (this._holds.has(source)) return;
    const wasRunning = this._holds.size === 0;
    this._holds.add(source);
    if (wasRunning && this._timer !== null) {
      this._remaining = Math.max(0, this._deadline - this._scheduler.now());
      this._clearTimer();
    }
  }

  resume(source: string): void {
    if (!this._holds.delete(source) || this._holds.size > 0) return;
    if (this._current && this._current.toast.durationMs > 0) this._arm(this._remaining);
  }

  /** Runs the action of the toast on screen (Undo): the toast closes, then the callback runs, once. Returns whether it ran. */
  runAction(): boolean {
    const action = this._current?.entry.onAction;
    if (!action) return false;
    // The toast is gone before the callback runs, so pressing Undo twice can never run it twice.
    this._closeCurrent();
    action();
    return true;
  }

  /** Takes every toast that is not finished (the one on screen, then the waiting ones) out of the queue, as options that
   * can be shown again somewhere else: a sheet hands its toasts to the page when it closes. Their time starts again. */
  takeAll(): ToastOptions[] {
    const taken = this._current ? [this._current.entry, ...this._waiting] : [...this._waiting];
    this.clear();
    return taken.map((entry) => ({ id: entry.id, message: entry.message, kind: entry.kind, actionLabel: entry.actionLabel, onAction: entry.onAction, durationMs: entry.durationMs }));
  }

  /** Drops the toast on screen and everything waiting, and stops the clock. */
  clear(): void {
    this._clearTimer();
    this._waiting = [];
    this._holds.clear();
    if (this._current) {
      this._current = null;
      this._onChange?.(null);
    }
  }

  private _present(entry: Entry): void {
    this._clearTimer();
    this._generation += 1;
    this._current = {
      toast: { id: entry.id, message: entry.message, kind: entry.kind, actionLabel: entry.actionLabel, durationMs: entry.durationMs, generation: this._generation },
      entry,
    };
    this._remaining = entry.durationMs;
    if (entry.durationMs > 0 && this._holds.size === 0) this._arm(entry.durationMs);
    this._onChange?.(this._current.toast);
  }

  private _closeCurrent(): void {
    this._clearTimer();
    this._current = null;
    const next = this._waiting.shift();
    if (next) this._present(next);
    else this._onChange?.(null);
  }

  private _arm(ms: number): void {
    this._clearTimer();
    const generation = this._generation;
    this._deadline = this._scheduler.now() + ms;
    this._timer = this._scheduler.setTimeout(() => {
      if (this._current?.toast.generation !== generation) return;
      this._timer = null;
      this._closeCurrent();
    }, ms);
  }

  private _clearTimer(): void {
    if (this._timer === null) return;
    this._scheduler.clearTimeout(this._timer);
    this._timer = null;
  }
}
