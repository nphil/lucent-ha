/** The custom properties the shell sets on its host; consumers and views read them. */
export const CHROME_PROPERTIES = {
    topChrome: "--lu-top-chrome",
    bottomBar: "--lu-bottom-bar",
    railW: "--lu-rail-w",
};
/** Whole pixels, rounded UP: a fractional gap would let scrolling content peek out under the chrome. Float noise
 * below 0.01 px (56.0000001 from layout maths) does not count, and anything that is not a positive number is 0. */
export function ceilPx(value) {
    return Number.isFinite(value) && value > 0 ? Math.ceil(value - 0.01) : 0;
}
/** What to publish for a nav mode:
 * - `--lu-top-chrome`: the sticky top block as measured (so it already includes the pills row in pills mode);
 * - `--lu-bottom-bar`: everything pinned to the bottom, the same in every mode (a `bottom` strip and the home-indicator
 *   padding exist without a bottom bar);
 * - `--lu-rail-w`: the rail's width in rail mode, otherwise 0. */
export function chromeSizes(mode, measure) {
    return {
        topChrome: `${ceilPx(measure.top)}px`,
        bottomBar: `${ceilPx(measure.dock)}px`,
        railW: `${mode === "rail" ? ceilPx(measure.rail) : 0}px`,
    };
}
/** Writes `next` onto `style`, touching only the properties whose value changed since `previous`, so a resize
 * burst does not dirty style for nothing. `null` removes all three (the token defaults apply again). Returns what
 * is now published, to pass as `previous` next time. */
export function publishSizes(style, next, previous) {
    for (const key of Object.keys(CHROME_PROPERTIES)) {
        const name = CHROME_PROPERTIES[key];
        if (next === null) {
            if (previous !== null)
                style.removeProperty(name);
        }
        else if (previous === null || previous[key] !== next[key]) {
            style.setProperty(name, next[key]);
        }
    }
    return next;
}
