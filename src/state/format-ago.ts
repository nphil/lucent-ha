const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function startOfDay(time: number): number {
  const date = new Date(time);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** How long ago `then` (ms epoch) was, in words, for the "Showing data from ..." strip.
 *
 * - under a minute (and anything in the future, which a skewed clock can produce): "just now"
 * - under an hour: "12 min ago"; under a day: "3 h ago" (whole units, rounded down)
 * - a day or more: "yesterday" when it was the previous calendar day, otherwise the date ("Oct 3", with the
 *   year when it is not this year).
 *
 * `now` and `locale` are arguments so tests can pin them. Only the date uses the locale; the units are English. */
export function formatAgo(then: number, now: number = Date.now(), locale?: string): string {
  const age = now - then;
  if (!(age >= MINUTE)) return "just now";
  if (age < HOUR) return `${Math.floor(age / MINUTE)} min ago`;
  if (age < DAY) return `${Math.floor(age / HOUR)} h ago`;
  const dayGap = Math.round((startOfDay(now) - startOfDay(then)) / DAY);
  if (dayGap <= 1) return "yesterday";
  const sameYear = new Date(then).getFullYear() === new Date(now).getFullYear();
  return new Date(then).toLocaleDateString(locale, sameYear ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" });
}
