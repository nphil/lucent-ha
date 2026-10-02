/* Derived from music-assistant/frontend src/components/PanelDragHandle.vue:18-224 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md).
 * Modified: the Vue component's gesture logic is rewritten as a DOM-free state machine (`SwipeModel`) plus a pure
 * classifier of the elements under the finger (`classifyStart`, which reads a composed path instead of `closest`);
 * thresholds come from `SWIPE`; a mouse can only drag the handle, a finger can also drag the header and swipe
 * anywhere; text fields and more sliders are protected from swipes; the click guard also covers long handle drags. */
import { SWIPE } from "../tokens/constants.js";
/** Things a drag must never steal: sliders and maps handle their own drags (Home Assistant's own bottom sheet keeps the
 * same list), and so do the toolkit's sliders (`<prefix>-lu-slider`). */
const SLIDER_TAGS = {
    "ha-control-slider": true,
    "ha-slider": true,
    "ha-control-switch": true,
    "ha-control-circular-slider": true,
    "ha-hs-color-picker": true,
    "ha-map": true,
    "lu-slider": true,
};
const TEXT_INPUT_TYPES = { "": true, text: true, search: true, email: true, url: true, tel: true, password: true, number: true };
const CONTROL_TAGS = { button: true, a: true, input: true, select: true, textarea: true, summary: true };
/** True when a swipe that starts on or inside `node` must not move the sheet: text fields (a finger drag there places the
 * caret or scrolls the field), sliders, maps, anything marked `data-no-sheet-drag`, and anything already scrolled down
 * (that scroller owns the move). */
function isSwipeBlocked(node) {
    if (node.scrollTop > 0 || node.noDrag || node.editable)
        return true;
    if (node.tag === "textarea" || node.tag === "select")
        return true;
    if (node.tag === "input")
        return node.inputType === "range" || TEXT_INPUT_TYPES[node.inputType] === true;
    return SLIDER_TAGS[node.tag] === true || node.tag.endsWith("-lu-slider");
}
/** Decides what a press at the start of a gesture means. `path` is the elements from the one under the finger up to (not
 * including) the panel. `touch` is false for a mouse or pen.
 *
 * - The handle always starts a drag. The header band starts one for a finger (a mouse keeps it for selecting text), unless
 *   the press is on a button, link, field or `data-no-sheet-drag` element.
 * - Anywhere else a finger may swipe, unless it started on a slider/text field or inside something already scrolled down. */
export function classifyStart(path, touch) {
    let inGrab = false;
    let inControl = false;
    for (const node of path) {
        if (node.handle)
            return "handle";
        if (node.grab)
            inGrab = true;
        if (node.noDrag || node.role === "menuitem" || CONTROL_TAGS[node.tag] === true)
            inControl = true;
    }
    if (!touch)
        return "none";
    if (inGrab && !inControl)
        return "handle";
    return path.some(isSwipeBlocked) ? "none" : "swipe";
}
/** How the panel looks while it follows the finger: it fades to half as it travels (`max(.5, 1 - d/400)`). */
export function followOpacity(distance) {
    return Math.max(0.5, 1 - distance / 400);
}
/** The gesture itself, with no DOM and no clock of its own. Feed it the start, the moves and the end of one finger (or
 * mouse button); it tells you when a drag begins, how far the panel should be down, and whether the release dismisses.
 *
 * - A swipe starts as a *candidate*. Until the finger has moved 10 px nothing happens. Then it is a drag only if the move
 *   is downward and more vertical than horizontal; anything else hands the gesture back to the page for good.
 * - A drag measures its distance from where it began (so the panel never jumps by the slop), never goes up, and
 *   dismisses when the release is at least 24 px (handle) or 72 px (swipe) down.
 * - Right after a swipe (or a long drag) a click is swallowed for 400 ms, so lifting the finger over a button does not press it. */
export class SwipeModel {
    constructor() {
        /** How far the panel is dragged down, in px (0 until a drag has started). */
        this.distance = 0;
        /** How the current or last drag started. */
        this.via = "handle";
        this._phase = "idle";
        this._id = -1;
        this._x = 0;
        this._y = 0;
        this._threshold = SWIPE.handleDismiss;
        this._endedAt = -Infinity;
    }
    /** A gesture is being watched (candidate or drag). */
    get active() {
        return this._phase !== "idle";
    }
    /** A drag is under way. */
    get dragging() {
        return this._phase === "drag";
    }
    /** Starts watching a press. Returns `engaged` for a handle drag (it moves at once), `candidate` for a swipe that still
     * has to prove itself, `none` when the gesture is not ours or another one is already being dragged. */
    begin(id, x, y, kind) {
        if (kind === "none" || this._phase === "drag")
            return "none";
        this._id = id;
        if (kind === "handle") {
            this._engage(y, "handle", SWIPE.handleDismiss);
            return "engaged";
        }
        this._phase = "candidate";
        this._x = x;
        this._y = y;
        return "candidate";
    }
    move(id, x, y) {
        if (this._phase === "idle" || id !== this._id)
            return "none";
        if (this._phase === "candidate") {
            const dx = x - this._x;
            const dy = y - this._y;
            if (Math.abs(dx) < SWIPE.slop && Math.abs(dy) < SWIPE.slop)
                return "pending";
            if (dy >= SWIPE.slop && dy > Math.abs(dx)) {
                this._engage(y, "swipe", SWIPE.anywhereDismiss);
                return "engaged";
            }
            this._phase = "idle";
            return "none";
        }
        this.distance = Math.max(0, y - this._y);
        return "drag";
    }
    /** The finger lifted. `now` is a millisecond clock (it only matters for the click guard). */
    end(id, now) {
        if (id !== this._id)
            return "none";
        const wasDragging = this._phase === "drag";
        this._phase = "idle";
        if (!wasDragging)
            return "none";
        if (this.via === "swipe" || this.distance >= SWIPE.slop)
            this._endedAt = now;
        return this.distance >= this._threshold ? "dismiss" : "reset";
    }
    /** The browser took the gesture away (pointercancel / touchcancel) or a second finger joined: the panel goes back.
     * Returns true when a drag was in progress. */
    cancel() {
        const wasDragging = this._phase === "drag";
        this._phase = "idle";
        return wasDragging;
    }
    /** True for a click that arrives so soon after a swipe that it is the lift of the finger, not a tap. */
    swallowsClick(now) {
        return now - this._endedAt <= SWIPE.clickGuardMs;
    }
    _engage(y, via, threshold) {
        this._phase = "drag";
        this._y = y;
        this._threshold = threshold;
        this.via = via;
        this.distance = 0;
    }
}
