# Moving Kestrel onto lucent-ha

For the person doing the move (FrontendAgent): which Kestrel piece becomes which toolkit part, what to change, what stays in Kestrel, and a safe order.
Kestrel's code is edited all the time, so pieces are named by symbol or CSS selector, not by line.

## What Nitin will notice afterwards

The Home Assistant menu button is always one tap away on a phone, also on a sighting's page, because the top bar now stays pinned. Back (phone gesture or button)
closes an open sheet first and only then leaves the page; from a sighting, Back returns to the list exactly where he was. Each tab remembers how far he had scrolled.
Pictures are fetched at the size they are shown (once Kestrel's media route supports `?width=`). Undo messages and sheets look and behave like the ones in his other
panels because they come from one shared kit. On the Echo Show an opt-in wall mode hides Home Assistant's sidebar and the bar gets its own menu button.

## Set-up (do this first, nothing changes visibly)

1. `package.json`: `"lucent-ha": "github:nphil/lucent-ha#v0.1.0"` (Lit stays a dependency; it is the toolkit's peer). esbuild resolves `dist/` (plain modules + `.d.ts`), no `allowImportingTsExtensions` needed.
2. `src/main.ts`: replace the side-effect imports of `ui/*` with ONE call that lists only what Kestrel uses, so the bundle stays small and under the 80 KiB gzip gate in `build.mjs`:
   ```ts
   import { defineElements, LuAppShell, LuAudioList, LuAudioPlayer, LuButton, LuChip, LuGrid, LuImage, LuMediaRail, LuRoot, LuRow, LuSection, LuSegmented, LuSheet, LuState, LuViewStack } from "lucent-ha";
   defineElements("kestrel", [/* the classes above */]);   // dependencies (nav, toast, ...) come with them
   ```
   Tags become `kestrel-lu-<name>` and cannot clash with `kestrel-live-player`, `kestrel-species-sheet`, `kestrel-cameras`, `kestrel-panel`. Never import `lucent-ha`'s `defineLucent` (it registers everything).
3. Measure the bundle after step 1 and after every step below (`node build.mjs`). If the gate is at risk: drop unused classes from `defineElements`, keep `badge()` as plain classes instead of `<kestrel-lu-chip>` on the 70 species tiles (see row 27), never import `src/all.ts`.
4. Registration in `custom_components/kestrel` does not change (`panel_custom` + `add_extra_js_url`, component `kestrel-panel`, path `kestrel`). `handle_safe_area` stays unset: Home Assistant pads the panel by `--safe-area-inset-*` and the app shell cancels that padding for its own bar and dock, so its surface reaches the screen edge (checked by `scripts/ha-check.mjs`).

## The map

Toolkit names: elements are `<kestrel-lu-...>`; events are `lu-...`; functions come from `"lucent-ha"`. API pages: [`docs/api/`](api).

### Frame, navigation, history

| # | Kestrel piece | Becomes | What to change |
|---|---|---|---|
| 1 | `kestrel-cameras.ts` `_renderHeader()`; CSS `.topbar`, `.brand`, `.title-stack`, `.open-scrypted`, `.shortcuts-button` | `app-shell` (`heading`, `leading`, slot `actions`) | Delete the header. `heading="Kestrel"`; `leading="auto"` on tabs, `leading="back"` on the visit page; put the "Open in Scrypted" link and the help button in `slot="actions"`. `heading` is text only: keep the logo as a small element in `actions` or drop it. |
| 2 | `_onMenu()` and the `narrow` menu-button branch | `app-shell` `leading="auto"` (`showMenuButton`, `toggleHaMenu`) | Delete both. Keep passing `.hass` and `?narrow` to the shell: it now also honours `dockedSidebar: always_hidden`, kiosk and the Companion app's own sidebar, which Kestrel ignored. |
| 3 | `_renderNav()`, `NAV`, CSS `.navigation`, `.nav-item`, the `@container (max-width:680px)` fixed bottom bar and the `data-lu-short` rail block | `app-shell` `destinations` + `current` (the nav comes with it) | `destinations = [{ id: "live", label: "Live", icon: "mdi:cctv", href: "/kestrel/live" }, { id: "wildlife", ... }, { id: "insights", label: "AI check-up", ... }]`, `current=${this._view}`, `@lu-navigate=${(e) => navigate(this, e.detail.href)}`. Delete all `.navigation/.nav-item` CSS. Bar modes are tabs >= 900, pills 680-899, bottom bar < 680, left rail when the screen is <= 500 tall. On the visit page pass `.destinations=${[]}` to hide the destinations (fewer than two draws none). |
| 4 | `_onGlobalKeydown` number keys and the `window` keydown listener | the shell's digit shortcuts | Delete the 1-3 branch (fine pointers only, never while typing or in a dialog). Keep the `?` help branch and `_helpOpen`/`_renderHelp` (no help overlay in the toolkit); its guard can use `isTextEntry` and `layerDepth()`. |
| 5 | `api.ts` `navigate()`, `goBack()`, `panelDepth()`, `history.state.kestrel` | `navigate`, `goBack`, `canGoBack`, `TabHistory` | `navigate(this, "/kestrel/<view>" + search, { replace })` (a FULL path: Kestrel's helper prefixed `/kestrel/` itself); `goBack(this, "/kestrel/live")`; delete `panelDepth` and the `{ kestrel: n }` state (the toolkit stamps its own marker and keeps HA's). Tabs: `new TabHistory({ defaultId: "live" })` + `select(id, path, this)` (tabs replace the entry; leaving Live adds ONE marker entry, so Back from any tab returns to Live and the next Back leaves). Keep `routeView`, `visitIdFromLocation`, `speciesFromLocation`. |
| 6 | `_syncRoute()`, `_routeKey`, `_onLocationChanged` (`location-changed` + `popstate`), `_pageKey`, `_visitSeeds` | stays | Keep. The toolkit's `navigate` still fires `location-changed`. A layer-closing Back (sheet) must not also be handled as a route change twice: layers are closed by the layer manager, the URL does not change. Keep the rule "a sheet shares its page's key". |
| 7 | `_renderCached(view)`, `_mounted`, `_frozen`, CSS `.view[data-active="false"]` content-visibility + `inert` | `view-stack` (`current`, `max`, children `data-view`) | Wrap the views in `<kestrel-lu-view-stack current=${this._view}>`; children are `<div data-view="live">` (Kestrel already writes `data-view`). Delete the `.view[data-active]` CSS and `?inert` (the stack owns them). Keep `_frozen`/`_mounted` at first: Lit still re-renders hidden children on every state change, and the frozen template prevents that. Render views keyed; remove a view on `lu-view-evict`. |
| 8 | scroll restore: `_scrolls`, `_beginRestore`, `_applyRestore`, `_abortRestore`, `history.scrollRestoration = "manual"`, `overflowAnchor` on `documentElement` | `view-stack` per-view scroll memory | The stack implements the same algorithm (waits for the height to settle, scroll anchoring off on its own host, aborts on user input) and remembers offsets in module memory. Delete Kestrel's block after one real-HA comparison (Back from a visit lands on the same offset). The visit page re-uses one view id for different visits: call `stack.forgetScroll("visit")` before showing a new one. |
| 9 | `_livePaused`, `_onViewChanged()`, `LIVE_GRACE_MS = 250`, staggered stops | `lu-view-hidden` / `lu-view-shown` events | On `lu-view-hidden` for `live` start the 250 ms timer then set `_livePaused`; on `lu-view-shown` clear it and resume at once. A hidden view's content-visibility does NOT stop a Scrypted stream, keep the pause. |
| 10 | window listeners, `_stopPresses`, `_clockTimer` | `trackPresses` | Keep the routing listeners and the 30 s tick; `import { trackPresses } from "lucent-ha"` (the shell and `lu-root` also track presses on themselves). |
| 11 | `render()` tail (`ha-card` wrapper for the card form), `:host{container-type:inline-size}`, `ha-card` height rule, `.app`, `main` padding | `app-shell` (panel) / `lu-root mode="card"` (card) | Panel: `app-shell` with `contentMax="grid"` (it supplies the edge padding and `--lu-content-max`). Card form: `<kestrel-lu-root mode="card">`, no shell. Delete the height rule, `.app`, `main` padding. |
| 12 | `src/styles/tokens.ts`: `TOKENS_CSS`, `FOCUS_CSS`, `BASE_CSS`, `CONTROLS_CSS`, `COMMON_CSS` | `TOKENS_CSS`, `BASE_CSS`, `CONTROLS_CSS`, `FOCUS_CSS`, `SURFACE_CSS` (`.sheet .tile .raised .status-dot`) from `"lucent-ha"` | Delete the file AFTER comparing tokens line by line in a flat and a glass theme (the toolkit's are a superset of Kestrel's v2 block). Differences to know: `--lu-type-numeral` is now the canonical feature value (`tabular-nums`) and the size is `--lu-type-numeral-size`; `--lu-scale-pressed` is no longer used by components (press = wash, see "Lessons"); `--lu-shadow-rest` falls back to `none` (the theme's own card shadow), plus new `--lu-shadow-overlay`; the dialog blur follows `--lu-sheet-blur`/`--lu-scrim-blur`. Everything toolkit-drawn must sit INSIDE the shell/root: tokens are declared there and inherited. |
| 13 | `src/ui/profile.ts` `PanelProfile`, `resolveProfile`, `SHORT_HEIGHT = 540`; `_panel.width` for `_maxLive()` and `.wide` | the shell's own profile; `shell.panelWidth`, `shell.profile`, event `lu-profile-change` | Delete Kestrel's controller. Short is now <= 500 px tall (Kestrel's was 540); smart is touch + short + viewport >= 900 + height >= 440 (Echo Show 960x480). Read the width for `_maxLive()`/`.wide` from `shell.panelWidth` and re-render on `lu-profile-change`. Kestrel's remaining `:host([data-lu-short])` rules must move to the element that carries the attribute (the shell host) or use `@container`/`::part`-free tokens (`--lu-top-chrome` etc.). |

### Overlays and feedback

| # | Kestrel piece | Becomes | What to change |
|---|---|---|---|
| 14 | `src/ui/sheet.ts` `kestrel-sheet` (`heading`, `subheading`, `closeLabel`, event `close`, owner removes it) | `sheet` (`open`, `heading`, `subheading`, `closeLabel`, `layer`, `history`, event `lu-close {reason}`) | `<kestrel-sheet>` -> `<kestrel-lu-sheet ?open=${cond}>`; `@close` -> `@lu-close` (fires after the exit motion; `detail.reason` is escape, scrim, swipe, button, back, api, navigate). The sheet is a native top-layer dialog (or Home Assistant's own adaptive dialog when defined): a bottom sheet under 680 px, a right-hand pane on wide or short screens, a centred dialog in between. It now has a real swipe-down, closes on Back, never auto-focuses a text field on touch and keeps the first rows above the keyboard. Delete `src/ui/sheet.ts`. Keep sheets OUTSIDE the view-stack children (a modal inside a hidden view would still block the document). |
| 15 | `_openSpecies(name)` / `_closeSpecies()` (`navigate("wildlife", "?s=...")` / `goBack`), `_selectedSpecies` | `sheet` with `history="false"` + `navigate`/`goBack` | The species sheet is URL-backed (deep links, Back from a visit reopens it): keep the URL as the single source of truth: `<kestrel-lu-sheet history="false" ?open=${!!selected} @lu-close=${this._closeSpecies}>`. Do NOT let it also push a layer (two history entries per open). |
| 16 | `_renderCorrectionSheet`, `_pickerOpen`, `.species-search`, `.choice-list`, `.choice-row`, `.special-choices` | `sheet` (default `history`, `layer="wrong-picker"`), `row`, `button` | `.choice-row` -> `<kestrel-lu-row heading=... detail=... chevron interactive>`; "Not an animal" / "Can't tell" -> `<kestrel-lu-button kind="secondary">`; the search `<input>` stays native. Back now closes the picker (new and wanted). |
| 17 | `_renderHelp()`, `_helpOpen` | `sheet` | Tag and event renames only; rows stay plain markup. |
| 18 | `_setToast()`, `_toast`, `_toastTimer`, `_renderToast()`, `.toast*` CSS | `showToast(this, options)` | `showToast(this, { message, kind, actionLabel, onAction, durationMs })` (renames: `action` -> `onAction`, `duration` -> `durationMs`; Undo >= 5 s, Kestrel's 10 s stays; `kind: "error"` for the "wasn't saved" messages). Delete the state, the timer, `_renderToast` and all `.toast*` CSS. The toast host lives in the shell/root, so the template must be inside one. |

### Content

| # | Kestrel piece | Becomes | What to change |
|---|---|---|---|
| 19 | CSS `.camera-grid`, `.species-grid`, `.health-grid` | `grid` (`kind="camera"|"species"|"visit"|"custom"`, `min`, `lazy`) | `<kestrel-lu-grid kind="camera">`, `kind="species" lazy`, health tiles `kind="custom" .min=...`. Delete the three `grid-template-columns` rules. Minimums change on purpose: camera 240 -> 360, species 180 -> 176 (fewer, larger camera tiles at 680-1100 px; four per row at 1920x1080). |
| 20 | `kestrel-lazy-image` (`src`, `alt`, `square`/`wide`, slot `empty`, event `kestrel-image-error`) | `image` (`src`, `alt`, `ratio`, `fit`, `priority`, `widths`, `authed`; slot `fallback`; `lu-image-load`/`lu-image-error`) | `square` -> `ratio="1"`, `wide` -> `ratio="16/10"`, default 4/3 unchanged; slot `empty` -> `fallback`; `kestrel-image-error` -> `lu-image-error` (3 sites: `_onReferenceImageError`, `_onVisitReferenceImageError`, species sheet `_photoFailed`). Use `priority="high"` on the first row of camera/species tiles. |
| 21 | `cameraSnapshotUrl()`, `speciesPicture()`, `visitSnapshot()`, `mediaUrl()`; the Python route `KestrelMediaView` | `sizedUrl` + `image` `widths` | Needs the server side first: the media route must accept `?width=<160|320|640>` (Home Assistant's signed links reject every other extra parameter; `width`/`height` are the ones they allow), keep `authSig` valid and cache per width. Then `.widths=${[160, 320, 640]}`. Until then use `image` WITHOUT `widths`. Apply Kestrel's `stableUrl` first (keeps the signed link constant for 6 h), then `sizedUrl`. |
| 22 | `_renderCameraSkeleton()`, `_renderWildlifeSkeleton()`, visit/insights skeletons, `.bone`, `PARTS_CSS` `.bone` (it pulses) | `state kind="loading"` (`variant`, `count`) | Cameras/species `variant="tiles"`, visit `variant="text"`, insights `tiles`. Static, never pulses, same geometry as the content. Keep the conditions that show it only while there is no data. Delete `.bone` CSS. |
| 23 | `_renderLoadError()`, `.error-state`; `.empty-state` blocks (Live "No cameras", Wildlife empty, Visit gone) | `state kind="empty"|"error"` (slot `action`, event `lu-retry`, `retryLabel`) | Each `.empty-state` -> `<kestrel-lu-state kind="empty" icon heading message>` with buttons in `slot="action"`; `.error-state` -> `kind="error" @lu-retry=${...}`. Copy the wording across unchanged; `_renderVisitGone` stays calm (an empty state, not an error). |
| 24 | `src/ui/section.ts` `kestrel-section` (event `retry`) | `section` | Tag -> `kestrel-lu-section`, `@retry` -> `@lu-retry`; props identical. Keep the rule "count > 0 with state=error means a later page failed". |
| 25 | `.visit-list/.visit-row` (AI check-up), `.choice-row` | `row` (`icon`, `heading`, `detail`, `href`, `selected`, `chevron`, `interactive`, slots `leading`/`trailing`) | Review rows keep their 56 px thumbnail in the `leading` slot. `.simple-list` (label + value, not interactive) stays plain markup. |
| 26 | `badge()` + `PARTS_CSS` (`.badge-row > .badge`, `.chip-button`) | `chip` (`kind="evidence"`, `overlay`, `count`, `icon`; `interactive` with a `detail` slot) | Species-tile badges can become `<kestrel-lu-chip kind="evidence" overlay>`; `_renderSighting`'s two-line 48 px "latest sighting" button is `<kestrel-lu-chip interactive>` with a `detail` slot. **70 tiles:** Kestrel made badges plain classes to avoid a shadow root per tile: measure scrolling first and keep `badge()` + `PARTS_CSS` if the element costs anything. |
| 27 | `.status-chip`, `.snapshot-chip`, `.camera-health`, `.count-badge`, `.new-tag`, `.status-dot` | `chip` (`kind`: positive, warning, danger, neutral, info, live, evidence; `overlay`) | `_statusKind()` maps ok -> positive, warn -> warning. Chips over photos/video use `overlay` (a near-opaque reading surface; glass themes need it). `.status-dot` stays until needed. |
| 28 | `src/ui/segmented.ts` `kestrel-segmented` (event `change`) | `segmented` | Tag rename, `@change` -> `@lu-change` (`detail.value` unchanged; the element now updates its own `value`). Reserved height, arrows/Home/End preserved. |
| 29 | `.pill` (primary/secondary/danger), `.icon-button`, `.back-button`, `.text-button`, `.back-inline`, `.show-more` | `button` (`kind`: primary, secondary, danger, quiet; `icon-only` + `label`; `loading`; `href`) | `.pill.primary` -> `<kestrel-lu-button kind="primary">`; `.text-button`/`.back-inline` -> `kind="quiet"`; `.icon-button` -> `icon-only label="..."`. `@click`/`?disabled` unchanged (a disabled or loading button never fires click). Primary buttons use `contrast-color()` where the browser has it, so a light accent keeps a readable label. |
| 30 | `_renderVisit()` hero + side column (`.visit-view`, `.visit-hero`, `.visit-summary`) | composition on tokens (no element) | Keep the layout as Kestrel CSS (media left, facts and the one primary action right at >= 900 px, stacked below); remove only the page header (the back arrow moves to the shell). The primary action ("That's right") must stay visible without scrolling on a phone. |

### Media

| # | Kestrel piece | Becomes | What to change |
|---|---|---|---|
| 31 | `src/ui/media-rail.ts` `kestrel-media-rail` (events `select`, `warm`, `more`) | `media-rail` | Tag; events -> `lu-select`, `lu-warm`, `lu-more`. Item shape unchanged. `warm` still fires on pointerdown. |
| 32 | `src/ui/audio-list.ts` `kestrel-audio-list` | `audio-list` | Tag; `@select`/`@more` -> `@lu-select`/`@lu-more`; row shape unchanged. Keeps press-time warm, hairline progress, `content-visibility` rows, `fallback` on error, ONE shared `<audio>`. |
| 33 | `src/ui/lazy-audio.ts` `kestrel-lazy-audio` | `audio-player` | Tag; same props (`src`, `original`, `mark`, `caption`, `label`, `preload`). `sameMedia` stays in Kestrel. |
| 34 | `src/ui/audio-focus.ts`, `src/ui/press.ts` | `claimAudio`/`releaseAudio`, `trackPresses` from `"lucent-ha"` | Delete the copies; change the imports. |

### Data and resilience

| # | Kestrel piece | Becomes | What to change |
|---|---|---|---|
| 35 | `src/cache.ts` (`readCached`/`writeCached`, localStorage, 6 h) | `swr` with `persist` | `swr("cameras", fetcher, { persist: { maxAgeMs: 6 * 3600e3 } })`: last answer at once (also after HA re-creates the panel, and after a reload through the saved copy), refresh behind it. Prefix keys with `kestrel` (the saved copies share localStorage with every app on the address). Call `clearSwr()` on sign-out. Keep Kestrel's identical-refresh drop (`_camerasSignature`) so an unchanged list does not re-render. |
| 36 | `_loadWildlife()`, `_setSpecies()`, `visible.map(_renderSpeciesTile)` | keyed rendering | `repeat(visible, (s) => s.species, ...)` so a push refetch updates tiles in place by id and never resets scroll or "show more". |
| 37 | `_ensureConnection()` and no visible reconnect state | `ReconnectGrace` / `ReconnectController`, `state kind="stale"` | Addition: `update(hass.connected)` in the `hass` setter; during `grace` keep the data visible; at `lost` show `<kestrel-lu-state kind="stale" .since=...>`. Keep `shouldUpdate` ignoring pure `hass` churn. |
| 38 | `HomeAssistant`/`KestrelCardConfig` in `src/types.ts` | toolkit `HomeAssistant` | Make Kestrel's type extend the toolkit's, keeping its stricter `callWS<T>` and `connection.subscribeMessage<T>`. |

### Build, dev and gate

| # | Kestrel piece | Becomes | What to change |
|---|---|---|---|
| 39 | `build.mjs`, 80 KiB gzip gate | stays | No script change. Watch the gate (the toolkit adds shell, nav, view stack, sheet, toast, grid, state, row, chip, button; Kestrel deletes about eleven `ui/*` files). |
| 40 | `dev/harness.ts` + `dev/index.html` (flat dark/light only, `scrypted-nvr-camera` stand-in) | keep for the domain fixtures | Add the glass-theme variables (translucent `--ha-card-background`, `--ha-dialog-surface-background`). Use the toolkit harness (four real themes, nine sizes, a specimen of every element) to look at the toolkit parts. |
| 41 | `dev/perf-check.mjs` | stays as the APP gate | Update the selectors in the same step as each swap (`.nav-item` -> `kestrel-lu-nav` links with `aria-current`, `kestrel-segmented` -> `kestrel-lu-segmented`, `kestrel-sheet` -> `kestrel-lu-sheet`, `.back-button` -> the shell's back button). Add the toolkit budgets (sheet open <= 220 ms, Back closes the top layer <= 100 ms). Use thread time from a trace for press cost when the host is loaded. |

## Stays in Kestrel

The live player and its camera plumbing (`kestrel-live-player`, `live-frames.ts`, `_ensureNvrComponents`, the Scrypted link); the domain components and flows (`kestrel-species-sheet` composition, `api.ts` commands and shapes, `types.ts` domain types, `wildlife.ts`, `vocab.ts`, `format.ts`, `urls.ts` signed-link handling, `_onPush`, `_correctVisit`, ...); CSS with no toolkit element (`.hours`, `.health-tile`, `.meter`, `.progress-track`, `.heard-panel`, `.clip-progress`); the `?` help sheet content; the Python integration.

## Known gaps (and the workaround)

- **Detail page hero (B11)** and the retained side pane at >= 900 px are composition, not elements: keep Kestrel's two-column CSS and open the species `sheet` below 900 px (the sheet itself is a right-hand pane on wide screens).
- **No search input element:** `.species-search` stays a native `<input type="search">`.
- **Sizes need the server first** (row 21).
- **Stacked sheets** open at the same spot: a larger upper sheet hides the lower one.
- **Hover** cannot be shown in headless Chrome: hover styles were checked as rules, not seen.
- **Real Home Assistant:** the toolkit was exercised in the live HA (`scripts/ha-check.mjs`: theme follow, menu, kiosk, Back, drawer stacking, safe areas); the `ha-adaptive-dialog` path was only verified against the harness stand-in plus the live element's presence (see `docs/api/sheet.md`).

## Order (each step ships and passes Kestrel's own gate)

1. Dependency + `defineElements` in `main.ts` (rows above, set-up); measure the bundle.
2. Leaf swaps with an identical look: `trackPresses`/`claimAudio` imports (34), `segmented` (28), `section` (24), `media-rail` / `audio-list` / `audio-player` (31-33). Delete each `ui/*` file and fix the perf-check selectors.
3. Toast (18): wrap the template in `kestrel-lu-root mode="panel"` first (the toast host and the tokens come from it).
4. Sheets (14-17): species sheet with `history="false"` + URL; picker and help with history. Check glass themes.
5. Image and states (20, 22, 23); `widths` waits for the server.
6. Grid (19): the visible change is bigger camera tiles.
7. Shell + nav + history (1-6, 11, 13): the biggest visible change, do it alone; keep Kestrel's scroll-restore block for now.
8. View stack (7-9): swap the wrappers, hook live pause to the view events; delete the scroll-restore block after the real-HA comparison.
9. Reconnect grace + stale state + `swr` + keyed tiles (35-37).
10. Detail page and wide layout (30), wall mode (`wall` on the shell, `wall-key="kestrel.wall"`, a toggle in `slot="actions"`).

Rollback: each step is one commit; the bundle name is a content hash and `build.mjs` deletes older ones; bump `INTEGRATION_VERSION` on release so the module URL changes.

## Lessons the move must not regress

1. Never `position: fixed` inside a layout-contained host (`container-type`): that was the old sheet bug and is why the bars are sticky and overlays use the top layer.
2. Glass themes make cards translucent: overlays use `--lu-sheet` (HA's dialog surface); text over photos/video uses the reading surface (`overlay`).
3. Live players must pause when a view hides (`content-visibility` does not stop a stream); stagger stops; capture the last frame.
4. A push refetch updates tiles in place by id, never rebuilds the grid.
5. Scroll restore waits for the height to settle: the view stack does it; verify with images that load late.
6. Only a press that STARTED on the scrim dismisses a sheet; focus returns to the opener (the toolkit sheet does both).
7. Press feedback is a wash or a veil, never a `transform: scale`: it re-promotes a layer on every press (6-13 ms measured on this panel).
8. `ha-icon` only scales with `--mdc-icon-size`: keep that CSS when moving markup.
9. The per-image IntersectionObserver was removed from Kestrel for cost (about 60 ms per revisit of 24 tiles at 4x CPU); the toolkit image uses one shared observer: re-measure with the perf-check `scroll` and `tab` gates.
