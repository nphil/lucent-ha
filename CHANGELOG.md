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
