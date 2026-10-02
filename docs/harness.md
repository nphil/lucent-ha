# The dev harness

A web page that shows every lucent-ha element inside a copy of Home Assistant's own frame (sidebar, drawer, panel area, theme), in four
themes and nine screen sizes, so a change can be looked at before it goes anywhere near the real Home Assistant. Everybody uses the same
page: `http://127.0.0.1:4180/harness.html`.

## In 30 seconds

| I want to | Command |
|---|---|
| see the page | open `http://127.0.0.1:4180/harness.html` (the server runs as the service `lucent-harness`; it is the only one) |
| rebuild after changing code | `scripts/lu-run node dev/build.mjs` (about a second), then reload |
| take a screenshot | `scripts/lu-browser node dev/shot.mjs --theme flat-light --device phone --only button --out /tmp/button.png` |
| take them in every theme and two sizes | `scripts/lu-browser node dev/shot.mjs --theme all --device phone,smart --only button --out /tmp/button-{theme}-{device}.png` |
| make the whole picture set | `scripts/lu-browser node dev/screenshots.mjs` (4 themes x 9 sizes into `docs/specimen/`) |
| start the server (only if it is not running) | `node dev/serve.mjs` (port 4180; set `HARNESS_PORT` for a test copy) |

Several themes or sizes in one `shot.mjs` run share one browser tab and one turn of the browser lock: always prefer one run over many.
`shot.mjs --help` lists every option (`--eval` runs JavaScript in the page BEFORE the shot, so it can open a sheet or switch the theme).

## The four themes

