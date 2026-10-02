import { LuElement } from "../core/element.js";
import { LuState } from "./state.js";
export type SectionState = "loading" | "ready" | "error";
/** A titled block of content that always says what it is doing: shaped placeholders while loading, a calm
 * one-liner when empty, and an honest message with a retry when it failed. (Kestrel's `kestrel-section`.)
 *
 * `count` is how many items the slotted content holds. With none, the slot stays hidden and `state` decides
 * what shows instead. With some, an `error` means a later page failed: the content stays and a "Couldn't load
 * more" line follows it. `variant` shapes the loading placeholder: `rows` for a list, `thumbs` for a rail.
 * `noun` completes the messages ("Couldn't load visits."); `empty` is the text for a section with nothing in it.
 * Slots: default content, `actions` (header, right-aligned). Event `lu-retry` (from the inner `lu-state`). One
 * section wraps ONE group; consecutive sections are separated by a hairline, never boxed. */
export declare class LuSection extends LuElement {
    static luName: string;
    static luDeps: readonly [typeof LuState];
    static properties: {
        icon: {
            type: StringConstructor;
        };
        heading: {
            type: StringConstructor;
        };
        summary: {
            type: StringConstructor;
        };
        state: {
            type: StringConstructor;
        };
        count: {
            type: NumberConstructor;
        };
        empty: {
            type: StringConstructor;
        };
        noun: {
            type: StringConstructor;
        };
        variant: {
            type: StringConstructor;
        };
    };
    icon: string;
    heading: string;
    summary: string;
    state: SectionState;
    count: number;
    empty: string;
    noun: string;
    variant: "rows" | "thumbs";
    constructor();
    static styles: import("lit").CSSResult[];
    private _renderBody;
    protected render(): import("lit-html").TemplateResult;
}
