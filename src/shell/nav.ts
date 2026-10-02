import { css, html, nothing } from "lit";
import type { PropertyValues, TemplateResult } from "lit";
import { deepActiveElement, isTextEntry } from "../core/dom.ts";
import { LuElement } from "../core/element.ts";
import { renderIcon } from "../core/icon.ts";
import { BASE_CSS } from "../tokens/base-css.ts";
import type { NavMode } from "../tokens/profile-model.ts";
import { accessibleName, formatBadge, resolveCurrent } from "./nav-model.ts";
import type { LuDestination } from "./nav-model.ts";
import { isLayerNode, matchShortcut, shortcutHint, shortcutKey } from "./shortcuts.ts";

/** What `lu-navigate` carries: the destination that was chosen (and its link, when it has one). */
export interface LuNavigateDetail {
  id: string;
  href?: string;
}

/** The places a user can go, drawn as tabs in the app bar, a row of pills, a bottom bar or a left rail (`mode`).
 * It is a `<nav>` holding links (destinations with an `href`) or buttons, never a tablist: the current one carries
 * `aria-current="page"` and a small accent mark, which stays readable without colour. Every destination shows its
 * label on every screen size.
 *
 * Choosing one fires `lu-navigate` (`{ id, href? }`) and changes nothing else: you route, then set `current`. A plain
 * click on a link is taken over; a click with Ctrl, Cmd, Shift, Alt or the middle button is left to the browser.
 *
 * With `shortcuts` on, the digits 1-9 (or a destination's own `shortcut` key) jump to a destination on screens with a
 * mouse or trackpad, never while a text field, dialog or popup has the key. Each destination then tells assistive
 * technology its key (`aria-keyshortcuts`) and shows a tooltip and a small key cap on hover and keyboard focus. */
export class LuNav extends LuElement {
  static luName = "nav";

  static properties = {
    destinations: { attribute: false },
    current: { type: String },
    mode: { type: String, reflect: true },
    label: { type: String },
    shortcuts: { type: Boolean },
  };

  declare destinations: readonly LuDestination[];
  /** The id of the current destination. An id that matches none marks nothing as current. */
  declare current: string;
  /** `tabs` (in the app bar), `pills` (a row under it), `bottom` (a bar at the bottom of the screen: 3 to 5 destinations) or `rail` (a column at the left). */
  declare mode: NavMode;
  /** Names the navigation landmark for screen readers. */
  declare label: string;
  /** Digits 1-9 (or each destination's own `shortcut`) jump to a destination, on fine pointers only. */
  declare shortcuts: boolean;

  private _finePointer: MediaQueryList | undefined;

