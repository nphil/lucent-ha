import { LuElement } from "../core/element.js";
/** The look of the secondary and danger pills, shared with the hold button.
 *
 * In glass themes the card is see-through, so a translucent pill can end up with light text on a light patch of the
 * wallpaper. The pill therefore sits on `--lu-reading` (a near-opaque page colour) with its usual glass wash laid over
 * it as an inset shadow: the same look in flat themes, readable text in glass ones. The danger label stays in the
 * ordinary ink colour (red text on a tinted pill does not reach 4.5:1 in every theme); the danger colour carries the
 * border, the tint and the icon. */
export declare const PILL_SURFACE_CSS: import("lit").CSSResult;
export type LuButtonKind = "primary" | "secondary" | "danger" | "quiet";
/** One button for every look: a pill with text (and an optional icon), a round icon-only button, or a quiet text
 * button. `primary` is the one main action of a task, `secondary` the ordinary one, `danger` a destructive one,
 * `quiet` a low-key text action (or, with `icon-only`, a plain toolbar icon).
 *
 * It draws a real `<button>` (or an `<a>` when `href` is set) in its shadow root, so keyboard, focus and
 * accessibility are the browser's. Listen for the normal `click` on the element; it never fires while the button
 * is `disabled` or `loading`. `loading` shows a spinner, keeps the width and ignores clicks. */
export declare class LuButton extends LuElement {
    static luName: string;
    static formAssociated: boolean;
    static shadowRootOptions: {
        delegatesFocus: boolean;
        clonable?: boolean;
        customElementRegistry?: CustomElementRegistry;
        mode: ShadowRootMode;
        serializable?: boolean;
        slotAssignment?: SlotAssignmentMode;
    };
    static properties: {
        kind: {
            type: StringConstructor;
            reflect: boolean;
        };
        icon: {
            type: StringConstructor;
        };
        iconOnly: {
            type: BooleanConstructor;
            attribute: string;
            reflect: boolean;
        };
        label: {
            type: StringConstructor;
        };
        loading: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        disabled: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        href: {
            type: StringConstructor;
        };
        target: {
            type: StringConstructor;
        };
        type: {
            type: StringConstructor;
        };
    };
    /** "primary" | "secondary" | "danger" | "quiet". */
    kind: LuButtonKind;
    /** `mdi:name` or SVG path data. */
    icon: string;
    /** Show only the icon in a round 48px button. `label` is then required: it becomes the accessible name. */
    iconOnly: boolean;
    /** The text of the button; with `icon-only`, its accessible name. The default slot works too. */
    label: string;
    loading: boolean;
    disabled: boolean;
    /** Renders a link (`<a>`) instead of a button. */
    href: string;
    target: string;
    /** "button" (default) | "submit" | "reset": what a click does to an enclosing `<form>`. */
    type: "button" | "submit" | "reset";
    private readonly internals;
    constructor();
    private get blocked();
    /** Programmatic `.click()` on the element behaves like a click on the button inside (and respects disabled). */
    click(): void;
    private onClick;
    render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult[];
}
