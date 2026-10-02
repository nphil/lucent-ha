# The sample panel

A complete Home Assistant panel built **only** from lucent-ha's own elements: three pages (Live, Library, Insights), a detail page,
three sheets, toasts with Undo, a stale-data strip and a wall mode. Its server is fake and needs no network. It does three jobs: it
is the proving ground (anything awkward in the toolkit shows up here first), it is the page `dev/perf-check.mjs` measures, and it is
the worked example the README links to. Everything it shows is generated, and the same every time (a fixed seed, a fixed "now" of
1 October 2026, 16:45 UTC), so pictures can be compared.

## Open it

| I want to | Do |
|---|---|
| look at it | `http://127.0.0.1:4180/harness.html?scenario=panel&theme=glass-dark` (any theme, any size) |
| rebuild after a change | `scripts/lu-run node dev/build.mjs` |
| take a picture | `scripts/lu-browser node dev/shot.mjs --scenario panel --device phone --theme flat-light --out /tmp/panel.png` |
| open a visit directly | `http://127.0.0.1:4180/harness.html/visit?v=3&scenario=panel`, or in the page `__lu.navigate("/harness.html/visit?v=3")` |
| open a species directly | `.../harness.html/library?s=Robin&scenario=panel` |
| make the next request fail | Insights > "Failure drill", or `__lu.demo.failNext(true)` |

## What to try

| Do this | What happens | Built from |
|---|---|---|
| Resize or pick another device | Navigation becomes tabs (900 px and up), pills, a bottom bar (phone) or a left rail (short screens); camera tiles go 1 to 4 across, species tiles 2 to 4 (measured from 320 px to 2560 px) | `app-shell`, `grid` |
| Tap Library, scroll, tap Insights, tap Library | You are back at exactly the same offset | `view-stack` |
| "Show 24 more", then Insights > "Simulate a new sighting", back to Library | New data moves one tile to the front; the other tiles are the same elements, the scroll offset and the 48 tiles stay | keyed `repeat`, `swr` |
| Tap a species | A sheet opens, the address gets `?s=Robin`; Back, Escape and the X each close only the sheet and leave no extra history entry | `sheet` with `history=false`, `navigate`, `goBack` |
| In that sheet: a clip, a recording, "Original", "Mute alerts" | The clip opens the visit page and Back brings the sheet back; the Original toggle swaps the recording; the Undo toast works inside the sheet | `media-rail`, `audio-list`, `audio-player`, `showToast` |
| App bar tag button ("What was it?") | A sheet with a search field and the likely species as rows; Back closes it (`layerDepth()` is 1 while open); on a touch screen the keyboard does not pop up | `sheet` (history layer), `row` |
| Pick a species there, or "Wrong?" on a visit | The page changes at once, the toast offers Undo after the save, a failed save puts the old value back | `swr` (`mutateSwr`), `showToast` |
| Open a visit, then the back arrow | Back to where you were; opened from a link (cold) it goes to Live | `app-shell leading="back"`, `goBack` |
| "Hold to delete" on a visit | A hold, or a quick tap then Confirm | `hold-button` |
| Insights | The four states of `lu-state` on demand, rows with thumbnails, stepper, slider, all button kinds | `section`, `state`, `row`, controls |
| Wall mode (first app bar button) | Home Assistant's header and sidebar go away, the bar gets its own menu button | `app-shell wall` |
| `__lu.mock.disconnect()` | The last data stays, a strip at the bottom says "Reconnecting..."; `reconnect()` removes it | `ReconnectController`, `state kind="stale"` |

## How it is put together

`dev/scenarios/panel.ts` is the panel (address, data, shell, sheets). Next to it, in the folder `dev/scenarios/panel/`: one file per page
(`live-view.ts`, `library-view.ts`, `insights-view.ts`, `visit-page.ts`), the sheets (`species-sheet.ts`, `sheets.ts`), `styles.ts` (tokens
only), `route.ts` (pure), `data.ts` (the fake server, no `lit`, no DOM), `driver.ts`. The helpers are in a folder because the harness
treats every top-level file in `dev/scenarios/` as a scenario (see finding 12).

The patterns worth copying:

- **The address is the only state** for page, species sheet and visit. A tap sets the route at once (the page changes in that frame) and
  then navigates; `location-changed` and `popstate` report the same route a moment later and nothing happens. Parameters the panel does not own
  (the harness keeps `scenario` and `theme` in the query) are carried along.
- **Data**: `swr(key, () => hass.callWS(...))` for every list, `readSwr` in `render()`, `subscribeSwr` to redraw. The pages are `guard`ed on their
  snapshot, so a hidden page costs nothing when something else changes.
- **Keyed tiles** (`repeat(..., (item) => item.id, ...)`) and `lu-grid lazy`: fresh data updates tiles in place.
- **Change, save, Undo**: `mutateSwr` shows the change, `hass.callWS` saves it, then the toast offers Undo; Undo is the same call with the old values.
- **Two kinds of sheet**: the species sheet is opened by the address (`history=false`); "What was it?" and the shortcut list use the
  sheet's own history entry (`layerDepth()`, `closeTopLayer()`).
