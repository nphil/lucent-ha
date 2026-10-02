# Home Assistant helpers (`src/ha`)

These are the plain TypeScript pieces that make a custom panel behave like part of Home Assistant: the menu button, the
Back button, sheets that Back closes first, tabs that do not fill the Back stack, and a calm reaction to a dropped
connection. None of it draws anything, it has no colours or CSS variables, and only `ReconnectController` touches Lit
(as a type); everything is imported as `import { ... } from "lucent-ha"`.

## What you call for what

| You want | Call |
|---|---|
| Show the "open Home Assistant's sidebar" button only when Home Assistant would | `showMenuButton(hass, narrow)` |
| Open or close that sidebar | `toggleHaMenu(this)` |
| Wall display: hide Home Assistant's own header and sidebar | `setKioskMode(true)` |
| Go to another page of the panel | `navigate(this, "/kestrel/visit?v=12")` |
| Back arrow in the app bar | `goBack(this, "/kestrel/live")` (and `canGoBack()` to choose arrow or menu) |
| A sheet, picker or focused camera that system Back closes | `pushLayer("species", onClose)` |
| Top-level tabs that keep Back tidy | `new TabHistory({ defaultId: "live" })` |
| Escape key as Back | `shouldEscapeNavigateBack(event)` |
| Keep the last data on screen while the websocket reconnects | `new ReconnectController(this, { getHass })` |
| Remember a choice on this screen only (wall mode, sort order) | `createDeviceSettings("kestrel")` |

## What these pieces promise

- **The menu button follows Home Assistant's own rule**, so it appears exactly when Home Assistant's would, including
  when the user set the sidebar to "always hidden" and in the Companion app.
- **Back closes the top layer first.** Every sheet, picker and focused camera is one history entry. System Back (the
  phone's Back, the browser's Back, Alt+Left) closes only the top one; Escape and the app bar arrow do the same.
- **Tabs never grow the Back stack.** Tab taps replace the current entry. Leaving the home tab adds exactly ONE extra entry,
  so Back from any other tab returns to the home tab, and the next Back leaves the panel.
- **A deep link never strands the user.** A visit opened from a notification has nothing before it inside the panel, so
  `goBack` swaps the page for your fallback instead of leaving the panel.
- **Closing from the screen is instant.** `handle.close()` runs your `onClose` at once (play the exit animation there) and
  fixes the history a moment later; opening another layer in the same tick is safe.
- **A dropped connection is a blip, not an error screen**: for 10 seconds the last data stays; only then it is "lost".

## Menu and kiosk (`menu.ts`)

### `showMenuButton(hass, narrow, options?) -> boolean`
`hass` is the panel's `hass` (or `undefined` before it arrives), `narrow` is the panel's `narrow` property
(Home Assistant sets it for screens up to 870 px). `options.wall` is `true` while the panel's own wall mode is on.

True when the sidebar is a drawer, so a button is needed: the screen is narrow **or** `hass.dockedSidebar === "always_hidden"`.
False when `hass.kioskMode` is on, and false whenever the Companion app draws its own sidebar
(`hass.auth.external.config.hasSidebar`). With no `hass` yet it counts as "not kiosk, no app sidebar, sidebar unknown".

Wall mode is the one exception to the width rule: kiosk mode turns Home Assistant's sidebar into a closed drawer at every
width (an Echo Show at 960 px is not "narrow"), so with `wall: true` the answer is true unless the Companion app has its
own sidebar.

### `toggleHaMenu(from, open?)`
Fires the bubbling, composed `hass-toggle-menu` event from the element `from` (use `this`). `open: true` opens the drawer,
`false` closes it, leaving it out toggles. On a wide screen with a docked sidebar Home Assistant docks or undocks it instead.

### `setKioskMode(enable) -> () => void`
Fires the `hass-kiosk-mode` window event Home Assistant listens to. The returned function switches kiosk mode off again;
calling it twice does nothing the second time, so it is safe in `disconnectedCallback`. It always switches OFF (it does
not restore whatever was set before).

## Moving around (`navigate.ts`)

### `navigate(from, path, options?)`
Moves to an absolute `path` (`/kestrel/visit?v=12`) inside the panel. `options.replace: true` swaps the current history
entry instead of adding one; `options.data` is kept in `history.state` next to the toolkit's own marker.

