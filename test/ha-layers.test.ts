import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { POP_TIMEOUT_MS, createLayerManager } from "../src/ha/layers.ts";
import type { LayerHandle } from "../src/ha/layers.ts";
import { FakeClock, FakeHistory } from "./ha-fakes.ts";

const OTHER_PAGE = { state: null, url: "/lovelace/0" };

/** One layer manager on a fake history: an older entry from another Home Assistant page, then the panel's page. */
function setup(first: { state?: unknown; url?: string } = { url: "/kestrel/wildlife" }, clockStart = 1000, before = [OTHER_PAGE]) {
  const clock = new FakeClock(clockStart);
  const history = new FakeHistory(first, before);
  const errors: unknown[] = [];
  const manager = createLayerManager({ history, addPopstate: history.addPopstate, addLocationChanged: history.addLocationChanged, clock, onError: (error) => errors.push(error) });
  /** "id:reason" for every onClose call, in call order. */
  const closed: string[] = [];
  const open = (id: string): LayerHandle => manager.pushLayer(id, (reason) => closed.push(`${id}:${reason}`));
  /** The index of the panel's page; layer entries sit above it. */
  const base = history.index;
  return { clock, history, manager, errors, closed, open, base };
}

function layerOf(state: unknown): { id: string; seq: number } | undefined {
  return (state as { lu?: { layer?: { id: string; seq: number } } } | null)?.lu?.layer;
}

describe("opening a layer", () => {
  it("adds exactly one history entry and keeps the address", () => {
    const { history, manager, open, base } = setup();
    const lengthBefore = history.length;
    const sheet = open("sheet");
    assert.equal(history.length, lengthBefore + 1);
    assert.equal(history.index, base + 1);
    assert.equal(history.url, "/kestrel/wildlife");
    assert.equal(layerOf(history.state)?.id, "sheet");
    assert.equal(manager.layerDepth(), 1);
    assert.equal(sheet.open, true);
    assert.equal(sheet.id, "sheet");
  });

  it("numbers entries upward so a later layer always has the bigger number", () => {
    const { history, open } = setup();
    open("a");
    const first = layerOf(history.state)?.seq ?? 0;
    open("b");
    const second = layerOf(history.state)?.seq ?? 0;
    assert.ok(first > 0);
    assert.ok(second > first);
  });

  it("keeps Home Assistant's keys and the toolkit's other fields on the new entry, and leaves the old entry alone", () => {
    const original = { root: true, from: "/lovelace/0", opensDialog: true, lu: { depth: 2, tab: { id: "wildlife", marker: true } } };
    const { history, open, base } = setup({ state: original, url: "/kestrel/wildlife" });
    open("sheet");
    const pushed = history.state as typeof original & { lu: { layer?: unknown } };
    assert.equal(pushed.root, true);
    assert.equal(pushed.from, "/lovelace/0");
    assert.equal(pushed.opensDialog, true);
    assert.equal(pushed.lu.depth, 2);
    assert.deepEqual(pushed.lu.tab, { id: "wildlife", marker: true });
    assert.ok(pushed.lu.layer);
    assert.deepEqual(history.entries[base]?.state, original);
  });
});

