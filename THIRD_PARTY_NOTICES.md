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

Not copied: the Music Assistant name, logo, icons, `src/assets`, fonts or the `shared-icons` set. Thresholds and numbers (for example a 600 ms long press or a 10 px swipe slop) are ideas, not code, and carry no notice.

## Home Assistant

The toolkit reads Home Assistant's CSS variables, events and element APIs at runtime (`hass-toggle-menu`, `hass-kiosk-mode`, `ha-adaptive-dialog`, `ha-icon`, `--primary-color` ...). No Home Assistant source is included.
