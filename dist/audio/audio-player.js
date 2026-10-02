import { css, html, nothing } from "lit";
import { BASE_CSS, CONTROLS_CSS } from "../tokens/base-css.js";
import { claimAudio, releaseAudio } from "../core/audio-focus.js";
import { LuElement } from "../core/element.js";
import { renderIcon } from "../core/icon.js";
import { activeSource, failCurrent, playerSources, retryPlayer, settle, toggleOriginal, withSources } from "./audio-model.js";
/** One recording with the browser's own audio controls (keyboard, screen readers and seeking for free).
 *
 * - `src` is the recording; `original` (optional) is the untouched one behind a cleaned preview, and a small
 *   "Original" toggle plays it instead. Switching keeps playing: it continues from the start of the other file.
 * - A preview that cannot be loaded falls back to the original by itself; when nothing can be played the player
 *   says "Couldn't load this recording." with a "Try again" button.
 * - A new `src` while the preview is playing waits until it pauses or ends, so the swap is never heard.
 * - ONE recording at a time on the whole page: starting this one pauses any other (`claimAudio`).
 * - `mark` (a short passive label such as "Cleaned") and `caption` sit under the player while the preview plays.
 * - The sound survives a re-render of the page around it, but not removal of the element (the browser stops it).
 *
 * `preload` is `none` by default: nothing downloads until the listener presses play. Needs the host's `--lu-*` tokens. */
export class LuAudioPlayer extends LuElement {
    constructor() {
        super();
        /** The listener pressed play and has not paused since: a fallback to the original carries on playing. */
        this._playRequested = false;
        this.src = "";
        this.original = "";
        this.mark = "";
        this.caption = "";
        this.label = "";
        this.preload = "none";
        this._sources = playerSources("", "");
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        const audio = this._audio;
        if (audio)
            releaseAudio(audio);
    }
    get _audio() {
        return this.renderRoot?.querySelector("audio") ?? null;
    }
    willUpdate(changed) {
        if (!changed.has("src") && !changed.has("original"))
            return;
        const audio = this._audio;
        const playing = Boolean(audio && !audio.paused && !audio.ended);
        this._sources = withSources(this._sources, this.src, this.original, playing);
    }
    _onPlay(event) {
        this._playRequested = true;
        claimAudio(event.currentTarget);
    }
    _onSettle(event) {
        this._playRequested = false;
        releaseAudio(event.currentTarget);
        this._sources = settle(this._sources);
    }
    /** A preview that cannot load switches to the original; if the listener had pressed play, that starts playing. */
    async _onError() {
        const resume = this._playRequested;
        this._sources = failCurrent(this._sources);
        await this.updateComplete;
        if (resume && !this._sources.failed)
            void this._audio?.play().catch(() => undefined);
    }
    async _toggleOriginal() {
        const wasPlaying = this._audio ? !this._audio.paused : false;
        this._sources = toggleOriginal(this._sources);
        await this.updateComplete;
        if (wasPlaying)
            void this._audio?.play().catch(() => undefined);
    }
    render() {
        if (!this.src)
            return nothing;
        const state = this._sources;
        const original = state.useOriginal && Boolean(state.original);
        if (state.failed) {
            return html `<p class="fallback" role="status">${renderIcon("mdi:volume-off")}<span>Couldn't load this recording.</span><button class="text-button" type="button" @click=${() => { this._sources = retryPlayer(this._sources); }}>Try again</button></p>`;
        }
        const player = html `<audio controls preload=${this.preload} src=${activeSource(state)} aria-label=${original ? `${this.label} (original recording)` : this.label} @play=${this._onPlay} @pause=${this._onSettle} @ended=${this._onSettle} @error=${this._onError}></audio>`;
        const notes = !original && (this.mark || this.caption)
            ? html `<p class="notes">${this.mark ? html `<span class="mark">${renderIcon("mdi:creation")}${this.mark}</span>` : nothing}${this.caption ? html `<span>${this.caption}</span>` : nothing}</p>`
            : nothing;
        const toggle = this.original
            ? html `<button class="toggle" type="button" aria-pressed=${state.useOriginal ? "true" : "false"} @click=${this._toggleOriginal}>${state.useOriginal ? renderIcon("mdi:check") : nothing}Original</button>`
            : nothing;
        return html `${player}${notes}${toggle}`;
    }
}
LuAudioPlayer.luName = "audio-player";
LuAudioPlayer.properties = {
    src: { type: String },
    original: { type: String },
    mark: { type: String },
    caption: { type: String },
    label: { type: String },
    preload: { type: String },
    _sources: { state: true },
};
LuAudioPlayer.styles = [BASE_CSS, CONTROLS_CSS, css `
    :host { display: block; }
    audio { display: block; width: 100%; }
    .fallback { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lu-space-2); margin: 0; color: var(--lu-ink-2); font-size: var(--lu-type-label); }
    .fallback .icon { --lu-icon: 20px; }
    .notes { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lu-space-2); margin: var(--lu-space-1) 0 0; color: var(--lu-ink-2); font-size: var(--lu-type-caption); }
    .mark { display: inline-flex; align-items: center; gap: var(--lu-space-1); min-height: 24px; padding: 0 var(--lu-space-2); border: 1px solid var(--lu-edge); border-radius: var(--lu-radius-pill); color: var(--lu-ink); background: var(--lu-tile); font-weight: 600; }
    .mark .icon { --lu-icon: 14px; }
    .toggle { display: inline-flex; min-height: var(--lu-target); align-items: center; gap: var(--lu-space-1); margin-top: var(--lu-space-1); padding: 0 var(--lu-space-3); border: 1px solid var(--lu-edge); border-radius: var(--lu-radius-pill); color: var(--lu-ink-2); background: transparent; font: 500 var(--lu-type-caption)/1.2 var(--lu-font); cursor: pointer; transition: background-color var(--lu-motion-label) var(--lu-ease); }
    .toggle:is(:active, [data-pressed]) { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); transition: none; }
    .toggle[aria-pressed="true"] { color: var(--lu-ink); background: var(--lu-glass-raised); border-color: var(--lu-edge-raised); box-shadow: var(--lu-highlight-raised); font-weight: 600; }
    .toggle .icon { --lu-icon: 16px; }
    @media (hover: hover) and (pointer: fine) { .toggle[aria-pressed="false"]:hover { background: var(--lu-material-hover-wash); } }
    @media (prefers-reduced-motion: reduce) { .toggle { transition: none; } }
  `];
