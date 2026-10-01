/** Dispatches a bubbling, composed CustomEvent from `target` (so it crosses shadow roots) and returns
 * `!defaultPrevented`. Every toolkit event is named `lu-<thing>`. */
export function emit<T = undefined>(target: EventTarget, name: string, detail?: T, init: Omit<CustomEventInit<T>, "detail"> = {}): boolean {
  return target.dispatchEvent(new CustomEvent<T>(name, { bubbles: true, composed: true, ...init, detail: detail as T }));
}
