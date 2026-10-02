import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SheetLifecycle, initialFocus, keyboardInset } from "../src/sheet/sheet-model.ts";
import type { SheetCloseReason, SheetLayer } from "../src/sheet/sheet-model.ts";

/** A layer stack that behaves like the real manager (`src/ha/layers.ts`): `handle.close()` closes the layer and every layer
 * above it and runs their `onClose` callbacks right away, top first (inside `close()`, before it returns); `popFromBrowser`
 * is the system Back button. */
function fakeHistory() {
  const log: string[] = [];
  const layers: Array<SheetLayer & { onClose: (reason: string) => void; isOpen: boolean }> = [];
  const closeFrom = (start: number, reason: string): void => {
    const closing = layers.slice(start).filter((layer) => layer.isOpen);
    for (const layer of closing) layer.isOpen = false;
    for (const layer of closing.reverse()) layer.onClose(reason);
  };
  const push = (id: string, onClose: (reason: string) => void): SheetLayer => {
    const layer = {
      isOpen: true,
      get open() { return layer.isOpen; },
      onClose,
      close(reason?: string) {
        if (!layer.isOpen) return;
        log.push(`layer.close(${reason ?? ""})`);
        closeFrom(layers.indexOf(layer), reason ?? "api");
      },
    };
    log.push(`push(${id})`);
    layers.push(layer);
    return layer;
  };
  /** The system Back button: pops the topmost layer that is still open. */
  const popFromBrowser = (reason = "back"): void => {
    for (let index = layers.length - 1; index >= 0; index--) {
      if (!layers[index]?.isOpen) continue;
      closeFrom(index, reason);
      return;
    }
  };
  return { log, layers, push, popFromBrowser };
}

function sheet(options: { wantsOpen?: () => boolean; showThrows?: boolean; withHistory?: boolean } = {}) {
  const history = fakeHistory();
  const log = history.log;
  const effects = {
    show() { if (options.showThrows) throw new Error("not connected"); log.push("show"); },
    exit(reason: SheetCloseReason) { log.push(`exit(${reason})`); },
    closed(reason: SheetCloseReason) { log.push(`closed(${reason})`); },
    setOpen(open: boolean) { log.push(`setOpen(${open})`); },
    wantsOpen: options.wantsOpen ?? (() => false),
  };
  const lifecycle = new SheetLifecycle(effects, options.withHistory === false ? null : history.push);
  return { lifecycle, history, log };
}

const HISTORY = { history: true, layer: "species" };
const NO_HISTORY = { history: false, layer: "species" };

describe("SheetLifecycle: opening", () => {
  it("shows the sheet and adds one history entry with the chosen layer id", () => {
    const { lifecycle, log } = sheet();
    lifecycle.open(HISTORY);
    assert.deepEqual(log, ["show", "push(species)"]);
    assert.equal(lifecycle.phase, "open");
  });

  it("adds no history entry for a card (history off) or when the app has no layer support", () => {
    const card = sheet();
    card.lifecycle.open(NO_HISTORY);
    assert.deepEqual(card.log, ["show"]);
    const bare = sheet({ withHistory: false });
    bare.lifecycle.open(HISTORY);
    assert.deepEqual(bare.log, ["show"]);
  });

  it("opening an open sheet does nothing", () => {
    const { lifecycle, log } = sheet();
    lifecycle.open(HISTORY);
    lifecycle.open(HISTORY);
    assert.deepEqual(log, ["show", "push(species)"]);
  });

  it("a sheet that cannot be shown stays closed and leaves no history entry", () => {
    const { lifecycle, log } = sheet({ showThrows: true });
    assert.throws(() => lifecycle.open(HISTORY), /not connected/);
    assert.equal(lifecycle.phase, "closed");
    assert.deepEqual(log, []);
  });
});

