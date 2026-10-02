/** The hold-to-confirm gesture as plain functions of time. Pure (no DOM, no timers, no lit): every function takes
 * `now` (ms), so tests drive it with numbers and the element drives it with `performance.now()`.
 *
 * Phases: idle -> charging (button held) -> completed (held long enough, fires once)
 *                                         -> draining (let go early; the charge runs back)
 * A press let go inside `TAP_MAX_MS` is a tap: the element offers the ordinary Cancel / Confirm instead. */
/** Lucent: a hold lasts 1500 ms (`--lu-hold`). */
export const HOLD_DURATION_MS = 1500;
export const HOLD_DRAIN_MS = 400;
/** A press let go sooner than this is a tap, not an abandoned hold. */
export const TAP_MAX_MS = 350;
export const HOLD_DEFAULTS = { durationMs: HOLD_DURATION_MS, drainMs: HOLD_DRAIN_MS };
export const HOLD_IDLE = { phase: "idle", since: 0, from: 0, pressedAt: 0 };
/** Charge 0..1 at `now`. */
export function holdProgress(state, now, config) {
    const elapsed = Math.max(0, now - state.since);
    switch (state.phase) {
        case "charging":
            return Math.min(1, state.from + elapsed / config.durationMs);
        case "draining":
            return Math.max(0, state.from - elapsed / config.drainMs);
        case "completed":
            return 1;
        default:
            return 0;
    }
}
/** Milliseconds until a charging press completes (0 when not charging). */
export function holdRemainingMs(state, now, config) {
    if (state.phase !== "charging")
        return 0;
    return Math.max(0, (1 - holdProgress(state, now, config)) * config.durationMs);
}
/** Milliseconds until a draining charge reaches nothing (0 when not draining). */
export function holdDrainRemainingMs(state, now, config) {
    if (state.phase !== "draining")
        return 0;
    return Math.max(0, holdProgress(state, now, config) * config.drainMs);
}
/** Pointer or key goes down. A press during a drain continues from the charge it had reached. Ignored while charging or completed. */
export function holdPress(state, now, config) {
    if (state.phase === "charging" || state.phase === "completed")
        return state;
    return { phase: "charging", since: now, from: holdProgress(state, now, config), pressedAt: now };
}
/** Moves a press that has run its course into `completed` (charging at 100%) or `idle` (drained to nothing). */
export function holdSettle(state, now, config) {
    if (state.phase === "charging" && holdProgress(state, now, config) >= 1)
        return { ...state, phase: "completed", since: now, from: 1 };
    if (state.phase === "draining" && holdProgress(state, now, config) <= 0)
        return HOLD_IDLE;
    return state;
}
/** The press ended: the charge drains. `tap` is true when the press was short enough to count as a tap. For a
 * cancel (pointer cancelled, key released elsewhere, focus or page visibility lost, finger slid off) use `.state`
 * and ignore `tap`. A press that had already run its full course is `completed` first, so letting go exactly at
 * the end still confirms. */
export function holdRelease(state, now, config) {
    const settled = holdSettle(state, now, config);
    if (settled.phase !== "charging")
        return { state: settled, tap: false };
    return {
        state: { phase: "draining", since: now, from: holdProgress(settled, now, config), pressedAt: settled.pressedAt },
        tap: now - settled.pressedAt < TAP_MAX_MS,
    };
}
