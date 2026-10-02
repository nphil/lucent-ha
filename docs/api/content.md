# Content: grid, states, section, row

Four small elements for the body of a panel or card. `lu-grid` lays out tiles by the room its container gives it; `lu-state` shows the honest "loading / empty / error / stale" versions of a list; `lu-section` is a titled group that uses `lu-state` for you; `lu-row` is a list row. Tags are `<prefix>-lu-grid`, `<prefix>-lu-state`, `<prefix>-lu-section`, `<prefix>-lu-row` (the examples use the prefix `app`).

Register what you use with `defineElements("app", [LuSection, LuGrid, LuRow])`; `LuSection` brings `LuState`, and `LuState` brings `LuGrid`. Colours, sizes and spacing all come from the `--lu-*` tokens of the surrounding root, so the elements follow the Home Assistant theme live.

## `lu-grid`

As many columns as fit, by the width of the grid's **container** (never the window, so a docked Home Assistant sidebar is already accounted for). Tiles are never wider than `--lu-tile-max` (560 px) and never narrower than the kind's minimum; the whole grid is at most `--lu-content-max` (1600 px) wide and centred. Put it inside a block-level parent.

| Attribute | Values | Meaning |
|---|---|---|
| `kind` | `camera` (default minimum 360 px), `species` (176 px, two columns always fit), `visit` (280 px), `custom` (default) | Smallest tile width, from `--lu-tile-min-camera` / `-species` / `-visit` / `--lu-tile-min` |
| `min` | number (px) | Overrides the kind's minimum |
| `lazy` | boolean | `content-visibility: auto`: a long grid far off screen costs nothing until you scroll near it |

Slot: tiles (any elements). Gap is `--lu-gutter`. Tiles get `width: 100%` and `max-width: var(--lu-tile-max)`; a rule of your own on a tile wins.

Typical columns (gap 24, content max 1600): cameras 1 / 2 / 3 / 4 at 390 / 960 / 1280 / 1664 px of container; species 2 / 4 / 6 / 8; visits 1 / 2 / 4 / 5. The pure functions `tileColumns(containerWidth, min, gap, {minColumns, contentMax})`, `tileWidth(...)` and `gridWidth(...)` (exported from `lucent-ha`) mirror the CSS rule, for tests.

CSS variables read: `--lu-tile-min`, `--lu-tile-min-camera`, `--lu-tile-min-species`, `--lu-tile-min-visit`, `--lu-tile-max`, `--lu-content-max`, `--lu-gutter`.

## `lu-state`

| Attribute | Meaning |
|---|---|
| `kind` | `loading`, `empty` (default), `error`, `stale` |
| `variant` | Loading shape: `rows` (default; row-high bars with an icon and two lines), `thumbs` (16:10 rail tiles), `tiles` (a real `lu-grid` of picture-plus-two-lines tiles), `text` (lines) |
| `count` | How many placeholders (0 = a sensible default: rows 3, thumbs 4, tiles 6, text 3) |
| `tile`, `ratio` | For `variant="tiles"`: the grid kind (`camera`, `species`, `visit`, `custom`) and the picture shape (`"16/9"`, default `"4/3"`) so the skeleton has the real tile's size |
| `heading`, `message` | The text. Loading: `heading` is the hidden label for screen readers ("Loading visits"; empty = "Loading") |
| `icon` | `mdi:name` or SVG path data. Sensible default per kind |
| `since` | Stale only: when the shown data was fresh, ms since epoch. Shows "Showing data from 12 min ago" and refreshes slowly, only while visible |
| `retry-label` | Error button text (default "Retry") |
| `compact` | Empty/error as one line instead of a centred block |

Slots: default (last-good content, shown for `error` and `stale`), `action` (the next step for `empty`, an extra button for `error`). Event: `lu-retry` (bubbles, composed) when the Retry button is pressed.

The loading skeleton is static: no pulse, no shimmer, no animation. Show it only while there is no data yet. An error never replaces data: with content in the default slot, the content stays and a one-line "couldn't refresh" strip with Retry follows it. Say *why* a list is empty in `message`, and give a useful `action`.

`formatAgo(then, now?, locale?)` (exported) gives the text: "just now" (under a minute, and for times in the future), "12 min ago", "3 h ago", "yesterday", then a date ("Oct 3", with the year when it is not this year).

## `lu-section`

Kestrel's `kestrel-section` API, renamed. A titled group (`<h3>`) with an `actions` slot in its header and a body that picks the right state for you.

| Attribute | Meaning |
|---|---|
| `icon`, `heading`, `summary` | Header: icon, title, quiet "· 3 online" after it |
| `state` | `ready` (default), `loading`, `error` |
| `count` | How many items the slotted content holds. With none, the slot is hidden and `state` decides: loading skeleton, "Couldn't load {noun}." + Try again, or the `empty` text. With some, an `error` keeps the content and adds "Couldn't load more." + Try again |
| `empty` | Text for an empty section (default "Nothing here yet") |
| `noun` | Completes the messages ("items") |
| `variant` | Loading shape: `rows` or `thumbs` |

Slots: default, `actions`. Event: `lu-retry`. Consecutive sections are separated by a hairline; the first one has none. A section is one group: do not put a card inside it.

## `lu-row`

An icon, a heading, an optional detail line, a `trailing` slot and an optional chevron, at least `--lu-row` high. It renders **one** interactive element: a link if `href` is set, a button if `interactive` or `selected` is set, otherwise plain text. The whole row is the hit area; a plain value or chip in `trailing` passes the tap on, while real controls in `trailing` (button, link, input, anything with `tabindex` or `role`, or `data-row-control`) stay separately clickable.

| Attribute | Meaning |
|---|---|
| `icon`, `heading`, `detail` | Content. Long text is cut with an ellipsis |
| `href` | Makes the row a link. Listen for `click` and call `preventDefault()` to route inside Home Assistant |
| `interactive` | Makes the row a button (listen for `click`) |
| `selected` | Wash plus an accent mark at the start edge, and `aria-current="true"` |
| `disabled` | Action off, icon dimmed; heading and the reason in `detail` stay readable |
| `chevron` | Shows a drill-in chevron after the trailing slot |

Slots: `trailing` (value, chip, switch), `leading` (a thumbnail or avatar, for example 56 px; replaces `icon` while it has content). Stack rows directly, with no gap.

## Example: a grid inside a section inside the shell

```ts
import { defineElements, LuAppShell, LuSection, LuGrid, LuRow, LuState } from "lucent-ha";

defineElements("app", [LuAppShell, LuSection, LuGrid, LuRow, LuState]);

render(html`
  <app-lu-app-shell heading="Wildlife">
    <app-lu-section icon="mdi:paw-outline" heading="Species" .summary=${`${species.length} seen`}
        .state=${loading ? "loading" : failed ? "error" : "ready"} .count=${species.length}
        noun="species" empty="No wildlife visits yet" variant="rows" @lu-retry=${reload}>
      <app-lu-grid kind="species">
        ${species.map((s) => html`<my-species-tile .species=${s}></my-species-tile>`)}
      </app-lu-grid>
    </app-lu-section>
    <app-lu-section heading="Recent visits" state="ready" .count=${visits.length} noun="visits">
      ${visits.map((v) => html`<app-lu-row icon="mdi:bird" .heading=${v.name} .detail=${v.when} interactive chevron
          @click=${() => open(v)}></app-lu-row>`)}
    </app-lu-section>
  </app-lu-app-shell>`, document.body);
```