describe("SheetLifecycle: closing by the user or by code", () => {
  for (const reason of ["escape", "scrim", "swipe", "button", "api"] as const) {
    it(`${reason}: open flips at once, the history entry is given back once, lu-close comes after the exit`, () => {
      const { lifecycle, log } = sheet();
      lifecycle.open(HISTORY);
      log.length = 0;
      assert.equal(lifecycle.close(reason), true);
      assert.deepEqual(log, ["setOpen(false)", `layer.close(${reason})`, `exit(${reason})`]);
      assert.equal(lifecycle.phase, "closing");
      lifecycle.exited();
      assert.deepEqual(log.slice(3), [`closed(${reason})`]);
      assert.equal(lifecycle.phase, "closed");
    });
  }

  it("a card sheet closes without touching history", () => {
    const { lifecycle, log } = sheet();
    lifecycle.open(NO_HISTORY);
    log.length = 0;
    lifecycle.close("button");
    lifecycle.exited();
    assert.deepEqual(log, ["setOpen(false)", "exit(button)", "closed(button)"]);
  });

  it("the first reason wins; later attempts while it is leaving do nothing", () => {
    const { lifecycle, log } = sheet();
    lifecycle.open(HISTORY);
    log.length = 0;
    assert.equal(lifecycle.close("escape"), true);
    assert.equal(lifecycle.close("button"), false);
    assert.equal(lifecycle.close("scrim"), false);
    lifecycle.exited();
    lifecycle.exited();
    assert.deepEqual(log, ["setOpen(false)", "layer.close(escape)", "exit(escape)", "closed(escape)"]);
  });

  it("closing a sheet that is not open does nothing", () => {
    const { lifecycle, log } = sheet();
    assert.equal(lifecycle.close("api"), false);
    lifecycle.exited();
    assert.deepEqual(log, []);
  });
});

describe("SheetLifecycle: the system Back button", () => {
  it("closes the sheet with reason back and does not remove the history entry a second time", () => {
    const { lifecycle, history, log } = sheet();
    lifecycle.open(HISTORY);
    log.length = 0;
    history.popFromBrowser("back");
    assert.deepEqual(log, ["setOpen(false)", "exit(back)"]);
    lifecycle.exited();
    assert.deepEqual(log.slice(2), ["closed(back)"]);
  });

  it("any other reason from the layer (a page navigation) reports api", () => {
    const { lifecycle, history, log } = sheet();
    lifecycle.open(HISTORY);
    history.popFromBrowser("navigate");
    assert.equal(log.at(-1), "exit(api)");
    lifecycle.exited();
    assert.equal(log.at(-1), "closed(api)");
  });

  it("Back while the sheet is already leaving does nothing more", () => {
    const { lifecycle, history, log } = sheet();
    lifecycle.open(HISTORY);
    lifecycle.close("button");
    log.length = 0;
    history.popFromBrowser("back");
    lifecycle.exited();
    assert.deepEqual(log, ["closed(button)"]);
  });

  it("two sheets nest: Back closes the top one, then the one below", () => {
    const stack = fakeHistory();
    const events: string[] = [];
    const make = (name: string) => {
      const lifecycle: SheetLifecycle = new SheetLifecycle({
        show: () => {},
        exit: (reason) => { events.push(`${name} exit ${reason}`); lifecycle.exited(); },
        closed: (reason) => events.push(`${name} closed ${reason}`),
        setOpen: () => {},
        wantsOpen: () => false,
      }, stack.push);
      return lifecycle;
    };
    const below = make("below");
    const top = make("top");
    below.open(HISTORY);
    top.open(HISTORY);
    stack.popFromBrowser("back");
    assert.deepEqual(events, ["top exit back", "top closed back"]);
    stack.popFromBrowser("back");
    assert.deepEqual(events.slice(2), ["below exit back", "below closed back"]);
  });
});

