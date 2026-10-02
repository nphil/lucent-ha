# Changelog

All notable changes to `lucent-ha`. Versions follow [semver](https://semver.org/); every release is a git tag `vX.Y.Z` with GitHub Release notes.

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

