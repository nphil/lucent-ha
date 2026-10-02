# Shell: `app-shell`, `nav`, `root`

The shell is the frame of a Home Assistant panel: a bar that stays at the top, the panel's destinations (Live, Wildlife, ...) shown the way
that fits the screen, and the toast host. `root` does the token and device-profile part for a card or any piece of UI that is not a whole panel.

Tags are `<prefix>-lu-app-shell`, `<prefix>-lu-nav` and `<prefix>-lu-root` (for example `kestrel-lu-app-shell`). Register them with
`defineElements("kestrel", [LuAppShell])`; the nav and the toast host come with the shell.

## `app-shell` (`LuAppShell`)

Home Assistant draws no header for a custom panel and lets the page itself scroll. So the shell draws a Home Assistant style app bar that is
`position: sticky`, never touches `html` or `body`, and never routes: when someone picks a destination it tells you (`lu-navigate`), you change the
URL and set `current`.

### Where the destinations go

The layout follows the panel's own width (not the window's, because Home Assistant's sidebar takes some of it) and the screen height:

| Screen | Layout | Looks like |
|---|---|---|
| panel width 900 or more | `tabs` | `[menu] Title [Live] [Wildlife] [Check-up] ...... [actions]`, all in one 56 px bar |
| 680 to 899 | `pills` | the bar, and under it a row of pills; both stay at the top together |
| under 680 | `bottom` | the bar, and a bar at the bottom of the screen (3 to 5 destinations; more is a mistake) |
| screen height 500 or less (a phone held sideways, a wall display), any width | `rail` | a 48 px bar, and a column of destinations at the left (72 px wide, 96 px when targets are 64 px) |

Fewer than two destinations: no navigation is drawn (a single tab is not navigation). The bottom bar and the rail never appear together.
Every destination shows its label, on every size. Switching layout moves nothing while you are reading: the chrome has its final size on the first frame.
A shell that is created before it has any width (inside an element that has not rendered yet) draws nothing until it has been measured, so a wrong layout never flashes. The chrome that does not scroll away stays well under 20 % of the screen height (bar and edge line: 13 % of a 390 px tall phone held sideways, 10 % of a 480 px tall wall display).

How it looks: the bar, the pills row, the rail and the bottom bar share one surface (Home Assistant's header colours over an opaque base, so it stays
readable over scrolling content in glass themes). The current destination has a wash, a short accent bar and `aria-current="page"`; the bar is a
shape, so "you are here" also reads without colour. A press shows a wash at once (nothing moves); keyboard focus is Lucent's landing bar.

### Properties

| Property | Attribute | Default | What it does |
|---|---|---|---|
| `hass` | - | none | Home Assistant's `hass`. The shell reads only `kioskMode`, `dockedSidebar`, `auth.external.config.hasSidebar`, `language` and `localize` from it, and renders again only when one of those changes (not on every state change in the house). |
| `narrow` | `narrow` | `false` | Home Assistant's `narrow`. It only decides whether the menu button shows; the layout follows the panel's own size. |
| `heading` | `heading` | `""` | The title in the bar. It is the page's `h1`; start your own views at `h2`. |
| `destinations` | - | `[]` | `LuDestination[]`, see below. |
| `current` | `current` | `""` | Id of the current destination. An id that matches none (a detail page) marks nothing as current. |
| `leading` | `leading` | `"auto"` | The button at the start of the bar. `auto`: Home Assistant's menu button when its sidebar is a drawer (narrow screen, or the user's "always hidden" setting), nothing otherwise. `menu`: always the menu button. `back`: a back arrow (sub-pages; it also answers Escape). `none`. |
| `wall` | `wall` | `false` | Wall mode, see below. |
| `wallKey` | `wall-key` | `""` | Set it in the markup and this device remembers wall mode under that key (read once when the shell connects; an explicit `wall` wins). Kept in `localStorage` as `<prefix>.lu.<key>`. |
| `contentMax` | `content-max` | `"grid"` | How wide content may grow: `grid` 1600 px, `text` 1100 px, `none`. Centred. |
| `scrollMode` | `scroll` | `"document"` | `document`: the page scrolls (the normal case). `contained`: the shell is `height: 100%` of its parent and scrolls inside itself (specimens, previews). In code the property is `scrollMode` because every element already has a method called `scroll`. |
| `navMode` | `nav-mode` | `"auto"` | `auto` follows the screen. `tabs`, `pills`, `bottom` or `rail` force one layout (design review, previews). |
| `navLabel` | `nav-label` | `"Sections"` | Names the navigation for screen readers (say "Camera sections"). |
| `shortcuts` | `shortcuts` | on | Digit shortcuts for destinations on screens with a mouse or trackpad. `shortcuts="false"` turns them off. |

