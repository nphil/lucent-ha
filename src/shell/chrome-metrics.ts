/** What the shell publishes about its own chrome, and the rule for it. Pure (no `lit`, no DOM): the measuring
 * itself lives in `chrome-meter.ts`. */
import type { NavMode } from "../tokens/profile-model.ts";

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
export const CHROME_PROPERTIES: Readonly<Record<keyof ChromeSizes, string>> = {
  topChrome: "--lu-top-chrome",
  bottomBar: "--lu-bottom-bar",
  railW: "--lu-rail-w",
};

/** Whole pixels, rounded UP: a fractional gap would let scrolling content peek out under the chrome. Float noise
 * below 0.01 px (56.0000001 from layout maths) does not count, and anything that is not a positive number is 0. */
export function ceilPx(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.ceil(value - 0.01) : 0;
}

/** What to publish for a nav mode:
 * - `--lu-top-chrome`: the sticky top block as measured (so it already includes the pills row in pills mode);
 * - `--lu-bottom-bar`: everything pinned to the bottom, the same in every mode (a `bottom` strip and the home-indicator
 *   padding exist without a bottom bar);
 * - `--lu-rail-w`: the rail's width in rail mode, otherwise 0. */
export function chromeSizes(mode: NavMode, measure: ChromeMeasure): ChromeSizes {
  return {
    topChrome: `${ceilPx(measure.top)}px`,
    bottomBar: `${ceilPx(measure.dock)}px`,
    railW: `${mode === "rail" ? ceilPx(measure.rail) : 0}px`,
  };
}

/** The part of `CSSStyleDeclaration` that publishing needs (a fake in tests). */
export interface StyleTarget {
  setProperty(name: string, value: string): void;
  removeProperty(name: string): unknown;
}

/** Writes `next` onto `style`, touching only the properties whose value changed since `previous`, so a resize
 * burst does not dirty style for nothing. `null` removes all three (the token defaults apply again). Returns what
 * is now published, to pass as `previous` next time. */
export function publishSizes(style: StyleTarget, next: ChromeSizes | null, previous: ChromeSizes | null): ChromeSizes | null {
  for (const key of Object.keys(CHROME_PROPERTIES) as Array<keyof ChromeSizes>) {
    const name = CHROME_PROPERTIES[key];
    if (next === null) {
      if (previous !== null) style.removeProperty(name);
    } else if (previous === null || previous[key] !== next[key]) {
      style.setProperty(name, next[key]);
    }
  }
  return next;
}