describe("system Back", () => {
  it("closes only the top layer, with the reason back", () => {
    const { history, manager, closed, open, base } = setup();
    const a = open("a");
    const b = open("b");
    history.back();
    history.flush();
    assert.deepEqual(closed, ["b:back"]);
    assert.equal(manager.layerDepth(), 1);
    assert.equal(a.open, true);
    assert.equal(b.open, false);
    assert.equal(history.index, base + 1);
  });

  it("closes the next layer on the next Back, top first overall", () => {
    const { history, manager, closed, open, base } = setup();
    open("a");
    open("b");
    history.back();
    history.flush();
    history.back();
    history.flush();
    assert.deepEqual(closed, ["b:back", "a:back"]);
    assert.equal(manager.layerDepth(), 0);
    assert.equal(history.index, base);
  });

  it("closes both, top first, when one jump skips two entries", () => {
    const { history, closed, open, base } = setup();
    open("a");
    open("b");
    history.go(-2);
    history.flush();
    assert.deepEqual(closed, ["b:back", "a:back"]);
    assert.equal(history.index, base);
    assert.equal(history.popstates.length, 1);
  });

  it("does nothing while no layer is open", () => {
    const { history, closed, base } = setup();
    history.back();
    history.flush();
    assert.deepEqual(closed, []);
    assert.equal(history.index, base - 1);
    assert.deepEqual(history.traversals, [-1], "no bounce, no extra traversal");
  });

  it("leaves the layer open when a Home Assistant dialog on top of it is closed with Back", () => {
    const { history, manager, closed, open } = setup();
    open("sheet");
    history.pushState({ dialog: "more-info" }, "");
    history.back();
    history.flush();
    assert.deepEqual(closed, []);
    assert.equal(manager.layerDepth(), 1);
  });

  it("never steps over an ordinary entry that has no toolkit marker", () => {
    const { history, base } = setup();
    history.pushState({ from: "/kestrel/wildlife" }, "", "/kestrel/visit?v=1");
    history.back();
    history.flush();
    assert.equal(history.index, base);
    assert.deepEqual(history.traversals, [-1]);
  });
});

describe("closing from the UI", () => {
  it("runs onClose at once, then one traversal pops the entry and its popstate closes nothing more", () => {
    const { history, manager, closed, open, base } = setup();
    const sheet = open("sheet");
    sheet.close("button");
    assert.deepEqual(closed, ["sheet:button"]);
    assert.equal(sheet.open, false);
    assert.equal(history.pending, 1);
    history.flush();
    assert.deepEqual(closed, ["sheet:button"]);
    assert.equal(history.index, base);
    assert.equal(manager.layerDepth(), 0);
    assert.deepEqual(history.traversals, [-1]);
  });

  it("closing a lower layer closes the ones above it, top first, with ONE traversal", () => {
    const { history, manager, closed, open, base } = setup();
    const a = open("a");
    open("b");
    open("c");
    a.close("scrim");
    assert.deepEqual(closed, ["c:scrim", "b:scrim", "a:scrim"]);
    history.flush();
    assert.deepEqual(history.traversals, [-3]);
    assert.equal(history.index, base);
    assert.equal(manager.layerDepth(), 0);
  });

  it("closeTopLayer closes only the top one, reports whether it did, and defaults the reason to api", () => {
    const { history, manager, closed, open } = setup();
    assert.equal(manager.closeTopLayer(), false);
    open("a");
    open("b");
    assert.equal(manager.closeTopLayer(), true);
    history.flush();
    assert.deepEqual(closed, ["b:api"]);
    assert.equal(manager.closeTopLayer("escape"), true);
    history.flush();
    assert.deepEqual(closed, ["b:api", "a:escape"]);
    assert.equal(manager.closeTopLayer(), false);
  });

  it("calls onClose once even when closed twice, or after Back already closed it", () => {
    const { history, closed, open } = setup();
    const a = open("a");
    a.close("button");
    a.close("button");
    history.flush();
    const b = open("b");
    history.back();
    history.flush();
    b.close("api");
    history.flush();
    assert.deepEqual(closed, ["a:button", "b:back"]);
  });

  it("closing a layer that is already closed leaves the other layers alone", () => {
    const { history, manager, closed, open } = setup();
    const a = open("a");
    const b = open("b");
    b.close("button");
    history.flush();
    const c = open("c");
    history.flush();
    b.close("button");
    history.flush();
    assert.equal(a.open, true);
    assert.equal(c.open, true);
    assert.equal(manager.layerDepth(), 2);
    assert.deepEqual(closed, ["b:button"]);
  });

  it("closing layers one after another walks down entry by entry without overshooting", () => {
    const { history, manager, closed, open, base } = setup();
    open("a");
    const b = open("b");
    const c = open("c");
    c.close("api");
    b.close("api");
    history.flush();
    assert.deepEqual(closed, ["c:api", "b:api"]);
    assert.equal(manager.layerDepth(), 1);
    assert.equal(history.index, base + 1, "stopped on a's entry, did not bounce past it");
    assert.equal(layerOf(history.state)?.id, "a");
  });

  it("merges closes that queue up behind a traversal that is already under way", () => {
    const { history, manager, closed, open, base } = setup();
    open("a");
    const b = open("b");
    const c = open("c");
    const d = open("d");
    d.close("api");
    c.close("api");
    b.close("api");
    history.flush();
    assert.deepEqual(history.traversals, [-1, -2]);
    assert.deepEqual(closed, ["d:api", "c:api", "b:api"]);
    assert.equal(history.index, base + 1);
    assert.equal(manager.layerDepth(), 1);
  });
});

