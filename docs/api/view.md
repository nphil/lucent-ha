# View stack: keep-alive tabs, scroll memory, paint-from-memory data

The view stack keeps the pages of a panel (its tabs) alive and shows one at a time, so coming back to a page is instant and lands exactly where you left it. `swr` is a small cache that remembers the last answer for a request, so a screen paints from memory first and refreshes behind it; it survives Home Assistant re-creating your panel.

Everything on this page is exported from the package root (`import { swr, importWithReload } from "lucent-ha"`). Tags below use the harness prefix `spec`; use your own (`<kestrel-lu-view-stack>`).

## The idea in plain words

- **Visited pages stay.** A page you have opened stays in the document, but is switched off: it cannot be focused, screen readers skip it and the browser does not draw it (`inert` + `content-visibility: hidden`). Coming back is a repaint, not a rebuild.
- **At most 4 stay (`max`).** Open a fifth page and the one shown longest ago is pushed out: the stack tells you (`lu-view-evict`) and you remove its element. Memory stays small on a wall display that runs for weeks.
- **Each page remembers its scroll position.** Leave a page at 1400 px, come back, and it is at 1400 px again, exactly. A page you never left starts at the top. The memory is kept at module level, so it also survives Home Assistant re-creating your panel (it does that when you switch panels, and after the panel was hidden for a few minutes).
- **A returning page fades in** (180 ms, opacity only; none with reduced motion). The page you left disappears at once.
- **Pages are told** when they are shown or hidden, so a live camera can pause while its page is hidden.

## `<prefix>-lu-view-stack`

Put the pages inside as direct children, each with a unique `data-view` id, and set `current` to the id to show.

| Property | Attribute | Default | What it does |
|---|---|---|---|
| `current` | `current` | `""` | The `data-view` id to show. Empty shows nothing. |
| `max` | `max` | `4` | How many pages stay alive (at least 1; the showing page always stays). |
| `memoryKey` | `memory-key` | `"default"` | Names the scroll memory. Stacks with the same key share it (that is how a re-created panel finds its old positions), so give every stack on a page its own key. |
| `scroller` | (none) | the shell's scroller, else the page | What scrolls. A `LuScroller` (`{ top, scrollTo(top), target, element }`), or just `{ top, scrollTo(top) }`. Leave it unset inside the app shell and on the page: the stack finds the shell's scroll area when the shell is in `scroll="contained"` mode, and the page otherwise. |

**Method** `forgetScroll(id)`: the next time `id` is shown it starts at the top. Call it *before* showing a page that now holds different content under the same id (see the recipe below). It has no effect on the page that is showing.

**Slot** default: the pages. Anything without `data-view` is left alone.

