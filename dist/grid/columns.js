import { SHELL } from "../tokens/constants.js";
/** The width the grid actually gets: the container, capped by `contentMax`. */
export function gridWidth(containerWidth, contentMax = Infinity) {
    return Math.max(0, Math.min(containerWidth, contentMax));
}
/** How many columns `lu-grid` shows in a container `containerWidth` px wide, for tiles of at least `min` px with
 * `gap` px between them. At least 1, whatever the numbers. */
export function tileColumns(containerWidth, min, gap, options = {}) {
    const width = gridWidth(containerWidth, options.contentMax);
    const minColumns = Math.max(1, options.minColumns ?? 1);
    const tile = Math.min(min, (width - (minColumns - 1) * gap) / minColumns);
    if (!(tile > 0))
        return 1;
    // Tiny epsilon: a width that exactly fits n tiles must give n even when the sum is off by float noise.
    return Math.max(1, Math.floor((width + gap) / (tile + gap) + 1e-9));
}
/** The width of one tile (px): the free width split evenly between the columns, never above `tileMax`. */
export function tileWidth(containerWidth, min, gap, options = {}) {
    const width = gridWidth(containerWidth, options.contentMax);
    const columns = tileColumns(containerWidth, min, gap, options);
    return Math.min(options.tileMax ?? SHELL.tileMax, (width - (columns - 1) * gap) / columns);
}
