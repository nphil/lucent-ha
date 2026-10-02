import { css, html, nothing } from "lit";
import { LuElement } from "../core/element.js";
import { renderIcon } from "../core/icon.js";
import { BASE_CSS } from "../tokens/base-css.js";
/** Material Design Icons "chevron-right", as path data so the row needs no icon font. */
const CHEVRON = "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z";
/** A list row: a leading icon, a heading with an optional detail line, a `trailing` slot (a value, a chip, a
 * switch) and an optional chevron. At least `--lu-row` high, transparent at rest.
 *
 * It renders exactly ONE interactive element: a link when `href` is set, a button when `interactive` or
 * `selected` is set, otherwise plain text. The whole row is the hit area (a plain value in `trailing` passes the
 * tap on); controls you slot into `trailing` (button, link, input, switch, anything with `tabindex`, `role` or
 * `data-row-control`) stay separately clickable. Listen for `click` on the row; for a link, call
 * `preventDefault()` there to route inside Home Assistant instead of reloading the page.
 *
 * - Slot `leading`: a thumbnail or avatar (for example 56 px) before the heading; while it has content it replaces `icon`.
 * - `selected`: wash plus a small accent mark at the start edge, and `aria-current="true"` (not colour alone).
 * - `disabled`: the action is off and the icon dims, but the heading and the reason in `detail` stay readable.
 * - Long text is cut with an ellipsis. Keep rows directly stacked, with no gap. */
export class LuRow extends LuElement {
    constructor() {
        super();
        this.icon = "";
        this.heading = "";
        this.detail = "";
        this.href = "";
        this.selected = false;
        this.disabled = false;
        this.chevron = false;
        this.interactive = false;
        this._hasLeading = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this._hasLeading = this.querySelector(":scope > [slot='leading']") !== null;
    }
    _leadingChanged(event) {
        this._hasLeading = event.target.assignedNodes({ flatten: true }).length > 0;
    }
    render() {
        const link = this.href !== "";
        const button = !link && (this.interactive || this.selected);
        const actionable = link || button;
        const content = html `<span class="leading" ?hidden=${!this._hasLeading}><slot name="leading" @slotchange=${this._leadingChanged}></slot></span>${this._hasLeading ? nothing : renderIcon(this.icon, "icon lead")}<span class="text"><span class="heading">${this.heading}</span>${this.detail ? html `<span class="detail">${this.detail}</span>` : nothing}</span>`;
        const current = this.selected ? "true" : undefined;
        let hit;
        if (link && !this.disabled)
            hit = html `<a class="hit" href=${this.href} aria-current=${current ?? nothing}>${content}</a>`;
        else if (link)
            hit = html `<a class="hit" role="link" aria-disabled="true" aria-current=${current ?? nothing}>${content}</a>`;
        else if (button)
            hit = html `<button class="hit" type="button" ?disabled=${this.disabled} aria-current=${current ?? nothing}>${content}</button>`;
        else
            hit = html `<div class="hit">${content}</div>`;
        return html `<div class=${`row ${actionable ? "actionable" : ""} ${this.selected ? "selected" : ""} ${this.disabled ? "disabled" : ""}`}>
      ${hit}<span class="trailing"><slot name="trailing"></slot></span>${this.chevron ? renderIcon(CHEVRON, "icon chevron") : nothing}
    </div>`;
    }
}
LuRow.luName = "row";
LuRow.properties = {
    icon: { type: String },
    heading: { type: String },
    detail: { type: String },
    href: { type: String },
    selected: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    chevron: { type: Boolean },
    interactive: { type: Boolean },
    _hasLeading: { state: true },
};
LuRow.styles = [BASE_CSS, css `
    :host { display: block; min-width: 0; }
    .row { position: relative; display: flex; align-items: center; gap: var(--lu-space-3); min-height: var(--lu-row); padding-inline: var(--lu-space-3); border-radius: var(--lu-radius-row); color: var(--lu-ink); transition: background-color var(--lu-motion-label) var(--lu-ease); }
    .hit { display: flex; flex: 1; align-items: center; align-self: stretch; gap: var(--lu-space-3); min-width: 0; min-height: var(--lu-row); padding: var(--lu-space-1) 0; border: 0; color: inherit; background: transparent; font: inherit; text-align: start; text-decoration: none; }
    .actionable .hit { cursor: pointer; }
    .actionable .hit::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
    .actionable .hit:focus-visible { box-shadow: none !important; }
    .actionable:has(.hit:focus-visible) { box-shadow: var(--lu-focus-ring); }
    .actionable:has(.hit:is(:active, [data-pressed])) { background: var(--lu-material-press-wash); }
    .selected { background: var(--lu-material-selected-wash); }
    .selected::before { content: ""; position: absolute; inset-block: var(--lu-space-3); inset-inline-start: 0; width: 3px; border-radius: 3px; background: var(--lu-accent); }
    .leading { display: flex; flex: none; }
    .leading[hidden] { display: none; }
    .lead { color: var(--lu-ink-2); }
    .selected .lead { color: var(--lu-accent); }
    .text { display: grid; flex: 1; gap: 2px; min-width: 0; }
    .heading { font: 500 var(--lu-type-body)/1.3 var(--lu-font); }
    .detail { color: var(--lu-ink-2); font: 400 var(--lu-type-label)/1.3 var(--lu-font); }
    .heading, .detail { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .trailing { display: flex; flex: none; align-items: center; gap: var(--lu-space-2); color: var(--lu-ink-2); font: 400 var(--lu-type-label)/1.3 var(--lu-font); }
    .trailing:empty { display: none; }
    .chevron { color: var(--lu-ink-3); }
    .chevron:dir(rtl) { transform: scaleX(-1); }
    .actionable .trailing { position: relative; z-index: 1; pointer-events: none; }
    .actionable .trailing ::slotted(:is(a, button, input, select, textarea, summary, label, [tabindex], [role], [data-row-control])) { pointer-events: auto; }
    .disabled { cursor: not-allowed; }
    .disabled .heading { color: var(--lu-ink-3); }
    .disabled .lead { opacity: var(--lu-material-disabled-opacity); }
    @media (hover: hover) and (pointer: fine) { .actionable:not(.disabled):hover { background: var(--lu-material-hover-wash); } }
  `];