Real Home Assistant theme data (`frontend/get_themes` of this installation), applied on `<html>` the way Home Assistant does it
(default variables, then the theme's, then the derived `--rgb-*`). Switching is live: `window.__lu.setTheme("glass-dark")`, or the
toolbar. Nothing reloads, so every `--lu-*` token must follow on its own.

| name | built from | looks like |
|---|---|---|
| `flat-light` | Neumorphism, light | soft grey-blue surface, raised and inset shadows, teal accent |
| `flat-dark` | Neumorphism, dark | dark slate, same shadows, light teal accent |
| `glass-light` | Frosted Glass, light | translucent cards over a pastel wallpaper |
| `glass-dark` | Frosted Glass, dark | translucent dark cards over a deep wallpaper |

In glass themes, specimen cells get the variables card-mod puts on every Lovelace card (`--ha-card-background`, `--ha-card-backdrop-filter`,
...), so `--lu-card` is as see-through as it is on a dashboard. Cells of `size: "full"` are panel-like and get only the page-level variables.

## URL parameters

| parameter | values | does |
|---|---|---|
| `theme` | `flat-light` (default), `flat-dark`, `glass-light`, `glass-dark` | the emulated theme |
| `group` | `shell`, `view`, `sheet`, `ha`, `controls`, `content`, `state`, `grid`, `image`, `audio` | only that group's specimens |
| `only` | specimen id, comma separated | only these specimens |
| `plain` | `1` | no toolbar, labels or environment cells: clean screenshots |
| `pointer` | `auto` (default), `touch`, `fine` | forces the toolkit's pointer class (see "Not emulated"); `shot.mjs` and `screenshots.mjs` add `fine` on non-touch sizes by themselves |
| `safe` | `top,right,bottom,left` px, e.g. `47,0,34,0` | the Companion app's safe-area insets (`--app-safe-area-inset-*`) |
| `surface` | `dashboard` (default), `panel` | wallpaper behind the cards (a Lovelace dashboard) or just the background colour (a panel) |
| `sidebar` | `docked` (default), `auto`, `always_hidden` | the user's sidebar setting: 256px, 56px icons, or a drawer on every width |
| `kiosk` | `1` | wall mode: `hass-kiosk-mode` on, the sidebar becomes a drawer |
| `external` | `1` | the Companion app draws its own sidebar (`hass-toggle-menu` sends `sidebar/show` to the app) |
| `dir` | `ltr` (default), `rtl` | text direction of the whole page |
| `handle-safe-area` | `1` | the panel config says `handle_safe_area`: the container does not pad |
| `ha-dialog` | `1` | registers the `ha-adaptive-dialog` stand-in |
| `scenario` | scenario id | mounts `dev/scenarios/<id>.ts` as the panel instead of the specimen page |

The toolbar changes the same things live and keeps the URL in step (no new history entries), so a reload or a pasted URL gives the same page.

## `window.__lu`

| | |
|---|---|
| `__luReady` | `true` once fonts are loaded, every specimen's `setup` ran, Lit elements finished updating and two frames painted. Wait for this before measuring. |
| `__lu.settle()` | resolves when the page is still again (after you change something) |
| `__lu.setTheme(name)`, `setPointer(mode)`, `setSafeArea([t,r,b,l])`, `setSurface(s)`, `setSidebar(s)`, `setKiosk(bool)`, `setDirection(d)`, `openDrawer(bool)`, `navigate(path, {replace})` | change the page live |
| `__lu.hass`, `__lu.mock` | the current `hass` (a new object on every change, like Home Assistant) and its control surface: `mock.update(patch)`, `mock.disconnect()`, `mock.reconnect()`, `mock.onWS(type, handler)` answers `hass.callWS`, `mock.externalMessages` |
| `__lu.query(sel)`, `__lu.queryAll(sel)` | `querySelector` that looks through shadow roots |
| `__lu.errors`, `__lu.problems`, `__lu.loaded`, `__lu.specimens`, `__lu.registry` | what went wrong / what was loaded / the registered `spec-lu-*` tags |

## Adding a specimen

Create `dev/specimens/<area>.ts` (the types are in `dev/specimen-types.ts`), then rebuild. The toolkit is registered with the prefix `spec`,
so write the tags directly.

```ts
import { html } from "lit";
import type { Specimen } from "../specimen-types.ts";

export const specimens: Specimen[] = [
  { id: "button", title: "Button: every kind", group: "controls",
    render: () => html`<spec-lu-button kind="primary" label="Save"></spec-lu-button>` },
];
```

Each specimen sits in its own labelled cell inside `<spec-lu-root>` (tokens, profile, container queries are live): `size: "cell"` (default) and `"wide"` in a
card, `"full"` as a whole-width panel. `setup(cell, ctx)` runs once after the first render for states that need an interaction. A file that does
not build is left out and shown in a red banner on the page; one that throws while rendering shows the error in its own cell.

Icons: `<ha-icon icon="mdi:bird">` is a stand-in that draws the paths in `dev/mdi-subset.ts`. A missing icon logs the exact command to add it:
`node dev/tools/add-icon.mjs bird`.

## Adding a scenario

A scenario is a whole app-like page (shell, views, sheet, toasts) used as THE panel. Create `dev/scenarios/<id>.ts` exporting
`scenario: Scenario` (`dev/scenario-types.ts`): `create()` returns the panel element; the harness appends it to `<ha-panel-custom>` and sets `hass`,
`narrow`, `route` and `panel` on it, exactly as Home Assistant does. Open it with `?scenario=<id>`. `dev/screenshots.mjs` also shoots every scenario's first screen.

## What the Home Assistant frame does (and where the rules come from)

From `home-assistant-main`, `ha-drawer`, `ha-panel-custom`, `ha-menu-button` and `sidebar-mixin` of the 2026.9 frontend:

- `narrow` is `(max-width: 870px)`.
- Sidebar mode is "drawer" when narrow, when the setting is `always_hidden`, in kiosk mode, or when the Companion app has its own sidebar. The drawer is a
  top-layer `<dialog>` 256px wide with a scrim; Escape, the scrim and any navigation close it.
- Otherwise the sidebar is docked: `position: fixed; z-index: 6`, 256px (`docked`) or 56px (`auto`), and the panel area is padded by the same width.
- `hass-toggle-menu {open?}`: in drawer mode it toggles the drawer; docked, it fires `hass-dock-sidebar` (docked <-> 56px). With an external sidebar it only sends
  `{type: "sidebar/show"}`. `window` event `hass-kiosk-mode {enable}` sets `hass.kioskMode`.
- The panel is a light-DOM child of `<ha-panel-custom>`, padded by `--safe-area-inset-top/bottom` and the content insets (the docked sidebar absorbs the
  left inset, a drawer does not) unless `handle-safe-area`; the **document** scrolls (`html`/`body` have no overflow).
- `ha-panel-custom.navigate(path, {replace, data})` = `pushState`/`replaceState` with `from` bookkeeping, then `location-changed` on `window`. A URL outside
  `/harness.html` destroys the panel element (a placeholder shows) and Back creates a new one, as Home Assistant does for custom panels.
- `hass` is immutable: every change (theme, sidebar, kiosk, connection) builds a new object and hands it to the panel.
- `<ha-card>` paints `--ha-card-background`, `--ha-card-backdrop-filter`, `--ha-card-box-shadow`, border and radius, so `position: fixed` inside a glass card is
  trapped against the card. `<ha-icon>` is inline and sized only by `--mdc-icon-size`.
- Roboto (bundled, `dev/fonts`) is the font Home Assistant ships; `<meta viewport>` and `color-scheme` are Home Assistant's.

## Not emulated (on purpose, or because headless Chrome cannot)

- **Hover.** Headless Chrome has no pointing device: desktop sizes report `(hover: none)`. `?pointer=fine|touch` only changes what `matchMedia` answers (the toolkit
  reads it); a CSS `@media (hover: hover)` rule keeps the browser's answer, so hover styling cannot be seen in screenshots.
- **The real Home Assistant chrome:** no app bar (a custom panel draws its own), no real sidebar entries, notifications, search, dialogs, `hass.states` beyond a few demo entities.
- **The remote wallpapers** of the glass themes (they are JPEGs on a CDN): a local gradient with crisp shapes plays that role, so blur and translucency stay visible offline.
- **card-mod's CSS** (it restyles Home Assistant's own cards); only the `:host` variable block it puts on each card is replayed.
- **Companion-app details** beyond the safe-area insets and `sidebar/show`; **iOS/Android browser chrome**; real **scrollbar** widths on touch sizes (hidden).
- **Colour-scheme:** the page pins `color-scheme` to the theme's mode (Home Assistant leaves it to the OS), so native controls match the screenshot.

