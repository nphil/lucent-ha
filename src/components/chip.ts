import { css, html, nothing } from "lit";
import { LuElement } from "../core/element.ts";
import { renderIcon } from "../core/icon.ts";
import { BASE_CSS } from "../tokens/base-css.ts";
import { chipIcon, chipKind, type LuChipKind } from "./chip-model.ts";
import { ICON_CHECK } from "./controls-icons.ts";

/** A small label for a state or a piece of evidence.
 *
 * By default it is a passive badge: it is never focusable and not a control. `kind` colours it (`positive`,
 * `warning`, `danger`, `info`, `live`, `neutral`); every colour comes with an icon and a text, so the meaning
 * survives without colour. `kind="evidence"` is the photo badge: just an icon and an optional `count`, with `label`
 * kept as the accessible name. Set `overlay` when the chip sits on a photo or video: it then gets the strong
 * reading surface instead of the see-through card one.
 *
 * `interactive` turns it into a real 48px button (a filter chip or a chip-button): `selected` marks it as chosen
 * (a check mark plus `aria-pressed`) and the default slot / `detail` slot hold a main and a quiet second line. */
export class LuChip extends LuElement {
  static luName = "chip";

  static properties = {
    kind: { type: String, reflect: true },
    icon: { type: String },
    label: { type: String },
    count: { type: Number },
    interactive: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    overlay: { type: Boolean, reflect: true },
  };

  /** "neutral" | "positive" | "warning" | "danger" | "info" | "live" | "evidence". */
  declare kind: LuChipKind;
  /** `mdi:name` or SVG path data; each kind has a default icon. */
  declare icon: string;
  /** The text. Optional when the default slot holds it. For `kind="evidence"` it is the accessible name only. */
  declare label: string;
  /** A number shown after the text (or beside the icon of an evidence badge). Hidden when `undefined`. */
  declare count: number | undefined;
  declare interactive: boolean;
  /** Interactive chips only. */
  declare selected: boolean;
  declare disabled: boolean;
  /** Sits on a photo or video: use the reading surface. */
  declare overlay: boolean;

  constructor() {
    super();
    this.kind = "neutral";
    this.icon = "";
    this.label = "";
    this.count = undefined;
    this.interactive = false;
    this.selected = false;
    this.disabled = false;
    this.overlay = false;
  }

  render() {
    const kind = chipKind(this.kind);
    const evidence = kind === "evidence";
    const icon = renderIcon(this.interactive && this.selected ? ICON_CHECK : chipIcon(kind, this.icon));
    const text = evidence
      ? html`<span class="sr-only">${this.label}<slot></slot></span>`
      : html`<span class="text"><slot>${this.label}</slot></span>`;
    const count = this.count === undefined ? nothing : html`<span class="count">${this.count}</span>`;
    if (this.interactive) {
      return html`<button class="chip ${kind}" type="button" aria-pressed=${this.selected ? "true" : "false"} ?disabled=${this.disabled}>
        ${icon}
        <span class="lines"><span class="lead">${text}${count}</span><span class="detail"><slot name="detail"></slot></span></span>
      </button>`;
    }
    return html`<span class="chip ${kind}" title=${evidence && this.label ? this.label : nothing}>${icon}${text}${count}</span>`;
  }

  static styles = [
    BASE_CSS,
    css`
      :host { display: inline-flex; min-width: 0; max-width: 100%; vertical-align: middle; }
      :host([hidden]) { display: none; }
      .chip { --lu-icon: calc(var(--lu-type-caption) * 1.35); display: inline-flex; align-items: center; gap: var(--lu-space-1); min-width: 0; max-width: 100%; min-height: max(28px, calc(var(--lu-type-caption) * 2)); padding: 0 var(--lu-space-3) 0 var(--lu-space-2); border: 1px solid var(--lu-edge); border-radius: var(--lu-radius-pill); color: var(--lu-ink); background: var(--lu-tile); font: 600 var(--lu-type-caption)/1.25 var(--lu-font); font-variant-numeric: tabular-nums; }
      :host([overlay]) .chip { background: var(--lu-reading); }
      .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .count { flex: none; }
      .evidence { padding: 0 var(--lu-space-2); }
      .evidence:has(.count) { padding-right: var(--lu-space-3); }
      /* Meaning comes from the icon and the text; the colour only supports it (mixed toward the ink so the icon keeps 3:1 on glass too). */
      .positive .icon { color: color-mix(in srgb, var(--lu-positive) 45%, var(--lu-ink)); }
      .warning .icon { color: color-mix(in srgb, var(--lu-warning) 45%, var(--lu-ink)); }
      .danger .icon { color: color-mix(in srgb, var(--lu-danger) 45%, var(--lu-ink)); }
      .info .icon { color: color-mix(in srgb, var(--lu-info) 45%, var(--lu-ink)); }
      .live .icon { --lu-icon: 10px; margin: 0 var(--lu-space-1); color: color-mix(in srgb, var(--lu-live) 45%, var(--lu-ink)); }
      .positive { border-color: color-mix(in srgb, var(--lu-positive) 40%, var(--lu-edge)); }
      .warning { border-color: color-mix(in srgb, var(--lu-warning) 40%, var(--lu-edge)); }
      .danger { border-color: color-mix(in srgb, var(--lu-danger) 40%, var(--lu-edge)); }
      .info { border-color: color-mix(in srgb, var(--lu-info) 40%, var(--lu-edge)); }
      .live { border-color: color-mix(in srgb, var(--lu-live) 40%, var(--lu-edge)); }

      /* Interactive: a 48px button. */
      button.chip { --lu-icon: 20px; min-height: var(--lu-target); padding: var(--lu-space-1) var(--lu-space-3) var(--lu-space-1) var(--lu-space-2); border-radius: var(--lu-radius-control); font: 500 var(--lu-type-label)/1.25 var(--lu-font); text-align: left; cursor: pointer; transition: background-color var(--lu-motion-label) var(--lu-ease); -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
      button.chip .icon { color: var(--lu-accent); }
      .lines { display: grid; min-width: 0; }
      .lead { display: inline-flex; align-items: baseline; gap: var(--lu-space-1); min-width: 0; font-weight: 600; }
      .detail { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--lu-ink); font-size: var(--lu-type-caption); font-weight: 400; }
      ::slotted([slot="detail"]) { display: block; overflow: hidden; text-overflow: ellipsis; }
      button.chip[aria-pressed="true"] { background: var(--lu-material-selected-wash); border-color: var(--lu-edge-raised); box-shadow: var(--lu-highlight-raised); }
      button.chip[aria-pressed="true"] .icon { color: var(--lu-ink); }
      button.chip:is(:active, [data-pressed]):not(:disabled) { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); transition: none; }
      button.chip:disabled { color: var(--lu-ink-3); cursor: not-allowed; }
      button.chip:disabled .icon { color: inherit; opacity: var(--lu-material-disabled-opacity); }
      @media (hover: hover) and (pointer: fine) { button.chip:hover:not(:disabled) { background: var(--lu-glass-raised); } }
      @media (prefers-reduced-motion: reduce) { button.chip { transition: none; } }
      @media (forced-colors: active) { .chip { border-color: CanvasText; } button.chip[aria-pressed="true"] { border-width: 2px; } }
    `,
  ];
}
