/** How the cache downloads a picture: Home Assistant's `hass.fetchWithAuth(url)` or any `fetch`-like function. */
export type ImageFetcher = (url: string) => Promise<Response>;
export interface ImageUrlCacheOptions {
    /** Downloads one picture with the user's credentials. */
    fetcher: ImageFetcher;
    /** Pictures nobody shows right now that stay cached (so coming back to them is instant and flash-free).
     * The oldest are revoked beyond this. Default 120. Pictures somebody shows are never revoked. */
    maxIdle?: number;
    /** Test hooks; default to `URL.createObjectURL` / `URL.revokeObjectURL`. */
    createObjectUrl?: (blob: Blob) => string;
    revokeObjectUrl?: (url: string) => void;
}
/** One holder's claim on a cached picture. `url` is the object URL once known (null while it downloads or when
 * it failed). `release()` gives the claim back; calling it twice is harmless. */
export interface ImageUrlLease {
    readonly url: string | null;
    release(): void;
}
/** Downloads pictures that need authentication (`<img>` cannot send a Bearer token) once each, keeps them as
 * object URLs, and counts who is showing them. An object URL is revoked only after its LAST holder released it
 * and the idle limit is exceeded, so a picture still on screen never loses its source.
 *
 *     const cache = new ImageUrlCache({ fetcher: (url) => hass.fetchWithAuth(url) });
 *     const lease = cache.acquire(url, (objectUrl) => { ... });   // objectUrl is null when the download failed
 *     lease.release();                                              // once the picture is no longer shown
 *
 * A failed download is not cached: the next `acquire` tries again. */
export declare class ImageUrlCache {
    private readonly _fetcher;
    private readonly _maxIdle;
    private readonly _create;
    private readonly _revoke;
    /** url -> object URL; pictures nobody shows are ordered by when they were let go. */
    private readonly _ready;
    private readonly _refs;
    private readonly _waiting;
    private _disposed;
    constructor(options: ImageUrlCacheOptions);
    /** Pictures currently held as object URLs (shown or idle). */
    get size(): number;
    /** Claims `url`. When it is already downloaded, `lease.url` is set at once and `onReady` is not called;
     * otherwise the download starts (one per URL, however many holders) and `onReady` is called when it settles,
     * unless the lease was released first. */
    acquire(url: string, onReady: (objectUrl: string | null) => void): ImageUrlLease;
    /** Revokes everything, held or not. For the owner of the cache when it goes away. Leases still out become no-ops. */
    dispose(): void;
    private _request;
    private _download;
    private _drop;
    private _trim;
}
