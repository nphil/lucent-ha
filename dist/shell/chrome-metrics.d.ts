/** What the shell publishes about its own chrome, and the rule for it. Pure (no `lit`, no DOM): the measuring
 * itself lives in `chrome-meter.ts`. */
import type { NavMode } from "../tokens/profile-model.js";
/** Measured sizes (CSS px) of the pieces of chrome the shell renders. A piece that is not rendered is 0. */
export interface ChromeMeasure {
    /** The whole sticky top block: the app bar (with the safe-area padding above it), its edge line and, in pills
     * mode, the pills row under it. */
    top: number;
    /** The width of the left rail (rail mode). */
    rail: number;
    /** Everything pinned to the bottom: the `bottom` strip, the bottom bar and the safe-area padding under them. */
    dock: number;
}
/** CSS values for the three custom properties published on the shell host. */
export interface ChromeSizes {
    topChrome: string;
    bottomBar: string;
    railW: string;
}
/** The custom properties the shell sets on its host; consumers and views read them. */
export declare const CHROME_PROPERTIES: Readonly<Record<keyof ChromeSizes, string>>;
/** Whole pixels, rounded UP: a fractional gap would let scrolling content peek out under the chrome. Float noise
 * below 0.01 px (56.0000001 from layout maths) does not count, and anything that is not a positive number is 0. */
export declare function ceilPx(value: number): number;
/** What to publish for a nav mode:
 * - `--lu-top-chrome`: the sticky top block as measured (so it already includes the pills row in pills mode);
 * - `--lu-bottom-bar`: everything pinned to the bottom, the same in every mode (a `bottom` strip and the home-indicator
 *   padding exist without a bottom bar);
 * - `--lu-rail-w`: the rail's width in rail mode, otherwise 0. */
export declare function chromeSizes(mode: NavMode, measure: ChromeMeasure): ChromeSizes;
/** The part of `CSSStyleDeclaration` that publishing needs (a fake in tests). */
export interface StyleTarget {
    setProperty(name: string, value: string): void;
    removeProperty(name: string): unknown;
}
/** Writes `next` onto `style`, touching only the properties whose value changed since `previous`, so a resize
 * burst does not dirty style for nothing. `null` removes all three (the token defaults apply again). Returns what
 * is now published, to pass as `previous` next time. */
export declare function publishSizes(style: StyleTarget, next: ChromeSizes | null, previous: ChromeSizes | null): ChromeSizes | null;
