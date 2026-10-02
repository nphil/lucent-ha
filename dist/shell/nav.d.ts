import type { PropertyValues, TemplateResult } from "lit";
import { LuElement } from "../core/element.js";
import type { NavMode } from "../tokens/profile-model.js";
import type { LuDestination } from "./nav-model.js";
/** What `lu-navigate` carries: the destination that was chosen (and its link, when it has one). */
export interface LuNavigateDetail {
    id: string;
    href?: string;
}
/** The places a user can go, drawn as tabs in the app bar, a row of pills, a bottom bar or a left rail (`mode`).
 * It is a `<nav>` holding links (destinations with an `href`) or buttons, never a tablist: the current one carries
 * `aria-current="page"` and a small accent mark, which stays readable without colour. Every destination shows its
 * label on every screen size.
 *
 * Choosing one fires `lu-navigate` (`{ id, href? }`) and changes nothing else: you route, then set `current`. A plain
 * click on a link is taken over; a click with Ctrl, Cmd, Shift, Alt or the middle button is left to the browser.
 *
 * With `shortcuts` on, the digits 1-9 (or a destination's own `shortcut` key) jump to a destination on screens with a
 * mouse or trackpad, never while a text field, dialog or popup has the key. Each destination then tells assistive
 * technology its key (`aria-keyshortcuts`) and shows a tooltip and a small key cap on hover and keyboard focus. */
export declare class LuNav extends LuElement {
    static luName: string;
    static properties: {
        destinations: {
            attribute: boolean;
        };
        current: {
            type: StringConstructor;
        };
        mode: {
            type: StringConstructor;
            reflect: boolean;
        };
        label: {
            type: StringConstructor;
        };
        shortcuts: {
            type: BooleanConstructor;
        };
    };
    destinations: readonly LuDestination[];
    /** The id of the current destination. An id that matches none marks nothing as current. */
    current: string;
    /** `tabs` (in the app bar), `pills` (a row under it), `bottom` (a bar at the bottom of the screen: 3 to 5 destinations) or `rail` (a column at the left). */
    mode: NavMode;
    /** Names the navigation landmark for screen readers. */
    label: string;
    /** Digits 1-9 (or each destination's own `shortcut`) jump to a destination, on fine pointers only. */
    shortcuts: boolean;
    private _finePointer;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    protected updated(changed: PropertyValues): void;
    /** The key listener exists only while the element is connected and shortcuts are on. */
    private _listenForKeys;
    private _onKeydown;
    /** Choosing the destination you are already on does nothing (no duplicate history entry for a re-tap). */
    private _choose;
    private _onLinkClick;
    private _renderItem;
    render(): TemplateResult<1>;
    static styles: import("lit").CSSResult[];
}
declare global {
    interface HTMLElementEventMap {
        "lu-navigate": CustomEvent<LuNavigateDetail>;
    }
}
