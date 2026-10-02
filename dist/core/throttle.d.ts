/** Injectable clock + a leading/trailing throttle. Everything time-based takes a
 * `Scheduler` so tests drive it with a fake clock instead of real timers. */
export interface Scheduler {
    now(): number;
    setTimeout(callback: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
}
export declare const realScheduler: Scheduler;
export interface Throttled<A extends unknown[]> {
    (...args: A): void;
    /** Send the pending call now (used when a drag ends, so the final value is never held back). */
    flush(): void;
    /** Drop the pending call. */
    cancel(): void;
    readonly pending: boolean;
}
/** Calls `fn` at most once per `intervalMs`: the first call goes out immediately, calls arriving
 * inside the window collapse to the LAST one, sent when the window closes. Successive sends are
 * always at least `intervalMs` apart, so 250 ms means never more than 4 per second. */
export declare function throttle<A extends unknown[]>(fn: (...args: A) => void, intervalMs: number, scheduler?: Scheduler): Throttled<A>;
