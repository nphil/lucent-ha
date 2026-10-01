import type { LuElementClass } from "./core/element.ts";
import { LuElement } from "./core/element.ts";
import { assertValidPrefix, luTagName } from "./core/tag.ts";
import { VERSION } from "./version.ts";

/** What `defineElements` / `defineLucent` return: the tags that now exist for this prefix. */
export interface LucentRegistry {
  readonly prefix: string;
  readonly version: string;
  /** Short name -> registered tag name, for every element registered by the call (dependencies included). */
  readonly tags: Readonly<Record<string, string>>;
  /** The registered tag of a short name; throws if that element was not registered. */
  tag(name: string): string;
}

function expand(elements: readonly LuElementClass[]): LuElementClass[] {
  const ordered: LuElementClass[] = [];
  const seen = new Set<LuElementClass>();
  const visit = (element: LuElementClass): void => {
    if (seen.has(element)) return;
    seen.add(element);
    for (const dep of element.luDeps) visit(dep);
    ordered.push(element);
  };
  for (const element of elements) visit(element);
  return ordered;
}

/** Registers the given toolkit elements (and everything they render) as `<prefix>-lu-<name>`.
 *
 * Each registration gets its own subclass, so one bundle can serve two prefixes. Already-defined tags are left
 * alone (a second bundle with the same prefix reuses the first one's elements; a version mismatch is warned
 * about once). Use this to keep a bundle small: only the elements you pass, plus their dependencies, are
 * pulled in. `defineLucent` (from `lucent-ha`) registers the whole catalogue. */
export function defineElements(prefix: string, elements: readonly LuElementClass[]): LucentRegistry {
  assertValidPrefix(prefix);
  const tags: Record<string, string> = {};
  for (const element of expand(elements)) {
    const name = element.luName;
    if (!name) throw new Error("lucent-ha: an element class has no luName.");
    const tag = luTagName(prefix, name);
    tags[name] = tag;
    const existing = customElements.get(tag);
    if (existing) {
      const version = (existing as typeof LuElement).luVersion;
      if (version !== undefined && version !== VERSION) console.warn(`lucent-ha: <${tag}> is already defined by lucent-ha ${version}; this bundle has ${VERSION}. Two versions of one prefix share elements: give each app its own prefix.`);
      continue;
    }
    const registered = class extends (element as unknown as typeof LuElement) {};
    registered.luRegisteredPrefix = prefix;
    customElements.define(tag, registered);
  }
  return {
    prefix,
    version: VERSION,
    tags,
    tag(name: string): string {
      const tag = tags[name];
      if (!tag) throw new Error(`lucent-ha: no "${name}" element was registered for prefix "${prefix}".`);
      return tag;
    },
  };
}
