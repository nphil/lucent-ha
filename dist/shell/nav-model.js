/** Pure helpers for the navigation destinations (no `lit`, no DOM), so `node --test` can drive them. */
/** The destination that is "current": the first one whose id equals `current`, or `undefined`.
 * An unknown id (a detail page that has no tab of its own) marks nothing as current; it never falls back
 * to the first destination. */
export function resolveCurrent(destinations, current) {
    if (!current)
        return undefined;
    return destinations.find((destination) => destination.id === current);
}
/** The text drawn in a badge, or "" when there is nothing to show. Counts: 0, negative and non-numbers hide it,
 * fractions round down, above 99 reads "99+". Words are trimmed. */
export function formatBadge(badge) {
    if (typeof badge === "number") {
        const count = Math.floor(badge);
        if (!Number.isFinite(count) || count < 1)
            return "";
        return count > 99 ? "99+" : String(count);
    }
    if (typeof badge === "string")
        return badge.trim();
    return "";
}
/** What a screen reader says for a destination: the label, plus the badge ("Wildlife, 3"). */
export function accessibleName(destination) {
    const badge = formatBadge(destination.badge);
    return badge ? `${destination.label}, ${badge}` : destination.label;
}
