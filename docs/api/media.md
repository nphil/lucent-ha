# Media: pictures, the thumbnail rail and recordings

`lu-image` shows a picture in a box whose shape is fixed up front, so nothing jumps when it arrives, and loads it only when it is near the screen.
`lu-media-rail` is a sideways shelf of picture buttons that always shows "N and a half" tiles. `lu-audio-player` and `lu-audio-list` play recordings, one at a time on the whole page.

Tags are `<prefix>-lu-image`, `<prefix>-lu-media-rail`, `<prefix>-lu-audio-player`, `<prefix>-lu-audio-list` (prefix chosen by `defineElements`). All of them need the host's `--lu-*` tokens: put them under your panel root, card root or `lu-root`.

## `lu-image`

| Property (attribute) | Default | Meaning |
|---|---|---|
| `src` | `""` | Picture address. Empty shows the placeholder. |
| `alt` | `""` | Text alternative. Empty marks the picture decorative. |
| `ratio` | `"4/3"` | Width-to-height of the box: `"4/3"`, `"16/10"`, `"1"` ... Anything else falls back to 4/3. |
| `fit` | `"cover"` | `"cover"` or `"contain"`. |
| `priority` | `"auto"` | `"high"` loads at once with `fetchpriority=high` (use for the first row). `"auto"` waits until the picture is within 200 px of the screen. `"low"` waits and asks the browser to go last. |
| `widths` (JS only) | unset | Sizes your server serves, e.g. `[160, 320, 640]`. Makes the picture ask for the right size through `sizedUrl`. |
| `authed`, `cache` (JS only) | `false` | `authed` plus an `ImageUrlCache` downloads the picture with your login (see below). |

Events (bubbling, composed): `lu-image-load {src}`, `lu-image-error {src}` (after the retry failed).
Slot `fallback`: shown after the failure instead of the default broken-picture icon (initials, an illustration).
CSS: `--lu-image-radius` (corner radius, default `--lu-radius-tile`). The host is `display:block; width:100%`; override `aspect-ratio` on the host to force another shape.

What it does for you:
- **One shared observer.** Every picture on the page uses the same IntersectionObserver and the same ResizeObserver.
- **No layout shift.** The box has its final shape from the first frame; the placeholder (`--lu-tile`) is static, never pulsing.
- **Fade.** The picture fades in over `--lu-motion-card` (opacity only). No fade when it was already cached (arrives within ~60 ms), when `authed` finds it in the cache, or with reduced motion.
- **Retry once, then fall back.** A failed picture is asked for again after one second (with `lu_retry=1` added to the address); if that fails too the `fallback` slot shows and `lu-image-error` fires.
- **Right size.** With `widths`, the picture measures its own width and asks for the smallest size that is at least width x screen density (density capped at 3). If the box later gets bigger (rotation, resize) the picture upgrades in place, without blinking; it never downgrades.
- A new `src` shows the placeholder again until the new picture is there.

### `sizedUrl(url, cssWidth, dpr, options?)` and the `?w=` contract

```ts
sizedUrl("/api/photo.jpg", 175, 2, { widths: [160, 320, 640] }); // "/api/photo.jpg?w=640"
```
- Rounds **up** to the smallest whitelisted width that is at least `cssWidth x dpr`; clamps to the largest. Defaults: widths `80, 160, 256, 512, 1024`, parameter `w`, density cap 3 (`options.widths`, `options.param`, `options.maxDpr`).
- Keeps an existing query and `#fragment`; replaces an existing `w`. `data:`, `blob:` and other schemes are returned unchanged, as is a URL when the width is not a positive number.
- `pickWidth(needed, widths)` and `withQueryParam(url, name, value)` are the two helpers it is made of.

**What your server must do.** Accept `?w=<n>` on the picture route and answer with the picture scaled to `n` pixels wide (aspect ratio kept, never enlarged beyond the original), but only for the widths you list in `widths`; answer the original or HTTP 400 for others. Send long cache headers (the address is stable per width). If the address is signed (for example `authSig`), the signature must not cover the query string, or must be re-issued per width, otherwise `?w=` invalidates it.

### `ImageUrlCache`: pictures that need a login

The browser cannot send a Bearer token from an `<img>`, so the cache downloads with Home Assistant's `fetchWithAuth` and shows the result from an object URL.

```ts
const cache = new ImageUrlCache({ fetcher: (url) => hass.fetchWithAuth(url), maxIdle: 120 });
const lease = cache.acquire(url, (objectUrl) => { /* null = download failed */ });
lease.url;       // object URL when already downloaded, else null
lease.release(); // exactly once per acquire (a second call does nothing)
cache.dispose(); // revoke everything, when the owner goes away
```
- One download per address, however many pictures show it. A failed download is not remembered: the next `acquire` tries again.
- Counted by holder: an object URL is revoked only after its last holder released it **and** more than `maxIdle` (default 120) unused pictures exist; the longest unused goes first. A picture on screen is never revoked.
- `fetcher` is any `(url) => Promise<Response>`. `createObjectUrl` / `revokeObjectUrl` options exist for tests.

## `lu-media-rail`

