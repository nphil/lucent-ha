export declare const DEFAULT_RATIO = "4 / 3";
/** Turns `"4/3"`, `"16 / 10"`, `"1.5"` or `"1"` into a value for CSS `aspect-ratio`; anything else gives the default. */
export declare function parseRatio(ratio: string | undefined | null): string;
/** The address a failed picture is asked for the second (and last) time. By default the very same address: a signed
 * link rejects any extra query parameter. A server that accepts one can name it (`retryParam`), and a cache-busting
 * `<retryParam>=1` is added so a cached error response is not served again. `data:` and `blob:` addresses cannot take
 * one and are retried as they are. */
export declare function retryUrl(url: string, retryParam?: string): string;
/** How long a picture waits before its one retry (ms). */
export declare const RETRY_DELAY_MS = 1000;
