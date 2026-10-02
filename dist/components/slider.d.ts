import { type PropertyValues } from "lit";
import { LuElement } from "../core/element.js";
/** A slider: label and value, a shallow recessed track with a filled part, and an isolated thumb.
 *
 * It is a native `<input type="range">` underneath, so keyboard (arrows, PageUp / PageDown, Home, End), screen
 * readers and touch work the way the platform does; the hit area is the full 48px (64px on smart displays) although
 * the track is only 6px. A vertical swipe that starts on it still scrolls the page.
 *
 * `lu-input` (detail `{ value }`) fires while dragging, at most ten times a second, and the final value is always
 * sent. `lu-change` fires once when the choice is committed (finger lifted, or each key press). While the thumb is
 * held, a new `value` set from outside (a late state echo) is ignored, so the thumb never jumps from under the
 * finger; after release the value the user chose stands until you set `value` again. */
export declare class LuSlider extends LuElement {
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
        disabled: {
            type: BooleanConstructor;
            reflect: boolean;
        };
    };
    value: number;
    min: number;
    max: number;
    step: number;
    label: string;
    /** Shown after the value ("%", "°C", "min"). */
    unit: string;
    disabled: boolean;
    private shown;
    private readonly sendInput;
    constructor();
    private get range();
    disconnectedCallback(): void;
    protected willUpdate(changed: PropertyValues<this>): void;
    protected updated(): void;
    private onPointerDown;
    private release;
    private onInput;
    private onChange;
    render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult[];
}
