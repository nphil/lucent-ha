/** Calls `onWidth(cssPixels)` with the element's content width now-ish (the observer reports before the next
 * paint) and whenever it changes. One listener per element. Returns the stop function. Without ResizeObserver
 * (old WebViews) it reports `clientWidth` once. */
export declare function watchWidth(element: Element, onWidth: (width: number) => void): () => void;
