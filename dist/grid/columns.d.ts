/** The column maths of `lu-grid`, written down once so tests and specimens can check the browser against it.
 *
 * The grid is `repeat(auto-fill, minmax(min(<min>, <floor-share>), 1fr))` on the grid's OWN width: as many
 * columns as fit, never fewer than one. `minColumns` is the "pair floor": a grid of small tiles (species) keeps
 * at least that many columns even when `min` would not fit twice, by letting the tile shrink below `min`. */
export interface ColumnOptions {
    /** Columns that always fit, shrinking the tile below `min` if needed. Default 1. */
    minColumns?: number;
    /** The grid never grows wider than this (px). Default: no cap. */
    contentMax?: number;
}
/** The width the grid actually gets: the container, capped by `contentMax`. */
export declare function gridWidth(containerWidth: number, contentMax?: number): number;
/** How many columns `lu-grid` shows in a container `containerWidth` px wide, for tiles of at least `min` px with
 * `gap` px between them. At least 1, whatever the numbers. */
export declare function tileColumns(containerWidth: number, min: number, gap: number, options?: ColumnOptions): number;
/** The width of one tile (px): the free width split evenly between the columns, never above `tileMax`. */
export declare function tileWidth(containerWidth: number, min: number, gap: number, options?: ColumnOptions & {
    tileMax?: number;
}): number;