- `from` is any element inside the panel. The walk goes up through shadow roots to Home Assistant's `ha-panel-custom` and
  uses its own `navigate` (which also closes Home Assistant's dialogs). Without one (a Lovelace card, the dev harness) it
  uses `pushState`/`replaceState` and fires `location-changed`. Pass `null` when you have no element.
- Open layers close first, with the reason `"navigate"`.
- Home Assistant navigates a moment later, not synchronously: react to `location-changed` or `popstate`, do not read
  `location` on the next line.
- Calls queue up, so two quick calls land in order.

### `canGoBack() -> boolean`
True when an entry of this panel session exists before the current one. False on the page the session started at (a
deep link, a fresh tab). The answer survives a reload, because it is stored in `history.state`.

### `goBack(from, fallback)`
What a back arrow means: if a layer is open, close the top one; else if `canGoBack()`, go back one step; else replace the
page with `fallback`.

## Layers (`layers.ts`)

### `pushLayer(id, onClose) -> LayerHandle`
Opens a layer: one history entry that keeps the address and the old `history.state`. `onClose(reason)` runs exactly once,
whoever closes the layer, top layer first when several close together, and never inside another `onClose`. Play the exit
animation there. A throwing `onClose` is reported to the console and does not stop the others.

`LayerHandle` has `id`, `open` (true until the layer closes, by any route) and `close(reason?)` (default reason `"api"`).
Closing a layer also closes every layer above it. Closing twice does nothing.

Safe to call from `disconnectedCallback`: when the page has already moved on without the layer (Home Assistant switched
to another panel, or a Home Assistant dialog is open on top), `close()` still runs `onClose` but does not go back in
history, because that would undo somebody else's navigation. A navigation Home Assistant makes itself (a sidebar tap, a
link it handled) also closes every open layer, with the reason `"navigate"`, so a layer cannot outlive the page.

| Reason | Meaning |
|---|---|
| `"back"` | System Back or Forward moved history (or `goBack` closed the top layer) |
| `"navigate"` | `navigate()` or a tab change replaced the page |
| `"api"` | Code called `close()` without a reason |
| anything else | Your own word: `"button"`, `"scrim"`, `"escape"`, `"swipe"` |

### `closeTopLayer(reason?) -> boolean`
Closes the top layer; false when none was open.

### `layerDepth() -> number`
How many layers are open. Calling any layer function early (the app shell does) makes the page's Back handling exist
from the start, which matters after a reload: see "Limits".

### `createLayerManager(env?)`
The same three functions on a manager of your own with a fake history (tests). `env` is `{ history, addPopstate,
addLocationChanged, clock, onError }`; anything left out uses the browser. The functions above share ONE manager per page, parked on
`globalThis[Symbol.for("lucent-ha:layers")]`, so two bundles of the toolkit on one page never both react to Back.

## Tabs (`tab-history.ts`)

### `new TabHistory({ defaultId, initialId?, env? })`
`defaultId` is the home tab. `initialId` is the tab the address shows when the panel opened on something else (a deep
link); it only matters when the history entry has no tab stamp yet.

| Member | What it does |
|---|---|
| `select(id, path, from?)` | Switches to tab `id` whose page is `path`. Home to other: pushes the one marker entry. Other to other: replaces. Home while the marker is current: pops it (`history.back()`). Selecting the current tab does nothing. |
| `current` | The tab the current history entry shows. Update it only through `select`. |
| `onChange(callback) -> stop` | Called with the tab id when system Back or Forward lands on an entry of another tab (not for changes `select` made). |
| `dispose()` | Stops listening to history (call from `disconnectedCallback`). |

A deep link to a non-default tab has no home entry under it, so choosing the home tab replaces instead of popping and Back
from there leaves the panel.

## Escape key (`escape.ts`)

### `shouldEscapeNavigateBack(event) -> boolean`
True for a plain Escape (no Ctrl/Alt/Meta/Shift, not a key repeat, not cancelling an input method) that nothing else
wants. Nothing else wants it when: no toolkit layer is open, focus is not in a text field, editable area or native
select, no open `<dialog>`, `aria-modal`, `role=dialog/alertdialog/menu/listbox` or open popover is in the event's path
(it looks through shadow roots), and Home Assistant has no dialog open (`history.state.dialog`). When it returns true,
call `event.preventDefault()` and `goBack(...)` yourself. A second argument lets tests pass fakes.

## Reconnect (`reconnect.ts`, `reconnect-controller.ts`)

