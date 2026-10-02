import { css, html, nothing } from "lit";
import { LuElement } from "../core/element.ts";
import { renderIcon } from "../core/icon.ts";
import { nextRovingIndex } from "../core/roving.ts";
import { BASE_CSS } from "../tokens/base-css.ts";
import { ICON_CHEVRON_DOWN } from "./controls-icons.ts";

export interface LuSegmentOption {
  value: string;
  label: string;
  /** `mdi:name` or SVG path data, drawn beside the count. */
  icon?: string;
  count?: number;
}

/** An exclusive choice between 2 and 5 options in a recessed tray. The chosen option is the raised one and carries a
 * small accent mark; keyboard focus is a separate light, so "chosen" and "focused" never look the same.
 *
 * It is a radio group: one tab stop, the arrow keys (and Home / End) move the choice. `value` follows the user's
 * choice and `lu-change` (detail `{ value }`) reports it; set `value` from code to change it. With more than 3
 * options in a container narrower than 360px the options would be squeezed, so the same choice is shown as a
 * native select instead (same events). The element takes the width of its row (up to 480px); it does not shrink
 * to its content. */
export class LuSegmented extends LuElement {
  static luName = "segmented";

  static properties = {
    options: { attribute: false },
    value: { type: String },
    label: { type: String },
    disabled: { type: Boolean, reflect: true },
  };

  declare options: LuSegmentOption[];
  declare value: string;
  /** Names the group for screen readers (for example "Time range"). */
  declare label: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.options = [];
    this.value = "";
    this.label = "";
    this.disabled = false;
  }

  /** Options with a count or icon get two lines, so the tray is taller. Empty options (still loading) reserve that height too. */
  protected willUpdate(): void {
    this.toggleAttribute("data-tall", this.options.length === 0 || this.options.some((option) => option.count !== undefined || option.icon));
  }

  private choose(value: string): void {
    if (this.disabled || value === this.value) return;
    this.value = value;
    this.emit("lu-change", { value });
  }

  private onKeydown(event: KeyboardEvent): void {
    const current = this.options.findIndex((option) => option.value === this.value);
    const next = nextRovingIndex(event.key, Math.max(0, current), this.options.length);
    if (next === null) return;
    event.preventDefault();
    this.renderRoot.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
    const option = this.options[next];
    if (option) this.choose(option.value);
  }

  private onSelect(event: Event): void {
    this.choose((event.target as HTMLSelectElement).value);
  }

  render() {
    const hasChosen = this.options.some((option) => option.value === this.value);
    const radios = html`<div class="tray" role="radiogroup" aria-label=${this.label || nothing} aria-disabled=${this.disabled ? "true" : nothing}>
      ${this.options.map((option, index) => {
        const chosen = option.value === this.value;
        const tabbable = chosen || (!hasChosen && index === 0);
        const meta = option.icon || option.count !== undefined;
        return html`<button type="button" role="radio" class="segment" aria-checked=${chosen ? "true" : "false"} tabindex=${tabbable ? 0 : -1} ?disabled=${this.disabled}
          @click=${() => this.choose(option.value)} @keydown=${this.onKeydown}>
          <span class="name">${option.label}</span>
          ${meta ? html`<span class="meta">${renderIcon(option.icon)}${option.count ?? nothing}</span>` : nothing}
        </button>`;
      })}
    </div>`;
    if (this.options.length <= 3) return radios;
    return html`${radios}<div class="picker">
      <select aria-label=${this.label || nothing} ?disabled=${this.disabled} @change=${this.onSelect}>
        ${this.options.map((option) => html`<option value=${option.value} .selected=${option.value === this.value}>${option.count === undefined ? option.label : `${option.label} (${option.count})`}</option>`)}
      </select>
      ${renderIcon(ICON_CHEVRON_DOWN)}
    </div>`;
  }

  static styles = [
    BASE_CSS,
    css`
      /* The height is reserved up front, so the page below doesn't shift when the options render. */
      :host { display: block; min-width: 0; max-width: 480px; container-type: inline-size; min-height: calc(var(--lu-target) + var(--lu-space-1) * 2 + 2px); }
      :host([data-tall]) { min-height: calc(var(--lu-row) + var(--lu-space-1) * 2 + 2px); }
      :host([hidden]) { display: none; }
      .tray { display: flex; gap: var(--lu-space-1); padding: var(--lu-space-1); border: 1px solid var(--lu-edge); border-radius: var(--lu-radius-control); background: var(--lu-material-well); box-shadow: var(--lu-neumorphic-inset); }
      .segment { position: relative; display: grid; flex: 1 1 0; min-width: 0; min-height: var(--lu-target); align-content: center; justify-items: center; gap: 2px; padding: var(--lu-space-1) var(--lu-space-2); border: 1px solid transparent; border-radius: max(calc(var(--lu-radius-control) - 5px), 6px); color: var(--lu-ink-2); background: transparent; font: 500 var(--lu-type-label)/1.2 var(--lu-font); cursor: pointer; transition: background-color var(--lu-motion-label) var(--lu-ease); -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
      :host([data-tall]) .segment { min-height: var(--lu-row); }
      .segment[aria-checked="true"] { color: var(--lu-ink); background: var(--lu-glass-raised); border-color: var(--lu-edge-raised); box-shadow: var(--lu-highlight-raised); font-weight: 600; }
      .segment[aria-checked="true"]::after { content: ""; position: absolute; top: var(--lu-space-2); right: var(--lu-space-2); width: 6px; height: 6px; border-radius: 50%; background: var(--lu-accent); }
      .segment:is(:active, [data-pressed]):not(:disabled) { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); transition: none; }
      .segment:disabled { cursor: not-allowed; opacity: var(--lu-material-disabled-opacity); }
      @media (hover: hover) and (pointer: fine) { .segment[aria-checked="false"]:hover:not(:disabled) { background: var(--lu-material-hover-wash); } }
      .name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .meta { display: inline-flex; align-items: center; gap: var(--lu-space-1); font-size: var(--lu-type-caption); font-variant-numeric: tabular-nums; }
      .meta .icon { --lu-icon: 14px; }

      /* More than 3 options and a narrow container: a native select instead of squeezed labels. */
      .picker { display: none; position: relative; }
      select { width: 100%; min-height: var(--lu-target); padding: 0 calc(var(--lu-space-3) + 24px) 0 var(--lu-space-4); border: 1px solid var(--lu-edge-raised); border-radius: var(--lu-radius-control); color: var(--lu-ink); background: var(--lu-glass-raised); color-scheme: inherit; font: 600 var(--lu-type-label)/1.2 var(--lu-font); appearance: none; -webkit-appearance: none; cursor: pointer; text-overflow: ellipsis; }
      select:disabled { opacity: var(--lu-material-disabled-opacity); cursor: not-allowed; }
      .picker .icon { position: absolute; top: 50%; right: var(--lu-space-3); translate: 0 -50%; pointer-events: none; color: var(--lu-ink-2); }
      @container (max-width: 359px) {
        .tray:has(~ .picker) { display: none; }
        .picker { display: block; }
      }
      @media (prefers-reduced-motion: reduce) { .segment { transition: none; } }
      @media (forced-colors: active) { .segment[aria-checked="true"] { border-color: Highlight; border-width: 2px; } }
    `,
  ];
}