describe("SheetLifecycle: opening again", () => {
  it("while it is leaving, waits for the exit and then opens again with a new history entry", () => {
    let wanted = false;
    const { lifecycle, log } = sheet({ wantsOpen: () => wanted });
    lifecycle.open(HISTORY);
    lifecycle.close("button");
    log.length = 0;
    wanted = true;
    lifecycle.open(HISTORY);
    assert.deepEqual(log, [], "nothing happens while it is leaving");
    lifecycle.exited();
    assert.deepEqual(log, ["closed(button)", "show", "push(species)"]);
    assert.equal(lifecycle.phase, "open");
  });

  it("does not reopen when the owner changed its mind during the exit", () => {
    let wanted = true;
    const { lifecycle, log } = sheet({ wantsOpen: () => wanted });
    lifecycle.open(HISTORY);
    lifecycle.close("api");
    lifecycle.open(HISTORY);
    wanted = false;
    log.length = 0;
    lifecycle.exited();
    assert.deepEqual(log, ["closed(api)"]);
    assert.equal(lifecycle.phase, "closed");
  });

  it("a closed sheet can be opened and closed again, each time with its own history entry", () => {
    const { lifecycle, history } = sheet();
    for (let round = 0; round < 3; round++) {
      lifecycle.open(HISTORY);
      lifecycle.close("escape");
      lifecycle.exited();
    }
    assert.equal(history.layers.length, 3);
    assert.ok(history.layers.every((layer) => !layer.isOpen));
  });
});

describe("SheetLifecycle: the element goes away", () => {
  it("dispose gives the history entry back without any effect", () => {
    const { lifecycle, history, log } = sheet();
    lifecycle.open(HISTORY);
    log.length = 0;
    lifecycle.dispose();
    assert.deepEqual(log, ["layer.close(api)"]);
    assert.equal(history.layers[0]?.isOpen, false);
    assert.equal(lifecycle.phase, "closed");
  });

  it("is silent even though the layer manager runs onClose inside close(): no exit, no lu-close, no reopen", () => {
    const { lifecycle, log } = sheet({ wantsOpen: () => true });
    lifecycle.open(HISTORY);
    log.length = 0;
    lifecycle.dispose();
    assert.deepEqual(log, ["layer.close(api)"]);
  });

  it("a sheet that never had a history entry has nothing to give back", () => {
    const { lifecycle, log } = sheet();
    lifecycle.open(NO_HISTORY);
    log.length = 0;
    lifecycle.dispose();
    assert.deepEqual(log, []);
    assert.equal(lifecycle.phase, "closed");
  });
});

describe("SheetLifecycle: two sheets, the lower one closes first", () => {
  it("closes the sheet above it too, reporting api, and the lower one keeps its own reason", () => {
    const stack = fakeHistory();
    const events: string[] = [];
    const make = (name: string) => {
      const lifecycle: SheetLifecycle = new SheetLifecycle({
        show: () => {},
        exit: (reason) => { events.push(`${name} exit ${reason}`); lifecycle.exited(); },
        closed: (reason) => events.push(`${name} closed ${reason}`),
        setOpen: () => {},
        wantsOpen: () => false,
      }, stack.push);
      return lifecycle;
    };
    const lower = make("lower");
    const upper = make("upper");
    lower.open(HISTORY);
    upper.open(HISTORY);
    lower.close("button");
    assert.deepEqual(events, ["upper exit api", "upper closed api", "lower exit button", "lower closed button"]);
    assert.equal(lower.phase, "closed");
    assert.equal(upper.phase, "closed");
  });
});

describe("keyboardInset", () => {
  const view = { innerHeight: 844, height: 844, offsetTop: 0, scale: 1 };

  it("is 0 without a keyboard", () => {
    assert.equal(keyboardInset(view), 0);
  });

  it("is the height the keyboard takes from the bottom", () => {
    assert.equal(keyboardInset({ ...view, height: 544 }), 300);
  });

  it("does not count the part the browser scrolled away above the visual viewport", () => {
    assert.equal(keyboardInset({ ...view, height: 500, offsetTop: 40 }), 304);
  });

  it("is never negative", () => {
    assert.equal(keyboardInset({ ...view, height: 900 }), 0);
  });

  it("ignores a pinch-zoomed page: a smaller visual viewport is not a keyboard", () => {
    assert.equal(keyboardInset({ ...view, height: 422, scale: 2 }), 0);
  });
});

describe("initialFocus", () => {
  it("never moves into a field on a touch screen, which would raise the keyboard", () => {
    assert.equal(initialFocus(true, true), "container");
    assert.equal(initialFocus(true, false), "container");
  });

  it("honours autofocus for a mouse and keyboard user, and otherwise lands on the sheet", () => {
    assert.equal(initialFocus(false, true), "target");
    assert.equal(initialFocus(false, false), "container");
  });
});
