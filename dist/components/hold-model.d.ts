/** The hold-to-confirm gesture as plain functions of time. Pure (no DOM, no timers, no lit): every function takes
 * `now` (ms), so tests drive it with numbers and the element drives it with `performance.now()`.
 *
 * Phases: idle -> charging (button held) -> completed (held long enough, fires once)
 *                                         -> draining (let go early; the charge runs back)
 * A press let go inside `TAP_MAX_MS` is a tap: the element offers the ordinary Cancel / Confirm instead. */
export type HoldPhase = "idle" | "charging" | "draining" | "completed";
export interface HoldConfig {
    /** How long the button must be held (ms). */
    durationMs: number;
    /** How long a FULL charge takes to drain back to nothing (ms); a partial charge drains in proportion. */
    drainMs: number;
}
export interface HoldState {
    readonly phase: HoldPhase;
    /** When this phase began (ms). */
    readonly since: number;
    /** The charge (0..1) when this phase began. */
    readonly from: number;
    /** When the current press began (ms), for the tap test. */
    readonly pressedAt: number;
}
/** Lucent: a hold lasts 1500 ms (`--lu-hold`). */
export declare const HOLD_DURATION_MS = 1500;
export declare const HOLD_DRAIN_MS = 400;
/** A press let go sooner than this is a tap, not an abandoned hold. */
export declare const TAP_MAX_MS = 350;
export declare const HOLD_DEFAULTS: HoldConfig;
export declare const HOLD_IDLE: HoldState;
/** Charge 0..1 at `now`. */
export declare function holdProgress(state: HoldState, now: number, config: HoldConfig): number;
/** Milliseconds until a charging press completes (0 when not charging). */
export declare function holdRemainingMs(state: HoldState, now: number, config: HoldConfig): number;
/** Milliseconds until a draining charge reaches nothing (0 when not draining). */
export declare function holdDrainRemainingMs(state: HoldState, now: number, config: HoldConfig): number;
/** Pointer or key goes down. A press during a drain continues from the charge it had reached. Ignored while charging or completed. */
export declare function holdPress(state: HoldState, now: number, config: HoldConfig): HoldState;
/** Moves a press that has run its course into `completed` (charging at 100%) or `idle` (drained to nothing). */
export declare function holdSettle(state: HoldState, now: number, config: HoldConfig): HoldState;
/** The press ended: the charge drains. `tap` is true when the press was short enough to count as a tap. For a
 * cancel (pointer cancelled, key released elsewhere, focus or page visibility lost, finger slid off) use `.state`
 * and ignore `tap`. A press that had already run its full course is `completed` first, so letting go exactly at
 * the end still confirms. */
export declare function holdRelease(state: HoldState, now: number, config: HoldConfig): {
    state: HoldState;
    tap: boolean;
};
