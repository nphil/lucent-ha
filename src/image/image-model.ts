import { canResize, withQueryParam } from "./sized-url.ts";

export const DEFAULT_RATIO = "4 / 3";

/** Turns `"4/3"`, `"16 / 10"`, `"1.5"` or `"1"` into a value for CSS `aspect-ratio`; anything else gives the default. */
export function parseRatio(ratio: string | undefined | null): string {
  const text = (ratio ?? "").trim();
  const pair = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(text);
  if (pair && Number(pair[1]) > 0 && Number(pair[2]) > 0) return `${pair[1]} / ${pair[2]}`;
  if (/^\d+(?:\.\d+)?$/.test(text) && Number(text) > 0) return text;
  return DEFAULT_RATIO;
}

/** The address a failed picture is asked for the second (and last) time: the same one with a cache-busting
 * query parameter, so a cached error response is not served again. `data:` and `blob:` addresses cannot take one and
 * are retried as they are. */
export function retryUrl(url: string): string {
  if (!canResize(url)) return url;
  return withQueryParam(url, "lu_retry", "1");
}

/** How long a picture waits before its one retry (ms). */
export const RETRY_DELAY_MS = 1000;
