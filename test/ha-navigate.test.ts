import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHistoryNavigator, findHaNavigate } from "../src/ha/navigate.ts";
import { createLayerManager } from "../src/ha/layers.ts";
import { FakeClock, FakeHistory, createWorld, settle } from "./ha-fakes.ts";

interface FakeNode {
  localName?: string;
  parentNode?: FakeNode | null;
  host?: FakeNode | null;
  navigate?: (path: string, options: unknown) => unknown;
}

const asTarget = (node: FakeNode): EventTarget => node as unknown as EventTarget;

describe("findHaNavigate: the walk up to ha-panel-custom", () => {
  function tree() {
    const calls: Array<{ self: unknown; path: string; options: unknown }> = [];
    const haPanel: FakeNode = {
      localName: "ha-panel-custom",
      parentNode: null,
      navigate(path, options) {
        calls.push({ self: this, path, options });
        return true;
      },
    };
    // ha-panel-custom > kestrel-panel (light DOM child) > #shadow-root > lu-app-shell > #shadow-root > button
    const panel: FakeNode = { localName: "kestrel-panel", parentNode: haPanel };
    const panelShadow: FakeNode = { host: panel, parentNode: null };
    const shell: FakeNode = { localName: "kestrel-lu-app-shell", parentNode: panelShadow };
    const shellShadow: FakeNode = { host: shell, parentNode: null };
    const button: FakeNode = { localName: "button", parentNode: shellShadow };
    return { calls, haPanel, button, panel };
  }

  it("finds Home Assistant's navigate from deep inside nested shadow roots, and calls it on its own element", () => {
    const { calls, haPanel, button } = tree();
    const navigate = findHaNavigate(asTarget(button));
    assert.ok(navigate);
    navigate("/kestrel/visit", { replace: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.self, haPanel);
    assert.equal(calls[0]?.path, "/kestrel/visit");
    assert.deepEqual(calls[0]?.options, { replace: true });
  });

  it("finds it from the panel element itself and from ha-panel-custom itself", () => {
    const { haPanel, panel } = tree();
    assert.ok(findHaNavigate(asTarget(panel)));
    assert.ok(findHaNavigate(asTarget(haPanel)));
  });

  it("returns null without a starting point, outside Home Assistant, and for an old ha-panel-custom without navigate", () => {
    assert.equal(findHaNavigate(null), null);
    assert.equal(findHaNavigate(new EventTarget()), null);
    const lonely: FakeNode = { localName: "div", parentNode: { localName: "body", parentNode: null } };
    assert.equal(findHaNavigate(asTarget(lonely)), null);
    const old: FakeNode = { localName: "ha-panel-custom", parentNode: null };
    const inside: FakeNode = { localName: "kestrel-panel", parentNode: old };
    assert.equal(findHaNavigate(asTarget(inside)), null);
  });
});

describe("navigate through Home Assistant's own navigate", () => {
  it("pushes one entry, and the toolkit's marker is already in it when location-changed fires", async () => {
    const w = createWorld();
    const lengthBefore = w.history.length;
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1");
    assert.equal(w.history.url, "/kestrel/live", "Home Assistant navigates asynchronously");
    await settle();
    assert.equal(w.history.url, "/kestrel/visit?v=1");
    assert.equal(w.history.length, lengthBefore + 1);
    assert.deepEqual(w.history.state, { from: "/kestrel/live", lu: { depth: 1 } });
    assert.equal(w.locationChanges.length, 1);
    assert.deepEqual(w.locationChanges[0]?.state, { from: "/kestrel/live", lu: { depth: 1 } });
    assert.equal(w.navigator.canGoBack(), true);
  });

  it("stamps the marker afterwards when an older Home Assistant drops `data`", async () => {
    const w = createWorld({ ha: { flavor: "legacy" } });
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1");
    await settle();
    assert.deepEqual(w.history.state, { lu: { depth: 1 } });
    assert.equal(w.navigator.canGoBack(), true);
  });

  it("replace swaps the entry and keeps the depth", async () => {
    const w = createWorld();
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1");
    await settle();
    const lengthBefore = w.history.length;
    w.navigator.navigate(w.panel, "/kestrel/visit?v=2", { replace: true });
    await settle();
    assert.equal(w.history.length, lengthBefore);
    assert.equal(w.history.url, "/kestrel/visit?v=2");
    assert.equal((w.history.state as { lu: { depth: number } }).lu.depth, 1);
    assert.equal(w.locationChanges[1]?.replace, true);
  });

  it("keeps the caller's data next to the marker, and the caller cannot overwrite the marker", async () => {
    const w = createWorld();
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1", { data: { camera: 3, lu: { depth: 99 } } });
    await settle();
    assert.deepEqual(w.history.state, { camera: 3, from: "/kestrel/live", lu: { depth: 1 } });
  });

  it("changes nothing when Home Assistant refuses (a dialog would not close)", async () => {
    const w = createWorld({ ha: { refuse: true } });
    const lengthBefore = w.history.length;
    const navigated = await w.navigator.navigateStamped(w.panel, "/kestrel/visit?v=1", {}, {});
    assert.equal(navigated, false);
    assert.equal(w.history.length, lengthBefore);
    assert.equal(w.history.state, null);
    assert.equal(w.locationChanges.length, 0);
    assert.equal(w.navigator.canGoBack(), false);
  });

  it("restores the marker after Home Assistant replaced the first entry (it keeps only `root`)", async () => {
    const w = createWorld({ first: { state: { root: true }, url: "/kestrel/live" } });
    await w.navigator.navigateStamped(w.panel, "/kestrel/wildlife", { replace: true }, { tab: { id: "wildlife" } });
    assert.deepEqual(w.history.state, { root: true, lu: { depth: 0, tab: { id: "wildlife" } } });
  });

  it("leaves a replaced first entry as Home Assistant wrote it when there is nothing to stamp", async () => {
    const w = createWorld({ first: { state: { root: true }, url: "/kestrel/live" } });
    w.navigator.navigate(w.panel, "/kestrel/wildlife", { replace: true });
    await settle();
    assert.deepEqual(w.history.state, { root: true });
    assert.equal(w.navigator.canGoBack(), false);
  });

  it("a replace keeps the entry's tab stamp, a push does not copy it", async () => {
    const w = createWorld({ first: { state: { lu: { tab: { id: "live" } } }, url: "/kestrel/live" } });
    w.navigator.navigate(w.panel, "/kestrel/live?camera=3", { replace: true });
    await settle();
    assert.deepEqual((w.history.state as { lu: unknown }).lu, { depth: 0, tab: { id: "live" } });
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1");
    await settle();
    assert.deepEqual((w.history.state as { lu: unknown }).lu, { depth: 1 });
  });
});

describe("navigate without Home Assistant above the element (a card, the dev harness)", () => {
  it("uses pushState at once and announces location-changed", () => {
    const w = createWorld({ ha: "none" });
    const lengthBefore = w.history.length;
    w.navigator.navigate(null, "/kestrel/visit?v=1");
    assert.equal(w.history.url, "/kestrel/visit?v=1");
    assert.equal(w.history.length, lengthBefore + 1);
    assert.deepEqual(w.history.state, { lu: { depth: 1 } });
    assert.equal(w.locationChanges.length, 1);
    assert.equal(w.locationChanges[0]?.replace, false);
    assert.equal(w.locationChanges[0]?.url, "/kestrel/visit?v=1");
  });

  it("uses replaceState for replace, with the same depth", async () => {
    const w = createWorld({ ha: "none" });
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1");
    await settle();
    const lengthBefore = w.history.length;
    w.navigator.navigate(w.panel, "/kestrel/visit?v=2", { replace: true });
    assert.equal(w.history.length, lengthBefore);
    assert.equal((w.history.state as { lu: { depth: number } }).lu.depth, 1);
    assert.equal(w.locationChanges[1]?.replace, true);
  });
});

describe("navigations queue up", () => {
  it("two quick pushes land in order, one level deeper each", async () => {
    const w = createWorld();
    w.navigator.navigate(w.panel, "/a");
    w.navigator.navigate(w.panel, "/b");
    await settle();
    const urls = w.history.entries.map((entry) => entry.url);
    assert.deepEqual(urls.slice(-3), ["/kestrel/live", "/a", "/b"]);
    assert.equal((w.history.entries[w.history.index - 1]?.state as { lu: { depth: number } }).lu.depth, 1);
    assert.equal((w.history.state as { lu: { depth: number } }).lu.depth, 2);
  });

  it("a replace right after a push replaces the pushed entry and does not reset the depth", async () => {
    const w = createWorld();
    const lengthBefore = w.history.length;
    w.navigator.navigate(w.panel, "/a");
    w.navigator.navigate(w.panel, "/b", { replace: true });
    await settle();
    assert.equal(w.history.length, lengthBefore + 1);
    assert.equal(w.history.url, "/b");
    assert.equal(w.navigator.canGoBack(), true);
  });

  it("an error from Home Assistant is reported and does not block the next navigation", async () => {
    const history = new FakeHistory({ url: "/kestrel/live" });
    const errors: unknown[] = [];
    const boom = new Error("dialog exploded");
    let fail = true;
    const navigator = createHistoryNavigator({
      history,
      layers: createLayerManager({ history, addPopstate: history.addPopstate, addLocationChanged: history.addLocationChanged, clock: new FakeClock() }),
      announce: () => undefined,
      onError: (error) => errors.push(error),
      findHaNavigate: () => async (path) => {
        if (fail) throw boom;
        history.pushState({ lu: { depth: 1 } }, "", path);
        return true;
      },
    });
    navigator.navigate(null, "/a");
    fail = false;
    navigator.navigate(null, "/b");
    await settle();
    assert.deepEqual(errors, [boom]);
    assert.equal(history.url, "/b");
  });
});

describe("navigate and open layers", () => {
  it("closes them with the reason navigate and does not touch history for them", async () => {
    const w = createWorld();
    const closed: string[] = [];
    w.layers.pushLayer("sheet", (reason) => closed.push(reason));
    const base = w.history.index - 1;
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1");
    assert.deepEqual(closed, ["navigate"], "the sheet is gone at once, before the page changes");
    await settle();
    assert.deepEqual(w.history.traversals, []);
    const layerEntry = w.history.entries[base + 1]?.state as { lu: { layer: { id: string } } };
    assert.equal(layerEntry.lu.layer.id, "sheet", "its entry stays behind as a leftover");
    assert.equal(w.history.url, "/kestrel/visit?v=1");
    assert.equal(w.history.index, base + 2);
  });

  it("waits for a close that is still on its way, so the late traversal cannot undo the navigation", async () => {
    const w = createWorld();
    const sheet = w.layers.pushLayer("sheet", () => undefined);
    sheet.close("button");
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1");
    await settle();
    assert.equal(w.history.url, "/kestrel/live", "still waiting for the sheet's traversal");
    assert.equal(w.history.pending, 1);
    w.history.flush();
    await settle();
    assert.equal(w.history.url, "/kestrel/visit?v=1");
    assert.equal(w.history.index, w.history.length - 1, "the visit is the newest entry: nothing went back over it");
    assert.deepEqual(w.history.traversals, [-1]);
  });
});

describe("canGoBack and goBack", () => {
  it("a deep link (nothing before it in this panel session) cannot go back", () => {
    const w = createWorld({ first: { url: "/kestrel/visit?v=9" } });
    assert.equal(w.navigator.canGoBack(), false);
  });

  it("goBack on a deep link replaces the page with the fallback: it never strands the user or leaves the panel", async () => {
    const w = createWorld({ first: { url: "/kestrel/visit?v=9" } });
    const lengthBefore = w.history.length;
    w.navigator.goBack(w.panel, "/kestrel/live");
    await settle();
    assert.equal(w.history.url, "/kestrel/live");
    assert.equal(w.history.length, lengthBefore);
    assert.deepEqual(w.history.traversals, []);
    assert.equal(w.locationChanges[0]?.replace, true);
    assert.equal(w.navigator.canGoBack(), false);
  });

  it("goBack after an in-panel navigation goes back one entry", async () => {
    const w = createWorld();
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1");
    await settle();
    assert.equal(w.navigator.canGoBack(), true);
    w.navigator.goBack(w.panel, "/kestrel/live");
    await settle();
    assert.deepEqual(w.history.traversals, [-1]);
    w.history.flush();
    assert.equal(w.history.url, "/kestrel/live");
    assert.equal(w.navigator.canGoBack(), false);
  });

  it("the marker survives a reload: a new navigator on the same history still can go back", async () => {
    const w = createWorld();
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1");
    await settle();
    const reloaded = createHistoryNavigator({ history: w.history, layers: w.layers });
    assert.equal(reloaded.canGoBack(), true);
  });

  it("goBack closes the top open layer first, even on a deep link, and does not navigate", async () => {
    const w = createWorld({ first: { url: "/kestrel/visit?v=9" } });
    const closed: string[] = [];
    w.layers.pushLayer("sheet", (reason) => closed.push(reason));
    w.navigator.goBack(w.panel, "/kestrel/live");
    await settle();
    assert.deepEqual(closed, ["back"]);
    w.history.flush();
    assert.equal(w.history.url, "/kestrel/visit?v=9");
    assert.equal(w.locationChanges.length, 0);
  });

  it("goBack waits for a close that is still on its way before it goes back", async () => {
    const w = createWorld();
    w.navigator.navigate(w.panel, "/kestrel/visit?v=1");
    await settle();
    const sheet = w.layers.pushLayer("sheet", () => undefined);
    sheet.close("button");
    w.navigator.goBack(w.panel, "/kestrel/live");
    await settle();
    assert.deepEqual(w.history.traversals, [-1], "only the sheet's traversal so far");
    w.history.flush();
    await settle();
    assert.deepEqual(w.history.traversals, [-1, -1]);
    w.history.flush();
    assert.equal(w.history.url, "/kestrel/live");
  });
});
