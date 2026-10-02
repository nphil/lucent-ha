import { css, html, nothing } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { LuElement } from "../core/element.js";
import { renderIcon } from "../core/icon.js";
import { BASE_CSS, CONTROLS_CSS } from "../tokens/base-css.js";
import { MOTION } from "../tokens/constants.js";
import { ICON_ALERT_CIRCLE, ICON_CHECK_CIRCLE, ICON_CLOSE } from "./sheet-icons.js";
import { registerToastHost } from "./toast-event.js";
import { ToastQueue } from "./toast-queue.js";
/** Older browsers have no `popover`; they get a plain fixed element. */
function supportsPopover() {
    return typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;
}
/** The toast host: one small message at a time, with an optional action (Undo, Retry), queued when several arrive.
 *
 * It lives in the browser's top layer (an HTML `popover`), so it sits above everything and no theme effect on a
 * parent (the glass themes' `backdrop-filter`) can trap or clip it. It floats at the bottom centre, above the shell's
 * bottom bar and the safe area. A polite live region (always in the page) announces the message; focus is never taken.
 * The clock stops while the pointer is over the toast, focus is inside it, a finger is on it or the tab is hidden, and
 * continues with the time that was left. A toast with an action stays at least 5 seconds; an error stays 8.
 *
 * Put one in your root (`lu-root` and `lu-app-shell` already do) and call `showToast(element, {...})` from anywhere
 * below it. A host can also be driven directly with `show()`. */
export class LuToast extends LuElement {
    constructor() {
        super();
        this._queue = new ToastQueue({ onChange: (current) => this._onChange(current) });
        this._watchingVisibility = false;
        this._onVisibility = () => {
            if (document.hidden)
                this._queue.pause("hidden");
            else
                this._queue.resume("hidden");
        };
        this._holdPointer = () => this._queue.pause("pointer");
        this._releasePointer = () => this._queue.resume("pointer");
        this._holdFocus = () => this._queue.pause("focus");
        this._releaseFocus = (event) => {
            // Focus moving between the toast's own buttons is not leaving it.
            if (event.relatedTarget instanceof Node && this.renderRoot.contains(event.relatedTarget))
                return;
            this._queue.resume("focus");
        };
        this._runAction = () => {
            this._queue.runAction();
        };
        this._dismiss = () => this._queue.dismiss();
        this.dismissLabel = "Dismiss";
        this._view = null;
        this._announce = "";
    }
    connectedCallback() {
        super.connectedCallback();
        this._unregister = registerToastHost(this);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        this._unregister?.();
        this._unregister = undefined;
        this._queue.clear();
        clearTimeout(this._leaveTimer);
        this._view = null;
    }
    /** Shows a toast now, or queues it behind the one on screen. Returns a handle to close just that toast. */
    show(options) {
        return this._queue.show(options);
    }
    /** Closes the toast with this id (shown or waiting); with no id, the one on screen. */
    dismiss(id) {
        this._queue.dismiss(id);
    }
    /** Takes every toast out of this host, as options for `show()` somewhere else (a sheet hands its toasts to the page). */
    takeAll() {
        return this._queue.takeAll();
    }
    _onChange(current) {
        clearTimeout(this._leaveTimer);
        // The pointer and focus holds belong to the toast element that was on screen; a removed element can never report
        // that the pointer left, so they end whenever the toast changes.
        this._queue.resume("pointer");
        this._queue.resume("focus");
        if (current) {
            this._view = { toast: current, leaving: false };
            this._announce = current.message;
            this._watchVisibility(true);
            return;
        }
        this._announce = "";
        this._watchVisibility(false);
        if (!this._view)
            return;
        this._view = { toast: this._view.toast, leaving: true };
        this._leaveTimer = setTimeout(() => {
            this._view = null;
        }, MOTION.exit);
    }
    /** A toast does not run out while nobody can see it. */
    _watchVisibility(on) {
        if (on === this._watchingVisibility)
            return;
        this._watchingVisibility = on;
        if (on) {
            document.addEventListener("visibilitychange", this._onVisibility);
            this._onVisibility();
        }
        else {
            document.removeEventListener("visibilitychange", this._onVisibility);
            this._queue.resume("hidden");
        }
    }
    updated(changed) {
        if (!changed.has("_view"))
            return;
        const toast = this.renderRoot.querySelector(".toast");
        if (toast && supportsPopover() && !toast.matches(":popover-open"))
            toast.showPopover();
    }
    _renderToast(view) {
        const { toast, leaving } = view;
        const mark = toast.kind === "success" ? renderIcon(ICON_CHECK_CIRCLE, "icon mark") : toast.kind === "error" ? renderIcon(ICON_ALERT_CIRCLE, "icon mark") : nothing;
        return html `<div class="toast ${toast.kind}${leaving ? " leaving" : ""}" popover=${supportsPopover() ? "manual" : nothing}
      @pointerenter=${this._holdPointer} @pointerleave=${this._releasePointer} @focusin=${this._holdFocus} @focusout=${this._releaseFocus}>
      ${mark}
      <span class="message">${toast.message}</span>
      ${toast.actionLabel ? html `<button class="text-button action" type="button" @click=${this._runAction}>${toast.actionLabel}</button>` : nothing}
      <button class="icon-button dismiss" type="button" aria-label=${this.dismissLabel} @click=${this._dismiss}>${renderIcon(ICON_CLOSE)}</button>
    </div>`;
    }
    render() {
        const view = this._view;
        return html `<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">${this._announce}</div>${view ? keyed(view.toast.generation, this._renderToast(view)) : nothing}`;
    }
}
LuToast.luName = "toast";
LuToast.properties = {
    dismissLabel: { type: String, attribute: "dismiss-label" },
    _view: { state: true },
    _announce: { state: true },
};
LuToast.styles = [
    BASE_CSS,
    CONTROLS_CSS,
    css `
      :host { display: contents; }
      .toast {
        position: fixed; inset: auto auto calc(max(var(--lu-bottom-bar, 0px), var(--lu-safe-bottom, 0px)) + var(--lu-space-4)) 50%; translate: -50% 0;
        display: flex; align-items: center; gap: var(--lu-space-2); width: max-content; max-width: min(560px, calc(100vw - 2 * var(--lu-space-4)));
        margin: 0; padding: var(--lu-space-1) var(--lu-space-1) var(--lu-space-1) var(--lu-space-4); overflow: visible;
        border: 1px solid var(--lu-edge-raised); border-radius: var(--lu-radius-row); color: var(--lu-ink); background: var(--lu-sheet);
        box-shadow: var(--lu-highlight-rest), var(--lu-shadow-raised); font: 500 var(--lu-type-label)/1.35 var(--lu-font);
        animation: toast-in var(--lu-motion-layer) var(--lu-ease) both;
      }
      .toast:not([popover]) { z-index: var(--lu-z-popup); }
      .toast[popover]:not(:popover-open) { display: none; }
      .toast.leaving { pointer-events: none; animation: toast-out var(--lu-motion-exit) var(--lu-ease-exit) both; }
      .mark { --lu-icon: 20px; }
      .success .mark { color: var(--lu-positive); }
      .error .mark { color: var(--lu-danger); }
      .message { min-width: 0; overflow-wrap: anywhere; }
      .action, .dismiss { flex: none; }
      @keyframes toast-in { from { opacity: 0; transform: translateY(var(--lu-travel-toast)); } }
      @keyframes toast-out { to { opacity: 0; transform: translateY(var(--lu-travel-toast)); } }
    `,
];
