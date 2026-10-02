# Controls: button, chip, segmented, stepper, slider, hold-button

Six small controls for everything a user presses, chooses or adjusts. All of them are 48px targets (64px on smart displays), follow the Home Assistant theme live (flat and glass), show press feedback within one frame, have a visible keyboard focus, and honour reduced motion. Tags are `<prefix>-lu-button`, `-chip`, `-segmented`, `-stepper`, `-slider`, `-hold-button` (the examples use the prefix `app`).

Register what you use with `defineElements("app", [LuButton, LuChip, LuSegmented, LuStepper, LuSlider, LuHoldButton])`; `LuHoldButton` brings `LuButton` with it. Sizes, colours and spacing come from the `--lu-*` tokens of the surrounding root (`lu-root`, `lu-app-shell`); the controls declare none of their own. The controls use only these properties: `--lu-target`, `--lu-row`, the `--lu-material-*` washes, `--lu-glass-raised`, `--lu-edge*`, `--lu-accent*`, `--lu-ink*`, `--lu-danger/warning/positive/info/live`, `--lu-reading`, `--lu-canvas`, `--lu-focus-*`, `--lu-motion-*`, `--lu-radius-*`, `--lu-space-*`, `--lu-type-*`.

Changing a value: `value` (segmented, stepper, slider) follows what the user picks, and the event reports it. To set it yourself (for example to undo a rejected change), assign `element.value = x`.

## `lu-button`

One element for every button look. It draws a real `<button>` (or a link) inside, so keyboard and screen readers behave natively. Listen for the normal `click` event.

| Attribute | Values | Meaning |
|---|---|---|
| `kind` | `primary`, `secondary` (default), `danger`, `quiet` | `primary` is the one main action of a task. `danger` is destructive. `quiet` is a plain text button (a plain round icon with `icon-only`) |
| `label` | text | The button text. The default slot works too. With `icon-only` it is the **required** accessible name |
| `icon` | `mdi:name` or SVG path data | Leading icon |
| `icon-only` | boolean | Round 48px button with only the icon |
| `loading` | boolean | Spinner in place of the icon, width unchanged, `aria-busy`, clicks are ignored |
| `disabled` | boolean | Not clickable, readable |
| `href`, `target` | text | Renders a link instead (`rel="noopener noreferrer"` is added for `_blank`) |
| `type` | `button` (default), `submit`, `reset` | What a click does to an enclosing `<form>` |

`element.click()` behaves like a click on the button and respects `disabled` / `loading`. To stretch a button, give the host `display: flex`.

```html
<app-lu-button kind="primary" icon="mdi:content-save" label="Save"></app-lu-button>
<app-lu-button kind="secondary" label="Cancel"></app-lu-button>
<app-lu-button kind="danger" icon="mdi:delete" label="Delete"></app-lu-button>
<app-lu-button kind="quiet" icon-only icon="mdi:dots-vertical" label="More"></app-lu-button>
```

## `lu-chip`

A small label. By default a passive badge: not focusable, not a control.

| Attribute | Values | Meaning |
|---|---|---|
| `kind` | `neutral` (default), `positive`, `warning`, `danger`, `info`, `live`, `evidence` | Every kind except `neutral` and `evidence` carries an icon, so the meaning never rests on colour |
| `label` | text | The text (or use the default slot). For `evidence` it is only the accessible name |
| `icon` | `mdi:name` or SVG path | Overrides the kind's icon |
| `count` | number | A number after the text; for `evidence` the number beside the icon |
| `overlay` | boolean | The chip sits on a photo or video: strong reading surface |
| `interactive` | boolean | A real 48px button (filter chip / chip-button) |
| `selected` | boolean | Interactive only: chosen (`aria-pressed`, a check mark) |
| `disabled` | boolean | Interactive only |

Slots: default (text), `detail` (interactive only: a quiet second line). Passive chips are at least 28px high (twice the caption size) and truncate long text with an ellipsis; the full text stays in the page for screen readers. An interactive chip is a toggle button: listen for `click` and flip `selected` yourself.

```html
<app-lu-chip kind="positive" label="Online"></app-lu-chip>
<!-- evidence badges over a photo -->
<app-lu-chip kind="evidence" overlay icon="mdi:microphone" label="Audio recorded"></app-lu-chip>
<app-lu-chip kind="evidence" overlay icon="mdi:image-multiple" label="Photos" count="5"></app-lu-chip>
<!-- filter chip -->
<app-lu-chip interactive selected icon="mdi:bird" label="Birds" count="96"></app-lu-chip>
<app-lu-chip interactive icon="mdi:cctv"><span>Garden camera</span><span slot="detail">Seen 3 min ago</span></app-lu-chip>
```

## `lu-segmented`

An exclusive choice between **2 and 5** options in a recessed tray. The chosen option is raised and has a small accent mark; keyboard focus is a separate light. One tab stop; the arrow keys, Home and End change the choice (as in a native radio group).

| Property | Meaning |
|---|---|
| `options` | `{ value, label, icon?, count? }[]` (a property, not an attribute) |
| `value` | The chosen option's value. Follows the user's choice |
| `label` | Names the group for screen readers |
| `disabled` | boolean |

Event: `lu-change` with `detail: { value }` (a string). With **more than 3 options and a container narrower than 360px** the same choice is shown as a native `<select>` instead of squeezed labels (same event). The element takes the width of its row (up to 480px, override with `max-width`); it does not shrink to its content, so put it in a block, grid or full-width flex item. Its height is reserved before the options arrive (taller when options have counts or icons), so nothing below it shifts.

