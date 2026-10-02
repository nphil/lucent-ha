/** How long ago `then` (ms epoch) was, in words, for the "Showing data from ..." strip.
 *
 * - under a minute (and anything in the future, which a skewed clock can produce): "just now"
 * - under an hour: "12 min ago"; under a day: "3 h ago" (whole units, rounded down)
 * - a day or more: "yesterday" when it was the previous calendar day, otherwise the date ("Oct 3", with the
 *   year when it is not this year).
 *
 * `now` and `locale` are arguments so tests can pin them. Only the date uses the locale; the units are English. */
export declare function formatAgo(then: number, now?: number, locale?: string): string;
