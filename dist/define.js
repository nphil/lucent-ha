import { assertValidPrefix, luTagName } from "./core/tag.js";
import { VERSION } from "./version.js";
function expand(elements) {
    const ordered = [];
    const seen = new Set();
    const visit = (element) => {
        if (seen.has(element))
            return;
        seen.add(element);
        for (const dep of element.luDeps)
            visit(dep);
        ordered.push(element);
    };
    for (const element of elements)
        visit(element);
    return ordered;
}
/** Registers the given toolkit elements (and everything they render) as `<prefix>-lu-<name>`.
 *
 * Each registration gets its own subclass, so one bundle can serve two prefixes. Already-defined tags are left
 * alone (a second bundle with the same prefix reuses the first one's elements; a version mismatch is warned
 * about once). Use this to keep a bundle small: only the elements you pass, plus their dependencies, are
 * pulled in. `defineLucent` (from `lucent-ha`) registers the whole catalogue. */
export function defineElements(prefix, elements) {
    assertValidPrefix(prefix);
    const tags = {};
    for (const element of expand(elements)) {
        const name = element.luName;
        if (!name)
            throw new Error("lucent-ha: an element class has no luName.");
        const tag = luTagName(prefix, name);
        tags[name] = tag;
        const existing = customElements.get(tag);
        if (existing) {
            const version = existing.luVersion;
            if (version !== undefined && version !== VERSION)
                console.warn(`lucent-ha: <${tag}> is already defined by lucent-ha ${version}; this bundle has ${VERSION}. Two versions of one prefix share elements: give each app its own prefix.`);
            continue;
        }
        const registered = class extends element {
        };
        registered.luRegisteredPrefix = prefix;
        customElements.define(tag, registered);
    }
    return {
        prefix,
        version: VERSION,
        tags,
        tag(name) {
            const tag = tags[name];
            if (!tag)
                throw new Error(`lucent-ha: no "${name}" element was registered for prefix "${prefix}".`);
            return tag;
        },
    };
}
