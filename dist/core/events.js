/** Dispatches a bubbling, composed CustomEvent from `target` (so it crosses shadow roots) and returns
 * `!defaultPrevented`. Every toolkit event is named `lu-<thing>`. */
export function emit(target, name, detail, init = {}) {
    return target.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, ...init, detail: detail }));
}
