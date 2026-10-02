import { css, html, nothing } from "lit";
import { LuElement } from "../core/element.js";
import { BASE_CSS } from "../tokens/base-css.js";
import { throttle } from "../core/throttle.js";
import { sliderExternal, sliderGrabbed, sliderMoved, sliderReleased, valueToFraction } from "./slider-model.js";
import { clampToStep, decimalsFor, formatNumber, formatValueText } from "./stepper-model.js";
/** While dragging, `lu-input` goes out at most this often (ms); the last value is always sent. */
const INPUT_INTERVAL_MS = 100;
/** A slider: label and value, a shallow recessed track with a filled part, and an isolated thumb.
 *
 * It is a native `<input type="range">` underneath, so keyboard (arrows, PageUp / PageDown, Home, End), screen
 * readers and touch work the way the platform does; the hit area is the full 48px (64px on smart displays) although
 * the track is only 6px. A vertical swipe that starts on it still scrolls the page.
 *
 * `lu-input` (detail `{ value }`) fires while dragging, at most ten times a second, and the final value is always
 * sent. `lu-change` fires once when the choice is committed (finger lifted, or each key press). While the thumb is
 * held, a new `value` set from outside (a late state echo) is ignored, so the thumb never jumps from under the
 * finger; after release the value the user chose stands until you set `value` again. */
export class LuSlider extends LuElement {
    constructor() {
        super();
        this.release = () => {
            window.removeEventListener("pointerup", this.release);
            window.removeEventListener("pointercancel", this.release);
            if (!this.shown.dragging)
                return;
            this.shown = sliderReleased(this.shown);
            this.requestUpdate();
        };
        this.value = 0;
        this.min = 0;
        this.max = 100;
        this.step = 1;
        this.label = "";
        this.unit = "";
        this.disabled = false;
        this.shown = { value: 0, dragging: false };
        this.sendInput = throttle((value) => this.emit("lu-input", { value }), INPUT_INTERVAL_MS);
    }
    get range() {
        return { min: this.min, max: this.max, step: this.step };
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this.release();
        this.sendInput.cancel();
    }
    willUpdate(changed) {
        if (changed.has("value") || changed.has("min") || changed.has("max") || changed.has("step")) {
            this.shown = sliderExternal(this.shown, clampToStep(this.value, this.range));
        }
    }
    updated() {
        const input = this.renderRoot.querySelector("input");
        if (input && !this.shown.dragging)
            input.value = String(this.shown.value);
        const fill = this.renderRoot.querySelector(".fill");
        if (fill)
            fill.style.transform = `scaleX(${valueToFraction(this.shown.value, this.range)})`;
    }
    onPointerDown() {
        if (this.disabled)
            return;
        this.shown = sliderGrabbed(this.shown);
        window.addEventListener("pointerup", this.release);
        window.addEventListener("pointercancel", this.release);
    }
    onInput(event) {
        const value = Number(event.target.value);
        this.shown = sliderMoved(this.shown, value);
        this.requestUpdate();
        this.sendInput(value);
    }
    onChange(event) {
        const value = Number(event.target.value);
        this.shown = sliderReleased(sliderMoved(this.shown, value));
        this.sendInput.flush();
        this.value = value;
        this.emit("lu-change", { value });
    }
    render() {
        const decimals = decimalsFor(this.range);
        const text = formatValueText(formatNumber(this.shown.value, decimals), this.unit);
        return html `<div class="slider">
      <label class="name" for="range">${this.label}</label>
      <div class="control">
        <div class="track"><div class="fill"></div></div>
        <input id="range" type="range" min=${this.min} max=${this.max} step=${this.step} ?disabled=${this.disabled} aria-valuetext=${text || nothing}
          @pointerdown=${this.onPointerDown} @input=${this.onInput} @change=${this.onChange} />
      </div>
      <output class="value" for="range">${text}</output>
    </div>`;
    }
}
LuSlider.luName = "slider";
LuSlider.properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    label: { type: String },
    unit: { type: String },
    disabled: { type: Boolean, reflect: true },
};
LuSlider.styles = [
    BASE_CSS,
    css `
      :host { display: block; min-width: 0; container-type: inline-size; --thumb: 28px; }
      :host([hidden]) { display: none; }
      .slider { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--lu-space-3); align-items: center; color: var(--lu-ink); font: 500 var(--lu-type-label)/1.25 var(--lu-font); }
      .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .value { justify-self: end; color: var(--lu-ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .control { position: relative; grid-column: 1 / -1; grid-row: 2; height: var(--lu-target); }
      :host([disabled]) .name { color: var(--lu-ink-3); }
      :host([disabled]) .control { opacity: var(--lu-material-disabled-opacity); }
      /* The track stops half a thumb short of each end, so the fill ends exactly under the thumb's centre. */
      .track { position: absolute; inset: 50% calc(var(--thumb) / 2) auto; height: 6px; translate: 0 -50%; overflow: hidden; border-radius: var(--lu-radius-pill); background: var(--lu-track-off); box-shadow: var(--lu-neumorphic-inset); pointer-events: none; }
      .fill { position: absolute; inset: 0; transform-origin: left center; transform: scaleX(0); background: var(--lu-track-readable); }
      input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; background: transparent; cursor: pointer; touch-action: pan-y; -webkit-appearance: none; appearance: none; -webkit-tap-highlight-color: transparent; }
      input:disabled { cursor: not-allowed; }
      input:focus-visible { box-shadow: none !important; }
      input::-webkit-slider-runnable-track { height: 100%; background: transparent; }
      input::-moz-range-track { height: 100%; background: transparent; }
      input::-webkit-slider-thumb { -webkit-appearance: none; width: var(--thumb); height: var(--thumb); margin-top: calc((var(--lu-target) - var(--thumb)) / 2); border: 2px solid var(--lu-ink); border-radius: 50%; background: var(--lu-canvas); box-shadow: var(--lu-highlight-raised), var(--lu-neumorphic-raised); }
      input::-moz-range-thumb { box-sizing: border-box; width: var(--thumb); height: var(--thumb); border: 2px solid var(--lu-ink); border-radius: 50%; background: var(--lu-canvas); box-shadow: var(--lu-highlight-raised), var(--lu-neumorphic-raised); }
      input:not(:disabled):active::-webkit-slider-thumb { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); }
      input:not(:disabled):active::-moz-range-thumb { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); }
      /* Keyboard focus lands on the thumb as light: a wash around it and a landing bar inside it. */
      input:focus-visible::-webkit-slider-thumb { box-shadow: var(--lu-highlight-raised), 0 0 0 6px var(--lu-focus-wash), inset 0 -4px 0 var(--lu-ink); }
      input:focus-visible::-moz-range-thumb { box-shadow: var(--lu-highlight-raised), 0 0 0 6px var(--lu-focus-wash), inset 0 -4px 0 var(--lu-ink); }
      /* Wide containers: label, track and value share one row. */
      @container (min-width: 480px) {
        .slider { grid-template-columns: minmax(96px, 30%) minmax(0, 1fr) minmax(48px, auto); }
        .control { grid-column: 2; grid-row: 1; }
        .value { grid-column: 3; grid-row: 1; }
      }
      @media (forced-colors: active) { .track { border: 1px solid CanvasText; } .fill { background: Highlight; } input::-webkit-slider-thumb { background: ButtonFace; } }
    `,
];