describe("opening while a close is under way", () => {
  it("writes the new layer's entry only after the traversal landed, so the traversal cannot undo it", () => {
    const { history, manager, closed, open, base } = setup();
    const a = open("a");
    a.close("button");
    const b = open("b");
    assert.equal(b.open, true);
    assert.equal(manager.layerDepth(), 1);
    assert.equal(layerOf(history.entries[base + 1]?.state)?.id, "a", "still a's entry: b's is not written yet");
    history.flush();
    assert.equal(history.index, base + 1);
    assert.equal(layerOf(history.state)?.id, "b");
    history.back();
    history.flush();
    assert.deepEqual(closed, ["a:button", "b:back"]);
  });

  it("forgets a layer that was closed before its entry was written", () => {
    const { history, manager, closed, open, base } = setup();
    const a = open("a");
    a.close("button");
    const b = open("b");
    b.close("api");
    history.flush();
    assert.deepEqual(closed, ["a:button", "b:api"]);
    assert.equal(history.index, base);
    assert.equal(layerOf(history.entries[base + 1]?.state)?.id, "a", "no entry was ever written for b");
    assert.equal(manager.layerDepth(), 0);
    assert.deepEqual(history.traversals, [-1]);
  });

  it("opening and closing in a loop brings the history back to the same entry every time", () => {
    const { history, closed, open, base } = setup();
    for (let i = 0; i < 6; i++) {
      open(`l${i}`).close("button");
      history.flush();
      assert.equal(history.index, base);
    }
    assert.equal(closed.length, 6);
    assert.ok(history.length <= base + 2, "only the last closed layer's entry is left ahead");
  });
});

