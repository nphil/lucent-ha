import type { PropertyValues, TemplateResult } from "lit";
import { LuElement } from "../core/element.js";
import type { ShownToast, ToastHandle, ToastOptions } from "./toast-queue.js";
interface ToastView {
    toast: ShownToast;
    /** The toast has closed and its exit motion is playing. */
    leaving: boolean;
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
export declare class LuToast extends LuElement {
    static luName: string;
    static properties: {
        dismissLabel: {
            type: StringConstructor;
            attribute: string;
        };
        _view: {
            state: boolean;
        };
        _announce: {
            state: boolean;
        };
    };
    /** Accessible name of the dismiss button. */
    dismissLabel: string;
    _view: ToastView | null;
    _announce: string;
    private readonly _queue;
    private _unregister;
    private _leaveTimer;
    private _watchingVisibility;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    /** Shows a toast now, or queues it behind the one on screen. Returns a handle to close just that toast. */
    show(options: ToastOptions): ToastHandle;
    /** Closes the toast with this id (shown or waiting); with no id, the one on screen. */
    dismiss(id?: string): void;
    /** Takes every toast out of this host, as options for `show()` somewhere else (a sheet hands its toasts to the page). */
    takeAll(): ToastOptions[];
    private _onChange;
    /** A toast does not run out while nobody can see it. */
    private _watchVisibility;
    private _onVisibility;
    protected updated(changed: PropertyValues<this>): void;
    private _holdPointer;
    private _releasePointer;
    private _holdFocus;
    private _releaseFocus;
    private _runAction;
    private _dismiss;
    private _renderToast;
    render(): TemplateResult<1>;
    static styles: import("lit").CSSResult[];
}
export {};
