import { LuElement } from "../core/element.js";
export type GridKind = "camera" | "species" | "visit" | "custom";
/** The column rule, shared by `lu-grid` and the tiles skeleton of `lu-state` (which renders a real `lu-grid`).
 * `--lu-grid-min` is the smallest tile; `--lu-grid-floor` is how many columns always fit (small tiles shrink a
 * little rather than drop to one column on a phone). Layout internals, not tokens: the sizes themselves come from
 * `--lu-tile-min*`, `--lu-gutter`, `--lu-content-max` and `--lu-tile-max`. */
export declare const GRID_CSS: import("lit").CSSResult;
/** A grid of tiles that fills whatever room its container gives it (never the window): as many columns as fit
 * tiles of at least the kind's minimum width, tiles never wider than `--lu-tile-max`, the whole grid capped at
 * `--lu-content-max` and centred. Put it in a block-level parent (a section, the shell's content area).
 *
 * - `kind`: `camera` (360 px tiles), `species` (176; two columns always fit), `visit` (280), `custom` (`--lu-tile-min`).
 * - `min`: smallest tile in px, overrides the kind.
 * - `lazy`: long grids further down the page cost nothing until scrolled near (`content-visibility: auto`). */
export declare class LuGrid extends LuElement {
    static luName: string;
    static properties: {
        kind: {
            type: StringConstructor;
            reflect: boolean;
        };
        min: {
            type: NumberConstructor;
        };
        lazy: {
            type: BooleanConstructor;
            reflect: boolean;
        };
    };
    kind: GridKind;
    min: number;
    lazy: boolean;
    constructor();
    static styles: import("lit").CSSResult[];
    protected willUpdate(changed: Map<string, unknown>): void;
    protected render(): import("lit-html").TemplateResult<1>;
}