describe("leftover entries", () => {
  it("navigate closes layers without touching history; Back over their entry is invisible", () => {
    const { history, manager, closed, open, base } = setup();
    open("sheet");
    manager.releaseLayers("navigate");
    assert.deepEqual(closed, ["sheet:navigate"]);
    assert.equal(history.pending, 0, "releasing does not touch history");
    history.pushState({ lu: { depth: 1 } }, "", "/kestrel/visit?v=1");
    history.back();
    history.flush();
    assert.equal(history.index, base, "Back skipped the leftover entry and landed on the page before it");
    assert.deepEqual(history.popstates, [base + 1, base], "two traversals happened, the second one was started by us");
    assert.deepEqual(closed, ["sheet:navigate"]);
  });

  it("a layer opened above a leftover never reuses the leftover's number, so a long jump back over both closes it", () => {
    const { history, manager, closed, open, base } = setup();
    open("sheet");
    const leftoverSeq = layerOf(history.state)?.seq ?? 0;
    manager.releaseLayers("navigate");
    history.pushState({ lu: { depth: 1 } }, "", "/kestrel/visit?v=1");
    open("picker");
    assert.ok((layerOf(history.state)?.seq ?? 0) > leftoverSeq);
    history.go(-2);
    history.flush();
    assert.deepEqual(closed, ["sheet:navigate", "picker:back"], "the picker's entry is ahead of where we landed, so it closed");
    assert.equal(manager.layerDepth(), 0);
    assert.equal(history.index, base, "and the leftover under it was stepped over too");
  });

  it("Forward into a closed layer's entry bounces back where we were", () => {
    const { history, manager, closed, open, base } = setup();
    open("sheet");
    history.back();
    history.flush();
    history.forward();
    history.flush();
    assert.equal(history.index, base);
    assert.equal(manager.layerDepth(), 0);
    assert.deepEqual(closed, ["sheet:back"]);
  });

  it("starting on an ordinary page does nothing to the history", () => {
    const { history } = setup();
    assert.equal(history.pending, 0);
    assert.deepEqual(history.traversals, []);
  });

  describe("left by an earlier page life (a reload, a restored tab)", () => {
    /** [another page] [the panel's page] [a layer entry from before the reload, current]. */
    function reloaded(leftovers: number[] = [5000]) {
      const clock = new FakeClock(1000);
      const [last = 5000, ...rest] = [...leftovers].reverse();
      const older = rest.reverse().map((seq) => ({ state: { lu: { layer: { id: "old", seq } } }, url: "/kestrel/wildlife" }));
      const history = new FakeHistory({ state: { lu: { layer: { id: "old", seq: last } } }, url: "/kestrel/wildlife" }, [OTHER_PAGE, { state: null, url: "/kestrel/wildlife" }, ...older]);
      const manager = createLayerManager({ history, addPopstate: history.addPopstate, addLocationChanged: history.addLocationChanged, clock });
      return { clock, history, manager };
    }

    it("is stepped over as soon as the manager starts, so one Back press leaves the panel", () => {
      const { history } = reloaded();
      assert.equal(history.pending, 1);
      history.flush();
      assert.equal(history.index, 1, "on the page under the leftover entry");
      history.back();
      history.flush();
      assert.equal(history.url, "/lovelace/0");
    });

    it("several in a row are all stepped over", () => {
      const { history } = reloaded([5000, 5001, 5002]);
      history.flush();
      assert.equal(history.index, 1);
      assert.equal(history.popstates.length, 3);
    });

    it("a layer opened right away waits for that step and sits on the real page, not on the leftover", () => {
      const { history, manager } = reloaded();
      const closed: string[] = [];
      const sheet = manager.pushLayer("sheet", (reason) => closed.push(reason));
      assert.equal(sheet.open, true);
      history.flush();
      assert.equal(layerOf(history.state)?.id, "sheet");
      assert.equal(history.index, 2);
      assert.equal(history.length, 3, "the leftover was replaced by the new entry, not stacked under it");
      history.back();
      history.flush();
      assert.deepEqual(closed, ["back"]);
      history.back();
      history.flush();
      assert.equal(history.url, "/lovelace/0");
    });

    it("numbers new layers above anything the old page life left in the history", () => {
      const old = setup({ url: "/kestrel/wildlife" }, 1000);
      old.open("a");
      old.open("b");
      const lastOld = layerOf(old.history.state)?.seq ?? 0;
      old.manager.dispose();
      const later = createLayerManager({ history: old.history, addPopstate: old.history.addPopstate, addLocationChanged: old.history.addLocationChanged, clock: new FakeClock(2_000_000) });
      old.history.flush();
      later.pushLayer("c", () => undefined);
      assert.ok((layerOf(old.history.state)?.seq ?? 0) > lastOld);
    });

    it("numbers above a leftover it could not step over (nothing before it), even when the clock is behind", () => {
      const clock = new FakeClock(1000);
      const history = new FakeHistory({ state: { lu: { layer: { id: "old", seq: 9_000_000 } } }, url: "/kestrel/wildlife" });
      const manager = createLayerManager({ history, addPopstate: history.addPopstate, addLocationChanged: history.addLocationChanged, clock });
      history.flush();
      manager.pushLayer("sheet", () => undefined);
      clock.advance(POP_TIMEOUT_MS);
      assert.ok((layerOf(history.state)?.seq ?? 0) > 9_000_000);
    });
  });
});

