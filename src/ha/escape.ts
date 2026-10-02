/* Derived from music-assistant/frontend src/composables/useEscapeBack.ts:4-53 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md).
 * Modified: the Vue composable and its store flags became a pure yes/no question about one keydown event; the
 * overlay search follows the event's own path through shadow roots (a document-wide query cannot see into them);
 * toolkit layers and Home Assistant's own open dialog (`history.state.dialog`) count as owners of the key. */
import { deepActiveElement, isTextEntry } from "../core/dom.ts";
import { isRecord } from "./guards.ts";
import { layerDepth } from "./layers.ts";

/** What the guard looks at. The browser defaults are used when it is not given (tests pass fakes). */
export interface EscapeEnv {
  /** The element that really has focus, looking through shadow roots. */
  activeElement(): Element | null;
  /** True when Escape belongs to the focused element: a text field, an editable area, a native select. */
  ownsEscape(element: Element | null): boolean;
  /** True when an open dialog, menu or popover is in the key event's path, or Home Assistant has a dialog open. */
  insideOverlay(event: KeyboardEvent): boolean;
  /** How many toolkit layers (sheets, pickers ...) are open. */
  layerDepth(): number;
}

const OVERLAY = 'dialog[open], [aria-modal="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

function isPopoverOpen(element: Element): boolean {
  try {
    return element.hasAttribute("popover") && element.matches(":popover-open");
  } catch {
    // A browser that does not know `:popover-open` has no popovers to speak of.
    return false;
  }
}

const browserEnv: EscapeEnv = {
  activeElement: deepActiveElement,
  ownsEscape: (element) => isTextEntry(element) || element?.localName === "select",
  insideOverlay: (event) => {
    // Home Assistant marks the history entry of every open dialog.
    if (isRecord(window.history.state) && window.history.state.dialog) return true;
    return event.composedPath().some((node) => node instanceof Element && (node.matches(OVERLAY) || isPopoverOpen(node)));
  },
  layerDepth,
};

/** True when this keydown should act as Back: a plain Escape (no modifier, not a key repeat, not an IME cancel)
 * that nothing else wants. Something else wants it when a toolkit layer is open, when focus is in a field the user
 * types or picks in, or when an open dialog, menu or popover (including Home Assistant's own) contains the key.
 * Call `goBack(...)` when it returns true, and `event.preventDefault()` yourself. */
export function shouldEscapeNavigateBack(event: KeyboardEvent, env: EscapeEnv = browserEnv): boolean {
  if (event.key !== "Escape" || event.defaultPrevented || event.repeat || event.isComposing) return false;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
  if (env.layerDepth() > 0) return false;
  if (env.ownsEscape(env.activeElement())) return false;
  return !env.insideOverlay(event);
}
