/** Sizes a server is asked for, smallest first. Matches the idea of Music Assistant's image proxy (a short
 * whitelist, so caches see few distinct URLs); the numbers are this toolkit's own. Apps with their own
 * thumbnail sizes pass `options.widths` (Kestrel: 160 / 320 / 640). */
export declare const DEFAULT_WIDTHS: readonly number[];
/** A wide-screen phone is 3x; asking for more pixels than that only wastes bytes. */
export declare const MAX_DPR = 3;
export interface SizedUrlOptions {
    /** The widths the server accepts. Default `DEFAULT_WIDTHS`. */
    widths?: readonly number[];
    /** Query parameter that carries the width. Default `width`: the one extra parameter Home Assistant's signed media
     * links accept. */
    param?: string;
    /** Highest device-pixel-ratio worth serving. Default 3. */
    maxDpr?: number;
}
/** The smallest whitelisted width that has at least `needed` pixels; the largest one when none is big enough.
 * Returns null for an empty whitelist. */
export declare function pickWidth(needed: number, widths?: readonly number[]): number | null;
/** True for URLs a query parameter can be added to: relative paths and http(s). `data:`, `blob:` and every
 * other scheme are left alone. */
export declare function canResize(url: string): boolean;
/** Asks a media route for a picture just big enough (the server must resize: the helper cannot know; the caller decides
 * by using it only for routes that do): the smallest whitelisted width that is at least
 * `cssWidth x dpr` (rounded UP, so a tile is never soft and caches see few distinct URLs), clamped to the
 * largest width. The width goes in the query (`?width=320`); an existing query and `#fragment` are kept, and an
 * existing parameter of the same name is replaced. Returns the URL unchanged when it cannot be resized
 * (`data:`, `blob:`, other schemes), when `cssWidth` is not a positive number, or when the whitelist is empty. */
export declare function sizedUrl(url: string, cssWidth: number, dpr: number, options?: SizedUrlOptions): string;
/** Sets one query parameter, keeping the rest of the query and the fragment as they were. */
export declare function withQueryParam(url: string, name: string, value: string): string;