### `new ReconnectGrace({ graceMs?, clock?, onChange?, onError? })`
Turns "websocket up / down" reports into `state`: `"connected"`, `"grace"` (dropped less than `graceMs` ago, default
10 000: keep the last data and show a quiet "reconnecting" strip) or `"lost"` (show the offline state with Retry).

| Member | What it does |
|---|---|
| `update(connected)` | Report the websocket state. Repeats are harmless; "still down" never extends the window. |
| `state` | `"connected" \| "grace" \| "lost"` |
| `lastConnectedAt` | When it was last up (ms since the epoch): now while connected, the moment it dropped otherwise. |
| `dispose()` | Clears the timer; later reports are ignored. |

### `new ReconnectController(host, { getHass, graceMs?, clock? })`
A Lit controller around it. It follows `hass.connected` (read on every host update) and the connection's own
`ready`/`disconnected` events, and calls `host.requestUpdate()` when `state` changes. It exposes `state` and
`lastConnectedAt`, attaches listeners only to the websocket connection, and removes them in `hostDisconnected`.

## Device settings (`device-settings.ts`)

### `createDeviceSettings(namespace) -> { get, set, subscribe }`
Choices that belong to this screen, kept in `localStorage` as JSON under `<namespace>.lu.<key>`. Create ONE per namespace
and share it.

| Member | What it does |
|---|---|
| `get(key, fallback)` | The stored value, or `fallback` when nothing, corrupt JSON, or a value of another kind than `fallback` is stored |
| `set(key, value)` | Stores anything JSON can hold; `undefined` removes the key. Tells subscribers in this tab and, through the browser, in other tabs |
| `subscribe(key, callback) -> stop` | `callback(value)` after every change (`undefined` when removed). Stopping twice is fine; the window listeners go away with the last subscriber |

If the browser blocks or refuses storage, values stay in memory until the page closes.

## What is written into `history.state`

Everything of the toolkit sits under one key, `lu`; every other key (Home Assistant's `root`, `from`, `dialog` ...) is
copied over untouched.

```
lu: { depth: 2,                              // entries this panel session pushed before this one (canGoBack)
      layer: { id: "species", seq: 17 },     // set on the entry a layer pushed; seq only grows
      tab:   { id: "wildlife", marker: true } } // set by TabHistory; marker = the one entry pushed leaving home
```

## Home Assistant facts these rely on

Checked against the Home Assistant frontend `20260826.7` (Home Assistant 2026.9.4).

- `ha-menu-button` shows when `kioskMode === false`, the Companion app has no native sidebar, and the screen is narrow or
  the sidebar is "always hidden". `hass-toggle-menu` (`detail: { open? }`) is handled by `home-assistant-main`; kiosk mode
  is the `hass-kiosk-mode` window event (`detail: { enable }`).
- `ha-panel-custom` sits in the light DOM above a native panel and exposes `navigate(path, { replace, data })`. It is
  asynchronous, replaces `history.state` with `{ ...data, from }` (a replaced first entry keeps only `root`), and resolves
  `false` when it refused (a dialog would not close). Because `data` is stored, the toolkit's marker is already in the new
  entry when `location-changed` fires; for a Home Assistant that drops `data` the marker is written right afterwards.
- Home Assistant's own dialogs mark their history entry with `history.state.dialog` (and the entry below with
  `opensDialog`). Its `popstate` handler closes the last dialog when it lands on an `opensDialog` entry and steps back out
  of a `dialog` entry when no dialog is open. Layer entries copy the entry they sit on, so do not open a layer from inside
  a Home Assistant dialog.

## Example

