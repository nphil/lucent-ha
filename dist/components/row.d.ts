import { LuElement } from "../core/element.js";
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
export declare class LuRow extends LuElement {
    static luName: string;
    static properties: {
        icon: {
            type: StringConstructor;
        };
        heading: {
            type: StringConstructor;
        };
        detail: {
            type: StringConstructor;
        };
        href: {
            type: StringConstructor;
        };
        selected: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        disabled: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        chevron: {
            type: BooleanConstructor;
        };
        interactive: {
            type: BooleanConstructor;
        };
        _hasLeading: {
            state: boolean;
        };
    };
    icon: string;
    heading: string;
    detail: string;
    href: string;
    selected: boolean;
    disabled: boolean;
    chevron: boolean;
    interactive: boolean;
    _hasLeading: boolean;
    constructor();
    connectedCallback(): void;
    private _leadingChanged;
    static styles: import("lit").CSSResult[];
    protected render(): import("lit-html").TemplateResult<1>;
}
