# Third-party notices

`lucent-ha` is MIT-licensed (see `LICENSE`). A small number of source files are derived from Music Assistant's frontend and remain under the
Apache License 2.0 (`LICENSES/Apache-2.0.txt`). Each such file starts with a header comment naming its upstream file and what was changed.

## Music Assistant frontend

- Upstream: https://github.com/music-assistant/frontend
- Commit: `994d867e4afc45b57ea2da8a3bf4caf8c8e4386d` (2026-10-01)
- Copyright: The Music Assistant Authors
- Licence: Apache License 2.0 (`LICENSES/Apache-2.0.txt`). The upstream repository has no NOTICE file.

Derived files (upstream file -> file here -> change):

<!-- DERIVED-FILES -->
- `src/core/long-press.ts` <- `src/plugins/touchEvents.ts and src/composables/useHoldToOpenMenu.ts`: rewritten from a Vue directive to plain pointer events with cancel handling, Lucent's 600 ms `motion.reorder` threshold, and a capture-phase click swallow that is removed with the listeners.
- `src/ha/device-settings.ts` <- `src/helpers/device_settings.ts:1-77`: one small store per namespace instead of fixed setting names; values are JSON; blocked storage falls back to memory; subscribers can be removed (MA never removed its `storage` listeners) and are told the new value; same-tab changes travel as a toolkit event, so two settings objects with one namespace stay in step.
- `src/ha/escape.ts` <- `src/composables/useEscapeBack.ts:4-53`: the Vue composable and its store flags became a pure yes/no question about one keydown event; the overlay search follows the event's own path through shadow roots (a document-wide query cannot see into them); toolkit layers and Home Assistant's own open dialog (`history.state.dialog`) count as owners of the key.
- `src/ha/navigate.ts` <- `src/helpers/navigation.ts:10-24`: ported from vue-router to the browser history and Home Assistant's own navigate. "Can go back" is a depth counter the toolkit stamps into history.state (it survives reloads) instead of vue-router's `state.back`; going back with nothing to go back to replaces the page with the fallback; open layers are closed first; navigations are queued.
- `src/ha/reconnect.ts` <- `src/composables/useReconnectGrace.ts:20-77`: Vue refs and `watch` replaced by a plain class with an `onChange` callback; MA's four connection states became one boolean ("is the websocket up"); the result is three states (connected, grace, lost) instead of a boolean; the clock is injectable; repeated "still down" reports no longer extend the window.
- `src/image/media-rail.ts` <- `src/components/discover/EditorialShelf.vue:337-427`: the scroll-snap track CSS (proximity snap, pan-x pan-y, overscroll containment, overflow-anchor off, snap padding) is kept; tile size comes from rail-model.ts through ONE shared ResizeObserver (MA uses a MutationObserver and a window listener); no hover chevrons, no mouse drag; tiles are Lucent tokens, tiles are buttons with roving focus.
- `src/image/rail-model.ts` <- `src/components/discover/EditorialShelf.vue:151-166`: the tile size is solved for "N and a half tiles visible" from the container width alone (MA subtracts card padding and takes tiles-per-view from the caller), and the 120/280 clamp is a parameter.
- `src/sheet/swipe-model.ts` <- `src/components/PanelDragHandle.vue:18-224`: the Vue component's gesture logic is rewritten as a DOM-free state machine (`SwipeModel`) plus a pure classifier of the elements under the finger (`classifyStart`, which reads a composed path instead of `closest`); thresholds come from `SWIPE`; a mouse can only drag the handle, a finger can also drag the header and swipe anywhere; text fields and more sliders are protected from swipes; the click guard also covers long handle drags.
- `src/sheet/swipe.ts` <- `src/components/PanelDragHandle.vue:18-224`: a Lit ReactiveController instead of a Vue component; touch gestures are read from touch events (the way Home Assistant's own bottom sheet does it, because a browser that starts to scroll cancels pointer events but keeps sending touch events), mouse and pen drags from pointer events; the gesture itself lives in `swipe-model.ts`; elements under the finger are read from the composed path; the panel only follows the finger, the host plays the dismissal.
- `src/shell/chrome-meter.ts` <- `src/layouts/default/Footer.vue:40-71`: the Vue `useElementSize` + `watchEffect` pair is a plain ResizeObserver; instead of one player-bar height on `<html>` it measures the sticky top block, the rail and the bottom dock and publishes `--lu-top-chrome`, `--lu-rail-w` and `--lu-bottom-bar` on the shell host (rounded up, removed again when the shell disconnects).
- `src/view/chunk-guard.ts` <- `src/plugins/router.ts:711-759`: wraps one dynamic import() instead of hooking a vue-router error handler; also recognises the Firefox and Safari wordings; storage and reload are injectable; the flag is cleared after any successful import; no URL or hash handling.
<!-- /DERIVED-FILES -->

Not copied: the Music Assistant name, logo, icons, `src/assets`, fonts or the `shared-icons` set. Thresholds and numbers (for example a 600 ms long press or a 10 px swipe slop) are ideas, not code, and carry no notice.

## Development-only assets (the dev harness; none of this is shipped in `dist/` or needed by a consumer)

- `dev/fonts/Roboto-*.woff2`: Roboto, SIL Open Font License 1.1 (licence text beside the files). Home Assistant's own UI font, so the harness looks like Home Assistant.
- `dev/mdi-subset.ts`: a subset of the Material Design Icons path data (Pictogrammers, version 7.4.47), Apache License 2.0. Stand-in for Home Assistant's `ha-icon` in the harness only.
- `dev/fixtures/ha-defaults.json`: Home Assistant's default theme variables, generated by `dev/tools/vendor-ha-defaults.mjs` from home-assistant/frontend (tag 20260826.7), Apache License 2.0.
- `dev/fixtures/themes.json`: two Home Assistant themes (Neumorphism, Frosted Glass) as served by `frontend/get_themes` on the author's installation; community themes, used only to emulate how they look.

## Home Assistant

The toolkit reads Home Assistant's CSS variables, events and element APIs at runtime (`hass-toggle-menu`, `hass-kiosk-mode`, `ha-adaptive-dialog`, `ha-icon`, `--primary-color` ...). No Home Assistant source is included.