## Files

| file | job |
|---|---|
| `serve.mjs` | the static server (no-store, source maps, panel routes fall back to the page) |
| `build.mjs` | bundles `harness.ts` with esbuild; finds the toolkit, `specimens/*.ts` and `scenarios/*.ts` by looking at the folders; leaves out what does not build |
| `harness.html`, `harness.ts` | the page and its start-up (what the `home-assistant` root element does) |
| `ha-theme.ts`, `fixtures/*.json` | Home Assistant's theme application; real theme data and default variables |
| `ha-frame.ts`, `ha-panel.ts`, `ha-standins.ts`, `ha-dialog-standin.ts` | the frame, `ha-panel-custom`, `ha-icon` / `ha-card`, the optional `ha-adaptive-dialog` |
| `mock-hass.ts`, `harness-api.ts` | the scripted `hass`, and `window.__lu` with the URL parameters |
| `specimen-page.ts` | the toolbar, environment cells and the specimen cells |
| `pointer-override.ts` | `?pointer=` |
| `devices.json` | the nine sizes (phone 390x844 ... QHD 2560x1440) |
| `lib/browser.mjs`, `shot.mjs`, `screenshots.mjs` | the browser tools (shared Chromium, one tab, always closed) |
| `mdi-subset.ts`, `tools/add-icon.mjs`, `fonts/` | icon paths (Apache-2.0), Roboto (SIL OFL) |
| `tools/vendor-ha-defaults.mjs` | refreshes `fixtures/ha-defaults.json` from the Home Assistant frontend source |

`dev/dist/` and `dev/out/` are build output and scratch space (git-ignored).
