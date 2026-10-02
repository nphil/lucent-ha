import { css, nothing } from "lit";
import { html } from "lit/static-html.js";
import { LuElement } from "../core/element.js";
import { renderIcon } from "../core/icon.js";
import { BASE_CSS } from "../tokens/base-css.js";
import { LuState } from "./state.js";
/** A titled block of content that always says what it is doing: shaped placeholders while loading, a calm
 * one-liner when empty, and an honest message with a retry when it failed. (Kestrel's `kestrel-section`.)
 *
 * `count` is how many items the slotted content holds. With none, the slot stays hidden and `state` decides
 * what shows instead. With some, an `error` means a later page failed: the content stays and a "Couldn't load
 * more" line follows it. `variant` shapes the loading placeholder: `rows` for a list, `thumbs` for a rail.
 * `noun` completes the messages ("Couldn't load visits."); `empty` is the text for a section with nothing in it.
 * Slots: default content, `actions` (header, right-aligned). Event `lu-retry` (from the inner `lu-state`). One
 * section wraps ONE group; consecutive sections are separated by a hairline, never boxed. */
export class LuSection extends LuElement {
    constructor() {
        super();
        this.icon = "";
        this.heading = "";
        this.summary = "";
        this.state = "ready";
        this.count = 0;
        this.empty = "Nothing here yet";
        this.noun = "items";
        this.variant = "rows";
    }
    _renderBody() {
        const state = this.luTag("state");
        if (this.count > 0) {
            if (this.state !== "error")
                return html `<slot></slot>`;
            return html `<${state} kind="error" compact message="Couldn't load more." retry-label="Try again"><slot></slot></${state}>`;
        }
        if (this.state === "loading")
            return html `<${state} kind="loading" variant=${this.variant} heading=${`Loading ${this.noun}`}></${state}>`;
        if (this.state === "error")
            return html `<${state} kind="error" compact message=${`Couldn't load ${this.noun}.`} retry-label="Try again"></${state}>`;
        return html `<${state} kind="empty" compact message=${this.empty}></${state}>`;
    }
    render() {
        return html `<section aria-labelledby="title">
      <div class="head">
        <h3 id="title">${renderIcon(this.icon)}<span class="text">${this.heading}${this.summary ? html ` <span class="summary">· ${this.summary}</span>` : nothing}</span></h3>
        <div class="actions"><slot name="actions"></slot></div>
      </div>
      ${this._renderBody()}
    </section>`;
    }
}
LuSection.luName = "section";
LuSection.luDeps = [LuState];
LuSection.properties = {
    icon: { type: String },
    heading: { type: String },
    summary: { type: String },
    state: { type: String },
    count: { type: Number },
    empty: { type: String },
    noun: { type: String },
    variant: { type: String },
};
LuSection.styles = [BASE_CSS, css `
    :host { display: block; min-width: 0; }
    :host(:not(:first-child)) { margin-top: var(--lu-space-5); padding-top: var(--lu-space-4); border-top: 1px solid var(--lu-edge); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: var(--lu-space-3); min-height: var(--lu-target); }
    h3 { display: flex; align-items: center; gap: var(--lu-space-2); min-width: 0; margin: 0; font: 600 var(--lu-type-label)/1.3 var(--lu-font); }
    h3 .icon { --lu-icon: 20px; color: var(--lu-ink-2); }
    h3 .text { min-width: 0; overflow-wrap: anywhere; }
    .summary { color: var(--lu-ink-2); font-weight: 450; font-variant-numeric: tabular-nums; }
    .actions { display: flex; flex: none; align-items: center; gap: var(--lu-space-2); }
  `];
