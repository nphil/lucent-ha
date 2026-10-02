import type { LuElementClass } from "./core/element.js";
import type { LucentRegistry } from "./define.js";
/** Every element of the toolkit, in no particular order (dependencies are registered automatically). */
export declare const ALL_ELEMENTS: readonly LuElementClass[];
export interface DefineLucentOptions {
    /** Your app's name in lowercase (letters, digits, dashes): `kestrel` registers `<kestrel-lu-sheet>` and friends. */
    prefix: string;
    /** Register only these elements (short names such as `"sheet"`, `"button"`) plus what they render. Default: all.
     * To also keep the bundle small, pass classes to `defineElements` instead (see the README: "Lean bundles"). */
    only?: readonly string[];
}
/** Registers the whole toolkit as `<prefix>-lu-<name>` and returns the registry (`lu.tag("sheet")`). Safe to call
 * twice (existing tags are left alone). Never registers a bare `lu-*` or any `ha-*` tag. */
export declare function defineLucent(options: DefineLucentOptions): LucentRegistry;
