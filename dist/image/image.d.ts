import { nothing, type PropertyValues } from "lit";
import { LuElement } from "../core/element.js";
import type { ImageUrlCache } from "./image-cache.js";
type Phase = "waiting" | "loading" | "loaded" | "retrying" | "failed";
/** A picture in a box whose shape is fixed up front, so nothing moves when it arrives (zero layout shift).
 *
 * - The box is `ratio` wide-to-high (`"4/3"` by default) and as wide as its parent; the neutral placeholder
 *   (`--lu-tile`) shows until the picture is there. The corners follow `--lu-image-radius` (default `--lu-radius-tile`).
 * - Every picture on the page shares ONE IntersectionObserver: a picture is only asked for when it is within
 *   200 px of the screen. `priority="high"` (the first row of a grid) skips the wait and sets `fetchpriority=high`;
 *   `"low"` hints the browser that it is not urgent.
 * - `widths` (a list such as `[160, 320, 640]`) makes the picture ask for the smallest size that is at least its
 *   own width x the screen's pixel density (see `sizedUrl`: the server must resize for `?width=`). The width is
 *   measured by one shared ResizeObserver; a bigger box (rotation, resize) upgrades the picture in place.
 * - `authed` + `cache`: the picture is downloaded through the cache's fetcher (Bearer token) and shown from an
 *   object URL; the cache is reference counted, so a picture on screen is never revoked.
 * - It fades in over `--lu-motion-card` (opacity only), except when it was cached or the user prefers reduced motion.
 * - A failed picture is asked for once more after a second (the same address; `retryParam` can add a cache-busting query for servers that allow one); if that fails too the
 *   `fallback` slot shows (default: a broken-picture icon) and `lu-image-error` fires.
 *
 * Needs the host's `--lu-*` tokens (the panel root, card root or `lu-root` provides them). */
export declare class LuImage extends LuElement {
    static luName: string;
    static properties: {
        src: {
            type: StringConstructor;
        };
        alt: {
            type: StringConstructor;
        };
        ratio: {
            type: StringConstructor;
        };
        fit: {
            type: StringConstructor;
            reflect: boolean;
        };
        priority: {
            type: StringConstructor;
        };
        widths: {
            attribute: boolean;
        };
        authed: {
            type: BooleanConstructor;
        };
        cache: {
            attribute: boolean;
        };
        sizeParam: {
            type: StringConstructor;
            attribute: string;
        };
        retryParam: {
            type: StringConstructor;
            attribute: string;
        };
        _phase: {
            state: boolean;
        };
        _url: {
            state: boolean;
        };
    };
    /** Picture address. An empty `src` shows the placeholder. */
    src: string;
    /** Text alternative; empty (default) marks the picture decorative. */
    alt: string;
    /** Width-to-height: `"4/3"` (default), `"16/10"`, `"1"` ... */
    ratio: string;
    fit: "cover" | "contain";
    /** `"high"` loads at once with fetchpriority high (first row); `"auto"` waits until near the screen; `"low"` waits and asks the browser to go last. */
    priority: "high" | "auto" | "low";
    /** Sizes the server serves, e.g. `[160, 320, 640]`. Unset: `src` is used as it is. */
    widths: readonly number[] | undefined;
    /** Download through `cache` (needs it) instead of letting the browser fetch the address. */
    authed: boolean;
    cache: ImageUrlCache | undefined;
    /** Query parameter that carries the wanted width. Default `width` (the one Home Assistant's signed links accept). */
    sizeParam: string;
    /** Query parameter added (as `=1`) to the one retry, for servers that accept it. Default none: a signed link would be rejected. */
    retryParam: string;
    _phase: Phase;
    _url: string;
    private _seen;
    private _cssWidth;
    private _target;
    private _retried;
    private _instant;
    private _startedAt;
    private _lease;
    private _retryTimer;
    private _stopView;
    private _stopWidth;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    protected willUpdate(changed: PropertyValues<this>): void;
    protected updated(): void;
    /** Forget everything about the previous picture (the address or the way of fetching it changed). */
    private _reset;
    /** Decides whether the picture may load yet: on screen (or high priority), width known when sizes are used. */
    private _armVisibility;
    private _sync;
    /** Starts (or, for a bigger size, swaps to) `target`. While a picture is on screen the old one stays until the new one is ready. */
    private _begin;
    private _show;
    private _onLoad;
    private _loaded;
    private _onError;
    /** One retry after a short pause, then the fallback. */
    private _failed;
    private _retry;
    static styles: import("lit").CSSResult;
    protected render(): typeof nothing | import("lit-html").TemplateResult<1>;
}
declare global {
    interface HTMLElementEventMap {
        "lu-image-load": CustomEvent<{
            src: string;
        }>;
        "lu-image-error": CustomEvent<{
            src: string;
        }>;
    }
}
export {};
