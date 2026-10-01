/** Tag naming. Every toolkit element is registered as `<prefix>-lu-<name>`, so two apps that bundle the toolkit
 * can never collide with each other, with iLedClock's global `lu-*`, or with Home Assistant's `ha-*`. */

const PREFIX_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** The full tag name of a toolkit element for a consumer prefix: `luTagName("kestrel", "sheet")` -> `kestrel-lu-sheet`. */
export function luTagName(prefix: string, name: string): string {
  return `${prefix}-lu-${name}`;
}

/** Throws a readable error when `prefix` cannot safely namespace toolkit tags. */
export function assertValidPrefix(prefix: string): void {
  if (typeof prefix !== "string" || !PREFIX_RE.test(prefix)) {
    throw new Error(`lucent-ha: prefix "${String(prefix)}" must be lowercase letters, digits and dashes, starting with a letter (for example "kestrel").`);
  }
  if (prefix === "ha" || prefix.startsWith("ha-")) {
    throw new Error(`lucent-ha: prefix "${prefix}" would put tags in Home Assistant's own ha-* namespace. Use your app's name.`);
  }
  if (prefix === "lu") {
    throw new Error(`lucent-ha: prefix "lu" is confusing next to the bare lu-* tags that iLedClock owns. Use your app's name.`);
  }
}

/** Recovers the prefix from a tag registered by `defineElements`: `kestrel-lu-sheet` + `sheet` -> `kestrel`. */
export function prefixFromTag(localName: string, name: string): string {
  const suffix = `-lu-${name}`;
  return localName.endsWith(suffix) ? localName.slice(0, -suffix.length) : "";
}
