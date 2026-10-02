import { LitElement } from "lit";
import { type StaticValue } from "lit/static-html.js";
/** What `defineElements` accepts: a toolkit element class with its short name and the elements it renders. */
export interface LuElementClass {
    new (): LuElement;
    readonly luName: string;
    readonly luDeps: readonly LuElementClass[];
}
/** Base class of every toolkit element.
 *
 * - `static luName`: the short tag name (`"sheet"` is registered as `<prefix>-lu-sheet`).
 * - `static luDeps`: the toolkit elements this one renders; `defineElements` registers them with it.
 * - `luTag(name)`: a static tag literal for a sibling element, for templates written with
 *   `html` from `lit/static-html.js`: `html\`<${this.luTag("button")}>\``.
 * - Colours, radii and sizes come from the `--lu-*` tokens the host (panel root, card root or `lu-root`)
 *   declares; elements never declare tokens themselves, except the roots. */
export declare class LuElement extends LitElement {
    static luName: string;
    static luDeps: readonly LuElementClass[];
    /** Set on the per-registration subclass `defineElements` creates. */
    static luRegisteredPrefix: string;
    static luVersion: string;
    /** The consumer prefix this element was registered with (`kestrel` for `<kestrel-lu-sheet>`). */
    get luPrefix(): string;
    /** Static tag literal for a sibling toolkit element, for `html` from `lit/static-html.js`. */
    protected luTag(name: string): StaticValue;
    /** Fires a bubbling, composed `CustomEvent` from this element. */
    protected emit<T = undefined>(name: string, detail?: T, init?: Omit<CustomEventInit<T>, "detail">): boolean;
}
