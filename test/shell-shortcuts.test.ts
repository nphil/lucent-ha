import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isLayerNode, matchShortcut, shortcutHint, shortcutKey } from "../src/shell/shortcuts.ts";
import type { KeyContext, KeyInfo } from "../src/shell/shortcuts.ts";
import type { LuDestination } from "../src/shell/nav-model.ts";

const destinations: LuDestination[] = [
  { id: "live", label: "Live" },
  { id: "wildlife", label: "Wildlife" },
  { id: "checkup", label: "Check-up" },
];

const idle: KeyContext = { typing: false, insideLayer: false };

/** A plain key press with nothing special about it. */
function press(key: string, extra: Partial<KeyInfo> = {}): KeyInfo {
  return { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, isComposing: false, defaultPrevented: false, ...extra };
}

describe("shortcutKey", () => {
  it("is the digit for the position, 1 to 9", () => {
    assert.deepEqual(destinations.map((d, i) => shortcutKey(d, i)), ["1", "2", "3"]);
    assert.equal(shortcutKey({ id: "x", label: "x" }, 8), "9");
  });

  it("there is no key from the tenth destination on", () => {
    assert.equal(shortcutKey({ id: "x", label: "x" }, 9), undefined);
  });

  it("a destination's own one-character shortcut replaces its digit, in lower case", () => {
    assert.equal(shortcutKey({ id: "w", label: "Wildlife", shortcut: "W" }, 1), "w");
    assert.equal(shortcutKey({ id: "w", label: "Wildlife", shortcut: " 7 " }, 1), "7");
  });

  it("a shortcut that is not exactly one character is ignored, the digit stays", () => {
    assert.equal(shortcutKey({ id: "w", label: "Wildlife", shortcut: "Ctrl+K" }, 1), "2");
    assert.equal(shortcutKey({ id: "w", label: "Wildlife", shortcut: "" }, 1), "2");
  });
});

describe("matchShortcut", () => {
  it("a digit jumps to the destination at that position", () => {
    assert.equal(matchShortcut(destinations, press("2"), idle)?.id, "wildlife");
    assert.equal(matchShortcut(destinations, press("1"), idle)?.id, "live");
  });

  it("a digit past the last destination, or a key nobody owns, does nothing", () => {
    assert.equal(matchShortcut(destinations, press("4"), idle), undefined);
    assert.equal(matchShortcut(destinations, press("0"), idle), undefined);
    assert.equal(matchShortcut(destinations, press("x"), idle), undefined);
  });

  it("keys that are not one character never match, whatever they are called", () => {
    for (const key of ["Enter", "Tab", "ArrowRight", "Dead", "Process", "F1", ""]) {
      assert.equal(matchShortcut(destinations, press(key), idle), undefined, key);
    }
  });

  it("a held modifier means the key is not ours (Ctrl+1 and Cmd+1 switch browser tabs)", () => {
    for (const modifier of ["ctrlKey", "metaKey", "altKey", "shiftKey"] as const) {
      assert.equal(matchShortcut(destinations, press("2", { [modifier]: true }), idle), undefined, modifier);
    }
  });

  it("never while typing or inside a dialog, menu or popup", () => {
    assert.equal(matchShortcut(destinations, press("2"), { typing: true, insideLayer: false }), undefined);
    assert.equal(matchShortcut(destinations, press("2"), { typing: false, insideLayer: true }), undefined);
  });

  it("not on auto-repeat, during IME composition, or when something already handled the key", () => {
    assert.equal(matchShortcut(destinations, press("2", { repeat: true }), idle), undefined);
    assert.equal(matchShortcut(destinations, press("2", { isComposing: true }), idle), undefined);
    assert.equal(matchShortcut(destinations, press("2", { defaultPrevented: true }), idle), undefined);
  });

  it("a letter shortcut works with Caps Lock on but not with Shift, and takes the digit away from that destination", () => {
    const custom: LuDestination[] = [{ id: "live", label: "Live" }, { id: "wildlife", label: "Wildlife", shortcut: "w" }, { id: "checkup", label: "Check-up" }];
    assert.equal(matchShortcut(custom, press("w"), idle)?.id, "wildlife");
    assert.equal(matchShortcut(custom, press("W"), idle)?.id, "wildlife", "Caps Lock reports a capital letter without Shift");
    assert.equal(matchShortcut(custom, press("W", { shiftKey: true }), idle), undefined, "Shift+W is not a shortcut");
    assert.equal(matchShortcut(custom, press("2"), idle), undefined, "wildlife no longer answers to 2");
    assert.equal(matchShortcut(custom, press("3"), idle)?.id, "checkup");
  });

  it("when two destinations claim the same key the first one wins", () => {
    const clash: LuDestination[] = [{ id: "a", label: "A", shortcut: "2" }, { id: "b", label: "B" }];
    assert.equal(matchShortcut(clash, press("2"), idle)?.id, "a");
  });

  it("with no destinations nothing matches", () => {
    assert.equal(matchShortcut([], press("1"), idle), undefined);
  });
});

describe("shortcutHint", () => {
  it("is the label plus the key in capitals, the discoverable tooltip", () => {
    assert.equal(shortcutHint(destinations[1] as LuDestination, 1), "Wildlife (2)");
    assert.equal(shortcutHint({ id: "w", label: "Wildlife", shortcut: "w" }, 1), "Wildlife (W)");
  });

  it("is just the label when the destination has no key", () => {
    assert.equal(shortcutHint({ id: "x", label: "Tenth" }, 9), "Tenth");
  });
});

describe("isLayerNode", () => {
  const probe = (tag: string, role: string | null = null, hasPopoverAttribute = false) => ({ tag, role, hasPopoverAttribute });

  it("recognises native and Home Assistant dialogs, sheets and menus", () => {
    for (const tag of ["dialog", "ha-dialog", "ha-adaptive-dialog", "ha-bottom-sheet", "spec-lu-sheet", "ha-md-menu", "mwc-menu"]) {
      assert.equal(isLayerNode(probe(tag)), true, tag);
    }
  });

  it("recognises the ARIA roles that own keys, and popovers", () => {
    for (const role of ["dialog", "alertdialog", "menu", "listbox"]) assert.equal(isLayerNode(probe("div", role)), true, role);
    assert.equal(isLayerNode(probe("div", null, true)), true);
  });

  it("an ordinary element is not a layer, and neither is a tag that merely contains the word", () => {
    for (const tag of ["div", "button", "main", "nav", "dialogue-box", "menubar-item", "ha-card"]) assert.equal(isLayerNode(probe(tag)), false, tag);
    assert.equal(isLayerNode(probe("div", "navigation")), false);
  });
});
