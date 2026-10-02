import { LitElement, css, html, nothing } from "lit";
import { LuElement } from "../core/element.ts";
import { renderIcon } from "../core/icon.ts";
import { BASE_CSS, CONTROLS_CSS } from "../tokens/base-css.ts";

/** The danger pill: the label stays in the ordinary ink colour (red text on a tinted glass pill does not reach 4.5:1 in
 * every theme), the danger colour carries the border, the tint and the icon. Shared with the hold button. */
export const DANGER_PILL_CSS = css`
  .pill.danger { color: var(--lu-ink); background: color-mix(in srgb, var(--lu-danger) 18%, var(--lu-glass-raised)); border-color: color-mix(in srgb, var(--lu-danger) 55%, var(--lu-edge)); }
  .pill.danger .icon { color: var(--lu-danger); }
`;

export type LuButtonKind = "primary" | "secondary" | "danger" | "quiet";

/** One button for every look: a pill with text (and an optional icon), a round icon-only button, or a quiet text
 * button. `primary` is the one main action of a task, `secondary` the ordinary one, `danger` a destructive one,
 * `quiet` a low-key text action (or, with `icon-only`, a plain toolbar icon).
 *
 * It draws a real `<button>` (or an `<a>` when `href` is set) in its shadow root, so keyboard, focus and
 * accessibility are the browser's. Listen for the normal `click` on the element; it never fires while the button
 * is `disabled` or `loading`. `loading` shows a spinner, keeps the width and ignores clicks. */
export class LuButton extends LuElement {
  static luName = "button";
  static formAssociated = true;
  static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static properties = {
    kind: { type: String, reflect: true },
    icon: { type: String },
    iconOnly: { type: Boolean, attribute: "icon-only", reflect: true },
    label: { type: String },
    loading: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    href: { type: String },
    target: { type: String },
    type: { type: String },
  };

  /** "primary" | "secondary" | "danger" | "quiet". */
  declare kind: LuButtonKind;
  /** `mdi:name` or SVG path data. */
  declare icon: string;
  /** Show only the icon in a round 48px button. `label` is then required: it becomes the accessible name. */
  declare iconOnly: boolean;
  /** The text of the button; with `icon-only`, its accessible name. The default slot works too. */
  declare label: string;
  declare loading: boolean;
  declare disabled: boolean;
  /** Renders a link (`<a>`) instead of a button. */
  declare href: string;
  declare target: string;
  /** "button" (default) | "submit" | "reset": what a click does to an enclosing `<form>`. */
  declare type: "button" | "submit" | "reset";

  private readonly internals = this.attachInternals();

  constructor() {
    super();
    this.kind = "secondary";
    this.icon = "";
    this.iconOnly = false;
    this.label = "";
    this.loading = false;
    this.disabled = false;
    this.href = "";
    this.target = "";
    this.type = "button";
  }

  private get blocked(): boolean {
    return this.disabled || this.loading;
  }

  /** Programmatic `.click()` on the element behaves like a click on the button inside (and respects disabled). */
  click(): void {
    if (!this.blocked) this.renderRoot.querySelector<HTMLElement>(".button")?.click();
  }

  private onClick(event: MouseEvent): void {
    if (this.blocked) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (this.href) return;
    const form = this.internals.form;
    if (this.type === "submit") form?.requestSubmit();
    else if (this.type === "reset") form?.reset();
  }

  render() {
    const content = html`
      ${this.loading ? html`<span class="spinner" aria-hidden="true"></span>` : renderIcon(this.icon)}
      ${this.iconOnly ? nothing : html`<span class=${this.loading && !this.icon ? "label masked" : "label"}><slot>${this.label}</slot></span>`}
    `;
    const shape = this.iconOnly ? "icon-button" : this.kind === "quiet" ? "text-button" : "pill";
    const classes = `button ${shape} ${this.kind}${this.loading ? " loading" : ""}${this.icon || this.iconOnly ? " has-icon" : ""}`;
    const name = this.iconOnly ? this.label || nothing : nothing;
    if (this.href) {
      const blank = this.target === "_blank";
      return html`<a class=${classes} href=${this.disabled ? nothing : this.href} target=${this.target || nothing} rel=${blank ? "noopener noreferrer" : nothing}
        role=${this.disabled ? "link" : nothing} aria-disabled=${this.disabled ? "true" : nothing} aria-busy=${this.loading ? "true" : nothing} aria-label=${name} @click=${this.onClick}>${content}</a>`;
    }
    return html`<button class=${classes} type="button" ?disabled=${this.disabled} aria-busy=${this.loading ? "true" : nothing} aria-label=${name} @click=${this.onClick}>${content}</button>`;
  }

  static styles = [
    BASE_CSS,
    CONTROLS_CSS,
    DANGER_PILL_CSS,
    css`
      :host { display: inline-flex; min-width: 0; max-width: 100%; vertical-align: middle; }
      :host([hidden]) { display: none; }
      .button { position: relative; text-decoration: none; min-width: var(--lu-target); max-width: 100%; font-family: var(--lu-font); -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; }
      .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .label.masked { color: transparent; }
      .pill .icon, .text-button .icon { --lu-icon: 20px; }
      .text-button { gap: var(--lu-space-2); color: var(--lu-ink); }
      .icon-button { color: var(--lu-ink); }
      .icon-button.secondary { background: var(--lu-glass-raised); box-shadow: var(--lu-highlight-rest); border: 1px solid var(--lu-edge-raised); }
      .icon-button.primary { color: var(--lu-accent-ink); background: var(--lu-accent); }
      .icon-button.danger { color: var(--lu-danger); background: color-mix(in srgb, var(--lu-danger) 18%, var(--lu-glass-raised)); border: 1px solid color-mix(in srgb, var(--lu-danger) 55%, var(--lu-edge)); }
      /* Where the browser can pick black or white text for the theme's accent colour, the label stays readable even on a light accent. */
      @supports (color: contrast-color(red)) { .pill.primary, .icon-button.primary { color: contrast-color(var(--lu-accent)); } }
      .button:disabled, .button[aria-disabled="true"] { cursor: not-allowed; }
      .icon-button:is(:active, [data-pressed]):not(:disabled) { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); }
      .icon-button:disabled, .text-button:disabled, .text-button[aria-disabled="true"], .icon-button[aria-disabled="true"] { opacity: var(--lu-material-disabled-opacity); }
      .button[aria-disabled="true"]:is(:active, [data-pressed]) { background-image: none; }
      @media (hover: hover) and (pointer: fine) {
        .pill.primary:hover:not(:disabled), .icon-button:hover:not(:disabled) { background-image: linear-gradient(var(--lu-material-hover-wash), var(--lu-material-hover-wash)); }
        .text-button:hover:not(:disabled) { background: var(--lu-material-hover-wash); }
      }
      /* Loading: the spinner takes the icon's place (or sits centred over a hidden label), so the width never changes. */
      .spinner { flex: none; width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; }
      .loading:not(.has-icon) .spinner { position: absolute; inset: 0; margin: auto; }
      .loading { cursor: progress; }
      @media (prefers-reduced-motion: no-preference) { .spinner { animation: lu-spin 0.9s linear infinite; } }
      @keyframes lu-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .button { transition: none; } }
      @media (forced-colors: active) {
        .button { border: 1px solid ButtonText; }
        .button:disabled, .button[aria-disabled="true"] { border-color: GrayText; color: GrayText; }
      }
    `,
  ];
}
