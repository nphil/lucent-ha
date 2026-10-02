import { LuElement } from "../core/element.js";
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
export declare class LuSegmented extends LuElement {
    static luName: string;
    static properties: {
        options: {
            attribute: boolean;
        };
        value: {
            type: StringConstructor;
        };
        label: {
            type: StringConstructor;
        };
        disabled: {
            type: BooleanConstructor;
            reflect: boolean;
        };
    };
    options: LuSegmentOption[];
    value: string;
    /** Names the group for screen readers (for example "Time range"). */
    label: string;
    disabled: boolean;
    constructor();
    /** Options with a count or icon get two lines, so the tray is taller. Empty options (still loading) reserve that height too. */
    protected willUpdate(): void;
    private choose;
    private onKeydown;
    private onSelect;
    render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult[];
}
