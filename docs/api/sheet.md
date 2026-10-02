# Sheet and toast: the one overlay for panels and cards

`<prefix>-lu-sheet` is the panel that slides in for a task that needs the user's full attention for a moment: pick a species, correct a visit, change a setting. `showToast(...)` is the small "Saved. Undo" message that appears at the bottom without taking focus or blocking anything.

Everything on this page is exported from the package root (`import { showToast } from "lucent-ha"`). Tags below use the harness prefix `spec`; use your own (`<kestrel-lu-sheet>`).

## The idea in plain words

- **It sits where the screen suggests.** A phone gets a bottom sheet with a handle; a wide or short screen (a laptop, a wall display, a phone held sideways) gets a pane against the right edge; in between it is a centred dialog. You do not choose, and the same markup works everywhere.
- **Everything behind it is switched off.** You cannot tap, tab to or scroll the page behind an open sheet (it is a native modal `<dialog>` in the browser's top layer). The mouse wheel, a finger and the keyboard never reach the page; if anything else moves it (dragging the page's own scrollbar, a script), the sheet puts it back. Because it is in the top layer, a glass theme's `backdrop-filter` on `ha-card` cannot trap or clip it, in a card or anywhere else. The sheet never writes a style on `html` or `body`.
- **Every way out works, and you are told which one was used.** Escape, a tap on the dimmed area, the close button (always there, 48 px), a swipe down (phones), the system Back button, or your own code. `lu-close` fires once, after it is gone, with the reason.
- **The Back button closes the sheet and nothing else.** Opening a sheet adds one history entry, so Back (browser, Android, a mouse's side button) closes the sheet first and only then leaves the page. Cards must not touch history, so they turn this off (`history = false`).
- **A phone never gets its keyboard thrown at it.** On open, focus goes to the sheet itself, not into a text field, so the on-screen keyboard stays down until the user taps a field. When it does come up, the sheet moves above it.
- **Focus goes back to what opened it**, so keyboard users land where they left off.

## Where it sits (the window decides, not the panel)

The dialog covers the whole screen, Home Assistant's sidebar included, so the placement follows the **window**:

| Window | Placement | Size |
|---|---|---|
| narrower than 680 px | bottom sheet, rounded on top, handle, swipe down closes | full width, up to 90 % of the height (94 % on a short screen) |
| 680 to 899 px wide and taller than 500 px (a tablet held upright) | centred dialog | up to 640 px wide, up to 90 % of the height |
| 900 px or wider, or 680 px and wider while 500 px high or less (laptop, desktop, Echo Show, phone held sideways) | side pane against the right edge | full height, `min(520px, 42vw)` wide |

Safe areas are respected (`--lu-safe-*`): a bottom sheet pads its bottom, a side pane its top, bottom and right edge.

## `<prefix>-lu-sheet`

| Property | Attribute | Default | What it does |
|---|---|---|---|
| `open` | `open` | `false` | Open or close it. Turns `false` the moment a close starts (by any route) and stays in step if you set it yourself. |
| `heading` | `heading` | `""` | The title. Also the dialog's accessible name. |
| `subheading` | `subheading` | `""` | A line under the title. |
| `closeLabel` | `close-label` | `"Close"` | Accessible name of the close button (translate it). |
| `layer` | `layer` | `"sheet"` | Id of the history entry it adds, for your own bookkeeping (`"species"`). |
| `history` | `history` | `true` | Add one history entry while open, so Back closes the sheet. **Set `false` in cards** (`.history=${false}` or `history="false"`). |
| `engine` | `engine` | `"auto"` | `auto`: Home Assistant's own `ha-adaptive-dialog` when the page has one, a native dialog otherwise. `native`: always the native dialog. `ha`: Home Assistant's, with a console warning and the native dialog when the page does not have it. |

**Methods** `show()` (same as `open = true`) and `close(reason?)` (default reason `"api"`; the exit motion plays, then `lu-close` fires).

**Slots**

| Slot | What goes there |
|---|---|
| (default) | The body. It scrolls on its own (the header and footer stay put) and does not hand its scrolling over to the page behind. |
| `footer` | Pinned at the bottom, for the sheet's buttons ("Cancel", "That's right"). Hidden while empty. |
| `actions` | Buttons at the end of the header, next to the close button (Share, Edit). |

**Event** `lu-close` (bubbles, composed), `detail: { reason }`, fired **after** the sheet has closed (the exit motion is over, focus is back with the opener):

| `reason` | Who closed it |
|---|---|
| `"escape"` | the Escape key |
| `"scrim"` | a press that started and ended on the dimmed area |
| `"swipe"` | a swipe down (bottom sheet) |
| `"button"` | the close button |
| `"back"` | the system Back (or Forward) button |
| `"api"` | your code (`close()`, `open = false`), a page navigation that Home Assistant made, or anything not listed |

A close happens **once** per opening, whichever route gets there first. Opening it again while it is leaving waits for the exit and then opens it.

**CSS.** The sheet reads the toolkit tokens (`--lu-sheet`, `--lu-scrim`, `--lu-edge`, `--lu-radius-sheet`, `--lu-sheet-max`, `--lu-safe-*`, `--lu-space-*`, `--lu-motion-layer`, `--lu-travel-layer` ...) and declares none. The one variable it sets is `--lu-keyboard-inset` on its own dialog (the height the on-screen keyboard covers); do not set it. The surface is `--lu-sheet`: Home Assistant's own dialog colour, so it stays readable in glass themes where `--lu-card` is see-through. Where the theme blurs its dialogs (Frosted Glass sets `--ha-dialog-surface-backdrop-filter`) the panel looks the same as Home Assistant's own dialogs; flat themes have no blur.

**How the dim and the glass are drawn.** A `backdrop-filter` is redone over its whole area every time anything inside it changes, and on a browser without a GPU (the headless test browser, a weak device) that is CPU work: with Home Assistant's `brightness(68%)` scrim (`--ha-dialog-scrim-backdrop-filter`) over the whole screen, one press on a button inside the sheet cost 10 to 50 ms more than the same press on the page (28 to 48 ms in the display compositor alone on a 1920 px screen). So where the same picture can be had without a filter, the sheet draws it without one: a scrim filter that only darkens (`brightness(x)`, x at most 1) becomes a black layer of its own, a sibling in front of the page and behind the scrim, of opacity `1 - x` and with the scrim's motion; and a panel blur that sits over a scrim that has a filter of its own never saw the page (in Chromium an element with a backdrop filter is the root of the backdrop of everything inside it, so that blur only ever saw the scrim's flat colour), so the panel paints that colour under itself instead of blurring it. That second swap is made only in Chromium-based browsers (Chrome, Edge, Android's WebView, Silk), where the rule was checked pixel by pixel; Safari, Firefox and every browser on iOS keep the panel's blur, because there it may well show the page. The picture is the same to within 8-bit rounding (largest difference 1/255 in flat light, 2/255 at rest and 4/255 on a few pixels in mid-fade in glass dark). Every other combination (a scrim that blurs, a panel blur over a scrim without a filter) is drawn with the filters, as the theme says. The decision is taken at every opening and again when the theme changes while the sheet is open (`dialogLook` in `sheet-model.ts`).

**Every opening starts at the top**, even if the sheet was closed while scrolled down.

**Marking content.** An element with `data-no-sheet-drag` never lets a swipe that starts inside it move the sheet. Sliders (`<prefix>-lu-slider`, `input[type=range]`, Home Assistant's slider elements, maps), text fields, selects and anything scrolled down are protected already.

### How focus and the keyboard behave

- **Open:** focus goes to the sheet itself (the dialog has a name and is announced), never into a text field on a touch screen, and never onto a button that Space or Enter would press by accident. With a mouse and keyboard, an element in the content that has the `autofocus` attribute is focused, like Home Assistant's own dialogs do. (Browsers focus the first `autofocus` element or the first control when a dialog opens; on a touch screen the sheet lifts the attribute for that moment and puts it back, so your markup keeps `autofocus` and still no keyboard pops up.)
- **While open:** the page behind cannot take focus, scroll (wheel, touch, keyboard) or be tapped. Tab and Shift+Tab move only through the sheet's own controls: Shift+Tab wraps from the first control to the last, and Tab past the last control leaves the document for the browser's own controls (where there are none, as in a wall display's browser, it lands on nothing) and the next Tab comes back to the first control. That is how a native modal dialog behaves. Home Assistant's own dialog also lets Tab out past its last control (checked on the real Home Assistant 2026.9; it steps out on Shift+Tab as well, where the native one wraps): in neither does focus reach the page behind.
- **Scroll keys** (arrows, Page Up/Down, Home, End, Space and Shift+Space) scroll the sheet's body, also when focus is on the sheet itself or a header button, and never the page behind. Fields, sliders and menus keep their own keys, and Space still presses a focused button.
- **Close:** focus returns to the element that had it when the sheet opened.
- **On-screen keyboard:** while open, the sheet follows the visual viewport (`visualViewport`), keeps its bottom edge above the keyboard and scrolls the focused field into view. A pinch-zoomed page is not mistaken for a keyboard.
- **Reduced motion:** no travel, only a fade of at most 120 ms.

### Swipe down (bottom sheet only)

A finger can drag the handle or the header band (24 px or more dismisses), or swipe down from anywhere in the sheet that is not scrolled, not a slider or text field and not marked `data-no-sheet-drag` (72 px or more dismisses; the gesture must start clearly downward, 10 px, and is handed back to the page if it starts sideways or upward). The sheet follows the finger and fades to half; a short drag springs back; a swipe carries on downward from where the finger let go. A click that arrives within 400 ms of a swipe is swallowed, so lifting the finger over a button does not press it. A mouse can drag only the handle. The close button is always there: a swipe is never the only way.

### Nested sheets

A sheet inside a sheet (put it in the outer sheet's content) opens on top; Back, Escape and its close button close the top one first. Closing the lower sheet by code or button also closes the ones above it (they report `"api"`). `lu-close` bubbles: stop it (`event.stopPropagation()`) in the inner sheet's handler if the outer one should not hear it.

### In a card

```html
<spec-lu-sheet heading="Species" .history=${false}> ... </spec-lu-sheet>
```

`history = false` is the only thing a card has to do: the sheet then never touches history. At rest it has no window listeners at all; only while it is open does it listen to the visual viewport (the on-screen keyboard) and to the page's scroll (to keep the page where it was), and it lets go when it closes. A card's glass `backdrop-filter` cannot trap it, because it lives in the top layer. Back does not close a card's sheet; the close button, Escape, the scrim and a swipe do.

### Home Assistant's own dialog (`engine`)

With `engine="auto"` (the default) a page that has `ha-adaptive-dialog` (Home Assistant 2026.9 and later) gets Home Assistant's dialog: it chooses bottom sheet or dialog with its own rule (`max-width: 870px` or `max-height: 500px`), does its own swipe, Escape and scrim, and the sheet maps its `closed` event to `lu-close`. We render `heading` and `subheading` into its header, `actions` into its header action slot, and `footer` into its footer. Home Assistant does not say how its dialog was closed, so the reason is worked out on the way in: Escape is `"escape"`, its close button is `"button"`, anything else (its scrim, its own swipe) is `"scrim"`. History, focus return, `lu-close`, toasts and the card rule work the same as in the native engine. `data-no-sheet-drag` and the toolkit's swipe are not used there (Home Assistant has its own).

**What `auto` costs, measured on the real Home Assistant 2026.9** (Kestrel on the real panel, host load 12 to 14, tap to the first frame with the sheet on screen, median of 7 openings, same content in both engines): at 4x CPU slowdown a species sheet took **259 ms** with Home Assistant's dialog and **145 ms** with `engine="native"` on a 390 px phone, **329 ms** against **158 ms** at 960 x 480; the small picker sheet 138 against 58 ms and 153 against 65 ms; at 1x on a 1920 px desktop 66 against 34 ms. A trace shows where the time goes: Home Assistant's dialog makes the browser recalculate the styles of the whole document twice per opening (`showModal`, then its scroll-lock class on `<html>`: 700 to 1,000 elements, about 115 + 93 ms at 4x in Kestrel) and builds a fresh dialog each time (about 25 ms). So `auto` is roughly 80 to 170 ms slower to open at 4x. It stays the default, because it gives the page Home Assistant's own look and behaviour; an app that cares about opening speed, or wants one look on every Home Assistant version, sets `engine="native"` (Kestrel does, on all its sheets).

## Toasts

`showToast(from, options)` tells the user something small from anywhere in the page. It fires a bubbling `lu-toast` event from `from`; the nearest toolkit root or app shell shows it (a sheet that is open around `from` shows it itself, see below). It returns a handle to close that toast early. If the page has no toast host nothing is shown, nothing throws, and the console says so once.

```ts
import { showToast } from "lucent-ha";
const handle = showToast(this, { message: "Corrected to robin", actionLabel: "Undo", onAction: () => this.undo() });
// later, if the user went on: handle.dismiss();
```

`ToastOptions`:

| Field | Default | What it does |
|---|---|---|
| `message` | (required) | The text. An empty message is ignored. |
| `kind` | `"info"` | `"info"` (text), `"success"` (check mark), `"error"` (alert mark, stays 8 s). The mark is an icon, never colour alone. |
| `actionLabel` + `onAction` | none | Both together make a button (Undo, Retry). Pressing it closes the toast, then runs `onAction` once. Without both there is no button. |
| `durationMs` | 4000 (error 8000) | Time on screen. `0` (or `Infinity`) = until dismissed. A toast with an action stays **at least 5000** whatever you ask for. |
| `id` | a fresh one | A toast with the id of the one on screen replaces it (its time starts again); with the id of a waiting one it replaces that one in its place. Use it for "Saving..." then "Saved". |

`ToastHandle`: `{ id, dismiss() }`.

**Rules the host keeps**

- **One at a time, in order.** Others wait; they never stack.
- **No focus theft, polite announcement.** A live region that is always in the page announces the message.
- **The clock stops while the user is reading it**: the pointer is over the toast, focus is inside it, or the tab is hidden. It resumes with the time that was left, not from the start.
- **Position:** bottom centre, above the shell's bottom bar and the safe area (`--lu-bottom-bar`, `--lu-safe-bottom`), in the top layer, so no theme effect on a parent can clip it. It travels 8 px and fades; with reduced motion only a fade.
- **A toast raised inside an open sheet** is shown by the sheet itself (everything outside a modal dialog is switched off, so an Undo button there could not be pressed). If it is still showing when the sheet closes, it moves to the page's host and keeps its Undo.
- **Timers are safe.** A late timer never closes a newer toast; Undo runs once even if pressed twice.

### `<prefix>-lu-toast`

The host element. `lu-root` and `lu-app-shell` contain one and listen for `lu-toast` already; you only need your own in a page that uses neither.

| Member | What it does |
|---|---|
| `show(options): ToastHandle` | Show a toast now or queue it. |
| `dismiss(id?)` | Close the toast with that id (shown or waiting); without an id, the one on screen. |
| `takeAll(): ToastOptions[]` | Take every unfinished toast out (shown first), to show them somewhere else. |
| `dismissLabel` (attribute `dismiss-label`, default `"Dismiss"`) | Accessible name of the dismiss button (translate it). |

## Pieces for apps with their own overlays

`SwipeDismiss` (a Lit controller: `new SwipeDismiss(host, { panel, enabled, onDismiss })`), the pure `SwipeModel`, `classifyStart` and `followOpacity`, and the pure `ToastQueue` (with a clock you supply) are exported too. They are what the sheet and the toast are built from; most apps never need them.

## Recipe: a correction sheet with a search field (about 20 lines)

```ts
import { LitElement, html } from "lit";
import { defineLucent, showToast } from "lucent-ha";

defineLucent({ prefix: "kestrel" });

class CorrectVisit extends LitElement {
  static properties = { open: { type: Boolean }, species: { state: true } };
  constructor() { super(); this.open = false; this.species = ["Robin", "Blue tit", "Wren"]; }
  render() {
    return html`
      <kestrel-lu-button kind="primary" @click=${() => (this.open = true)}>Wrong?</kestrel-lu-button>
      <kestrel-lu-sheet .open=${this.open} heading="What was it?" subheading="Pick the species" layer="correct"
          @lu-close=${() => (this.open = false)}>
        <input type="search" autofocus placeholder="Search" aria-label="Search species" />
        ${this.species.map((name) => html`<kestrel-lu-row heading=${name} interactive @click=${() => this.pick(name)}></kestrel-lu-row>`)}
        <kestrel-lu-button slot="footer" kind="secondary" @click=${(e) => e.target.closest("kestrel-lu-sheet").close("button")}>Cancel</kestrel-lu-button>
      </kestrel-lu-sheet>`;
  }
  pick(name) {
    this.open = false;
    showToast(this, { message: `Corrected to ${name}`, kind: "success", actionLabel: "Undo", onAction: () => this.undo(name) });
  }
  undo(name) { /* put the old species back */ }
}
customElements.define("correct-visit", CorrectVisit);
```

Keep `open` in step with `lu-close`, as above: the sheet closes itself for Escape, scrim, swipe and Back, and tells you.

## Limits and what was verified against what

**Checked in a real browser** (the dev harness: headless Chrome 153 driven over the DevTools protocol, one tab; touch emulation with real finger events for phone 390x844, phone held sideways 844x390, Echo Show 960x480 and tablet 820x1180, a mouse for desktop 1280x800; flat and glass themes, light and dark, switched live with the sheet open):

- Placement: bottom sheet, centred dialog, side pane at the sizes in the table above; surfaces, borders, handle, header action, footer and close button look right in all four themes.
- All six ways out report the right reason, `open` flips at once, the exit finishes, focus returns to the opener (also when opened from the keyboard) and the history entry is gone again. A press that starts on the sheet never closes it.
- The page behind: not focusable (Tab never reaches it), not scrollable by wheel, finger (scrim, header, body, body at its end, sideways swipes), or scroll keys; a scroll made by a script is put back; scrolling works again right after the sheet closed.
- Touch: no text field is focused on open (search-field sheet), `autofocus` is still on the element afterwards; with a mouse the field is focused. Swipe down from the handle, the header or the body closes; a short drag springs back; a swipe starting in a text field or a scrolled body does not close it; sideways swipes do nothing (no browser history navigation).
- On-screen keyboard: simulated with a fake `visualViewport` (a 300 px keyboard): the sheet's bottom edge sits at the keyboard's top edge, the focused field and the first candidate rows are visible, and it drops back when the keyboard goes away.
- History: one entry per sheet; Back closes only the top sheet (the one below stays open); closing the lowest of three sheets fires exactly one `popstate` and all three report; a sheet opened and closed leaves no entry behind.
- Toast: queue order, Undo runs once, error and Retry, pause while the pointer is over it (it survived 5.5 s over a 4 s toast and went 3.7 s after the pointer left), the toast raised inside a sheet is clickable and moves to the page when the sheet closes, it sits above the shell's bottom bar (57 px bar: 73 px from the screen edge) and at 16 px without one.
- With the dev harness's `ha-adaptive-dialog` stand-in: all six routes, header action, footer, quick reopen, focus return.

**Checked on a real Home Assistant (2026.9), with Kestrel's panel** (`dev/smoke/real-matrix.mjs` in the Kestrel repository, 390x844 phone, 960x480 Echo Show and 1920x1080 desktop, flat light and Caule Black Blue Glass dark). With `engine="native"` (Kestrel 1.1.1; 350 checks passed, none failed, 82 skipped because they do not apply to that cell, such as the swipe on a side pane): Back closes only the sheet, Escape, a scrim press that began and ended on the scrim (and only that); focus goes into the sheet and back to the opener after Escape, the close button, Back and the scrim; Tab and Shift+Tab never reach the page behind; the page lock (wheel, scroll keys and a finger on the scrim and the header never move the page, the body scrolls, the page's scroll offset is the same after closing); safe-area insets (Chrome's override: +34 px bottom, +18 / +22 px sides, +30 px top are respected by footer, body and side pane); geometry per size (phone: bottom sheet with a handle and a working swipe down; Echo Show and desktop: side pane; close button 48 to 64 px); the theme switched live with the sheet open, four ways; and, after the 0.1.1 change, the dim (the scrim's pixels equal `brightness(0.68)` over the page, at most 1/255 away from the old filter) and the enter and leave fades (8 to 9 in-between frames, the dim in step with the scrim). With Home Assistant's own dialog (`engine="auto"`, Kestrel 1.1.0 on the same panel): open, Back, Escape, a scrim press, the picker's own history entry and a theme switch with the sheet open (10 cells, no failure), and Tab, which leaves the document past the last control and comes back like the native sheet does (on Shift+Tab it steps out once, where the native sheet wraps). The dev harness's `ha-adaptive-dialog` stand-in is still what the toolkit's own tests run against: it is written from Home Assistant's source (properties, slots, `opened`/`closed`, the `(max-width: 870px), (max-height: 500px)` rule), while the real element wraps webawesome's `wa-dialog`/`wa-drawer` and has its own swipe, focus and animation. What the sheet assumes about it: it closes itself on Escape, scrim and its close button and then fires `closed`; it reports how it was closed in no other way (the sheet works that out from the key and click on the way in); an element with `data-dialog="close"` closes it.

**Not verifiable here:** a real on-screen keyboard and real phones (iOS Safari handles `touch-action`, `overscroll-behavior` and `dvh` its own way; this was only run in Chrome, so the panel-blur swap above is made only in Chromium-based browsers), the physical Back button of Android, dragging the page's own scrollbar (a scripted scroll was used), and the Home Assistant Companion app. Speed is measured by `dev/perf-check.mjs` at the host's normal load ([perf.md](../perf.md)), not here by hand: on Kestrel's real panel the first frame of a species sheet came within 145 ms on a 390 px phone and 158 ms at 960 x 480 (both at 4x CPU slowdown), and 34 ms at 1920 px (1x), median of 7 openings at load 12 to 14; Back reached the sheet within 23 to 41 ms (budgets: 220 ms and 100 ms).

**Known limits**

- Two sheets always sit at the same spot: the one below is hidden behind the one above when the upper one is larger.
- A toast raised from the page (not from inside the sheet) while a sheet is open shows over the dimmed page but cannot be pressed until the sheet closes. Toasts with an action come from what the user just did, so they are raised inside the sheet or after it closed.
- After a reload with a sheet open, the sheet is gone but its history entry stays. The layer manager steps over such an entry as soon as it exists, and the app shell makes it exist when it connects, so inside the shell one Back leaves the panel (`docs/api/shell.md`, "Back and sheets"). A page without the shell (a bare `lu-root mode="panel"`) must call `layerDepth()` once at start-up; without it, one Back lands on the same address and a second one leaves. Cards are not affected: they never open history entries.
- A theme whose scrim blurs the page, or whose panel blur sits over a scrim with no filter of its own, still gets real `backdrop-filter`s: they cost what they cost on Home Assistant's own dialogs (without a GPU, a press inside the sheet redoes the filtered area). Home Assistant's own `brightness(68%)` scrim and the usual glass panel over it are not affected (see "How the dim and the glass are drawn").

### Where `showToast` finds a host

`showToast(from, options)` sends the `lu-toast` event up from `from`; the nearest app shell, root or open sheet around `from` shows the toast and marks the event handled. Events only travel up, so a caller that **contains** the shell (a panel's own methods calling `showToast(this, ...)`) is not under any host: in that case the toast is shown by the nearest toast host *inside* the caller (the shell's). If there is no host at all nothing is shown and one console warning says so.