- **`hass` churn**: `shouldUpdate` ignores a new `hass` unless something the shell or the connection reads changed; `route` has a `hasChanged` that
  compares the address.

## For scripts: `window.__lu.demo`

Installed while the panel is on the page. `ready()` resolves when the first data of the current page is painted (or its error is).

| Call | Returns |
|---|---|
| `ready()`, `current()`, `destinations()` | promise / the page showing (`live`, `library`, `insights`, `visit`) / `["live","library","insights"]` |
| `navItem(id)` | the navigation control to tap (`null` if the navigation is not drawn) |
| `openSpecies(name?)`, `speciesTile(i?)`, `speciesCount()` | opens the sheet as a tap does / the i-th tile / tiles drawn (24, then 48) |
| `openPicker()`, `pickerButton()`, `closeTopLayer()`, `layerDepth()`, `sheetOpen()` | the history-layer sheet; `closeTopLayer()` is system Back for a layer; the species sheet is not a layer |
| `scrollRoot()` | `{ top: scrollTop, height: scrollHeight }` of the page |
| `failNext(on)` | the next request to the server fails once |
| `stats()` | `{ renders, viewsMounted, evicted }` (`evicted` stays empty: four views fit `max=4`) |

Query hooks for `__lu.query`: `[data-demo=live-grid]`, `[data-demo=species-grid]`, `[data-demo=species-tile]`, `[data-demo=camera-tile]`,
`[data-demo=picker-open]`, `[data-demo=detail-primary]`. Two things to know when scripting: for about 1.5 s after a view is shown the stack puts
the scroll offset back (a script that scrolls in that time is undone; a real touch or wheel is not), and a toast in the top layer covers the
bottom of the page until it goes.

## What it showed about the toolkit (findings, with a suggested fix)

| # | What happened | Suggested fix |
|---|---|---|
| 1 | **System Back from the detail page counted a layout shift of 0.706** (gate: 0.02). A hidden view collapses and Chrome counts the vanishing box when nobody touched the page. | The stack should also set `visibility: hidden` on inert views. One rule in the panel (`[data-view][inert]{visibility:hidden}`) brought it to 0.001. |
| 2 | **The stale strip did not appear** when the connection dropped. The controller's update request merges with the `hass` update, so the update looks like "only hass changed". | Document it, or give the controller a `shouldRender(changed)` helper; the panel compares `link.state` first. |
| 3 | `lu-section` **hides its content unless `count` is 1 or more**, so a section holding a form or key/value rows shows "Nothing here yet". | Treat a `count` that was never set as "content present". |
| 4 | `TabHistory` **does not know detail pages**. `select()` ignores the tab you came from (the panel calls `goBack` then), and a pushed detail entry carries no tab stamp. | `navigate()` copies the current tab onto pushed entries; `select()` on a detail page goes to the tab's root. |
| 5 | The shell's own "ignore pure `hass` churn" check (`hassInputsChanged`, `shouldRender`) is **not exported**; the panel repeats its four comparisons. | Export it. |
| 6 | **Smart profile: 64 px buttons in a 48 px bar.** The back arrow measures 64 px high at y 24, so 8 px lie above the screen edge. | Make the bar at least as tall as the target in that profile. |
| 7 | Three 48 px actions leave the heading "Sample pa..." on a 390 px phone (two: "Sample p..." at 320 px). The shell cannot fold actions. | The shell could shrink the title or move actions into a menu; the panel hides the link-out under 430 px. |
| 8 | `lu-section state="error"` always says "Couldn't load more." even when the first page failed to refresh. | An `error-message` attribute. |
| 9 | `showToast` from the page **while a sheet is open** shows a toast whose Undo cannot be pressed (the sheet docs list it as a known limit). The panel picks `spec-lu-sheet[open]` as the origin itself. | `showToast` should find the top open sheet. |
| 10 | `swr` cannot be revalidated **by key**; the panel keeps its own key-to-request map. | `revalidateSwr(key)` using the last fetcher. |
| 11 | `lu-image` in a row's `leading` slot is `width: 100%`, so the thumbnail needs its own width rule. | A size variable on `lu-image`, or sizing the leading slot in `lu-row`. |
| 12 | **Harness**: any top-level `dev/scenarios/*.ts` is taken for a scenario; a helper file there leaves the page never ready (tried). | Skip files without a `scenario` export, and say so on the page. |
| 13 | **Harness**: `refresh()` hands a new `route` and `panel` object on every `hass` change. A panel comparing by identity renders every time. | Keep them while the address is the same, as Home Assistant does [not checked against Home Assistant]. |

Also seen, not defects: on the 960 x 480 display the docked sidebar leaves 704 px, so Live shows one camera per row (two in wall mode);
the `stale` strip is meant for the top of content and moves the page when it appears there, so the panel puts it in the shell's bottom slot.

## Not covered

Hover styling (headless Chrome has no pointing device), a real on-screen keyboard, real sound output (the recordings are generated tones),
a real Home Assistant, and any speed number: timing waits for a quiet host.
