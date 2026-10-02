/* Derived from music-assistant/frontend src/components/discover/EditorialShelf.vue:151-166 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md). Modified: the tile size is solved for "N and a half tiles visible" from the container width alone (MA subtracts card padding and takes tiles-per-view from the caller), and the 120/280 clamp is a parameter. */
/** Smallest and largest tile (CSS px) a rail uses unless the app says otherwise. Music Assistant's numbers. */
export const RAIL_MIN_TILE = 120;
export const RAIL_MAX_TILE = 280;
/** The width of one tile so that `perView` tiles are visible, the last one only partly: with `perView = 2.5`
 * two whole tiles, two gaps and half a tile fill `containerWidth` exactly, so the next tile peeks out and says
 * "scroll". Clamped to `min`..`max`. */
export function railTileWidth(containerWidth, gap, perView, min = RAIL_MIN_TILE, max = RAIL_MAX_TILE) {
    if (!(containerWidth > 0) || !(perView > 0))
        return min;
    const solved = (containerWidth - Math.floor(perView) * gap) / perView;
    return Math.round(Math.min(max, Math.max(min, solved)));
}
/** The N.5 (1.5, 2.5, 3.5 ...) that gives the biggest tiles not wider than `max`: a phone shows 1.5 large
 * tiles, a wall display 3.5 and a desktop 4.5 or more. When even 1.5 tiles would be wider than `max` the rail
 * shows 1.5 (and the tile is clamped to `max`); when the tiles would drop under `min` it settles for the
 * largest N.5 that still fits `min`. */
export function railPerView(containerWidth, gap, min = RAIL_MIN_TILE, max = RAIL_MAX_TILE) {
    let perView = 1.5;
    if (!(containerWidth > 0))
        return perView;
    for (;;) {
        const tile = (containerWidth - Math.floor(perView) * gap) / perView;
        if (tile <= max)
            break;
        perView += 1;
    }
    while (perView > 1.5 && (containerWidth - Math.floor(perView) * gap) / perView < min)
        perView -= 1;
    return perView;
}
/** Which tile a key moves focus to inside a rail (arrows, Home, End), or null for other keys. Does not wrap
 * (a shelf has two ends); in a right-to-left page the arrows are mirrored. */
export function railFocusIndex(key, current, count, rtl = false) {
    if (count <= 0)
        return null;
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (key === forward)
        return Math.min(count - 1, current + 1);
    if (key === back)
        return Math.max(0, current - 1);
    if (key === "Home")
        return 0;
    if (key === "End")
        return count - 1;
    return null;
}
