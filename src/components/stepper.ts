import { css, html, nothing, type PropertyValues } from "lit";
import { LuElement } from "../core/element.ts";
import { renderIcon } from "../core/icon.ts";
import { BASE_CSS, CONTROLS_CSS } from "../tokens/base-css.ts";
import { ICON_ALERT_CIRCLE, ICON_MINUS, ICON_PLUS } from "./controls-icons.ts";
import { applyKey, atLimit, clampToStep, decimalsFor, formatNumber, formatValueText, keyAction, nextValue, repeatDelayMs, type StepRange } from "./stepper-model.ts";

/** A number you nudge with minus and plus: label, value with unit, two 48px buttons.
 *
 * Press and hold a button to repeat (after 0.4 s, ten steps a second); the arrow keys, PageUp / PageDown (ten
 * steps), Home and End work on the value. Values stay on the `min` + n x `step` grid, so 0.1 steps never show
 * rounding noise. `value` follows the user's change and `lu-change` (detail `{ value }`) fires on every step,
 * including repeats: debounce on your side if each change calls a device. Set `error` to show a message under the
 * control (with an icon, not colour alone). Screen readers get a spin button with `aria-valuenow / min / max`. */
export class LuStepper extends LuElement {
  static luName = "stepper";

  static properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    label: { type: String },
    unit: { type: String },
    error: { type: String },
    disabled: { type: Boolean, reflect: true },
    decreaseLabel: { type: String, attribute: "decrease-label" },
    increaseLabel: { type: String, attribute: "increase-label" },
  };

  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare label: string;
  /** Shown after the number ("min", "°C", "%"). */
  declare unit: string;
  /** A message shown under the control; empty = no error. */
  declare error: string;
  declare disabled: boolean;
  /** Start of the accessible names of the buttons: "Decrease" + label. */
  declare decreaseLabel: string;
  declare increaseLabel: string;

  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private holdRepeats = 0;

  constructor() {
    super();
    this.value = 0;
    this.min = 0;
    this.max = 100;
    this.step = 1;
    this.label = "";
    this.unit = "";
    this.error = "";
    this.disabled = false;
    this.decreaseLabel = "Decrease";
    this.increaseLabel = "Increase";
  }

  private get range(): StepRange {
    return { min: this.min, max: this.max, step: this.step };
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopHold();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("value") || changed.has("min") || changed.has("max") || changed.has("step")) this.value = clampToStep(this.value, this.range);
  }

  /** Moves `steps` grid steps. Returns false when nothing changed (already at the limit). */
  private nudge(steps: number): boolean {
    return this.setValue(nextValue(this.value, steps, this.range));
  }

  private setValue(value: number): boolean {
    if (this.disabled || value === this.value) return false;
    this.value = value;
    this.emit("lu-change", { value });
    return true;
  }

  private startHold(direction: 1 | -1, event: PointerEvent): void {
    if (this.disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    document.addEventListener("visibilitychange", this.stopHold);
    this.holdRepeats = 0;
    if (!this.nudge(direction)) return;
    const repeat = (): void => {
      this.holdTimer = setTimeout(() => {
        if (!this.nudge(direction)) return this.stopHold();
        this.holdRepeats += 1;
        repeat();
      }, repeatDelayMs(this.holdRepeats));
    };
    repeat();
  }

  private stopHold = (): void => {
    clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
    document.removeEventListener("visibilitychange", this.stopHold);
  };

  /** A click that is not from a pointer (keyboard, assistive technology) steps once; pointer presses stepped on down. */
  private onButtonClick(direction: 1 | -1, event: MouseEvent): void {
    if (event.detail === 0) this.nudge(direction);
  }

  private onKeydown(event: KeyboardEvent): void {
    const action = keyAction(event.key);
    if (this.disabled || action === null || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    this.setValue(applyKey(this.value, action, this.range));
  }

  private stepButton(direction: 1 | -1) {
    const down = direction < 0;
    const blocked = this.disabled || atLimit(this.value, direction, this.range);
    return html`<button class="icon-button step" type="button" tabindex="-1" aria-label=${`${down ? this.decreaseLabel : this.increaseLabel} ${this.label}`.trim()} ?disabled=${blocked}
      @pointerdown=${(event: PointerEvent) => this.startHold(direction, event)} @pointerup=${this.stopHold} @pointercancel=${this.stopHold} @lostpointercapture=${this.stopHold} @blur=${this.stopHold}
      @click=${(event: MouseEvent) => this.onButtonClick(direction, event)} @contextmenu=${(event: Event) => event.preventDefault()}>${renderIcon(down ? ICON_MINUS : ICON_PLUS)}</button>`;
  }

  render() {
    const shown = formatNumber(this.value, decimalsFor(this.range));
    const text = formatValueText(shown, this.unit);
    return html`<div class="field">
      <span class="label" id="label">${this.label}</span>
      <div class="control">
        ${this.stepButton(-1)}
        <div class="value" role="spinbutton" tabindex=${this.disabled ? nothing : 0} aria-labelledby="label" aria-valuenow=${this.value} aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuetext=${text}
          aria-disabled=${this.disabled ? "true" : nothing} aria-invalid=${this.error ? "true" : nothing} aria-describedby=${this.error ? "error" : nothing} @keydown=${this.onKeydown}>
          <span class="number">${shown}</span>${this.unit ? html`<span class="unit">${this.unit}</span>` : nothing}
        </div>
        ${this.stepButton(1)}
      </div>
      ${this.error ? html`<p class="error" id="error">${renderIcon(ICON_ALERT_CIRCLE)}<span>${this.error}</span></p>` : nothing}
    </div>`;
  }

  static styles = [
    BASE_CSS,
    CONTROLS_CSS,
    css`
      :host { display: block; min-width: 0; }
      :host([hidden]) { display: none; }
      .field { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--lu-space-1) var(--lu-space-3); min-height: var(--lu-target); }
      .label { flex: 1 1 8rem; min-width: 0; color: var(--lu-ink); font: 500 var(--lu-type-label)/1.25 var(--lu-font); overflow-wrap: anywhere; }
      :host([disabled]) .label { color: var(--lu-ink-3); }
      .control { display: flex; flex: 0 1 auto; align-items: center; gap: var(--lu-space-2); min-width: 0; }
      .value { display: flex; align-items: center; justify-content: center; gap: var(--lu-space-1); min-width: 88px; min-height: var(--lu-target); padding: 0 var(--lu-space-3); border: 1px solid var(--lu-edge-raised); border-radius: var(--lu-radius-control); color: var(--lu-ink); background: var(--lu-material-well); box-shadow: var(--lu-neumorphic-inset); font: 600 var(--lu-type-body)/1 var(--lu-font); font-variant-numeric: tabular-nums; user-select: none; -webkit-user-select: none; }
      .unit { color: var(--lu-ink-2); font-size: var(--lu-type-label); font-weight: 500; }
      .step { border: 1px solid var(--lu-edge-raised); color: var(--lu-ink); background: var(--lu-glass-raised); box-shadow: var(--lu-highlight-rest); touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
      .step:is(:active, [data-pressed]):not(:disabled) { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); transition: none; }
      .step:disabled { opacity: var(--lu-material-disabled-opacity); cursor: not-allowed; }
      :host([disabled]) .value { opacity: var(--lu-material-disabled-opacity); }
      .error { flex: 1 1 100%; display: flex; align-items: flex-start; gap: var(--lu-space-2); margin: 0; color: var(--lu-ink); font: 500 var(--lu-type-label)/1.35 var(--lu-font); }
      .error .icon { --lu-icon: 18px; margin-top: 1px; color: var(--lu-danger); }
      .value[aria-invalid="true"] { border-color: var(--lu-danger); }
      @media (hover: hover) and (pointer: fine) { .step:hover:not(:disabled) { background-image: linear-gradient(var(--lu-material-hover-wash), var(--lu-material-hover-wash)); } }
      @media (prefers-reduced-motion: reduce) { .step { transition: none; } }
    `,
  ];
}
