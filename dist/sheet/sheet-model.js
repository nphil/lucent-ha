/** The life of one sheet: closed, open, closing (the exit motion is playing). Every way of closing goes through `close()`,
 * so a sheet is closed exactly once per opening, whichever of Escape, scrim, swipe, button, Back or code gets there first.
 *
 * - `open` flips to false the moment a close starts; `closed` (and `lu-close`) comes when the exit motion is over.
 * - A close started by the user or by code pops the sheet's history entry; a close that comes *from* the history entry
 *   (the system Back button) does not pop it again.
 * - If the owner asks for the sheet to open again while it is still leaving, it opens when the exit has finished. */
export class SheetLifecycle {
    constructor(effects, pushLayer) {
        this.phase = "closed";
        this._layer = null;
        this._reason = "api";
        this._wanted = { history: false, layer: "sheet" };
        this._effects = effects;
        this._push = pushLayer;
    }
    /** Opens the sheet (and its history entry). Does nothing while it is open; while it is leaving, it opens afterwards. */
    open(options) {
        this._wanted = options;
        if (this.phase !== "closed")
            return;
        this._effects.show();
        this.phase = "open";
        if (options.history && this._push)
            this._layer = this._push(options.layer, (reason) => this._layerClosed(reason));
    }
    /** Starts closing. Returns false when the sheet is not open (already closing, or closed): the first reason wins. */
    close(reason) {
        if (this.phase !== "open")
            return false;
        this.phase = "closing";
        this._reason = reason;
        this._effects.setOpen(false);
        const layer = this._layer;
        this._layer = null;
        if (layer?.open)
            layer.close(reason);
        this._effects.exit(reason);
        return true;
    }
    /** The exit motion has finished. */
    exited() {
        if (this.phase !== "closing")
            return;
        this.phase = "closed";
        this._effects.closed(this._reason);
        if (this._effects.wantsOpen())
            this.open(this._wanted);
    }
    /** The element is leaving the page: give the history entry back without any motion or event. The sheet counts as closed
     * before the entry is given back, because the layer manager runs `onClose` inside `close()`. */
    dispose() {
        const layer = this._layer;
        this._layer = null;
        this.phase = "closed";
        if (layer?.open)
            layer.close("api");
    }
    _layerClosed(reason) {
        // The browser has already removed the history entry; closing the sheet must not remove it a second time.
        this._layer = null;
        this.close(reason === "back" ? "back" : "api");
    }
}
/** How far the on-screen keyboard covers the bottom of the page, in px, from the visual viewport (`window.visualViewport`):
 * the part of the layout viewport that is neither visible above `offsetTop` nor inside the visual viewport. A pinch-zoomed
 * page also has a smaller visual viewport; that is not a keyboard, so it counts as 0. */
export function keyboardInset(viewport) {
    if (viewport.scale > 1.01)
        return 0;
    return Math.max(0, Math.round(viewport.innerHeight - viewport.height - viewport.offsetTop));
}
/** Where focus goes when a sheet opens: the sheet itself (a container with a name, nothing that opens the keyboard), or,
 * for a mouse and keyboard user, the element the content marked `autofocus`. On a touch screen a text field is never focused
 * on its own: that would raise the on-screen keyboard over half the sheet (idea from Music Assistant's `dialog_focus.ts`). */
export function initialFocus(touch, hasAutofocusTarget) {
    return !touch && hasAutofocusTarget ? "target" : "container";
}
export function keyScroll(key, shift) {
    switch (key) {
        case "ArrowDown": return { direction: 1, unit: "line" };
        case "ArrowUp": return { direction: -1, unit: "line" };
        case "PageDown": return { direction: 1, unit: "page" };
        case "PageUp": return { direction: -1, unit: "page" };
        case " ": return { direction: shift ? -1 : 1, unit: "page" };
        case "End": return { direction: 1, unit: "edge" };
        case "Home": return { direction: -1, unit: "edge" };
        default: return null;
    }
}
/** Where a scroller ends up after such a key: a line is 40 px, a page 87.5 % of its height (what browsers do), an edge is the
 * top or the bottom; never outside the content. */
export function scrolledTo(scroll, view) {
    const max = Math.max(0, view.scrollHeight - view.height);
    const distance = scroll.unit === "line" ? 40 : scroll.unit === "page" ? Math.round(view.height * 0.875) : Infinity;
    return Math.min(max, Math.max(0, view.top + scroll.direction * distance));
}
/** The browsers where "an element with a backdrop filter is the root of the backdrop of what is inside it" was checked, pixel by pixel:
 * Chromium's (Chrome, headless Chrome, Edge, Android's WebView and Silk, Samsung Internet), whose user agents all carry
 * `Chrome/<version>` (`HeadlessChrome/<version>` too). Safari, Firefox and every browser on iOS (`CriOS`, `FxiOS`) do not. */
export const rootsItsBackdrop = (userAgent) => /Chrome\/\d/.test(userAgent);
const BRIGHTNESS = /^brightness\(\s*(\d*\.?\d+)\s*(%?)\s*\)$/i;
/** `none`, or nothing at all (a token that is not set), is no filter. */
const isFilter = (text) => !/^(none)?$/i.test(text.trim());
/** `backdropRoot`: see `rootsItsBackdrop`. */
export function dialogLook(scrimFilter, surfaceFilter, backdropRoot) {
    const scrim = scrimFilter.trim();
    const match = BRIGHTNESS.exec(scrim);
    const level = match ? Number(match[1]) / (match[2] ? 100 : 1) : Number.NaN;
    return {
        dim: level >= 0 && level <= 1 ? Math.round((1 - level) * 1e4) / 1e4 : null,
        flatFrost: backdropRoot && isFilter(scrim) && isFilter(surfaceFilter),
    };
}
