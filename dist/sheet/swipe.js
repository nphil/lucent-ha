import { prefersReducedMotion } from "../core/dom.js";
import { SWIPE } from "../tokens/constants.js";
import { SwipeModel, classifyStart, followOpacity } from "./swipe-model.js";
/** The elements from the one under the finger up to (not including) the panel, as the model wants to see them. */
function describePath(path, panel) {
    const nodes = [];
    for (const target of path) {
        if (target === panel)
            break;
        if (!(target instanceof Element))
            continue;
        nodes.push({
            tag: target.localName,
            role: target.getAttribute("role") ?? "",
            inputType: target instanceof HTMLInputElement ? target.type : "",
            scrollTop: target.scrollTop,
            handle: target.hasAttribute("data-sheet-handle"),
            grab: target.hasAttribute("data-sheet-grab"),
            noDrag: target.hasAttribute("data-no-sheet-drag"),
            editable: target instanceof HTMLElement && target.isContentEditable,
        });
    }
    return nodes;
}
/** Swipe down to dismiss, for a bottom sheet. The handle and the header can be dragged by a finger, a mouse or a pen;
 * a finger can also swipe down from anywhere in the sheet that is not scrolled, a slider, a text field or marked
 * `data-no-sheet-drag`. The panel follows the finger (translate + fade); a release past 24 px (handle) or 72 px
 * (swipe) calls `onDismiss`, a shorter one springs back. A click that arrives right after a swipe is swallowed.
 *
 * Mouse and pen drags need the panel to be hit by pointer events; touch needs nothing but `touch-action: none` on
 * the handle and header (the sheet's CSS sets it). Attaches its listeners to the panel while the host is connected. */
