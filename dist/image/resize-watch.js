/** One shared ResizeObserver for every picture and rail on the page (an observer per element costs measurably
 * more on a long grid). Created on first use. */
let observer = null;
const listeners = new WeakMap();
function shared() {
    observer ??= new ResizeObserver((entries) => {
        for (const entry of entries) {
            const width = entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
            listeners.get(entry.target)?.(width);
        }
    });
    return observer;
}
/** Calls `onWidth(cssPixels)` with the element's content width now-ish (the observer reports before the next
 * paint) and whenever it changes. One listener per element. Returns the stop function. Without ResizeObserver
 * (old WebViews) it reports `clientWidth` once. */
export function watchWidth(element, onWidth) {
    if (typeof ResizeObserver === "undefined") {
        onWidth(element.clientWidth);
        return () => { };
    }
    listeners.set(element, onWidth);
    shared().observe(element);
    return () => {
        listeners.delete(element);
        observer?.unobserve(element);
    };
}
