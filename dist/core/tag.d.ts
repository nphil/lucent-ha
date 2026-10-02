/** Tag naming. Every toolkit element is registered as `<prefix>-lu-<name>`, so two apps that bundle the toolkit
 * can never collide with each other, with iLedClock's global `lu-*`, or with Home Assistant's `ha-*`. */
/** The full tag name of a toolkit element for a consumer prefix: `luTagName("kestrel", "sheet")` -> `kestrel-lu-sheet`. */
export declare function luTagName(prefix: string, name: string): string;
/** Throws a readable error when `prefix` cannot safely namespace toolkit tags. */
export declare function assertValidPrefix(prefix: string): void;
/** Recovers the prefix from a tag registered by `defineElements`: `kestrel-lu-sheet` + `sheet` -> `kestrel`. */
export declare function prefixFromTag(localName: string, name: string): string;
