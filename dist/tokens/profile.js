import { deepActiveElement, isTextEntry } from "../core/dom.js";
import { classifyPointer, resolveProfile } from "./profile-model.js";
/** True while a text field has focus (anywhere, through shadow roots): the on-screen keyboard is probably up,
 * so a shrinking viewport height must not flip the layout to "short". */
function isTyping() {
    return isTextEntry(deepActiveElement());
}
function readPointer() {
    if (typeof matchMedia !== "function")
        return "mixed";
    const hover = matchMedia("(hover: hover)").matches ? "hover" : matchMedia("(hover: none)").matches ? "none" : undefined;
    const pointer = matchMedia("(pointer: fine)").matches ? "fine" : matchMedia("(pointer: coarse)").matches ? "coarse" : "none";
    return classifyPointer(hover, pointer);
}
/** Keeps `data-lu-profile`, `data-lu-short`, `data-lu-touch` and `data-lu-nav` on the host current, so the token
 * layer switches type, target and margin sizes by profile and the shell picks its navigation, and re-renders
 * the host when they change. The profile comes from the panel's own width (a ResizeObserver, never the
 * viewport width alone), the window height (not the visual viewport, so pinch zoom and the on-screen
 * keyboard cannot flip it) and the primary input (`hover`/`pointer`), never from the user agent. */
export class PanelProfile {
    constructor(host, options = {}) {
        this.width = 0;
        this.height = 0;
        this.state = { profile: "tablet", short: false, touch: false, nav: "pills" };
        this._resolved = false;
        this._frame = 0;
        this._refresh = () => { this._apply(this._host.clientWidth); };
        this._host = host;
        this._card = options.mode === "card";
        this._onChange = options.onChange;
        host.addController(this);
    }
    hostConnected() {
        if (typeof ResizeObserver !== "undefined") {
            // Applying the profile inside the observer callback changes tokens and layout, so the observed host can change size in
            // the same delivery and the browser logs "ResizeObserver loop completed with undelivered notifications". One coalesced
            // animation frame avoids that; the first measurement (below) and window resizes stay synchronous.
            this._observer = new ResizeObserver(() => this._schedule());
            this._observer.observe(this._host);
        }
        if (!this._card) {
            window.addEventListener("resize", this._refresh);
            window.addEventListener("orientationchange", this._refresh);
        }
        this._apply(this._host.clientWidth);
    }
    hostDisconnected() {
        this._observer?.disconnect();
        this._observer = undefined;
        if (this._frame)
            window.cancelAnimationFrame(this._frame);
        this._frame = 0;
        window.removeEventListener("resize", this._refresh);
        window.removeEventListener("orientationchange", this._refresh);
    }
    /** Re-reads the size and input now (for example after the host was moved or shown). */
    measure() {
        this._apply(this._host.clientWidth);
    }
    _schedule() {
        if (this._frame)
            return;
        this._frame = window.requestAnimationFrame(() => {
            this._frame = 0;
            this._apply(this._host.clientWidth);
        });
    }
    _apply(measured) {
        const width = Math.round(measured);
        if (width <= 0)
            return;
        const wasHeight = this.height;
        let height = this._card ? 1000 : Math.round(window.innerHeight);
        if (!this._card && this._resolved && height < wasHeight && isTyping())
            height = wasHeight;
        const pointer = readPointer();
        const viewportWidth = this._card ? width : Math.round(window.innerWidth);
        const next = resolveProfile({ width, height, viewportWidth, pointer }, this._resolved ? this.state : undefined);
        const prev = this.state;
        const changed = !this._resolved || Math.abs(width - this.width) > 1 || height !== this.height || next.profile !== prev.profile || next.short !== prev.short || next.touch !== prev.touch || next.nav !== prev.nav;
        if (!changed)
            return;
        this.width = width;
        this.height = height;
        this.state = next;
        this._resolved = true;
        const host = this._host;
        host.setAttribute("data-lu-profile", next.profile);
        host.toggleAttribute("data-lu-short", next.short);
        host.toggleAttribute("data-lu-touch", next.touch);
        if (this._card)
            host.removeAttribute("data-lu-nav");
        else
            host.setAttribute("data-lu-nav", next.nav);
        host.requestUpdate();
        this._onChange?.(next);
    }
}