`LuDestination`: `{ id, label, icon?, href?, badge?, shortcut? }`.
`icon` is `mdi:name` or raw SVG path data. With an `href` the destination is a real link (middle-click and "open in a new tab" work).
`badge` is a count (0 hides it, above 99 reads "99+") or a very short word. `shortcut` is one key that replaces the digit.

### Slots

| Slot | What goes there |
|---|---|
| `actions` | Buttons at the end of the bar. Use 48 px targets; on a phone two or three fit. |
| (default) | The panel's views. |
| `bottom` | A strip pinned above the bottom bar (a "now playing" bar). It stays at the bottom in every layout and gets the bar's opaque surface unless you style your own. |

### Events

| Event | Detail | When |
|---|---|---|
| `lu-navigate` | `{ id, href? }` | A destination was chosen (it is fired by the nav inside and crosses the shell). Not fired for the current one. You route, then set `current`. |
| `lu-back` | none | The back arrow was pressed, or Escape was pressed with `leading="back"` and nothing else (a dialog, a text field, a toolkit sheet) wants the key. |
| `lu-wall-change` | `{ wall }` | Wall mode switched on or off (also when it was restored from the device). |

### CSS variables and attributes the shell publishes

Set on the shell itself, so everything inside inherits them:

| Name | Meaning |
|---|---|
| `--lu-top-chrome` | Height of the sticky top block: the bar, its edge line and, in pills layout, the pills row. Use `top: var(--lu-top-chrome)` for headers that stick under it. |
| `--lu-bottom-bar` | Height of everything pinned to the bottom: the `bottom` strip, the bottom bar and the home-indicator padding. `0px` when nothing is pinned. Toasts and focus scrolling use it. |
| `--lu-rail-w` | Width of the left rail (including a landscape notch), `0px` when there is none. |
| `data-lu-profile` | `phone`, `tablet`, `desktop` or `smart`. The tokens switch type, targets and margins on it. |
| `data-lu-short` | The screen is 500 px or less tall. |
| `data-lu-touch` | The main input is a finger. |
| `data-lu-nav` | The layout in force: `tabs`, `pills`, `bottom` or `rail`. |

The sizes are measured with a ResizeObserver, so they are the real ones (rounded up to whole pixels). What the shell changes itself (a render, a layout
switch) is published at once; a later change the observer reports (the strip grew) is published one frame later.

### Scrolling, safe areas and the bars

- Default (`scroll="document"`): the bars are `position: sticky` in the page. The bottom bar is the last thing in the page, so it can never cover the end of
  the content, and focusing a control in a bar never scrolls the page. The shell expects Home Assistant's usual padding around a panel (the safe-area
  insets: do not register the panel with `handle_safe_area`). It cancels that padding so the bars reach the screen edges, and pads their contents by the
  safe areas itself (a notch at the top or the sides, the home indicator at the bottom).
- `scroll="contained"`: the shell has its own scroll area and exposes `luScroller` (see `src/core/scroller.ts`) so a view stack inside it saves and
  restores scroll there. The parent needs a height. In document mode `luScroller` is `undefined` and the page scrolls.

### Wall mode

`wall` is for a display on a wall (the Echo Show). While it is on, the shell asks Home Assistant to hide its own header and sidebar (kiosk mode), the panel gets
the full width, and the bar always has its own menu button, which opens Home Assistant's sidebar as a drawer. Turning it off, or removing the shell, gives Home Assistant's
chrome back. Nothing turns it on by itself: it is opt-in per panel and per device.

