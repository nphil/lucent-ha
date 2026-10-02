# Changelog

All notable changes to `lucent-ha`. Versions follow [semver](https://semver.org/); every release is a git tag `vX.Y.Z` with GitHub Release notes.

## 0.1.1 - 2026-10-02

Found by measuring Kestrel on the real Home Assistant 2026.9, at the host's normal load (15 to 25 on 16 threads).

- **Sheet: a press on a button inside an open sheet no longer makes the browser redo a whole-screen filter.** Home Assistant's dialog scrim is `backdrop-filter: brightness(68%)` over the whole screen, and glass themes put `blur(8px)` over the whole panel. A backdrop filter is redone over its whole area whenever anything inside it changes, and on a browser without a GPU (the headless test browser, a weak device) that is CPU work. Measured before: the close button pressed in 55.8 / 53.5 / 49.3 ms in glass dark (phone 1x, phone 4x, Echo Show 1x) against 45.8 / 37.2 / 46.1 ms in flat light, and on the real Home Assistant (1920 px desktop) a recording row inside the sheet took 63 ms against 25 ms for a press that does nothing, with the display compositor spending 35 to 96 ms of CPU per pressed frame. The sheet now draws a scrim that only darkens as a black layer of its own (same motion), and, in Chromium-based browsers (where it was checked), a panel blur that only ever saw the scrim's flat colour as that colour under the panel; Safari, Firefox and every browser on iOS keep the panel's blur. Same picture (largest difference 1/255 in flat light, 2/255 at rest and 4/255 on a few pixels in mid-fade in glass dark), the display compositor now spends 1.8 to 3.1 ms per pressed frame, and the close button presses in 45.5 / 40.6 / 45.2 ms in glass dark (flat light unchanged). The choice is made at every opening and again when the theme changes while the sheet is open; scrims and blurs of any other kind are drawn with their filters as before (`dialogLook`, `docs/api/sheet.md`).
- **`engine="auto"` has a measured price, now documented.** On the real Home Assistant 2026.9 at 4x CPU, Home Assistant's own dialog opened about 80 to 170 ms slower than `engine="native"` with the same content (species sheet 259 against 145 ms on a phone, 329 against 158 ms at 960 x 480; picker 138 against 58 ms), because it makes the browser recalculate the styles of the whole document twice per opening. The default stays `auto`; an app that cares sets `engine="native"` (Kestrel 1.1.1 does).
- **Sheet focus, documented as measured.** Tab never reaches the page behind. Past the last control it leaves the document for the browser's own controls and the next Tab comes back to the first control; Shift+Tab wraps. Home Assistant's own dialog also lets Tab out (checked on the real Home Assistant 2026.9).
- **Perf tools judge at the host's normal load.** `PERF_MAX_LOAD` (default 64; `8` brings back "a truly quiet host only") replaces waiting for a quiet window that never comes; a cell is `PROVISIONAL` only at or above it, and the load is printed with every cell. README, `docs/perf.md`, `docs/scenario-panel.md` and `scripts/lu-load` no longer ask for a quiet host.

## 0.1.0 - 2026-10-01

First release: the shared Lucent-for-Home-Assistant toolkit, proven by Kestrel first.

- **Tokens and device profiles**: one Lucent v2 token layer that reads only Home Assistant's variables (live theme follow, flat and glass), profiles phone / tablet / desktop / smart (960x480 wall display) from the panel width, the viewport height and the pointer type, shell tokens, z-index bands, safe areas.
- **HA integration** (`lucent-ha/ha`): the menu-button rule Home Assistant itself uses, `hass-toggle-menu`, wall mode (`hass-kiosk-mode`), `navigate` / `goBack`, history layers (the system Back closes the top layer first), tab history, reconnect grace (10 s), device settings.
- **App shell and navigation**: sticky HA-style app bar, tabs / pills / bottom bar / left rail by container width and viewport height, keyboard shortcuts, wall mode, toast host.
- **View stack**: keep-alive views, per-view scroll memory, module-level stale-while-revalidate cache, cross-fade.
- **Sheet**: Home Assistant's adaptive dialog when it exists, native top-layer dialog otherwise; swipe-down, history layer, focus return, no soft keyboard on touch, side pane on wide screens.
- **Grid, image, states**: container-driven grids, one-observer images with sized URLs, static skeletons, empty / error / stale states.
- **Controls**: button, chip / badge, segmented, stepper, slider, hold-to-confirm (with a tap fallback), toast with Undo, inline audio player (one recording at a time), section, row, media rail.
- **Scoped registration**: `defineLucent({ prefix })` registers every element as `<prefix>-lu-<name>`, so two apps can bundle the toolkit side by side on one page without a tag clash.
- **Dev harness**: emulated Home Assistant (four themes from real theme data, nine device sizes), a specimen of every component, a perf gate with budgets.

### Known limits of 0.1.0

- **Speed budgets are built but not yet measured on a quiet host.** `dev/perf-check.mjs` runs end to end (touch and mouse input, 1x and 4x CPU, thread time from a trace for press cost); every number taken so far is PROVISIONAL because the host load was 24-37. The quiet-window run is scheduled separately (commands in `docs/perf.md`).
- The "sheet open <= 220 ms" budget is judged from the tap to the first frame in which the sheet is on screen and entering; the enter motion itself is `motion.layer` = 220 ms, so "fully open" is 270-380 ms by design (`--sheet-gate done` measures that).
- Sized pictures (`sizedUrl`) need the server to understand `?width=`; Home Assistant's signed media links reject every other extra parameter. Nothing is assumed: apps pass `widths` only when their media route resizes.
- Hover styles could not be seen (headless Chrome has no pointer): they were checked as rules. Real touch hardware, iOS Safari, Firefox and a real soft keyboard were not tried.
- Two sheets open at once sit at the same spot (the lower one hides behind a larger upper one).
- `lu-section` shows its content only while `count` is 1 or more (set it for sections holding forms or key/value rows); its error line always reads "Couldn't load more".
- `TabHistory.select` does not know about detail pages (use `goBack` for those); `swr` cannot be revalidated by key from outside; three app-bar actions truncate the title on a 390 px phone (the shell cannot fold actions yet).