describe("a lost popstate", () => {
  it("does not wedge the manager: waiting layers are written when the timeout runs out", () => {
    const { history, clock, manager, closed, open, base } = setup();
    const a = open("a");
    a.close("button");
    history.loseNextPopstate();
    history.flush();
    assert.equal(history.index, base, "history moved, the page never heard about it");
    const b = open("b");
    assert.notEqual(manager.whenSettled(), null);
    clock.advance(POP_TIMEOUT_MS - 1);
    assert.equal(history.index, base, "b is still waiting");
    clock.advance(1);
    assert.equal(history.index, base + 1);
    assert.equal(layerOf(history.state)?.id, "b");
    history.back();
    history.flush();
    assert.equal(b.open, false);
    assert.deepEqual(closed, ["a:button", "b:back"]);
    assert.equal(manager.whenSettled(), null);
  });

  it("also recovers when the traversal went nowhere (past the start of history)", () => {
    const { history, clock, manager, open } = setup();
    const a = open("a");
    // Drop everything before the layer's entry, so `go(-1)` has nowhere to go and fires nothing.
    history.entries.splice(0, history.index);
    history.index = 0;
    a.close("button");
    history.flush();
    assert.equal(history.popstates.length, 0);
    const b = open("b");
    assert.equal(b.open, true);
    assert.equal(history.length, 1, "b is still waiting");
    clock.advance(POP_TIMEOUT_MS);
    assert.equal(history.length, 2);
    assert.equal(manager.layerDepth(), 1);
  });

  it("cancels the timeout when the popstate does arrive", () => {
    const { history, clock, open } = setup();
    open("a").close("button");
    assert.equal(clock.pending, 1);
    history.flush();
    assert.equal(clock.pending, 0);
  });
});

describe("history moved on without us (Home Assistant navigated: a sidebar tap, a link it handled)", () => {
  /** What Home Assistant's own navigate does: push a new entry (its state has no toolkit marker) and announce it. */
  function haNavigates(history: FakeHistory, path: string): void {
    history.pushState({ from: "/kestrel/wildlife" }, "", path);
    history.fireLocationChanged();
  }

  it("closing a layer afterwards (its element was removed with the panel) does not go back over the navigation", () => {
    const { history, closed, open } = setup();
    const sheet = open("sheet");
    history.pushState({ from: "/kestrel/wildlife" }, "", "/lovelace/0");
    sheet.close("api");
    assert.deepEqual(closed, ["sheet:api"]);
    assert.deepEqual(history.traversals, [], "going back would have sent the user back into the panel");
    assert.equal(history.url, "/lovelace/0");
  });

  it("closing a layer while a Home Assistant dialog is open on top of it does not pop the dialog", () => {
    const { history, closed, open } = setup();
    const sheet = open("sheet");
    history.pushState({ dialog: "more-info" }, "");
    sheet.close("api");
    assert.deepEqual(closed, ["sheet:api"]);
    assert.deepEqual(history.traversals, []);
  });

  it("the navigation closes every open layer with the reason navigate and does not touch history", () => {
    const { history, manager, closed, open } = setup();
    open("a");
    open("b");
    haNavigates(history, "/lovelace/0");
    assert.deepEqual(closed, ["b:navigate", "a:navigate"]);
    assert.equal(manager.layerDepth(), 0);
    assert.deepEqual(history.traversals, []);
    assert.equal(history.url, "/lovelace/0");
  });

  it("Back from there steps over the layers' leftover entries and lands on the panel's page", () => {
    const { history, base, open } = setup();
    open("a");
    haNavigates(history, "/lovelace/0");
    history.back();
    history.flush();
    assert.equal(history.index, base, "skipped the leftover sheet entry");
    assert.equal(history.url, "/kestrel/wildlife");
  });

  it("a location-changed while the top layer's own entry is still current changes nothing", () => {
    const { history, manager, closed, open } = setup();
    open("a");
    history.fireLocationChanged();
    assert.equal(manager.layerDepth(), 1);
    assert.deepEqual(closed, []);
  });

  it("a location-changed with no layer open, or before a layer's entry is written, changes nothing", () => {
    const { history, manager, closed, open } = setup();
    history.fireLocationChanged();
    const a = open("a");
    a.close("button");
    const b = open("b");
    history.fireLocationChanged();
    assert.equal(b.open, true);
    assert.equal(manager.layerDepth(), 1);
    assert.deepEqual(closed, ["a:button"]);
  });
});

