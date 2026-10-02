import { css, html } from "lit";
import { LuElement } from "../core/element.ts";
import { BASE_CSS } from "../tokens/base-css.ts";

export type GridKind = "camera" | "species" | "visit" | "custom";

/** The column rule, shared by `lu-grid` and the tiles skeleton of `lu-state` (which renders a real `lu-grid`).
 * `--lu-grid-min` is the smallest tile; `--lu-grid-floor` is how many columns always fit (small tiles shrink a
 * little rather than drop to one column on a phone). Layout internals, not tokens: the sizes themselves come from
 * `--lu-tile-min*`, `--lu-gutter`, `--lu-content-max` and `--lu-tile-max`. */
export const GRID_CSS = css`
  :host { display: grid; width: 100%; min-width: 0; max-width: var(--lu-content-max); margin-inline: auto; gap: var(--lu-gutter); --lu-grid-min: var(--lu-tile-min); --lu-grid-floor: 1; grid-template-columns: repeat(auto-fill, minmax(min(var(--lu-grid-min), calc((100% - (var(--lu-grid-floor) - 1) * var(--lu-gutter)) / var(--lu-grid-floor))), 1fr)); }
  :host([kind="camera"]) { --lu-grid-min: var(--lu-tile-min-camera); }
  :host([kind="species"]) { --lu-grid-min: var(--lu-tile-min-species); --lu-grid-floor: 2; }
  :host([kind="visit"]) { --lu-grid-min: var(--lu-tile-min-visit); }
  ::slotted(*) { width: 100%; min-width: 0; max-width: var(--lu-tile-max); justify-self: center; }
`;

/** A grid of tiles that fills whatever room its container gives it (never the window): as many columns as fit
 * tiles of at least the kind's minimum width, tiles never wider than `--lu-tile-max`, the whole grid capped at
 * `--lu-content-max` and centred. Put it in a block-level parent (a section, the shell's content area).
 *
 * - `kind`: `camera` (360 px tiles), `species` (176; two columns always fit), `visit` (280), `custom` (`--lu-tile-min`).
 * - `min`: smallest tile in px, overrides the kind.
 * - `lazy`: long grids further down the page cost nothing until scrolled near (`content-visibility: auto`). */
export class LuGrid extends LuElement {
  static override luName = "grid";

  static properties = {
    kind: { type: String, reflect: true },
    min: { type: Number },
    lazy: { type: Boolean, reflect: true },
  };

  declare kind: GridKind;
  declare min: number;
  declare lazy: boolean;

  constructor() {
    super();
    this.kind = "custom";
    this.min = 0;
    this.lazy = false;
  }

  static override styles = [BASE_CSS, GRID_CSS, css`
    :host([lazy]) { content-visibility: auto; contain-intrinsic-size: auto 600px; }
  `];

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (!changed.has("min")) return;
    if (this.min > 0) this.style.setProperty("--lu-grid-min", `${this.min}px`);
    else this.style.removeProperty("--lu-grid-min");
  }

  protected override render() {
    return html`<slot></slot>`;
  }
}
