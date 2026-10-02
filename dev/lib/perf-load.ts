/** Host load tagging. The machine is shared and is never idle: a number measured while the one-minute load is very high says more about the machine
 * than about the toolkit, so every cell is tagged with the load before and after it ran. Pure; reading the load itself (`scripts/lu-load`) lives in
 * perf-check.mjs. */

/** The one-minute load average (this host has 16 threads) above which a cell's wall-clock numbers are PROVISIONAL, i.e. not blamed on the toolkit.
 * This host's normal state is 15-25 (Nitin, 2026-10-02: a quiet window is never coming), so the default of 64 judges at normal load; the load is
 * recorded and printed for every cell. `PERF_MAX_LOAD=8` brings back the old "quiet host only" rule. */
export const DEFAULT_LOAD_LIMIT = 64;

/** The limit from the text of `PERF_MAX_LOAD`; anything that is not a positive number means the default (a typo must not turn every cell PROVISIONAL). */
export function loadLimit(text: string | undefined): number {
  const value = Number.parseFloat(text ?? "");
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_LOAD_LIMIT;
}

/** The first number of `scripts/lu-load` or `/proc/loadavg`; `null` when the text is not a load (e.g. "unknown"). */
export function parseLoad(text: string): number | null {
  const value = Number.parseFloat(text.trim().split(/\s+/)[0] ?? "");
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export interface LoadReading {
  before: number | null;
  after: number | null;
  /** The higher of the two (`null` when neither is known). */
  max: number | null;
  /** The limit these readings were judged against. */
  limit: number;
  /** Both readings are known and below the limit. An unknown load is never within the limit. */
  withinLimit: boolean;
}

export function classifyLoad(before: number | null, after: number | null, limit = DEFAULT_LOAD_LIMIT): LoadReading {
  const known = [before, after].filter((value): value is number => value !== null);
  const withinLimit = before !== null && after !== null && before < limit && after < limit;
  return { before, after, max: known.length ? Math.max(...known) : null, limit, withinLimit };
}

/** A short label for a table row: `load 3.2 > 4.1` or `load unknown`. */
export function describeLoad(reading: Pick<LoadReading, "before" | "after">): string {
  const show = (value: number | null): string => (value === null ? "?" : String(Math.round(value * 10) / 10));
  return reading.before === null && reading.after === null ? "load unknown" : `load ${show(reading.before)} > ${show(reading.after)}`;
}
