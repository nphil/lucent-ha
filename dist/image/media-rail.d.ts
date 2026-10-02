import { LuElement, type LuElementClass } from "../core/element.js";
import type { ImageUrlCache } from "./image-cache.js";
/** One tile of a rail. */
export interface RailItem {
    id: string;
    /** Thumbnail address (empty shows the neutral placeholder). */
    image: string;
    /** First line under the picture, e.g. when it happened. */
    title: string;
    /** Second, quieter line, e.g. where. */
    caption?: string;
    /** Full accessible name of the tile's button. */
    label: string;
    /** Draws a play glyph over the picture. Without it, `badge` says what the picture is instead. */
    play?: boolean;
    badge?: string;
    badgeIcon?: string;
}
/** A shelf of picture buttons that scrolls sideways with snapping and ALWAYS shows N and a half tiles, so the next
 * one peeks out and says "scroll": about 1.5 tiles on a phone, 3.5 on a wall display, 4.5 or more on a desktop
 * (tiles stay between 120 and 280 px). Each tile has a title, a caption and either a play glyph or a small badge.
 * The last tile can be "Show more".
 *
 * Events: `lu-select {id}` when a tile is tapped, `lu-warm {id}` the instant one is pressed (so the app can start
 * loading what it opens), `lu-more` from the "Show more" tile. Keyboard: one Tab stop, arrow keys / Home / End move
 * between tiles and scroll the focused one into view. While `loading` and without items it shows static
 * placeholder tiles of the same size.
 *
 * `widths` and `cache` are handed to the thumbnails (see `lu-image`). Needs the host's `--lu-*` tokens. */
export declare class LuMediaRail extends LuElement {
    static luName: string;
    static luDeps: readonly LuElementClass[];
    static properties: {
        items: {
            attribute: boolean;
        };
        more: {
            type: BooleanConstructor;
        };
        loading: {
            type: BooleanConstructor;
        };
        moreLabel: {
            type: StringConstructor;
            attribute: string;
        };
        perView: {
            type: NumberConstructor;
            attribute: string;
        };
        widths: {
            attribute: boolean;
        };
        cache: {
            attribute: boolean;
        };
        _focus: {
            state: boolean;
        };
    };
    items: readonly RailItem[];
    /** Show the trailing "Show more" tile. */
    more: boolean;
    /** Loading: the "Show more" tile is disabled and says so; without items, placeholders show. */
    loading: boolean;
    moreLabel: string;
    /** How many tiles are visible, as an N.5 such as 2.5. 0 (default) picks the biggest tiles up to 280 px. */
    perView: number;
    /** Sizes the thumbnails ask the server for (see `lu-image`). */
    widths: readonly number[] | undefined;
    /** When set, thumbnails download through this cache (authenticated) instead of the browser. */
    cache: ImageUrlCache | undefined;
    _focus: number;
    private _stopWidth;
    private _width;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    private get _track();
    protected updated(changed: Map<PropertyKey, unknown>): void;
    /** Solves the tile width for the current container and writes it as one custom property (no re-render). */
    private _size;
    private _onKey;
    private _onFocusIn;
    static styles: import("lit").CSSResult[];
    protected render(): import("lit-html").TemplateResult;
}
declare global {
    interface HTMLElementEventMap {
        "lu-select": CustomEvent<{
            id: string;
        }>;
        "lu-warm": CustomEvent<{
            id: string;
        }>;
        "lu-more": CustomEvent<undefined>;
    }
}
