import { emit } from "../core/events.js";
import { nextToastId } from "./toast-queue.js";
const hosts = new Set();
let warned = false;
/** `LuToast` calls this while it is connected, so `showToast` knows somebody is listening and a `ToastHandle` can reach
 * the toast it belongs to. Returns the function that unregisters. */
export function registerToastHost(host) {
    hosts.add(host);
    return () => {
        hosts.delete(host);
    };
}
/** Closes the toast with this id on every host (the one that has it shows or drops it; the others ignore the id). */
export function dismissToast(id) {
    for (const host of hosts)
        host.dismiss(id);
}
/** Tells the user something small, from anywhere in the page: dispatches the bubbling `lu-toast` event from `from`, and the
 * nearest toolkit root or app shell (or an open sheet around `from`) shows it. Returns a handle to close that toast early.
 * If no host is present nothing is shown and nothing throws; the first time that happens a console warning says so. */
export function showToast(from, toast) {
    const detail = { ...toast, id: toast.id ?? nextToastId() };
    // A host (app shell, root, open sheet) that shows the toast calls preventDefault(). Events only travel UP, so when the caller
    // is an element that CONTAINS the shell (a panel calling showToast(this, ...)), nothing up the tree handles it: then the toast
    // goes to a host somewhere inside the caller.
    const unhandled = emit(from, "lu-toast", detail, { cancelable: true });
    if (unhandled) {
        let nearest;
        let nearestDistance = Infinity;
        for (const host of hosts) {
            const distance = distanceBelow(host, from);
            if (distance < nearestDistance) {
                nearest = host;
                nearestDistance = distance;
            }
        }
        nearest?.show(detail);
    }
    if (hosts.size === 0 && !warned) {
        warned = true;
        console.warn("lucent-ha: showToast() found no toast host. Put your content inside the toolkit's root or app-shell element (they show toasts).");
    }
    return { id: detail.id, dismiss: () => dismissToast(detail.id) };
}
/** How many steps `node` is below `from` (looking through shadow roots); Infinity when it is not below it. */
function distanceBelow(node, from) {
    let steps = 0;
    for (let current = node; current; current = current.parentNode ?? current.host ?? null) {
        if (current === from)
            return steps;
        steps += 1;
    }
    return Infinity;
}