export class SwipeDismiss {
    constructor(host, options) {
        this._model = new SwipeModel();
        this._panel = null;
        this._onTouchStart = (event) => {
            const panel = this._panel;
            const touch = event.changedTouches[0];
            if (!panel || !touch)
                return;
            if (event.touches.length > 1) {
                // A second finger is a pinch, not a swipe.
                if (this._model.cancel())
                    this._springBack();
                return;
            }
            if (!this._options.enabled())
                return;
            const kind = classifyStart(describePath(event.composedPath(), panel), true);
            if (this._model.begin(touch.identifier, touch.clientX, touch.clientY, kind) === "engaged")
                this._grab(panel);
        };
        this._onTouchMove = (event) => {
            const panel = this._panel;
            const touch = event.changedTouches[0];
            if (!panel || !touch || !this._model.active)
                return;
            const result = this._model.move(touch.identifier, touch.clientX, touch.clientY);
            if (result === "engaged")
                this._grab(panel);
            if (result !== "engaged" && result !== "drag")
                return;
            if (event.cancelable)
                event.preventDefault();
            this._follow(panel);
        };
        this._onTouchEnd = (event) => {
            const touch = event.changedTouches[0];
            if (touch)
                this._release(this._model.end(touch.identifier, performance.now()));
        };
        this._onTouchCancel = () => {
            if (this._model.cancel())
                this._springBack();
        };
        this._onPointerDown = (event) => {
            const panel = this._panel;
            if (!panel || event.pointerType === "touch" || event.button !== 0 || !this._options.enabled())
                return;
            const kind = classifyStart(describePath(event.composedPath(), panel), false);
            if (this._model.begin(event.pointerId, event.clientX, event.clientY, kind) !== "engaged")
                return;
            event.preventDefault();
            panel.setPointerCapture(event.pointerId);
            this._grab(panel);
        };
        this._onPointerMove = (event) => {
            const panel = this._panel;
            if (!panel || event.pointerType === "touch")
                return;
            if (this._model.move(event.pointerId, event.clientX, event.clientY) === "drag")
                this._follow(panel);
        };
        this._onPointerUp = (event) => {
            if (event.pointerType === "touch")
                return;
            const panel = this._panel;
            if (panel?.hasPointerCapture(event.pointerId))
                panel.releasePointerCapture(event.pointerId);
            this._release(this._model.end(event.pointerId, performance.now()));
        };
        this._onPointerCancel = (event) => {
            if (event.pointerType === "touch")
                return;
            if (this._model.cancel())
                this._springBack();
        };
        /** The click that follows the lift of a swipe must not press whatever the finger ended over. */
        this._onClick = (event) => {
            if (!this._model.swallowsClick(performance.now()))
                return;
            event.preventDefault();
            event.stopPropagation();
        };
        this._host = host;
        this._options = options;
        host.addController(this);
    }
    hostConnected() {
        this._sync();
    }
    hostUpdated() {
        this._sync();
    }
    hostDisconnected() {
        this.abort();
        this.clear();
        this._detach();
    }
    /** Stops following a finger without moving the panel: the sheet is closing for another reason and its exit starts from
     * wherever the panel is. */
    abort() {
        this._model.cancel();
    }
    /** Puts the panel back to its resting style immediately (after the dialog closed, ready for the next opening). */
    clear() {
        clearTimeout(this._resetTimer);
        const style = this._panel?.style;
        if (!style)
            return;
        style.transform = "";
        style.opacity = "";
        style.transition = "";
        style.willChange = "";
    }
    _sync() {
        const panel = this._options.panel();
        if (panel === this._panel)
            return;
        this._detach();
        if (panel)
            this._attach(panel);
    }
    _attach(panel) {
        this._panel = panel;
        // Touch: the start is passive (it never blocks scrolling); the move is not, so a drag can cancel the page's own scroll.
        panel.addEventListener("touchstart", this._onTouchStart, { passive: true });
        panel.addEventListener("touchmove", this._onTouchMove, { passive: false });
        panel.addEventListener("touchend", this._onTouchEnd);
        panel.addEventListener("touchcancel", this._onTouchCancel);
        panel.addEventListener("pointerdown", this._onPointerDown);
        panel.addEventListener("pointermove", this._onPointerMove);
        panel.addEventListener("pointerup", this._onPointerUp);
        panel.addEventListener("pointercancel", this._onPointerCancel);
        panel.addEventListener("click", this._onClick, true);
    }
    _detach() {
        const panel = this._panel;
        if (!panel)
            return;
        panel.removeEventListener("touchstart", this._onTouchStart);
        panel.removeEventListener("touchmove", this._onTouchMove);
        panel.removeEventListener("touchend", this._onTouchEnd);
        panel.removeEventListener("touchcancel", this._onTouchCancel);
        panel.removeEventListener("pointerdown", this._onPointerDown);
        panel.removeEventListener("pointermove", this._onPointerMove);
        panel.removeEventListener("pointerup", this._onPointerUp);
        panel.removeEventListener("pointercancel", this._onPointerCancel);
        panel.removeEventListener("click", this._onClick, true);
        this._panel = null;
    }
    /** The panel starts to follow: no CSS transition in the way, and a compositor layer of its own for the duration. */
    _grab(panel) {
        clearTimeout(this._resetTimer);
        panel.style.transition = "none";
        panel.style.willChange = "transform, opacity";
    }
    _follow(panel) {
        const distance = this._model.distance;
        panel.style.transform = `translate3d(0, ${distance}px, 0)`;
        panel.style.opacity = String(followOpacity(distance));
    }
    _release(result) {
        if (result === "dismiss")
            this._options.onDismiss();
        else if (result === "reset")
            this._springBack();
    }
    /** A short drag: the panel goes back to rest (at once under reduced motion). */
    _springBack() {
        const panel = this._panel;
        if (!panel)
            return;
        if (prefersReducedMotion()) {
            this.clear();
            return;
        }
        panel.style.transition = `transform ${SWIPE.resetMs}ms var(--lu-ease), opacity ${SWIPE.resetMs}ms var(--lu-ease)`;
        panel.style.transform = "translate3d(0, 0, 0)";
        panel.style.opacity = "1";
        this._resetTimer = setTimeout(() => this.clear(), SWIPE.resetMs);
    }
}
