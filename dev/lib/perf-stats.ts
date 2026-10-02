/** Small statistics for the perf gate. Pure: no browser, no Node imports, so `node --test` can load it. */

export interface Summary {
  /** How many samples. */
  n: number;
  median: number;
  min: number;
  max: number;
}

/** The middle value (the mean of the two middle ones for an even count). `NaN` for no samples. */
export function median(values: readonly number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/** Median plus the range of what was measured; `null` when nothing was. Non-finite samples are ignored. */
export function summarize(values: readonly number[]): Summary | null {
  const clean = values.filter(Number.isFinite);
  if (!clean.length) return null;
  return { n: clean.length, median: median(clean), min: Math.min(...clean), max: Math.max(...clean) };
}

/** Rounds to `digits` decimals (default 1); the shape stays a number so JSON output is plain. */
export function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

/** The largest of a list, or `null` when it is empty. */
export function maxOf(values: readonly number[]): number | null {
  const clean = values.filter(Number.isFinite);
  return clean.length ? Math.max(...clean) : null;
}
