import { LuElement } from "../core/element.js";
import { LuButton } from "./button.js";
type View = "idle" | "charging" | "draining" | "done" | "asking";
/** Hold to confirm. Press and hold the button for 1.5 seconds and a fill sweeps across it; letting go early drains
 * the fill back and does nothing. Completing the hold fires ONE `lu-confirm`.
 *
 * The hold is a shortcut, never the only way: a quick tap, or Enter / Space, turns the button into an ordinary
 * "Cancel / Confirm" pair in the same place, and Confirm fires the same `lu-confirm` (detail `{ via: "button" }`;
 * `{ via: "hold" }` for the hold). Use `consequence` to say, in one line, exactly what will happen to what. The
 * hold also stops when the pointer is cancelled, the finger slides off, the key is released, focus moves away or
 * the page is hidden. Set `busy` while your action runs. */
export declare class LuHoldButton extends LuElement {
    static luName: string;
    static luDeps: (typeof LuButton)[];
    static properties: {
        label: {
            type: StringConstructor;
        };
        completeLabel: {
            type: StringConstructor;
            attribute: string;
        };
        confirmLabel: {
            type: StringConstructor;
            attribute: string;
        };
        holdingLabel: {
            type: StringConstructor;
            attribute: string;
        };
        cancelLabel: {
            type: StringConstructor;
            attribute: string;
        };
        icon: {
            type: StringConstructor;
        };
        kind: {
            type: StringConstructor;
            reflect: boolean;
        };
        consequence: {
            type: StringConstructor;
        };
        duration: {
            type: NumberConstructor;
        };
        busy: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        disabled: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        view: {
            state: boolean;
        };
    };
    label: string;
    /** Shown briefly after the action is confirmed. */
    completeLabel: string;
    /** Text of the confirm button in the tap alternative. */
    confirmLabel: string;
    /** Shown while the button is being held. */
    holdingLabel: string;
    cancelLabel: string;
    /** `mdi:name` or SVG path data; default is none (a check appears when done). */
    icon: string;
    /** "secondary" (default) | "danger". */
    kind: "secondary" | "danger";
    /** One line naming the exact target and outcome, shown above the button. */
    consequence: string;
    /** Milliseconds to hold (default 1500, Lucent's `--lu-hold`). */
    duration: number;
    /** The confirmed action is running: spinner, no presses. */
    busy: boolean;
    disabled: boolean;
    view: View;
    private hold;
    private animation;
    private settleTimer;
    private pressRect;
    private keyHeld;
    constructor();
    private get config();
    private get locked();
    disconnectedCallback(): void;
    protected willUpdate(): void;
    /** The fill bar sweeps with the Web Animations API: linear, compositor-driven, nothing runs on a timer while idle. */
    private sweep;
    private begin;
    /** The press ended. `cancelled` = it did not end normally (never counts as a tap). */
    private end;
    private cancel;
    private stopListening;
    private drained;
    private complete;
    private confirmed;
    private ask;
    private closeAsk;
    private onPointerDown;
    /** A finger that slid off the button has let go of it. */
    private onPointerMove;
    private onPointerUp;
    private onKeydown;
    private onKeyup;
    /** A click with no pointer press and no key hold behind it comes from assistive technology: treat it as a tap. */
    private onClick;
    private onAskKeydown;
    private renderAsk;
    render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult[];
}
export {};
