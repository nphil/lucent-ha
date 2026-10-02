/** Keyboard model for a roving-tabindex group (radio groups, segmented controls, chips): one tab stop, arrows
 * move within it. Left/Up go to the previous item, Right/Down to the next, both wrapping; Home and End jump
 * to the ends. Returns null for keys the group does not handle. */
export declare function nextRovingIndex(key: string, current: number, count: number): number | null;
