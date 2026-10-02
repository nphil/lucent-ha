import type { LuElementClass } from "./core/element.js";
/** What `defineElements` / `defineLucent` return: the tags that now exist for this prefix. */
export interface LucentRegistry {
    readonly prefix: string;
    readonly version: string;
    /** Short name -> registered tag name, for every element registered by the call (dependencies included). */
    readonly tags: Readonly<Record<string, string>>;
    /** The registered tag of a short name; throws if that element was not registered. */
    tag(name: string): string;
}
/** Registers the given toolkit elements (and everything they render) as `<prefix>-lu-<name>`.
 *
 * Each registration gets its own subclass, so one bundle can serve two prefixes. Already-defined tags are left
 * alone (a second bundle with the same prefix reuses the first one's elements; a version mismatch is warned
 * about once). Use this to keep a bundle small: only the elements you pass, plus their dependencies, are
 * pulled in. `defineLucent` (from `lucent-ha`) registers the whole catalogue. */
export declare function defineElements(prefix: string, elements: readonly LuElementClass[]): LucentRegistry;