```html
<app-lu-segmented id="range" label="Time range" value="week"></app-lu-segmented>
<script>
  const range = document.getElementById("range");
  range.options = [{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month", count: 3 }];
  range.addEventListener("lu-change", (e) => load(e.detail.value));
</script>
```

## `lu-stepper`

A number with minus and plus buttons. Press and hold a button to repeat (after 0.4 s, then ten steps a second). On the value: Up/Right and Down/Left step, PageUp/PageDown move ten steps, Home and End go to the ends. Values stay on the grid `min + n x step`, so 0.1 steps show no rounding noise. Screen readers get a spin button (`aria-valuenow`, `-min`, `-max`, `-valuetext`).

| Attribute | Default | Meaning |
|---|---|---|
| `value`, `min`, `max`, `step` | 0, 0, 100, 1 | The number and its range. `step` shown with as many decimals as it (or `min`) has |
| `label` | | Shown left, names the control |
| `unit` | | Shown after the number (`%` and `°` sit against it, other units after a space) |
| `error` | | A message under the control, with an icon (never colour alone) |
| `disabled` | | |
| `decrease-label`, `increase-label` | "Decrease", "Increase" | Start of the buttons' accessible names (translate them) |

Event: `lu-change` with `detail: { value }` (a number), on **every** step including repeats. If each change calls a device, debounce on your side.

```html
<app-lu-stepper label="Clip length" unit="s" value="10" min="1" max="60" step="1"></app-lu-stepper>
<app-lu-stepper label="Threshold" value="0.3" min="0" max="1" step="0.1" error="Too many false alarms below 0.2."></app-lu-stepper>
```

## `lu-slider`

A native range input underneath (keyboard, screen readers and touch behave as the platform does), a 6px recessed track with a filled part, an isolated thumb, and a full 48px (64px on smart displays) hit area. A vertical swipe that starts on it still scrolls the page. In a container 480px or wider the label, track and value share one row; narrower, the label and value sit above the track.

| Attribute | Default | Meaning |
|---|---|---|
| `value`, `min`, `max`, `step` | 0, 0, 100, 1 | |
| `label` | | Names the control |
| `unit` | | Shown after the value |
| `disabled` | | |

Events: `lu-input` `{ value }` while dragging (at most ten a second; the final value is **always** sent) and `lu-change` `{ value }` once when the choice is committed (finger lifted, or each key press). While the thumb is held, a `value` you set from outside (a late state echo) is ignored, so the thumb never jumps from under the finger; after release the chosen value stands until you set `value` again.

```html
<app-lu-slider id="vol" label="Volume" unit="%" value="40"></app-lu-slider>
<script>
  const vol = document.getElementById("vol");
  vol.addEventListener("lu-input", (e) => preview(e.detail.value));   // live, throttled
  vol.addEventListener("lu-change", (e) => save(e.detail.value));     // committed
</script>
```

## `lu-hold-button`

Hold to confirm an action that is hard to undo. Press and hold for 1.5 s: a fill sweeps across the button and the label says "Holding…". Let go early and the fill drains back; nothing happens. Completing the hold fires **one** `lu-confirm`.

The hold is a shortcut, never the only way. A quick tap (under 350 ms), Enter, Space, or a screen-reader click turns the button into an ordinary **Cancel / Confirm** pair in the same place (focus lands on Cancel; Escape cancels). Confirm fires the same `lu-confirm`. The hold also stops when the pointer is cancelled, the finger slides off the button, the key is released, focus moves away, or the page is hidden.

| Attribute | Default | Meaning |
|---|---|---|
| `label` | "Hold to confirm" | Button text at rest |
| `holding-label` | "Holding…" | While held |
| `complete-label` | "Done" | Shown for about a second after confirming |
| `confirm-label`, `cancel-label` | "Confirm", "Cancel" | The tap alternative's buttons |
| `consequence` | | One line, above the button: say exactly what will happen to what ("Deletes 14 clips from Garden camera.") |
| `icon` | | `mdi:name` or SVG path data |
| `kind` | `secondary` | `secondary` or `danger` |
| `duration` | 1500 | Hold time in ms |
| `busy` | | Your action is running: spinner, presses ignored |
| `disabled` | | |

Event: `lu-confirm` with `detail: { via: "hold" | "button" }`. Set `busy` while your action runs; reversible actions should use a toast with Undo instead of this control.

```html
<app-lu-hold-button kind="danger" icon="mdi:delete" label="Hold to delete" confirm-label="Delete"
  consequence="Deletes 14 clips from Garden camera. This cannot be undone."></app-lu-hold-button>
<script>
  document.querySelector("app-lu-hold-button").addEventListener("lu-confirm", async (e) => {
    e.target.busy = true;
    await deleteClips();
    e.target.busy = false;
  });
</script>
```

## Pure helpers

Exported for tests and for code that needs the same rules: `clampToStep`, `nextValue`, `atLimit`, `keyAction`, `applyKey`, `decimalsFor`, `formatNumber`, `formatValueText`, `repeatDelayMs` (stepper maths, grid anchored at `min`); `valueToFraction`, `sliderGrabbed/Moved/Released/External` (slider); `holdPress`, `holdProgress`, `holdRelease`, `holdSettle`, `holdRemainingMs`, `holdDrainRemainingMs`, `HOLD_DEFAULTS`, `TAP_MAX_MS` (hold gesture as functions of time); `chipIcon`, `chipKind`.
