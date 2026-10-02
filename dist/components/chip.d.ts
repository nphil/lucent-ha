import { LuElement } from "../core/element.js";
import { type LuChipKind } from "./chip-model.js";
/** A small label for a state or a piece of evidence.
 *
 * By default it is a passive badge: it is never focusable and not a control. `kind` colours it (`positive`,
 * `warning`, `danger`, `info`, `live`, `neutral`); every colour comes with an icon and a text, so the meaning
 * survives without colour. `kind="evidence"` is the photo badge: just an icon and an optional `count`, with `label`
 * kept as the accessible name. Set `overlay` when the chip sits on a photo or video: it then gets the strong
 * reading surface instead of the see-through card one.
 *
 * `interactive` turns it into a real 48px button (a filter chip or a chip-button): `selected` marks it as chosen
 * (a check mark plus `aria-pressed`) and the default slot / `detail` slot hold a main and a quiet second line. */
export declare class LuChip extends LuElement {
    static luName: string;
    static properties: {
        kind: {
            type: StringConstructor;
            reflect: boolean;
        };
        icon: {
            type: StringConstructor;
        };
        label: {
            type: StringConstructor;
        };
        count: {
            type: NumberConstructor;
        };
        interactive: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        selected: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        disabled: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        overlay: {
            type: BooleanConstructor;
            reflect: boolean;
        };
    };
    /** "neutral" | "positive" | "warning" | "danger" | "info" | "live" | "evidence". */
    kind: LuChipKind;
    /** `mdi:name` or SVG path data; each kind has a default icon. */
    icon: string;
    /** The text. Optional when the default slot holds it. For `kind="evidence"` it is the accessible name only. */
    label: string;
    /** A number shown after the text (or beside the icon of an evidence badge). Hidden when `undefined`. */
    count: number | undefined;
    interactive: boolean;
    /** Interactive chips only. */
    selected: boolean;
    disabled: boolean;
    /** Sits on a photo or video: use the reading surface. */
    overlay: boolean;
    constructor();
    render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult[];
}