```ts
import { LitElement, html } from "lit";
import { ReconnectController, TabHistory, createDeviceSettings, goBack, navigate, pushLayer, shouldEscapeNavigateBack, showMenuButton, toggleHaMenu } from "lucent-ha";
import type { HomeAssistant, LayerHandle } from "lucent-ha";

const settings = createDeviceSettings("kestrel"); // one per app: settings.get("sort", "recent"), settings.set("sort", "name")

class KestrelPanel extends LitElement {
  static properties = { hass: { attribute: false }, narrow: { type: Boolean }, tab: { state: true }, sheetOpen: { state: true } };
  declare hass: HomeAssistant | undefined;
  declare narrow: boolean;
  declare tab: string;
  declare sheetOpen: boolean;
  private _link = new ReconnectController(this, { getHass: () => this.hass }); // "connected" | "grace" | "lost"
  private _tabs: TabHistory | undefined;
  private _sheet: LayerHandle | undefined;
  private _stopTabs: (() => void) | undefined;

  constructor() {
    super();
    this.narrow = false;
    this.tab = "live";
    this.sheetOpen = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._tabs = new TabHistory({ defaultId: "live" }); // pass `initialId` when the address is a deep link to another tab
    this._stopTabs = this._tabs.onChange((id) => (this.tab = id)); // the user pressed system Back
    window.addEventListener("keydown", this._onKey);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._sheet?.close("api"); // a panel removed with a sheet open must not leave its layer behind
    this._stopTabs?.();
    this._tabs?.dispose();
    window.removeEventListener("keydown", this._onKey);
  }

  private _onKey = (event: KeyboardEvent): void => {
    if (!shouldEscapeNavigateBack(event)) return;
    event.preventDefault();
    goBack(this, "/kestrel/live");
  };

  private _pickTab(id: string): void {
    this.tab = id;
    this._tabs?.select(id, `/kestrel/${id}`, this); // replaces the history entry; leaving "live" adds ONE marker entry
  }

  private _openSheet(): void {
    this.sheetOpen = true;
    this._sheet = pushLayer("species", () => (this.sheetOpen = false)); // system Back and this callback close it
  }

  private _closeSheet(): void {
    this._sheet?.close("button"); // runs the callback now, then pops the history entry
  }

  render() {
    return html`
      ${showMenuButton(this.hass, this.narrow) ? html`<button @click=${() => toggleHaMenu(this)}>Menu</button>` : ""}
      ${this._link.state === "grace" ? html`<p>Reconnecting…</p>` : ""}
      <button @click=${() => this._pickTab("wildlife")}>Wildlife</button>
      <button @click=${() => this._openSheet()}>Open sheet</button>
      <button @click=${() => navigate(this, "/kestrel/visit?v=12")}>Open visit</button>
    `;
  }
}
```

## Pattern for an overlay element (a sheet)

Open with `pushLayer`, close with the handle, and do all visual closing inside `onClose`, so Back, Escape, the scrim and
`navigate()` all take the same path:

```ts
show(): void {
  this._layer = pushLayer(this.layer || "sheet", (reason) => this._hide(reason)); // runs once, whoever closes
  this.open = true;
}
close(reason = "api"): void {
  if (this._layer) this._layer.close(reason); // onClose runs now, the history entry is popped a moment later
  else this._hide(reason);
}
private _hide(reason: string): void {
  this._layer = undefined;
  this.open = false; // start the exit animation here
  this.emit("lu-close", { reason });
}
disconnectedCallback(): void {
  super.disconnectedCallback();
  this._layer?.close("api"); // safe even when Home Assistant already moved to another panel
}
```

## Limits worth knowing

- **Native panels only** (`embed_iframe: false`) and Lovelace cards. A panel in an iframe has its own history that
  Home Assistant does not drive; `navigate` would use that iframe's history.
- **After a reload with a sheet open** the sheet is gone but its history entry stays. The toolkit steps over such leftover
  entries the moment its layer manager exists (any layer function creates it), so call one early, as the app shell does;
  before that, one Back press can land on the leftover and seem to do nothing.
- **Plain links bypass the toolkit.** Home Assistant itself navigates every same-origin `<a href>` click that nobody
  prevented (`isNavigationClick` on the window). That path does not write the `depth` marker, so `canGoBack()` stays false
  after it (open layers still close, because the toolkit notices the navigation). For links inside the panel call `event.preventDefault()` and use `navigate()` or
  `TabHistory.select()`.
- **Cards must not use layers** (`pushLayer`): a card should not push history. Sheets in cards run with `history: false`.
- Two quick navigations or a close-then-open in the same tick are safe; a Back press in the same few milliseconds as a
  close made from the screen can be counted twice (the layer below also closes).
- The Escape check's default (browser) environment looks at the live DOM and is covered by tests against a small fake
  DOM, not a real browser.

## Testing hooks

`createLayerManager(env)`, `createHistoryNavigator(env)`, `new TabHistory({ env })`, `createDeviceSettings(ns, env)`,
`new ReconnectGrace({ clock })` and `shouldEscapeNavigateBack(event, env)` all take their surroundings (history, clock,
storage, DOM questions) as arguments, with browser defaults, so `node --test` can drive them with fakes. See
`test/ha-fakes.ts` for a browser-faithful fake history.
