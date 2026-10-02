import type { ToastHandle, ToastOptions } from "./toast-queue.js";
/** What the `lu-toast` event carries: the options, with an `id` always filled in. */
export type ToastEventDetail = ToastOptions & {
    id: string;
};
/** Something that shows toasts and can close one by id (every connected `LuToast`). */
export interface ToastHost {
    dismiss(id: string): void;
    show(toast: ToastEventDetail): unknown;
}
/** `LuToast` calls this while it is connected, so `showToast` knows somebody is listening and a `ToastHandle` can reach
 * the toast it belongs to. Returns the function that unregisters. */
export declare function registerToastHost(host: ToastHost): () => void;
/** Closes the toast with this id on every host (the one that has it shows or drops it; the others ignore the id). */
export declare function dismissToast(id: string): void;
/** Tells the user something small, from anywhere in the page: dispatches the bubbling `lu-toast` event from `from`, and the
 * nearest toolkit root or app shell (or an open sheet around `from`) shows it. Returns a handle to close that toast early.
 * If no host is present nothing is shown and nothing throws; the first time that happens a console warning says so. */
export declare function showToast(from: EventTarget, toast: ToastOptions): ToastHandle;
declare global {
    interface HTMLElementEventMap {
        "lu-toast": CustomEvent<ToastEventDetail>;
    }
}