| Property | Default | Meaning |
|---|---|---|
| `items` | `[]` | `RailItem[]`: `{id, image, title, caption?, label, play?, badge?, badgeIcon?}`. `label` is the full accessible name of the tile button; `play` draws a play glyph, otherwise `badge` (with optional `badgeIcon`) is drawn on the picture. |
| `more` | `false` | Shows a trailing "Show more" tile. |
| `loading` | `false` | With items: the "Show more" tile says "Loading...". Without items: static placeholder tiles of the right size. |
| `moreLabel` (`more-label`) | `"Show more"` | Text of the last tile. |
| `perView` (`per-view`) | `0` | How many tiles show, as N.5 (e.g. `2.5`). `0` picks the biggest tiles up to 280 px. |
| `widths`, `cache` | unset | Passed to the thumbnails (`cache` also turns on `authed`). |

Events: `lu-select {id}` (tap), `lu-warm {id}` (the instant a tile is pressed: start loading what it opens), `lu-more`.

- Tiles are 120-280 px wide, chosen so that N whole tiles and **half of the next one** fill the width: about 1.5 tiles on a phone, 3.5 on an Echo Show, 4.5+ on a desktop. One ResizeObserver feeds this; it re-solves on rotation or resize.
- Scroll-snap (`x proximity`), touch scrolling both ways, no scroll chaining sideways. No scrollbar on touch screens.
- Keyboard: one Tab stop for the whole rail; Left/Right (mirrored in right-to-left pages), Home and End move between tiles (no wrap) and scroll the focused one into view.
- The host does not widen its parent: the rail scrolls inside.
- Pure helpers: `railTileWidth(containerWidth, gap, perView, min?, max?)`, `railPerView(containerWidth, gap, min?, max?)`, `railFocusIndex(key, current, count, rtl?)`.

## `lu-audio-player`

One recording with the browser's own audio controls.

| Property | Default | Meaning |
|---|---|---|
| `src` | `""` | The recording (often a cleaned preview). Empty renders nothing. |
| `original` | `""` | The untouched recording. Adds an "Original" toggle. |
| `mark`, `caption` | `""` | A small passive label (e.g. "Cleaned") and a line of text under the player while the preview is the one playing. |
| `label` | `""` | Accessible name ("recording from 4:45 AM at Backyard"). |
| `preload` | `"none"` | `"none"` or `"metadata"`. Nothing downloads before play with `none`. |

- Starting it pauses any other recording on the page (`claimAudio`).
- The Original toggle keeps playing across the swap (the other file starts from its beginning).
- A preview that cannot load falls back to `original`; when nothing plays you get "Couldn't load this recording." and a "Try again" button.
- A new `src` while it plays waits for pause/end, so the swap is never heard.
- The sound survives re-renders of the page around the element, **not** removal of the element: the browser stops audio whose element leaves the page.

## `lu-audio-list`

| Property | Default | Meaning |
|---|---|---|
| `rows` | `[]` | `AudioListRow[]`: `{id, src (or null), title, caption?, meta?, mark?, fallback?, label}`. |
| `more`, `loading`, `moreLabel` | `false`, `false`, `"Show more recordings"` | The trailing button. |

Events: `lu-select {id}` (tap on the row, not on play), `lu-more`. Method: `stop()`.

- ONE audio element for the whole list; with `claimAudio` only one recording plays page-wide. Switching rows reuses it.
- Pressing play starts loading a moment before the tap completes; the newest row is loaded when the list first has rows, so its first play is instant. A row plays its current `src`.
- `src` fails -> the `fallback` plays, and the row remembers to use it. Both fail (or no fallback) -> "Couldn't load this recording."; tapping play tries again; a changed `src` heals the row by itself.
- The progress hairline moves by direct style; the list does not re-render while playing.
- A row that disappears while playing stops the sound. Rows are `--lu-row` high with `content-visibility: auto`; targets are 48 px (64 px on a smart display).
- Pure behaviour lives in `SharedAudio` (`src/audio/audio-model.ts`), driven by fake media elements in the tests.

## Example

```ts
import { defineElements, LuImage, LuMediaRail, LuAudioList, ImageUrlCache } from "lucent-ha";

defineElements("kestrel", [LuMediaRail, LuAudioList, LuImage]);

const cache = new ImageUrlCache({ fetcher: (url) => hass.fetchWithAuth(url) });

html`
  <kestrel-lu-image src="/api/kestrel/photo/42" ratio="4/3" priority="high" alt="Robin"
    .widths=${[160, 320, 640]} authed .cache=${cache}></kestrel-lu-image>

  <kestrel-lu-media-rail .items=${visits} .widths=${[160, 320, 640]} .cache=${cache}
    @lu-select=${(e: CustomEvent<{ id: string }>) => this.openVisit(e.detail.id)}
    @lu-warm=${(e: CustomEvent<{ id: string }>) => this.prefetchVisit(e.detail.id)}></kestrel-lu-media-rail>

  <kestrel-lu-audio-list .rows=${calls} more
    @lu-select=${(e: CustomEvent<{ id: string }>) => this.openCall(e.detail.id)}
    @lu-more=${() => this.loadMoreCalls()}></kestrel-lu-audio-list>`;
```
