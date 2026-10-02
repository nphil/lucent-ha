import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { shouldEscapeNavigateBack } from "../src/ha/escape.ts";
import type { EscapeEnv } from "../src/ha/escape.ts";
import { pushLayer } from "../src/ha/layers.ts";
import { FakeHistory } from "./ha-fakes.ts";

interface KeyInit {
  key?: string;
  defaultPrevented?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  path?: unknown[];
}

function keydown(init: KeyInit = {}): KeyboardEvent {
  const { path = [], ...rest } = init;
  return { key: "Escape", defaultPrevented: false, repeat: false, isComposing: false, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, composedPath: () => path, ...rest } as unknown as KeyboardEvent;
}

type Focus = "none" | "button" | "text field" | "select";

interface Surroundings {
  layers?: number;
  focus?: Focus;
  overlay?: boolean;
}

function env(parts: Surroundings = {}): EscapeEnv {
  const focus = parts.focus ?? "none";
  const element = { focus } as unknown as Element;
  return {
    activeElement: () => (focus === "none" ? null : element),
    ownsEscape: (candidate) => candidate === element && (focus === "text field" || focus === "select"),
    insideOverlay: () => parts.overlay ?? false,
    layerDepth: () => parts.layers ?? 0,
  };
}

describe("shouldEscapeNavigateBack: the guard", () => {
  const rows: Array<[string, KeyInit, Surroundings, boolean]> = [
    // name,                                    key event,                          surroundings,                       acts as Back
    ["a plain Escape on a quiet page",           {},                                 {},                                  true],
    ["a plain Escape with a button focused",     {},                                 { focus: "button" },                 true],
    ["another key",                              { key: "Enter" },                   {},                                  false],
    ["the old IE name of the key",               { key: "Esc" },                     {},                                  false],
    ["already handled by someone (prevented)",   { defaultPrevented: true },         {},                                  false],
    ["key held down (repeat)",                   { repeat: true },                   {},                                  false],
    ["cancelling an IME composition",            { isComposing: true },              {},                                  false],
    ["with Ctrl",                                { ctrlKey: true },                  {},                                  false],
    ["with Alt",                                 { altKey: true },                   {},                                  false],
    ["with Meta",                                { metaKey: true },                  {},                                  false],
    ["with Shift",                               { shiftKey: true },                 {},                                  false],
    ["a toolkit layer is open (it closes first)", {},                                { layers: 1 },                       false],
    ["two layers are open",                      {},                                 { layers: 2 },                       false],
    ["focus is in a text field",                 {},                                 { focus: "text field" },             false],
    ["focus is in a native select",              {},                                 { focus: "select" },                 false],
    ["an open dialog, menu or popover owns it",  {},                                 { overlay: true },                   false],
    ["focus on a button inside an open dialog",  {},                                 { focus: "button", overlay: true },  false],
    ["everything at once",                       { shiftKey: true },                 { layers: 1, focus: "text field", overlay: true }, false],
  ];
  for (const [name, init, surroundings, expected] of rows) {
    it(name, () => {
      assert.equal(shouldEscapeNavigateBack(keydown(init), env(surroundings)), expected);
    });
  }
});

/** A page just detailed enough for the browser defaults: elements with attributes, focus, history, a window. */
class FakeElement {
  shadowRoot: { activeElement: FakeElement | null } | null = null;
  isContentEditable = false;
  popoverOpen = false;
  throwOnPopoverMatch = false;
  localName: string;
  attributes: Record<string, string>;
  constructor(localName: string, attributes: Record<string, string> = {}) {
    this.localName = localName;
    this.attributes = attributes;
  }
  hasAttribute(name: string): boolean {
    return name in this.attributes;
  }
  matches(selector: string): boolean {
    if (selector === ":popover-open") {
      if (this.throwOnPopoverMatch) throw new SyntaxError("not a valid selector");
      return this.popoverOpen;
    }
    // Only the shapes the guard uses: `tag[attr]` and `[attr="value"]`, comma separated.
    return selector.split(",").some((part) => {
      const found = /^\s*(\w+)?\[([\w-]+)(?:="([^"]*)")?\]\s*$/.exec(part);
      if (!found) return false;
      const [, tag, attribute = "", value] = found;
      if (tag !== undefined && tag !== this.localName) return false;
      if (!(attribute in this.attributes)) return false;
      return value === undefined || this.attributes[attribute] === value;
    });
  }
}
class FakeHtmlElement extends FakeElement {}
class FakeInput extends FakeHtmlElement {
  type: string;
  constructor(type: string) {
    super("input");
    this.type = type;
  }
}
class FakeTextarea extends FakeHtmlElement {
  constructor() {
    super("textarea");
  }
}