**Events** (they bubble and are composed; each is fired on the page's element, or on the stack itself when that page has no element yet):

| Event | `detail` | When |
|---|---|---|
| `lu-view-shown` | `{ id }` | A page became the showing one. The page is already back at its scroll position. Resume live streams here. |
| `lu-view-hidden` | `{ id }` | The showing page was replaced. Pause live streams here. |
| `lu-view-evict` | `{ id }` | More than `max` pages are alive and this is the one shown longest ago. **Remove its element.** The stack never removes nodes you render. |

**CSS variables:** none. The stack has no look of its own; it reads no tokens and declares none.

### Rules for the pages

1. Each page is a **direct child** with `data-view="<id>"`, ids unique. A page's root must produce a box (a `div`, or a custom element; custom elements are made `display: block` while hidden, so `content-visibility` works even though they are inline by default). Put margins and padding on a wrapper inside the root, not on the root, because a hidden page's own margin would still take space.
2. **Render pages keyed by id** (`repeat(ids, (id) => id, ...)` in Lit). Without keys Lit reuses one page's DOM for another when the list changes, which defeats keeping pages alive.
3. Do not set `inert`, `hidden` or `display` on a page yourself: the stack owns them.
4. **Remove a page when told** (`lu-view-evict`), by dropping it from the list you render.
5. **The first time a page is shown (or shown again after being pushed out) it does not fade.** It is still filling in, and a fade would only delay it.
6. A page that is rendered but never shown yet is hidden like all the others.

### What happens on a switch

1. The position of the page you leave is remembered (the exact offset; if its own restore had not finished, the offset it was still heading for).
2. The page you leave is switched off; the new page is switched on.
3. The new page is put back where it was left. If it is still too short (a skeleton waiting for data), the stack waits for its height to settle and keeps the offset while images or rows arrive. It lets go as soon as you touch, wheel, click or press a key, and gives up after 1.5 s (landing as close as the content allows).
4. The new page fades in; `lu-view-hidden`, `lu-view-shown` and any `lu-view-evict` fire.

Nothing moves while this happens: the old page and the new page are never on screen together, so nothing below them shifts.

### Recipe: new content under the same id

A detail page often reuses one id (`visit`) for different items. Its remembered offset belongs to the old item, so reset it before showing the new one:

```ts
stack.forgetScroll("visit");   // the next show of "visit" starts at the top
this.view = "visit";           // ...now show it
```

### Recipe: shell + view stack + one page fed by `swr` (about 20 lines)

```ts
import { LitElement, html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { defineLucent, readSwr, subscribeSwr, swr } from "lucent-ha";

defineLucent({ prefix: "kestrel" });
const TABS = [{ id: "wildlife", label: "Wildlife", icon: "mdi:bird" }, { id: "settings", label: "Settings", icon: "mdi:cog" }];
const SPECIES = "kestrel/species";

class KestrelPanel extends LitElement {
  static properties = { hass: { attribute: false }, view: { state: true }, alive: { state: true } };
  constructor() { super(); this.view = "wildlife"; this.alive = ["wildlife"]; }
  connectedCallback() {
    super.connectedCallback();
    this._stop = subscribeSwr(SPECIES, () => this.requestUpdate());          // repaint when the answer changes
    swr(SPECIES, () => this.hass.callWS({ type: "kestrel/species" }));        // last answer now, fresh one behind it
  }
  disconnectedCallback() { super.disconnectedCallback(); this._stop(); }
  render() {
    const species = readSwr(SPECIES);
    return html`<kestrel-lu-app-shell heading="Kestrel" .hass=${this.hass} .destinations=${TABS} .current=${this.view}
        @lu-navigate=${(e) => { if (!this.alive.includes(e.detail.id)) this.alive = [...this.alive, e.detail.id]; this.view = e.detail.id; }}>
      <kestrel-lu-view-stack .current=${this.view} memory-key="kestrel" @lu-view-evict=${(e) => { this.alive = this.alive.filter((id) => id !== e.detail.id); }}>
        ${repeat(this.alive, (id) => id, (id) => html`<div data-view=${id}>${id === "wildlife" ? (species.data ?? []).map((s) => html`<p>${s.name}</p>`) : html`<p>${id}</p>`}</div>`)}
      </kestrel-lu-view-stack>
    </kestrel-lu-app-shell>`;
  }
}
```

## `swr`: show the last answer now, refresh behind it

`swr` keeps the last good answer for a key **at module level**. Home Assistant re-creates your panel element; the module (and so this memory) stays. The new panel asks again, gets the old answer at once, and the fresh one replaces it when it arrives.

```ts
const handle = swr("kestrel/cameras", (signal) => fetchCameras(signal), { maxAgeMs: 30_000 });
handle.data;      // the last good answer, or undefined on the very first load
handle.loading;   // a request is running
handle.stale;     // there is data, but it is old or the last refresh failed: say so on screen
handle.error;     // why the last request failed (undefined when it worked)
await handle.pending;       // the running request, if any (resolves with the new snapshot, never rejects)
await handle.revalidate();  // fetch again now: the Retry button
```

| Function | What it does |
|---|---|
| `swr(key, fetcher, options?)` | Returns the handle above. Starts a request unless the data is fresh or a request is already running. Call it when your panel or page is created or shown, **not from `render()`**. Read `fetcher`'s `hass` inside the function (`() => this.hass.callWS(...)`), not from a variable captured earlier. |
| `readSwr(key)` | The current snapshot (`data`, `error`, `loading`, `stale`, `updatedAt`) without fetching. A new object after every change, so `===` tells you whether anything changed. |
| `subscribeSwr(key, callback)` | Calls `callback(snapshot)` after every change (request started, answer arrived, failure, mutation, clear). Returns the function that stops it. Call `requestUpdate()` in it. |
| `mutateSwr(key, updater)` | Replaces the data now (`updater(current) => next`): an optimistic update. A request that is running is dropped, because it was asked for before the change and could overwrite it. Call `handle.revalidate()` once your write is done. |
| `clearSwr(key?)` | Forgets one key, or everything (also the saved copies in storage). **Call it on sign-out or when the Home Assistant instance changes.** |
| `createSwrCache({ scheduler?, storage?, maxEntries? })` | A cache of your own with the same five operations (`swr`, `read`, `subscribe`, `mutate`, `clear`), for tests or when data must stay apart. |

**Options** (`swr(key, fetcher, { ... })`; give every caller of a key the same options):

| Option | Default | Meaning |
|---|---|---|
| `maxAgeMs` | `30000` | How long an answer counts as fresh. After that, `swr()` shows it as stale and refreshes it. A failed key is tried again by `swr()` no sooner than this after the failure (a Retry button calls `revalidate()`, which always tries). |
| `persist: { maxAgeMs }` | off | Also keep a copy in `localStorage`, so a *reloaded page* paints from it too. A copy older than this is ignored (Kestrel uses 6 h because its signed links last 12 h). Data must survive `JSON.stringify`. Writes are delayed 400 ms and merged. Change the key name when the data's shape changes (`"kestrel/cameras/v2"`). |

**Rules it keeps**

- Callers asking for one key at the same time share **one** request.
- A failed request **never blanks the screen**: the last good data stays, `error` is set, `stale` is true.
- A request that was replaced (`revalidate()`, `mutateSwr`, `clearSwr`) is aborted (the `signal` you were given) and its late answer is dropped, so an old answer can never overwrite a newer one.
- A fetcher that returns `undefined` counts as "no data".
- Memory is bounded: after 100 keys the ones used longest ago are forgotten, except keys somebody subscribed to.

### Recipe: a re-created panel paints from memory

```ts
// Anywhere the panel starts (connectedCallback):
const cameras = swr("kestrel/cameras", () => this.hass.callWS({ type: "kestrel/cameras" }), { persist: { maxAgeMs: 6 * 3_600_000 } });
this._cameras = cameras.data ?? [];        // switching panels and back: instant; reloading the page: instant too
```

## `importWithReload`: lazily loaded views after an app update

```ts
const { KestrelInsights } = await importWithReload(() => import("./insights.ts"));
```

After an update the old file names are gone from the server, and a page that is still open fails to load them. `importWithReload` recognises that failure (Chrome, Firefox and Safari wording), reloads the page **once**, and still throws the error so you can show your error state until the reload happens. A second failure with no successful import in between (the server is down) only throws, so it cannot loop. Any other error (a bug in the loaded file) is thrown untouched and never reloads. The "reloaded once" flag lives in `sessionStorage`; options `{ storage?, reload? }` replace it for tests. A successful import clears the flag.

## The pieces underneath (pure logic, no DOM; used by the tests)

| Export | What it is |
|---|---|
| `ViewStackModel` | The bookkeeping: `show(id) -> { hide, show, evict, first }`, `clear()`, `trim()`, `max`, `current`, `mounted`, `saveScroll(id, top)`, `scrollFor(id)`, `forgetScroll(id)`. |
| `createScrollMemory(limit?)`, `scrollMemoryFor(key)` | The per-view offsets. `scrollMemoryFor` is the module-level memory a stack with that `memory-key` uses (64 views per key, oldest forgotten first). |
| `ScrollRestorer` | The restore algorithm: `begin(scroller, top)`, `cancel()`, `active`. Works on any `{ top, scrollTo(top), maxTop() }`; takes its clock, frames and user-input source as an `env` (`browserRestoreEnv()` is the default). |

## Good to know

- **Where it scrolls.** In a Home Assistant panel the page scrolls, and the stack uses the page. Inside `<prefix>-lu-app-shell scroll="contained">` (specimens, iframes, cards) it uses the shell's scroll area automatically. Anywhere else set `scroller`.
- **The first paint is already in place.** The offset is restored in the same turn as the switch, before the browser paints, so a returning page never shows at the top for a frame.
- **Scroll anchoring.** While a restore is holding an offset the stack switches the browser's own scroll anchoring off for its pages (on the stack element, never on `html` or `body`), so late images cannot nudge the page.
- **Live content.** Views are not destroyed, so anything running inside them keeps running unless it listens for `lu-view-hidden` / `lu-view-shown`.
- **Reduced motion.** With `prefers-reduced-motion: reduce` there is no fade at all.
