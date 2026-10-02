/** What the model needs to know about one element between the finger and the sheet's panel, innermost first. The DOM
 * side (`swipe.ts`) fills these from a composed path, so shadow roots are no obstacle. */
export interface SwipeNode {
    /** Lower-case tag name. */
    tag: string;
    /** ARIA role attribute, "" when none. */
    role: string;
    /** `type` of an `<input>`, "" for anything else. */
    inputType: string;
    /** Current `scrollTop` (0 for elements that do not scroll). */
    scrollTop: number;
    /** The drag handle itself. */
    handle: boolean;
    /** Part of the header band that a finger can grab. */
    grab: boolean;
    /** Carries `data-no-sheet-drag`: a gesture that starts inside never moves the sheet. */
    noDrag: boolean;
    /** Content-editable text. */
    editable: boolean;
}
/** `handle`: the drag starts at once (24 px dismisses). `swipe`: wait for a clearly downward move (72 px dismisses).
 * `none`: this gesture belongs to something else. */
export type SwipeStartKind = "handle" | "swipe" | "none";
/** Decides what a press at the start of a gesture means. `path` is the elements from the one under the finger up to (not
 * including) the panel. `touch` is false for a mouse or pen.
 *
 * - The handle always starts a drag. The header band starts one for a finger (a mouse keeps it for selecting text), unless
 *   the press is on a button, link, field or `data-no-sheet-drag` element.
 * - Anywhere else a finger may swipe, unless it started on a slider/text field or inside something already scrolled down. */
export declare function classifyStart(path: readonly SwipeNode[], touch: boolean): SwipeStartKind;
/** How the panel looks while it follows the finger: it fades to half as it travels (`max(.5, 1 - d/400)`). */
export declare function followOpacity(distance: number): number;
export type SwipeMove = "none" | "pending" | "engaged" | "drag";
export type SwipeEnd = "none" | "dismiss" | "reset";
/** The gesture itself, with no DOM and no clock of its own. Feed it the start, the moves and the end of one finger (or
 * mouse button); it tells you when a drag begins, how far the panel should be down, and whether the release dismisses.
 *
 * - A swipe starts as a *candidate*. Until the finger has moved 10 px nothing happens. Then it is a drag only if the move
 *   is downward and more vertical than horizontal; anything else hands the gesture back to the page for good.
 * - A drag measures its distance from where it began (so the panel never jumps by the slop), never goes up, and
 *   dismisses when the release is at least 24 px (handle) or 72 px (swipe) down.
 * - Right after a swipe (or a long drag) a click is swallowed for 400 ms, so lifting the finger over a button does not press it. */
export declare class SwipeModel {
    /** How far the panel is dragged down, in px (0 until a drag has started). */
    distance: number;
    /** How the current or last drag started. */
    via: "handle" | "swipe";
    private _phase;
    private _id;
    private _x;
    private _y;
    private _threshold;
    private _endedAt;
    /** A gesture is being watched (candidate or drag). */
    get active(): boolean;
    /** A drag is under way. */
    get dragging(): boolean;
    /** Starts watching a press. Returns `engaged` for a handle drag (it moves at once), `candidate` for a swipe that still
     * has to prove itself, `none` when the gesture is not ours or another one is already being dragged. */
    begin(id: number, x: number, y: number, kind: SwipeStartKind): "engaged" | "candidate" | "none";
    move(id: number, x: number, y: number): SwipeMove;
    /** The finger lifted. `now` is a millisecond clock (it only matters for the click guard). */
    end(id: number, now: number): SwipeEnd;
    /** The browser took the gesture away (pointercancel / touchcancel) or a second finger joined: the panel goes back.
     * Returns true when a drag was in progress. */
    cancel(): boolean;
    /** True for a click that arrives so soon after a swipe that it is the lift of the finger, not a tap. */
    swallowsClick(now: number): boolean;
    private _engage;
}
