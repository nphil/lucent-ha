/** Pure helpers for the navigation destinations (no `lit`, no DOM), so `node --test` can drive them. */

/** One place the user can go: a tab, a pill, a bottom-bar item or a rail item, depending on the screen. */
export interface LuDestination {
  /** Stable id; `current` on the shell/nav is matched against it. */
  id: string;
  /** Visible text. Always shown, on every screen size (a destination is never icon-only). */
  label: string;
  /** `mdi:name` (drawn by Home Assistant's `ha-icon`) or raw 24x24 SVG path data. */
  icon?: string;
  /** When set the destination is a real link (middle-click and "open in new tab" work). The toolkit still never routes: it fires `lu-navigate` and you navigate. */
  href?: string;
  /** A count (0 hides it, above 99 shows "99+") or a very short word such as "new". */
  badge?: number | string;
  /** One key (a letter or digit) that jumps here. Default: the digit matching the position, 1-9. */
  shortcut?: string;
}

/** The destination that is "current": the first one whose id equals `current`, or `undefined`.
 * An unknown id (a detail page that has no tab of its own) marks nothing as current; it never falls back
 * to the first destination. */
export function resolveCurrent(destinations: readonly LuDestination[], current: string | undefined): LuDestination | undefined {
  if (!current) return undefined;
  return destinations.find((destination) => destination.id === current);
}

/** The text drawn in a badge, or "" when there is nothing to show. Counts: 0, negative and non-numbers hide it,
 * fractions round down, above 99 reads "99+". Words are trimmed. */
export function formatBadge(badge: number | string | undefined | null): string {
  if (typeof badge === "number") {
    const count = Math.floor(badge);
    if (!Number.isFinite(count) || count < 1) return "";
    return count > 99 ? "99+" : String(count);
  }
  if (typeof badge === "string") return badge.trim();
  return "";
}

/** What a screen reader says for a destination: the label, plus the badge ("Wildlife, 3"). */
export function accessibleName(destination: LuDestination): string {
  const badge = formatBadge(destination.badge);
  return badge ? `${destination.label}, ${badge}` : destination.label;
}
