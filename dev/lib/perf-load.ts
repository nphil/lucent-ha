/** Host load tagging. The machine is shared and often busy: a number measured while the one-minute load is high says more about the machine than
 * about the toolkit, so every cell is tagged with the load before and after it ran. Pure; reading the load itself (`scripts/lu-load`) lives in
 * perf-check.mjs. */

/** One-minute load average (this host has 16 threads) at which wall-clock numbers stop being trustworthy. */
export const QUIET_LOAD = 8;

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
  /** Both readings are known and below the limit. An unknown load is never called quiet. */
  quiet: boolean;
}

export function classifyLoad(before: number | null, after: number | null, limit = QUIET_LOAD): LoadReading {
  const known = [before, after].filter((value): value is number => value !== null);
  const quiet = before !== null && after !== null && before < limit && after < limit;
  return { before, after, max: known.length ? Math.max(...known) : null, quiet };
}

/** A short label for a table row: `load 3.2 > 4.1` or `load unknown`. */
export function describeLoad(reading: Pick<LoadReading, "before" | "after">): string {
  const show = (value: number | null): string => (value === null ? "?" : String(Math.round(value * 10) / 10));
  return reading.before === null && reading.after === null ? "load unknown" : `load ${show(reading.before)} > ${show(reading.after)}`;
}
