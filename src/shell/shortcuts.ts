/** Keyboard shortcuts for destinations: which key goes where, and when a key press is not ours to take.
 * Pure (no `lit`, no DOM): the nav element feeds it the facts it read from a real `KeyboardEvent`. */
import type { LuDestination } from "./nav-model.ts";

/** The parts of a `KeyboardEvent` the rule looks at. */
export interface KeyInfo {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
}

/** Who else may own the key right now (the nav element works this out from focus and the event path). */
export interface KeyContext {
  /** A text field or a select has focus: a digit is typing, not navigation. */
  typing: boolean;
  /** The key was pressed inside a dialog, menu or popup: it belongs to that layer. */
  insideLayer: boolean;
}

/** What the nav element reads off one node of the event path to decide `insideLayer`. */
export interface LayerProbe {
  /** `localName`, e.g. "dialog", "ha-adaptive-dialog". */
  tag: string;
  role: string | null;
  hasPopoverAttribute: boolean;
}

const LAYER_ROLES: Record<string, true> = { dialog: true, alertdialog: true, menu: true, listbox: true };
const LAYER_TAG = /(^|-)(dialog|sheet|menu|popup|popover)$/;

/** True for a node that is (part of) a dialog, menu or popup: keys pressed inside it belong to it. */
export function isLayerNode(probe: LayerProbe): boolean {
  return LAYER_ROLES[probe.role ?? ""] === true || LAYER_TAG.test(probe.tag) || probe.hasPopoverAttribute;
}

/** The key that jumps to the destination at `index`: its own `shortcut` (exactly one character, any case),
 * otherwise the digit for its position (1-9). From the tenth destination on there is none. Keys are lower-case. */
export function shortcutKey(destination: LuDestination, index: number): string | undefined {
  const own = destination.shortcut?.trim();
  if (own && [...own].length === 1) return own.toLowerCase();
  return index >= 0 && index < 9 ? String(index + 1) : undefined;
}

/** The destination a key press jumps to, or `undefined` when the press is not a shortcut or is not ours: a
 * modifier is held (Ctrl+1 is the browser's own tab switch), a key is held down, an IME is composing, someone
 * already handled it, the user is typing, or it happened inside a dialog or popup. When two destinations end up
 * with the same key, the first wins. */
export function matchShortcut(destinations: readonly LuDestination[], event: KeyInfo, context: KeyContext): LuDestination | undefined {
  if (context.typing || context.insideLayer) return undefined;
  if (event.defaultPrevented || event.repeat || event.isComposing) return undefined;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return undefined;
  if ([...event.key].length !== 1) return undefined;
  const key = event.key.toLowerCase();
  return destinations.find((destination, index) => shortcutKey(destination, index) === key);
}

/** Tooltip text that makes the shortcut discoverable: "Wildlife (2)", letters in capitals. Just the label when there is no key. */
export function shortcutHint(destination: LuDestination, index: number): string {
  const key = shortcutKey(destination, index);
  return key ? `${destination.label} (${key.toUpperCase()})` : destination.label;
}