describe("onClose callbacks", () => {
  it("a throwing callback does not stop the others, and the error is reported", () => {
    const { history, manager, errors } = setup();
    const calls: string[] = [];
    const boom = new Error("boom");
    const a = manager.pushLayer("a", () => {
      calls.push("a");
      throw boom;
    });
    manager.pushLayer("b", () => calls.push("b"));
    a.close("api");
    history.flush();
    assert.deepEqual(calls, ["b", "a"]);
    assert.deepEqual(errors, [boom]);
    assert.equal(manager.layerDepth(), 0);
    const again = manager.pushLayer("c", () => calls.push("c"));
    assert.equal(again.open, true);
  });

  it("never runs one callback inside another", () => {
    const { history, manager } = setup();
    const trace: string[] = [];
    const a = manager.pushLayer("a", (reason) => trace.push(`a:${reason}`));
    manager.pushLayer("b", () => {
      trace.push("b:start");
      a.close("api");
      trace.push("b:end");
    });
    history.back();
    history.flush();
    assert.deepEqual(trace, ["b:start", "b:end", "a:api"]);
    assert.equal(manager.layerDepth(), 0);
  });

  it("lets a callback open the next layer; it is written once the pending history change landed", () => {
    const { history, manager, closed, base } = setup();
    let next: LayerHandle | undefined;
    const a = manager.pushLayer("a", (reason) => {
      closed.push(`a:${reason}`);
      next = manager.pushLayer("next", (why) => closed.push(`next:${why}`));
    });
    a.close("button");
    history.flush();
    assert.equal(next?.open, true);
    assert.equal(layerOf(history.state)?.id, "next");
    assert.equal(history.index, base + 1);
    history.back();
    history.flush();
    assert.deepEqual(closed, ["a:button", "next:back"]);
  });
});

describe("a refused pushState", () => {
  it("keeps the layer usable (it just has no entry for Back), reports the error and never traverses for it", () => {
    const { history, manager, errors, closed } = setup();
    const refusal = new Error("SecurityError");
    const original = history.pushState.bind(history);
    history.pushState = () => {
      throw refusal;
    };
    const lengthBefore = history.length;
    const sheet = manager.pushLayer("sheet", (reason) => closed.push(`sheet:${reason}`));
    history.pushState = original;
    assert.deepEqual(errors, [refusal]);
    assert.equal(sheet.open, true);
    assert.equal(history.length, lengthBefore);
    sheet.close("button");
    history.flush();
    assert.deepEqual(closed, ["sheet:button"]);
    assert.deepEqual(history.traversals, []);
  });
});

describe("whenSettled and dispose", () => {
  it("is null when idle, a promise while a traversal is under way, and resolves when it lands", async () => {
    const { history, manager, open } = setup();
    assert.equal(manager.whenSettled(), null);
    open("a").close("button");
    const waiting = manager.whenSettled();
    assert.notEqual(waiting, null);
    let resolved = false;
    void waiting?.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    assert.equal(resolved, false);
    history.flush();
    await Promise.resolve();
    assert.equal(resolved, true);
    assert.equal(manager.whenSettled(), null);
  });

  it("dispose stops listening, clears the timer and releases anyone waiting", async () => {
    const { history, clock, manager, open } = setup();
    open("a").close("button");
    const waiting = manager.whenSettled();
    manager.dispose();
    assert.equal(history.listeners, 0);
    assert.equal(history.locationListeners, 0);
    assert.equal(clock.pending, 0);
    await waiting;
  });
});
