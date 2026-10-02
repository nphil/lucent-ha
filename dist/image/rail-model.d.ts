/** Smallest and largest tile (CSS px) a rail uses unless the app says otherwise. Music Assistant's numbers. */
export declare const RAIL_MIN_TILE = 120;
export declare const RAIL_MAX_TILE = 280;
/** The width of one tile so that `perView` tiles are visible, the last one only partly: with `perView = 2.5`
 * two whole tiles, two gaps and half a tile fill `containerWidth` exactly, so the next tile peeks out and says
 * "scroll". Clamped to `min`..`max`. */
export declare function railTileWidth(containerWidth: number, gap: number, perView: number, min?: number, max?: number): number;
/** The N.5 (1.5, 2.5, 3.5 ...) that gives the biggest tiles not wider than `max`: a phone shows 1.5 large
 * tiles, a wall display 3.5 and a desktop 4.5 or more. When even 1.5 tiles would be wider than `max` the rail
 * shows 1.5 (and the tile is clamped to `max`); when the tiles would drop under `min` it settles for the
 * largest N.5 that still fits `min`. */
export declare function railPerView(containerWidth: number, gap: number, min?: number, max?: number): number;
/** Which tile a key moves focus to inside a rail (arrows, Home, End), or null for other keys. Does not wrap
 * (a shelf has two ends); in a right-to-left page the arrows are mirrored. */
export declare function railFocusIndex(key: string, current: number, count: number, rtl?: boolean): number | null;
