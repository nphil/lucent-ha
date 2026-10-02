import { canResize, withQueryParam } from "./sized-url.js";
export const DEFAULT_RATIO = "4 / 3";
/** Turns `"4/3"`, `"16 / 10"`, `"1.5"` or `"1"` into a value for CSS `aspect-ratio`; anything else gives the default. */
export function parseRatio(ratio) {
    const text = (ratio ?? "").trim();
    const pair = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(text);
    if (pair && Number(pair[1]) > 0 && Number(pair[2]) > 0)
        return `${pair[1]} / ${pair[2]}`;
    if (/^\d+(?:\.\d+)?$/.test(text) && Number(text) > 0)
        return text;
    return DEFAULT_RATIO;
}
/** The address a failed picture is asked for the second (and last) time. By default the very same address: a signed
 * link rejects any extra query parameter. A server that accepts one can name it (`retryParam`), and a cache-busting
 * `<retryParam>=1` is added so a cached error response is not served again. `data:` and `blob:` addresses cannot take
 * one and are retried as they are. */
export function retryUrl(url, retryParam = "") {
    if (!retryParam || !canResize(url))
        return url;
    return withQueryParam(url, retryParam, "1");
}
/** How long a picture waits before its one retry (ms). */
export const RETRY_DELAY_MS = 1000;
