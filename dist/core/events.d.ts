/** Dispatches a bubbling, composed CustomEvent from `target` (so it crosses shadow roots) and returns
 * `!defaultPrevented`. Every toolkit event is named `lu-<thing>`. */
export declare function emit<T = undefined>(target: EventTarget, name: string, detail?: T, init?: Omit<CustomEventInit<T>, "detail">): boolean;
