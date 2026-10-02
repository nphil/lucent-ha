import { emit } from "../core/events.ts";
import { nextToastId } from "./toast-queue.ts";
import type { ToastHandle, ToastOptions } from "./toast-queue.ts";

/** What the `lu-toast` event carries: the options, with an `id` always filled in. */
export type ToastEventDetail = ToastOptions & { id: string };

/** Something that shows toasts and can close one by id (every connected `LuToast`). */
export interface ToastHost {
  dismiss(id: string): void;
}

const hosts = new Set<ToastHost>();
let warned = false;

/** `LuToast` calls this while it is connected, so `showToast` knows somebody is listening and a `ToastHandle` can reach
 * the toast it belongs to. Returns the function that unregisters. */
export function registerToastHost(host: ToastHost): () => void {
  hosts.add(host);
  return () => {
    hosts.delete(host);
  };
}

/** Closes the toast with this id on every host (the one that has it shows or drops it; the others ignore the id). */
export function dismissToast(id: string): void {
  for (const host of hosts) host.dismiss(id);
}

/** Tells the user something small, from anywhere in the page: dispatches the bubbling `lu-toast` event from `from`, and the
 * nearest toolkit root or app shell (or an open sheet around `from`) shows it. Returns a handle to close that toast early.
 * If no host is present nothing is shown and nothing throws; the first time that happens a console warning says so. */
export function showToast(from: EventTarget, toast: ToastOptions): ToastHandle {
  const detail: ToastEventDetail = { ...toast, id: toast.id ?? nextToastId() };
  emit(from, "lu-toast", detail);
  if (hosts.size === 0 && !warned) {
    warned = true;
    console.warn("lucent-ha: showToast() found no toast host. Put your content inside the toolkit's root or app-shell element (they show toasts).");
  }
  return { id: detail.id, dismiss: () => dismissToast(detail.id) };
}

declare global {
  interface HTMLElementEventMap {
    "lu-toast": CustomEvent<ToastEventDetail>;
  }
}
