export interface LongPressOptions {
    /** Hold time before the callback fires (ms). Lucent `motion.reorder`. */
    ms?: number;
    /** Movement that cancels the hold (px). */
    slop?: number;
}
/** Calls `callback` when a finger or mouse button stays down on `element` for `ms` without moving more than
 * `slop`. The click that follows the lift is swallowed so the hold does not also run the tap action.
 *
 * A long press must never be the only route to an action: always keep a visible control that does the same
 * thing (Lucent section 6). Returns a function that removes the listeners. */
export declare function attachLongPress(element: HTMLElement, callback: (event: PointerEvent) => void, options?: LongPressOptions): () => void;
