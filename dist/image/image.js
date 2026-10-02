import { css, html, nothing } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { LuElement } from "../core/element.js";
import { renderIcon } from "../core/icon.js";
import { observeInView } from "../core/in-view.js";
import { MAX_DPR, sizedUrl } from "./sized-url.js";
import { RETRY_DELAY_MS, parseRatio, retryUrl } from "./image-model.js";
import { watchWidth } from "./resize-watch.js";
/** A picture that arrives within this many ms of being asked for appears without a fade (it was cached). */
const INSTANT_MS = 60;
/** Pictures start loading this far before they scroll into view. */
const LOOK_AHEAD = "200px";
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
export class LuImage extends LuElement {
    constructor() {
        super();
        this._seen = false;
        this._cssWidth = 0;
        this._target = "";
        this._retried = false;
        this._instant = false;
        this._startedAt = 0;
        this._lease = null;
        this.src = "";
        this.alt = "";
        this.ratio = "4/3";
        this.fit = "cover";
        this.priority = "auto";
        this.widths = undefined;
        this.authed = false;
        this.cache = undefined;
        this.sizeParam = "width";
        this.retryParam = "";
        this._phase = "waiting";
        this._url = "";
    }
    connectedCallback() {
        super.connectedCallback();
        this._armVisibility();
        if (this.hasUpdated)
            this._sync(); // re-attached: the first render takes care of itself
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopView?.();
        this._stopView = undefined;
        this._stopWidth?.();
        this._stopWidth = undefined;
        clearTimeout(this._retryTimer);
        this._lease?.release();
        this._lease = null;
        this._target = "";
    }
    willUpdate(changed) {
        if (changed.has("ratio"))
            this.style.setProperty("--lu-image-ratio", parseRatio(this.ratio));
        if (changed.has("src") || changed.has("authed") || changed.has("cache"))
            this._reset();
        if (changed.has("priority"))
            this._armVisibility();
        if (changed.has("src") || changed.has("authed") || changed.has("cache") || changed.has("widths") || changed.has("sizeParam") || changed.has("priority"))
            this._sync();
    }
    updated() {
        // A picture the browser already had is complete the moment its address is set: show it without a fade.
        if (this._phase !== "loading")
            return;
        const img = this.renderRoot.querySelector("img");
        if (img?.complete && img.naturalWidth > 0) {
            this._instant = true;
            this._loaded();
        }
    }
    /** Forget everything about the previous picture (the address or the way of fetching it changed). */
    _reset() {
        clearTimeout(this._retryTimer);
        this._lease?.release();
        this._lease = null;
        this._target = "";
        this._retried = false;
        this._instant = false;
        this._url = "";
        this._phase = "waiting";
    }
    /** Decides whether the picture may load yet: on screen (or high priority), width known when sizes are used. */
    _armVisibility() {
        if (this._seen)
            return;
        if (this.priority === "high") {
            this._seen = true;
            return;
        }
        if (this._stopView || !this.isConnected)
            return;
        this._stopView = observeInView(this, (visible) => {
            if (!visible)
                return;
            this._seen = true;
            this._stopView?.();
            this._stopView = undefined;
            this._sync();
        }, LOOK_AHEAD);
    }
    _sync() {
        if (!this.isConnected)
            return;
        const sized = Boolean(this.widths?.length);
        if (sized && !this._stopWidth) {
            this._stopWidth = watchWidth(this, (width) => {
                if (width <= this._cssWidth)
                    return; // only ever ask for a bigger picture, never swap down
                this._cssWidth = width;
                this._sync();
            });
        }
        else if (!sized && this._stopWidth) {
            this._stopWidth();
            this._stopWidth = undefined;
        }
        if (!this.src || !this._seen || (sized && this._cssWidth <= 0))
            return;
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        const target = sized ? sizedUrl(this.src, this._cssWidth, dpr, { widths: this.widths, param: this.sizeParam }) : this.src;
        if (target === this._target)
            return;
        this._target = target;
        this._begin(target);
    }
    /** Starts (or, for a bigger size, swaps to) `target`. While a picture is on screen the old one stays until the new one is ready. */
    _begin(target) {
        this._startedAt = performance.now();
        if (!this.authed || !this.cache) {
            this._url = target;
            if (this._phase === "waiting")
                this._phase = "loading";
            return;
        }
        const previous = this._lease;
        const lease = this.cache.acquire(target, (objectUrl) => {
            if (this._target !== target)
                return; // superseded
            if (objectUrl === null) {
                lease.release();
                if (this._lease === lease)
                    this._lease = null;
                this._failed();
            }
            else {
                this._show(lease, objectUrl, previous);
            }
        });
        if (lease.url !== null) {
            if (this._phase !== "loaded")
                this._instant = true; // already downloaded: nothing to fade in from
            this._show(lease, lease.url, previous);
        }
    }
    _show(lease, objectUrl, previous) {
        if (previous && previous !== lease)
            previous.release();
        this._lease = lease;
        this._url = objectUrl;
        if (this._phase === "waiting" || this._phase === "retrying")
            this._phase = "loading";
    }
    _onLoad() {
        if (this._phase === "loaded")
            return;
        if (performance.now() - this._startedAt < INSTANT_MS)
            this._instant = true;
        this._loaded();
    }
    _loaded() {
        if (this._phase === "loaded")
            return;
        this._phase = "loaded";
        this.emit("lu-image-load", { src: this.src });
    }
    _onError() {
        this._failed();
    }
    /** One retry after a short pause, then the fallback. */
    _failed() {
        if (this._phase === "loaded" || this._phase === "failed" || this._phase === "retrying")
            return; // a bigger size failing leaves the picture on screen
        if (this._retried) {
            this._phase = "failed";
            this.emit("lu-image-error", { src: this.src });
            return;
        }
        this._retried = true;
        this._phase = "retrying";
        this._url = "";
        const target = this._target;
        this._retryTimer = setTimeout(() => this._retry(target), RETRY_DELAY_MS);
    }
    _retry(target) {
        if (this._target !== target || !this.isConnected)
            return;
        this._phase = "loading";
        if (this.authed && this.cache) {
            this._begin(target); // a failed download is not cached, so this downloads again
            return;
        }
        this._startedAt = performance.now();
        this._url = retryUrl(target, this.retryParam); // the failed <img> was removed when `_url` was cleared, so this is a fresh request
    }
    render() {
        if (this._phase === "failed") {
            return html `<div class="fallback"><slot name="fallback">${renderIcon("mdi:image-broken-variant")}</slot></div>`;
        }
        if (!this._url)
            return nothing;
        const shown = this._phase === "loaded";
        return html `<img class=${classMap({ shown, instant: this._instant })} src=${this._url} alt=${this.alt} decoding="async" fetchpriority=${this.priority} @load=${this._onLoad} @error=${this._onError}>`;
    }
}
LuImage.luName = "image";
LuImage.properties = {
    src: { type: String },
    alt: { type: String },
    ratio: { type: String },
    fit: { type: String, reflect: true },
    priority: { type: String },
    widths: { attribute: false },
    authed: { type: Boolean },
    cache: { attribute: false },
    sizeParam: { type: String, attribute: "size-param" },
    retryParam: { type: String, attribute: "retry-param" },
    _phase: { state: true },
    _url: { state: true },
};
LuImage.styles = css `
    :host { position: relative; display: block; width: 100%; aspect-ratio: var(--lu-image-ratio, 4 / 3); overflow: hidden; border-radius: var(--lu-image-radius, var(--lu-radius-tile)); background: var(--lu-tile); }
    :host([hidden]) { display: none; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity var(--lu-motion-card, 180ms) var(--lu-ease, ease-out); }
    :host([fit="contain"]) img { object-fit: contain; }
    img.shown { opacity: 1; }
    img.instant { transition: none; }
    .fallback { position: absolute; inset: 0; display: grid; place-items: center; color: var(--lu-ink-3); }
    .icon { display: block; width: var(--lu-icon, 28px); height: var(--lu-icon, 28px); --mdc-icon-size: var(--lu-icon, 28px); fill: currentColor; opacity: .66; }
    @media (prefers-reduced-motion: reduce) { img { transition: none; } }
  `;