describe("shouldEscapeNavigateBack: the browser defaults", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const SHARED = Symbol.for("lucent-ha:layers");
  let history: FakeHistory;
  const document = { activeElement: null as FakeElement | null };

  before(() => {
    history = new FakeHistory({ url: "/kestrel/live" });
    globals.window = { history, addEventListener: (type: string, handler: (event: { state: unknown }) => void) => (type === "popstate" ? history.addPopstate(handler) : undefined), removeEventListener: () => undefined };
    globals.document = document;
    globals.Element = FakeElement;
    globals.HTMLElement = FakeHtmlElement;
    globals.HTMLInputElement = FakeInput;
    globals.HTMLTextAreaElement = FakeTextarea;
  });

  after(() => {
    for (const name of ["window", "document", "Element", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement"]) delete globals[name];
    delete (globals as unknown as Record<symbol, unknown>)[SHARED];
  });

  const pressEscape = (path: FakeElement[] = []): boolean => shouldEscapeNavigateBack(keydown({ path }));

  it("acts as Back on a quiet page with a button focused", () => {
    document.activeElement = new FakeHtmlElement("button");
    assert.equal(pressEscape(), true);
  });

  it("does not act while focus is in a text field, a textarea, an editable area or a select, but does for a checkbox", () => {
    document.activeElement = new FakeInput("text");
    assert.equal(pressEscape(), false);
    document.activeElement = new FakeInput("search");
    assert.equal(pressEscape(), false);
    document.activeElement = new FakeTextarea();
    assert.equal(pressEscape(), false);
    const editable = new FakeHtmlElement("div");
    editable.isContentEditable = true;
    document.activeElement = editable;
    assert.equal(pressEscape(), false);
    document.activeElement = new FakeHtmlElement("select");
    assert.equal(pressEscape(), false);
    document.activeElement = new FakeInput("checkbox");
    assert.equal(pressEscape(), true);
  });

  it("looks through shadow roots for the focused element", () => {
    const field = new FakeInput("text");
    const host = new FakeHtmlElement("lu-search");
    host.shadowRoot = { activeElement: field };
    document.activeElement = host;
    assert.equal(pressEscape(), false);
  });

  it("does not act when an open dialog, an aria-modal element, a menu or an open popover is in the key's path", () => {
    document.activeElement = new FakeHtmlElement("button");
    assert.equal(pressEscape([new FakeElement("div"), new FakeElement("dialog", { open: "" })]), false);
    assert.equal(pressEscape([new FakeElement("div", { "aria-modal": "true" })]), false);
    assert.equal(pressEscape([new FakeElement("div", { role: "menu" })]), false);
    assert.equal(pressEscape([new FakeElement("div", { role: "listbox" })]), false);
    const popover = new FakeElement("div", { popover: "" });
    popover.popoverOpen = true;
    assert.equal(pressEscape([popover]), false);
  });

  it("acts when the path holds only closed things: a dialog without `open`, a closed popover, an aria-modal of false", () => {
    document.activeElement = new FakeHtmlElement("button");
    const closedPopover = new FakeElement("div", { popover: "" });
    assert.equal(pressEscape([new FakeElement("dialog"), closedPopover, new FakeElement("div", { "aria-modal": "false" }), new FakeElement("div")]), true);
  });

  it("treats a browser that cannot match :popover-open as having no open popovers", () => {
    document.activeElement = new FakeHtmlElement("button");
    const popover = new FakeElement("div", { popover: "" });
    popover.throwOnPopoverMatch = true;
    assert.equal(pressEscape([popover]), true);
  });

  it("does not act while Home Assistant has a dialog open (it marks the history entry)", () => {
    document.activeElement = new FakeHtmlElement("button");
    history.replaceState({ dialog: "ha-more-info-dialog" }, "");
    assert.equal(pressEscape(), false);
    history.replaceState({ from: "/lovelace/0" }, "");
    assert.equal(pressEscape(), true);
    history.replaceState(null, "");
    assert.equal(pressEscape(), true);
  });

  it("does not act while a toolkit layer is open, and acts again once it closed", () => {
    document.activeElement = new FakeHtmlElement("button");
    const sheet = pushLayer("sheet", () => undefined);
    assert.equal(pressEscape(), false);
    sheet.close("escape");
    assert.equal(pressEscape(), true);
  });
});
