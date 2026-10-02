import { type PropertyValues } from "lit";
import { LuElement } from "../core/element.js";
/** A number you nudge with minus and plus: label, value with unit, two 48px buttons.
 *
 * Press and hold a button to repeat (after 0.4 s, ten steps a second); the arrow keys, PageUp / PageDown (ten
 * steps), Home and End work on the value. Values stay on the `min` + n x `step` grid, so 0.1 steps never show
 * rounding noise. `value` follows the user's change and `lu-change` (detail `{ value }`) fires on every step,
 * including repeats: debounce on your side if each change calls a device. Set `error` to show a message under the
 * control (with an icon, not colour alone). Screen readers get a spin button with `aria-valuenow / min / max`. */
export declare class LuStepper extends LuElement {
    static luName: string;
    static properties: {
        value: {
            type: NumberConstructor;
        };
        min: {
            type: NumberConstructor;
        };
        max: {
            type: NumberConstructor;
        };
        step: {
            type: NumberConstructor;
        };
        label: {
            type: StringConstructor;
        };
        unit: {
            type: StringConstructor;
        };
        error: {
            type: StringConstructor;
        };
        disabled: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        decreaseLabel: {
            type: StringConstructor;
            attribute: string;
        };
        increaseLabel: {
            type: StringConstructor;
            attribute: string;
        };
    };
    value: number;
    min: number;
    max: number;
    step: number;
    label: string;
    /** Shown after the number ("min", "°C", "%"). */
    unit: string;
    /** A message shown under the control; empty = no error. */
    error: string;
    disabled: boolean;
    /** Start of the accessible names of the buttons: "Decrease" + label. */
    decreaseLabel: string;
    increaseLabel: string;
    private holdTimer;
    private holdRepeats;
    constructor();
    private get range();
    disconnectedCallback(): void;
    protected willUpdate(changed: PropertyValues<this>): void;
    /** Moves `steps` grid steps. Returns false when nothing changed (already at the limit). */
    private nudge;
    private setValue;
    private startHold;
    private stopHold;
    /** A click that is not from a pointer (keyboard, assistive technology) steps once; pointer presses stepped on down. */
    private onButtonClick;
    private onKeydown;
    private stepButton;
    render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult[];
}