### Keyboard

On screens with a mouse or trackpad, the digits 1 to 9 (or a destination's own `shortcut`) jump to that destination, never while a text field,
dialog or popup has the key and never with Ctrl, Cmd, Alt or Shift. Each destination announces its key (`aria-keyshortcuts`), and shows a tooltip and a small
key cap while hovered or keyboard-focused. Listeners exist only while the shell is connected.

### Toasts

The shell hosts a toast (`showToast(element, { message })` from anywhere inside it). The toast sits above the bottom bar and the safe area.

### Limits

- The bottom bar is for 3 to 5 destinations. More are squeezed and their labels cut short.
- When the destinations do not fit a very short screen, the rail scrolls inside itself.
- A notch inset is applied to the physical left and right edge; it is not mirrored for right-to-left pages.

## `nav` (`LuNav`)

The destinations on their own, if you ever need them outside the shell.

| Property | Attribute | Default | What it does |
|---|---|---|---|
| `destinations` | - | `[]` | `LuDestination[]` |
| `current` | `current` | `""` | Id of the current destination |
| `mode` | `mode` | `"tabs"` | `tabs`, `pills`, `bottom` or `rail` |
| `label` | `label` | `"Sections"` | Names the `<nav>` landmark |
| `shortcuts` | `shortcuts` | off | Digit shortcuts, hints and `aria-keyshortcuts` (fine pointers only) |

Event `lu-navigate` with `{ id, href? }`. It renders `<nav aria-label>` with a list of links or buttons (not a tablist). A plain click on a link is taken over; a
click with Ctrl, Cmd, Shift, Alt or the middle button is left to the browser. It reads the bar colours and the `--lu-*` tokens of whatever root it sits in.

## `root` (`LuRoot`)

Declares the tokens, works out the device profile, gives its content instant press feedback and hosts a toast. No bar, no navigation.

| Property | Attribute | Default | What it does |
|---|---|---|---|
| `mode` | `mode` | `"card"` | `card`: sized by its own width only, no listeners on the window (many cards on one dashboard stay cheap). `panel`: also follows the window height and the input type. Set it in the markup. |

## Helpers

`resolveCurrent(destinations, id)` returns the destination with that id, or `undefined` (never the first one). `formatBadge(badge)` returns the text a badge shows, `""` when hidden.

## Example: a panel with three destinations

```ts
import { LitElement, html } from "lit";
import { LuAppShell, defineElements, navigate } from "lucent-ha";

defineElements("kestrel", [LuAppShell]);

const DESTINATIONS = [
  { id: "live", label: "Live", icon: "mdi:cctv", href: "/kestrel/live" },
  { id: "wildlife", label: "Wildlife", icon: "mdi:bird", href: "/kestrel/wildlife", badge: 3 },
  { id: "checkup", label: "Check-up", icon: "mdi:heart-pulse", href: "/kestrel/checkup" },
];

class KestrelPanel extends LitElement {
  static properties = { hass: { attribute: false }, narrow: { type: Boolean }, route: { attribute: false } };
  render() {
    const view = this.route.path.split("/")[1] || "live";
    return html`
      <kestrel-lu-app-shell .hass=${this.hass} ?narrow=${this.narrow} heading="Kestrel" nav-label="Camera sections"
          .destinations=${DESTINATIONS} current=${view} @lu-navigate=${(event) => navigate(this, event.detail.href)}>
        <a slot="actions" href="https://scrypted.local">Open in Scrypted</a>
        <div>The ${view} view goes here.</div>
      </kestrel-lu-app-shell>`;
  }
}
customElements.define("kestrel-panel", KestrelPanel);
```

## Notes for view authors

- Find the scroller with `findScroller(this)` when you first need it (not in `connectedCallback`: the shell renders its scroll area one tick after it connects).
- Sticky headers inside a view: `position: sticky; top: var(--lu-top-chrome); z-index: var(--lu-z-sticky)`.
- Leave the end of your content alone: the bars are in the page flow, nothing covers it.
