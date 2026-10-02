/* Derived from music-assistant/frontend src/components/discover/EditorialShelf.vue:337-427 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md). Modified: the scroll-snap track CSS (proximity snap, pan-x pan-y, overscroll containment, overflow-anchor off, snap padding) is kept; tile size comes from rail-model.ts through ONE shared ResizeObserver (MA uses a MutationObserver and a window listener); no hover chevrons, no mouse drag; tiles are Lucent tokens, tiles are buttons with roving focus. */
import { css, nothing } from "lit";
import { html } from "lit/static-html.js";
import { BASE_CSS } from "../tokens/base-css.js";
import { LuElement } from "../core/element.js";
import { renderIcon } from "../core/icon.js";
import { LuImage } from "./image.js";
import { railFocusIndex, railPerView, railTileWidth } from "./rail-model.js";
import { watchWidth } from "./resize-watch.js";
const SKELETON_TILES = 4;
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
export class LuMediaRail extends LuElement {
    constructor() {
        super();
        this._width = 0;
        this.items = [];
        this.more = false;
        this.loading = false;
        this.moreLabel = "Show more";
        this.perView = 0;
        this.widths = undefined;
        this.cache = undefined;
        this._focus = 0;
    }
    connectedCallback() {
        super.connectedCallback();
        this._stopWidth?.();
        // After the first render the track exists; the shared observer reports its width before the first paint.
        void this.updateComplete.then(() => {
            const track = this._track;
            if (track && this.isConnected)
                this._stopWidth = watchWidth(track, (width) => { this._width = width; this._size(track); });
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopWidth?.();
        this._stopWidth = undefined;
    }
    get _track() {
        return this.renderRoot.querySelector(".track");
    }
    updated(changed) {
        if (changed.has("perView")) {
            const track = this._track;
            if (track)
                this._size(track);
        }
    }
    /** Solves the tile width for the current container and writes it as one custom property (no re-render). */
    _size(track) {
        const width = this._width;
        if (width <= 0)
            return;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        const perView = this.perView > 0 ? this.perView : railPerView(width, gap);
        track.style.setProperty("--lu-rail-tile", `${railTileWidth(width, gap, perView)}px`);
    }
    _onKey(event) {
        const stops = Array.from(this.renderRoot.querySelectorAll("[data-stop]"));
        const current = stops.indexOf(event.target);
        if (current < 0)
            return;
        const next = railFocusIndex(event.key, current, stops.length, getComputedStyle(this).direction === "rtl");
        if (next === null)
            return;
        event.preventDefault();
        stops[next]?.focus(); // the browser scrolls it into view, keeping `scroll-margin` clear of the edges
    }
    _onFocusIn(event) {
        const stops = Array.from(this.renderRoot.querySelectorAll("[data-stop]"));
        const index = stops.indexOf(event.target);
        if (index >= 0 && index !== this._focus)
            this._focus = index;
    }
    render() {
        const picture = this.luTag("image");
        const showSkeleton = this.loading && this.items.length === 0;
        const stops = this.items.length + (this.more ? 1 : 0);
        const tabStop = Math.min(this._focus, stops - 1); // the one tile Tab lands on, whatever the list did since
        return html `<ul class="track" role="list" aria-busy=${showSkeleton ? "true" : "false"} @keydown=${this._onKey} @focusin=${this._onFocusIn}>
      ${showSkeleton
            ? Array.from({ length: SKELETON_TILES }, () => html `<li aria-hidden="true"><span class="bone picture"></span><span class="bone line"></span><span class="bone line short"></span></li>`)
            : this.items.map((item, index) => html `<li><button class="item" type="button" data-stop tabindex=${index === tabStop ? 0 : -1} aria-label=${item.label} @pointerdown=${() => this.emit("lu-warm", { id: item.id })} @click=${() => this.emit("lu-select", { id: item.id })}>
          <span class="frame">
            <${picture} ratio="16/10" .src=${item.image} .widths=${this.widths} .cache=${this.cache} ?authed=${Boolean(this.cache)}></${picture}>
            ${item.play ? html `<span class="glyph-wrap"><span class="glyph">${renderIcon("mdi:play")}</span></span>` : item.badge ? html `<span class="badge">${renderIcon(item.badgeIcon)}${item.badge}</span>` : nothing}
          </span>
          <span class="title">${item.title}</span>
          ${item.caption ? html `<span class="caption">${item.caption}</span>` : nothing}
        </button></li>`)}
      ${this.more && !showSkeleton ? html `<li class="more"><button class="more-tile" type="button" data-stop tabindex=${this.items.length === tabStop ? 0 : -1} ?disabled=${this.loading} @click=${() => this.emit("lu-more")}>${this.loading ? "Loading…" : this.moreLabel}</button></li>` : nothing}
    </ul>`;
    }
}
LuMediaRail.luName = "media-rail";
LuMediaRail.luDeps = [LuImage];
LuMediaRail.properties = {
    items: { attribute: false },
    more: { type: Boolean },
    loading: { type: Boolean },
    moreLabel: { type: String, attribute: "more-label" },
    perView: { type: Number, attribute: "per-view" },
    widths: { attribute: false },
    cache: { attribute: false },
    _focus: { state: true },
};
LuMediaRail.styles = [BASE_CSS, css `
    /* The rail fills its parent and scrolls inside; its tiles must never widen a grid or flex parent. */
    :host { display: block; contain: inline-size; }
    .track { display: flex; align-items: flex-start; gap: var(--lu-space-3); margin: 0 calc(var(--lu-space-1) * -1); padding: var(--lu-space-1) var(--lu-space-1) var(--lu-space-2); overflow-x: auto; overflow-y: visible; overscroll-behavior-x: contain; overflow-anchor: none; list-style: none; scroll-snap-type: x proximity; scroll-padding-inline: var(--lu-space-1); scrollbar-width: thin; touch-action: pan-x pan-y; }
    @media (hover: none) { .track { scrollbar-width: none; } }
    li { flex: none; width: var(--lu-rail-tile, calc(var(--lu-target) * 3.5)); scroll-snap-align: start; }
    li.more { display: grid; align-items: start; width: auto; }
    [data-stop] { scroll-margin-inline: var(--lu-focus-scroll-clearance); }
    .item { display: grid; width: 100%; gap: 2px; padding: 0; border: 0; border-radius: var(--lu-radius-tile); color: var(--lu-ink); background: transparent; text-align: left; cursor: pointer; transition: background-color var(--lu-motion-label) var(--lu-ease); }
    .item:is(:active, [data-pressed]) { background: var(--lu-material-press-wash); transition: none; }
    /* Pressed picture: a veil over the picture itself (a scale would cost a layer per press). */
    .item:is(:active, [data-pressed]) .frame::after { content: ""; position: absolute; inset: 0; border-radius: var(--lu-radius-tile); background: var(--lu-material-press-wash); pointer-events: none; }
    @media (hover: hover) and (pointer: fine) { .item:hover { background: var(--lu-material-hover-wash); } }
    .frame { position: relative; display: block; margin-bottom: var(--lu-space-1); }
    .glyph-wrap { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
    .glyph { display: grid; width: var(--lu-glyph, 40px); height: var(--lu-glyph, 40px); place-items: center; border: 1px solid var(--lu-edge); border-radius: 50%; color: var(--lu-ink); background: var(--lu-reading); }
    .badge { position: absolute; top: var(--lu-space-2); left: var(--lu-space-2); display: inline-flex; align-items: center; gap: var(--lu-space-1); min-height: 28px; padding: 0 var(--lu-space-3) 0 var(--lu-space-2); border: 1px solid var(--lu-edge); border-radius: var(--lu-radius-pill); color: var(--lu-ink); background: var(--lu-reading); font-size: var(--lu-type-caption); font-weight: 600; pointer-events: none; }
    .badge .icon { --lu-icon: 16px; }
    .title { padding: 0 var(--lu-space-1); overflow: hidden; font-size: var(--lu-type-label); font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
    .caption { padding: 0 var(--lu-space-1); overflow: hidden; color: var(--lu-ink-2); font-size: var(--lu-type-caption); text-overflow: ellipsis; white-space: nowrap; }
    .more-tile { display: grid; width: calc(var(--lu-target) * 2.2); min-height: var(--lu-target); aspect-ratio: 16 / 10; place-items: center; padding: 0 var(--lu-space-3); border: 1px dashed var(--lu-edge-raised); border-radius: var(--lu-radius-tile); color: var(--lu-accent); background: transparent; font: 600 var(--lu-type-label) var(--lu-font); text-align: center; cursor: pointer; transition: background-color var(--lu-motion-label) var(--lu-ease); }
    .more-tile:is(:active, [data-pressed]):not(:disabled) { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); transition: none; }
    .more-tile:disabled { color: var(--lu-ink-3); cursor: progress; }
    .bone { display: block; border-radius: var(--lu-radius-tile); background: var(--lu-tile); }
    .bone.picture { aspect-ratio: 16 / 10; margin-bottom: var(--lu-space-2); }
    .bone.line { height: var(--lu-type-label); margin: 0 var(--lu-space-1) var(--lu-space-1); border-radius: var(--lu-radius-pill); }
    .bone.line.short { width: 60%; }
    @media (prefers-reduced-motion: reduce) { .item, .more-tile { transition: none; } }
  `];
