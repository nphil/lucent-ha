import { LitElement } from "lit";
import { unsafeStatic } from "lit/static-html.js";
import { emit } from "./events.js";
import { luTagName, prefixFromTag } from "./tag.js";
import { VERSION } from "../version.js";
/** Base class of every toolkit element.
 *
 * - `static luName`: the short tag name (`"sheet"` is registered as `<prefix>-lu-sheet`).
 * - `static luDeps`: the toolkit elements this one renders; `defineElements` registers them with it.
 * - `luTag(name)`: a static tag literal for a sibling element, for templates written with
 *   `html` from `lit/static-html.js`: `html\`<${this.luTag("button")}>\``.
 * - Colours, radii and sizes come from the `--lu-*` tokens the host (panel root, card root or `lu-root`)
 *   declares; elements never declare tokens themselves, except the roots. */
export class LuElement extends LitElement {
    /** The consumer prefix this element was registered with (`kestrel` for `<kestrel-lu-sheet>`). */
    get luPrefix() {
        const ctor = this.constructor;
        return ctor.luRegisteredPrefix || prefixFromTag(this.localName, ctor.luName);
    }
    /** Static tag literal for a sibling toolkit element, for `html` from `lit/static-html.js`. */
    luTag(name) {
        return unsafeStatic(luTagName(this.luPrefix, name));
    }
    /** Fires a bubbling, composed `CustomEvent` from this element. */
    emit(name, detail, init) {
        return emit(this, name, detail, init);
    }
}
LuElement.luName = "";
LuElement.luDeps = [];
/** Set on the per-registration subclass `defineElements` creates. */
LuElement.luRegisteredPrefix = "";
LuElement.luVersion = VERSION;
