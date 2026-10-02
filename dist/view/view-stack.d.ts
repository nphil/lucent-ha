import type { PropertyValues } from "lit";
import { LuElement } from "../core/element.js";
import type { LuScroller } from "../core/scroller.js";
/** What scrolls the page. A `LuScroller` fits; a bare `{ top, scrollTo }` works too, but then a returning view
 * is put back without waiting for its content to grow, and the offset is only remembered when a view is left. */
export type ViewScroller = Pick<LuScroller, "top" | "scrollTo"> & Partial<Pick<LuScroller, "target" | "element">>;
export interface LuViewEventDetail {
    /** The view's `data-view` id. */
    id: string;
}
declare global {
    interface HTMLElementEventMap {
        "lu-view-shown": CustomEvent<LuViewEventDetail>;
        "lu-view-hidden": CustomEvent<LuViewEventDetail>;
        "lu-view-evict": CustomEvent<LuViewEventDetail>;
    }
}
/** Keeps the views of a panel alive and shows one at a time (a tab bar's pages).
 *
 * Put the views inside as light-DOM children, each with `data-view="<id>"`, and set `current` to the id to
 * show. The others stay in the page, `inert` and skipped by rendering (`content-visibility: hidden`), so
 * coming back is a repaint, not a rebuild. The stack remembers how far each view was scrolled and puts it
 * back, fades a returning view in, and tells the views when they are shown, hidden or pushed out.
 *
 * Events (bubbling, composed; fired on the view's element, or on the stack when that view has none yet):
 * `lu-view-shown {id}`, `lu-view-hidden {id}` (pause live streams here), `lu-view-evict {id}` (more than
 * `max` views are alive: remove that view's element, the stack never removes nodes you render). */
export declare class LuViewStack extends LuElement {
    static luName: string;
    static properties: {
        current: {
            type: StringConstructor;
        };
        max: {
            type: NumberConstructor;
        };
        memoryKey: {
            type: StringConstructor;
            attribute: string;
        };
        scroller: {
            attribute: boolean;
        };
    };
    /** The `data-view` id to show; empty shows nothing. */
    current: string;
    /** How many views stay alive (default 4, at least 1). */
    max: number;
    /** Names the scroll memory. Stacks with the same key share it, so give each stack on a page its own. */
    memoryKey: string;
    /** What scrolls: default is the app shell's scroller when inside one in `contained` mode, else the page. */
    scroller: ViewScroller | undefined;
    private readonly _model;
    private readonly _restorer;
    private _switch;
    private _evicted;
    private _fade;
    private _tracked;
    private _stopTracking;
    constructor();
    /** The next time `id` is shown it starts at the top. Call it before showing a view that now holds different
     * content under the same id (a detail page reused for another item). It does nothing for the showing view. */
    forgetScroll(id: string): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    protected willUpdate(changed: PropertyValues<this>): void;
    protected updated(): void;
    /** Settles what `current` changed to while the old view is still the one on screen. */
    private _decide;
    /** The showing view is put back where it was and fades in. The first show of a view does not fade: it is
     * still filling in, and a fade would only delay it. */
    private _enter;
    /** Every view but the showing one is inert (no focus, hidden from assistive technology). */
    private _syncViews;
    /** Views the consumer took out of the page on its own stop counting against `max`. */
    private _dropGone;
    private _viewElement;
    private _announce;
    private _announceEvictions;
    private _scrollerNow;
    private _restoreScroller;
    /** Keeps the showing view's offset up to date while the user scrolls, so it survives the panel being
     * re-created (Home Assistant does that), when there is no moment left to read it. While a restore is holding
     * the offset the scroller is not where the user left it, so nothing is recorded. */
    private _track;
    protected render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult;
}
