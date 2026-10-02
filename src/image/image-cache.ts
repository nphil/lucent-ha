/* Idea and structure from Nitin's KibbleOS kibble-card `src/lib/image-cache.ts` (MIT, same owner): reference-counted object URLs, so a picture still on screen is never revoked. Rewritten around a lease and an injected fetcher. */

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
export class ImageUrlCache {
  private readonly _fetcher: ImageFetcher;
  private readonly _maxIdle: number;
  private readonly _create: (blob: Blob) => string;
  private readonly _revoke: (url: string) => void;
  /** url -> object URL; pictures nobody shows are ordered by when they were let go. */
  private readonly _ready = new Map<string, string>();
  private readonly _refs = new Map<string, number>();
  private readonly _waiting = new Map<string, Set<(objectUrl: string | null) => void>>();
  private _disposed = false;

  constructor(options: ImageUrlCacheOptions) {
    this._fetcher = options.fetcher;
    this._maxIdle = options.maxIdle ?? 120;
    this._create = options.createObjectUrl ?? ((blob) => URL.createObjectURL(blob));
    this._revoke = options.revokeObjectUrl ?? ((url) => URL.revokeObjectURL(url));
  }

  /** Pictures currently held as object URLs (shown or idle). */
  get size(): number {
    return this._ready.size;
  }

  /** Claims `url`. When it is already downloaded, `lease.url` is set at once and `onReady` is not called;
   * otherwise the download starts (one per URL, however many holders) and `onReady` is called when it settles,
   * unless the lease was released first. */
  acquire(url: string, onReady: (objectUrl: string | null) => void): ImageUrlLease {
    this._refs.set(url, (this._refs.get(url) ?? 0) + 1);
    let current = this._ready.get(url) ?? null;
    let released = false;
    const notify = (objectUrl: string | null): void => {
      if (released) return;
      current = objectUrl;
      onReady(objectUrl);
    };
    if (current === null) this._request(url, notify);
    return {
      get url() {
        return current;
      },
      release: () => {
        if (released) return;
        released = true;
        this._waiting.get(url)?.delete(notify);
        this._drop(url);
      },
    };
  }

  /** Revokes everything, held or not. For the owner of the cache when it goes away. Leases still out become no-ops. */
  dispose(): void {
    this._disposed = true;
    for (const objectUrl of this._ready.values()) this._revoke(objectUrl);
    this._ready.clear();
    this._refs.clear();
    this._waiting.clear();
  }

  private _request(url: string, notify: (objectUrl: string | null) => void): void {
    let waiting = this._waiting.get(url);
    if (waiting) {
      waiting.add(notify);
      return;
    }
    waiting = new Set([notify]);
    this._waiting.set(url, waiting);
    void this._download(url).then((objectUrl) => {
      const listeners = this._waiting.get(url);
      this._waiting.delete(url);
      if (objectUrl !== null) {
        if (this._disposed || (this._refs.get(url) ?? 0) === 0) this._revoke(objectUrl); // everybody lost interest while it downloaded
        else this._ready.set(url, objectUrl);
      }
      for (const listener of listeners ?? []) listener(objectUrl);
    });
  }

  private async _download(url: string): Promise<string | null> {
    try {
      const response = await this._fetcher(url);
      if (!response.ok) return null;
      return this._create(await response.blob());
    } catch {
      return null;
    }
  }

  private _drop(url: string): void {
    if (this._disposed) return;
    const left = (this._refs.get(url) ?? 0) - 1;
    if (left > 0) {
      this._refs.set(url, left);
      return;
    }
    this._refs.delete(url);
    const objectUrl = this._ready.get(url);
    if (objectUrl !== undefined) {
      this._ready.delete(url); // idle pictures are kept in the order they were let go: the longest idle goes first
      this._ready.set(url, objectUrl);
    }
    // A re-render may release and re-acquire the same picture in one turn: judge after it settled.
    queueMicrotask(() => this._trim());
  }

  private _trim(): void {
    let idle = 0;
    for (const url of this._ready.keys()) if (!this._refs.has(url)) idle += 1;
    for (const [url, objectUrl] of this._ready) {
      if (idle <= this._maxIdle) return;
      if (this._refs.has(url)) continue;
      this._ready.delete(url);
      this._revoke(objectUrl);
      idle -= 1;
    }
  }
}
