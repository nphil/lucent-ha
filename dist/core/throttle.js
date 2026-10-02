/** Injectable clock + a leading/trailing throttle. Everything time-based takes a
 * `Scheduler` so tests drive it with a fake clock instead of real timers. */
export const realScheduler = {
    now: () => Date.now(),
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (handle) => globalThis.clearTimeout(handle),
};
/** Calls `fn` at most once per `intervalMs`: the first call goes out immediately, calls arriving
 * inside the window collapse to the LAST one, sent when the window closes. Successive sends are
 * always at least `intervalMs` apart, so 250 ms means never more than 4 per second. */
export function throttle(fn, intervalMs, scheduler = realScheduler) {
    let lastSent = -Infinity;
    let timer = null;
    let waiting = null;
    const send = (args) => {
        lastSent = scheduler.now();
        fn(...args);
    };
    const throttled = ((...args) => {
        const elapsed = scheduler.now() - lastSent;
        if (elapsed >= intervalMs && timer === null) {
            send(args);
            return;
        }
        waiting = args;
        if (timer !== null)
            return;
        timer = scheduler.setTimeout(() => {
            timer = null;
            const args = waiting;
            waiting = null;
            if (args)
                send(args);
        }, Math.max(0, intervalMs - elapsed));
    });
    throttled.flush = () => {
        if (timer !== null)
            scheduler.clearTimeout(timer);
        timer = null;
        const args = waiting;
        waiting = null;
        if (args)
            send(args);
    };
    throttled.cancel = () => {
        if (timer !== null)
            scheduler.clearTimeout(timer);
        timer = null;
        waiting = null;
    };
    Object.defineProperty(throttled, "pending", { get: () => waiting !== null });
    return throttled;
}
