/** The browser's `popstate` stream as an add/remove pair, so history code can be handed a fake in tests.
 * Touches `window` only when called (modules must import in Node). Returns the function that stops listening. */
export function addPopstateListener(handler) {
    const listener = (event) => handler(event);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
}
/** `location-changed`: what Home Assistant (and the toolkit's own navigate) fires on the window right after the address
 * changed. Returns the function that stops listening. */
export function addLocationChangedListener(handler) {
    window.addEventListener("location-changed", handler);
    return () => window.removeEventListener("location-changed", handler);
}
