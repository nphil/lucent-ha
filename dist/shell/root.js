import { css } from "lit";
import { html } from "lit/static-html.js";
import { LuElement } from "../core/element.js";
import { trackPresses } from "../core/press.js";
import { LuToast } from "../sheet/toast.js";
import { BASE_CSS } from "../tokens/base-css.js";
import { PanelProfile } from "../tokens/profile.js";
import { TOKENS_CSS } from "../tokens/tokens-css.js";
/** The foundation for anything that is not a whole panel: it declares the design tokens, works out the device
 * profile and gives its content instant press feedback and a toast host. Put your card (or a standalone piece of UI)
 * inside it and everything inside, toolkit elements and your own CSS, can read the `--lu-*` tokens.
 *
 * - `mode="card"` (default): sized by its own width only, never by the window, and adds no global listeners, so
 *   many cards on one dashboard stay cheap.
 * - `mode="panel"`: also follows the window height and input type (short screens, touch or mouse), like the app shell.
 *
 * It sets `data-lu-profile`, `data-lu-short` and `data-lu-touch` on itself, which the tokens switch on. It has no app
 * bar and no navigation; for a full panel use the app shell. Toasts raised anywhere inside it (`showToast`) appear in it. */
export class LuRoot extends LuElement {
    /** The root's own width in px as last measured (0 before the first measurement). */
    get panelWidth() { return this._profile?.width ?? 0; }
    /** The device profile this root resolved: `{ profile, short, touch, nav }` (see `lu-profile-change`). */
    get profile() { return this._profile?.state; }
    constructor() {
        super();
        this._profile = null;
        this._profileMode = null;
        this._stopPresses = null;
        this._onToast = (event) => {
            const toast = this.renderRoot.querySelector("[data-toast]");
            if (!toast)
                return;
            toast.show(event.detail);
            // The nearest root shows it: a card inside an app shell must not toast twice.
            event.preventDefault();
            event.stopPropagation();
        };
        this.mode = "card";
    }
    connectedCallback() {
        // The profile must exist before the first render, so the very first frame already has the right sizes.
        this._syncProfile();
        super.connectedCallback();
        this.addEventListener("lu-toast", this._onToast);
        this._stopPresses ??= trackPresses(this);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this.removeEventListener("lu-toast", this._onToast);
        this._stopPresses?.();
        this._stopPresses = null;
    }
    willUpdate(changed) {
        if (changed.has("mode"))
            this._syncProfile();
    }
    /** One profile controller per mode: the mode decides whether it listens to the window. */
    _syncProfile() {
        if (this._profile && this._profileMode === this.mode)
            return;
        if (this._profile) {
            this._profile.hostDisconnected();
            this.removeController(this._profile);
        }
        this._profile = new PanelProfile(this, { mode: this.mode === "panel" ? "panel" : "card", onChange: (state) => { this.emit("lu-profile-change", state); } });
        this._profileMode = this.mode;
    }
    render() {
        return html `<slot></slot><${this.luTag("toast")} data-toast></${this.luTag("toast")}>`;
    }
}
LuRoot.luName = "root";
LuRoot.luDeps = [LuToast];
LuRoot.properties = {
    mode: { type: String, reflect: true },
};
LuRoot.styles = [TOKENS_CSS, BASE_CSS, css `
    :host { display: block; container-type: inline-size; color: var(--lu-ink); font-family: var(--lu-font); }
  `];