  constructor() {
    super();
    this.destinations = [];
    this.current = "";
    this.mode = "tabs";
    this.label = "Sections";
    this.shortcuts = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._listenForKeys();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this._onKeydown);
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has("shortcuts")) this._listenForKeys();
  }

  /** The key listener exists only while the element is connected and shortcuts are on. */
  private _listenForKeys(): void {
    window.removeEventListener("keydown", this._onKeydown);
    if (this.shortcuts && this.isConnected) window.addEventListener("keydown", this._onKeydown);
  }

  private _onKeydown = (event: KeyboardEvent): void => {
    this._finePointer ??= matchMedia("(hover: hover) and (pointer: fine)");
    if (!this._finePointer.matches) return;
    const active = deepActiveElement();
    const destination = matchShortcut(this.destinations, event, {
      typing: isTextEntry(active) || active instanceof HTMLSelectElement,
      insideLayer: event.composedPath().some((node) => node instanceof Element && isLayerNode({ tag: node.localName, role: node.getAttribute("role"), hasPopoverAttribute: node.hasAttribute("popover") })),
    });
    if (!destination) return;
    event.preventDefault();
    this._choose(destination);
  };

  /** Choosing the destination you are already on does nothing (no duplicate history entry for a re-tap). */
  private _choose(destination: LuDestination): void {
    if (destination.id === this.current) return;
    this.emit<LuNavigateDetail>("lu-navigate", destination.href ? { id: destination.id, href: destination.href } : { id: destination.id });
  }

  private _onLinkClick(event: MouseEvent, destination: LuDestination): void {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this._choose(destination);
  }

  private _renderItem(destination: LuDestination, index: number, current: boolean): TemplateResult {
    const key = this.shortcuts ? shortcutKey(destination, index) : undefined;
    const badge = formatBadge(destination.badge);
    const content = html`<span class="glyph">${renderIcon(destination.icon)}</span><span class="label">${destination.label}</span>${badge ? html`<span class="badge" aria-hidden="true">${badge}</span>` : nothing}${key ? html`<kbd class="hint" aria-hidden="true">${key.toUpperCase()}</kbd>` : nothing}`;
    const name = badge ? accessibleName(destination) : nothing;
    const title = key ? shortcutHint(destination, index) : nothing;
    const state = current ? "page" : nothing;
    return html`<li>${destination.href
      ? html`<a class="item" href=${destination.href} aria-current=${state} aria-label=${name} aria-keyshortcuts=${key ?? nothing} title=${title} @click=${(event: MouseEvent) => this._onLinkClick(event, destination)}>${content}</a>`
      : html`<button class="item" type="button" aria-current=${state} aria-label=${name} aria-keyshortcuts=${key ?? nothing} title=${title} @click=${() => this._choose(destination)}>${content}</button>`}</li>`;
  }

  render() {
    const current = resolveCurrent(this.destinations, this.current);
    return html`<nav aria-label=${this.label}><ul>${this.destinations.map((destination, index) => this._renderItem(destination, index, destination === current))}</ul></nav>`;
  }

  static styles = [BASE_CSS, css`
    :host { display: block; min-width: 0; --lu-icon: calc(var(--lu-target) / 2); }
    nav { min-width: 0; height: 100%; }
    ul { display: flex; height: 100%; margin: 0; padding: 0; list-style: none; gap: var(--lu-space-1); }
    li { display: flex; min-width: 0; }
    .item { position: relative; display: flex; align-items: center; justify-content: center; gap: var(--lu-space-2); min-width: var(--lu-target); min-height: var(--lu-target); max-width: 100%; margin: 0; padding: 0 var(--lu-space-4); scroll-margin: 0; border: 0; border-radius: var(--lu-radius-control); background-color: transparent; color: color-mix(in srgb, var(--lu-bar-ink) 72%, transparent); font: 600 var(--lu-type-label)/1.2 var(--lu-font); text-decoration: none; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: background-color var(--lu-motion-label) var(--lu-ease), color var(--lu-motion-label) var(--lu-ease); }
    .item:is(:active, [data-pressed]) { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); transition: none; }
    .item[aria-current] { color: var(--lu-bar-ink); background-color: var(--lu-material-selected-wash); }
    @media (hover: hover) and (pointer: fine) {
      .item:hover:not([aria-current]) { color: var(--lu-bar-ink); background-color: var(--lu-material-hover-wash); }
    }
    .glyph { display: inline-flex; flex: none; }
    .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* A count or short word: after the label in a row, on the icon's corner when the label sits under the icon. */
    .badge { flex: none; min-width: calc(var(--lu-type-caption) * 1.5); margin-inline-start: calc(var(--lu-space-1) * -1); padding: 0 var(--lu-space-1); border-radius: var(--lu-radius-pill); background: var(--lu-accent); color: var(--lu-accent-ink); font: 700 var(--lu-type-caption)/1.5 var(--lu-font); text-align: center; }
    /* The mark that says "you are here": a short accent bar, so it still reads as a shape without colour. */
    .item::after { content: ""; position: absolute; background: var(--lu-accent); opacity: 0; pointer-events: none; transition: opacity var(--lu-motion-label) var(--lu-ease); }
    .item[aria-current]::after { opacity: 1; }
    @media (forced-colors: active) { .item[aria-current]::after { background: Highlight; forced-color-adjust: none; } }
    /* Shortcut key cap: only where a mouse or trackpad exists, only while the item is hovered or has keyboard focus. */
    .hint { display: none; }
    @media (hover: hover) and (pointer: fine) {
      .hint { display: block; position: absolute; top: 2px; inset-inline-end: 3px; min-width: calc(var(--lu-type-caption) * 1.4); padding: 0 3px; border: 1px solid var(--lu-edge); border-radius: 6px; background: var(--lu-glass-raised); color: var(--lu-bar-ink); font: 600 var(--lu-type-caption)/1.2 var(--lu-font); text-align: center; opacity: 0; pointer-events: none; transition: opacity var(--lu-motion-label) var(--lu-ease); }
      .item:is(:hover, :focus-visible) .hint { opacity: 1; }
    }

    :host([mode="tabs"]) .item { border-radius: var(--lu-radius-control) var(--lu-radius-control) 0 0; }
    :host([mode="tabs"]) .item::after { inset-inline: var(--lu-space-3); bottom: 0; height: 3px; border-radius: 3px 3px 0 0; }

    :host([mode="pills"]) ul { width: max-content; }
    :host([mode="pills"]) .item { flex: none; padding: 0 var(--lu-space-5); border-radius: var(--lu-radius-pill); }
    :host([mode="pills"]) .item[aria-current] { box-shadow: inset 0 0 0 1px var(--lu-edge-raised); }
    :host([mode="pills"]) .item::after { inset-inline: calc(50% - 10px); bottom: 5px; height: 3px; border-radius: 3px; }

    :host([mode="bottom"]) ul { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 0; }
    :host([mode="bottom"]) li { display: block; padding: var(--lu-space-1) 1px; }
    :host([mode="bottom"]) .item { flex-direction: column; gap: 2px; width: 100%; height: 100%; min-width: 0; padding: 2px; font-size: var(--lu-type-caption); }
    :host([mode="bottom"]) .item::after { top: 0; inset-inline: calc(50% - 14px); height: 3px; border-radius: 0 0 3px 3px; }
    :host([mode="bottom"]) .label { max-width: 100%; }

    :host([mode="rail"]) ul { flex-direction: column; height: auto; padding: var(--lu-space-2) var(--lu-space-1); }
    :host([mode="rail"]) li { display: block; }
    :host([mode="rail"]) .item { flex-direction: column; gap: 2px; width: 100%; min-width: 0; min-height: calc(var(--lu-target) + var(--lu-space-2)); padding: var(--lu-space-1); font-size: var(--lu-type-caption); line-height: 1.2; text-align: center; }
    :host([mode="rail"]) .label { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; white-space: normal; overflow-wrap: anywhere; }
    :host([mode="rail"]) .item::after { inset-inline-start: 0; top: calc(50% - 12px); width: 3px; height: 24px; border-radius: 0 3px 3px 0; }
    :host([mode="rail"]) .item:dir(rtl)::after { border-radius: 3px 0 0 3px; }
    :host(:is([mode="bottom"], [mode="rail"])) .badge { position: absolute; top: 5px; inset-inline-start: calc(50% + var(--lu-space-2)); margin: 0; }
    @media (hover: hover) and (pointer: fine) {
      :host(:is([mode="bottom"], [mode="rail"])) .hint { top: 0; inset-inline: 0 auto; }
    }
    @media (prefers-reduced-motion: reduce) { .item { transition: none; } }
  `];
}

declare global {
  interface HTMLElementEventMap {
    "lu-navigate": CustomEvent<LuNavigateDetail>;
  }
}
