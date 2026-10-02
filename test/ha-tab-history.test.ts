import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TabHistory } from "../src/ha/tab-history.ts";
import { createWorld, settle } from "./ha-fakes.ts";
import type { World } from "./ha-fakes.ts";

const PATHS: Record<string, string> = { live: "/kestrel/live", wildlife: "/kestrel/wildlife", insights: "/kestrel/insights" };

function luOf(state: unknown): { depth?: number; tab?: { id: string; marker?: boolean }; layer?: unknown } {
  return (state as { lu?: never } | null)?.lu ?? {};
}

/** Selects a tab the way the app shell does and lets Home Assistant's asynchronous navigate land. */
async function select(world: World, tabs: TabHistory, id: string): Promise<void> {
  tabs.select(id, PATHS[id] ?? `/kestrel/${id}`, world.panel);
  await settle();
}

describe("leaving the default tab", () => {
  it("pushes exactly ONE marker entry and remembers which tab the entry we left belongs to", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    const lengthBefore = w.history.length;
    await select(w, tabs, "wildlife");
    assert.equal(w.history.length, lengthBefore + 1);
    assert.equal(w.history.url, "/kestrel/wildlife");
    assert.deepEqual(luOf(w.history.state).tab, { id: "wildlife", marker: true });
    assert.deepEqual(luOf(w.history.entries[w.history.index - 1]?.state).tab, { id: "live" });
    assert.equal(tabs.current, "wildlife");
  });

  it("works the same without Home Assistant above the panel", async () => {
    const w = createWorld({ ha: "none" });
    const tabs = w.makeTabs({ defaultId: "live" });
    const lengthBefore = w.history.length;
    await select(w, tabs, "wildlife");
    assert.equal(w.history.length, lengthBefore + 1);
    assert.deepEqual(luOf(w.history.state).tab, { id: "wildlife", marker: true });
  });
});

describe("switching between other tabs", () => {
  it("replaces the entry and keeps the marker, so history never grows past that one entry", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    await select(w, tabs, "wildlife");
    const lengthAfterMarker = w.history.length;
    await select(w, tabs, "insights");
    await select(w, tabs, "wildlife");
    await select(w, tabs, "insights");
    assert.equal(w.history.length, lengthAfterMarker);
    assert.equal(w.history.url, "/kestrel/insights");
    assert.deepEqual(luOf(w.history.state).tab, { id: "insights", marker: true });
    assert.equal(tabs.current, "insights");
  });
});

describe("going back to the default tab", () => {
  it("while the marker is current it pops the marker instead of pushing", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    const lengthBefore = w.history.length;
    await select(w, tabs, "wildlife");
    await select(w, tabs, "live");
    assert.deepEqual(w.history.traversals, [-1]);
    w.history.flush();
    assert.equal(w.history.url, "/kestrel/live");
    assert.equal(w.history.length, lengthBefore + 1, "the marker is still there, ahead of us, and will be replaced by the next push");
    assert.equal(tabs.current, "live");
  });

  it("tells nobody about a change the app made itself", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    const seen: string[] = [];
    tabs.onChange((id) => seen.push(id));
    await select(w, tabs, "wildlife");
    await select(w, tabs, "live");
    w.history.flush();
    assert.deepEqual(seen, []);
  });

  it("with a sheet open on the marker, the sheet and the marker go in one step and the sheet hears navigate", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    await select(w, tabs, "wildlife");
    const sheetEvents: string[] = [];
    w.layers.pushLayer("species", (reason) => sheetEvents.push(reason));
    await select(w, tabs, "live");
    assert.deepEqual(sheetEvents, ["navigate"]);
    assert.deepEqual(w.history.traversals, [-2]);
    w.history.flush();
    assert.equal(w.history.url, "/kestrel/live");
    assert.equal(tabs.current, "live");
  });

  it("a full round trip leaves the history as it was", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    const start = w.history.index;
    await select(w, tabs, "wildlife");
    await select(w, tabs, "insights");
    await select(w, tabs, "live");
    w.history.flush();
    assert.equal(w.history.index, start);
    assert.equal(w.history.url, "/kestrel/live");
  });
});

describe("system Back", () => {
  it("from a non-default tab returns to the default tab; the next Back leaves the panel", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    const seen: string[] = [];
    tabs.onChange((id) => seen.push(id));
    await select(w, tabs, "wildlife");
    await select(w, tabs, "insights");

    w.history.back();
    w.history.flush();
    assert.equal(w.history.url, "/kestrel/live");
    assert.equal(tabs.current, "live");
    assert.deepEqual(seen, ["live"]);

    w.history.back();
    w.history.flush();
    assert.equal(w.history.url, "/lovelace/0", "the second Back left the panel");
    assert.deepEqual(seen, ["live"], "the page we came from is not one of ours");
  });

  it("Forward goes to the other tab again and announces it", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    const seen: string[] = [];
    await select(w, tabs, "wildlife");
    tabs.onChange((id) => seen.push(id));
    w.history.back();
    w.history.flush();
    w.history.forward();
    w.history.flush();
    assert.equal(w.history.url, "/kestrel/wildlife");
    assert.deepEqual(seen, ["live", "wildlife"]);
    assert.equal(tabs.current, "wildlife");
  });

  it("a Back that lands on an entry of the same tab (a sheet closing) announces nothing", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    await select(w, tabs, "wildlife");
    const seen: string[] = [];
    tabs.onChange((id) => seen.push(id));
    w.layers.pushLayer("species", () => undefined);
    w.history.back();
    w.history.flush();
    assert.deepEqual(seen, []);
    assert.equal(tabs.current, "wildlife");
  });

  it("stops calling a listener once it unsubscribed", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    await select(w, tabs, "wildlife");
    const seen: string[] = [];
    const stop = tabs.onChange((id) => seen.push(id));
    stop();
    w.history.back();
    w.history.flush();
    assert.deepEqual(seen, []);
  });

  it("a throwing listener does not stop the others and the error is reported", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    await select(w, tabs, "wildlife");
    const seen: string[] = [];
    const boom = new Error("listener");
    tabs.onChange(() => {
      throw boom;
    });
    tabs.onChange((id) => seen.push(id));
    w.history.back();
    w.history.flush();
    assert.deepEqual(seen, ["live"]);
    assert.deepEqual(w.errors, [boom]);
  });
});

describe("a panel that opens on another tab (deep link)", () => {
  it("starts on that tab; choosing the default tab replaces instead of popping", async () => {
    const w = createWorld({ first: { url: "/kestrel/wildlife" } });
    const tabs = w.makeTabs({ defaultId: "live", initialId: "wildlife" });
    assert.equal(tabs.current, "wildlife");
    const lengthBefore = w.history.length;
    await select(w, tabs, "live");
    assert.equal(w.history.length, lengthBefore);
    assert.deepEqual(w.history.traversals, [], "there is no default entry under a deep link to go back to");
    assert.equal(w.history.url, "/kestrel/live");
    assert.equal(tabs.current, "live");
  });

  it("leaving the default tab afterwards pushes the marker as usual", async () => {
    const w = createWorld({ first: { url: "/kestrel/wildlife" } });
    const tabs = w.makeTabs({ defaultId: "live", initialId: "wildlife" });
    await select(w, tabs, "live");
    const lengthBefore = w.history.length;
    await select(w, tabs, "insights");
    assert.equal(w.history.length, lengthBefore + 1);
    assert.deepEqual(luOf(w.history.state).tab, { id: "insights", marker: true });
  });

  it("switching to a third tab on a deep link replaces without a marker", async () => {
    const w = createWorld({ first: { url: "/kestrel/wildlife" } });
    const tabs = w.makeTabs({ defaultId: "live", initialId: "wildlife" });
    const lengthBefore = w.history.length;
    await select(w, tabs, "insights");
    assert.equal(w.history.length, lengthBefore);
    assert.deepEqual(luOf(w.history.state).tab, { id: "insights" });
  });
});

describe("reload and repeated choices", () => {
  it("a reloaded panel finds its tab and its marker in the history entry", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    await select(w, tabs, "wildlife");
    tabs.dispose();
    const reloaded = w.makeTabs({ defaultId: "live" });
    assert.equal(reloaded.current, "wildlife");
    await select(w, reloaded, "live");
    assert.deepEqual(w.history.traversals, [-1], "the marker was recognised, so choosing home pops it");
  });

  it("choosing the tab that is already showing does nothing", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    const before = JSON.stringify(w.history.entries);
    await select(w, tabs, "live");
    assert.equal(JSON.stringify(w.history.entries), before);
    assert.deepEqual(w.history.traversals, []);
    assert.equal(w.locationChanges.length, 0);
  });

  it("dispose stops listening to history", () => {
    const w = createWorld();
    const before = w.history.listeners;
    const tabs = w.makeTabs({ defaultId: "live" });
    assert.equal(w.history.listeners, before + 1);
    tabs.dispose();
    assert.equal(w.history.listeners, before);
  });
});

describe("when the navigation does not happen", () => {
  it("goes back to the previous tab if Home Assistant refuses to navigate", async () => {
    const w = createWorld({ ha: { refuse: true } });
    const tabs = w.makeTabs({ defaultId: "live" });
    const lengthBefore = w.history.length;
    await select(w, tabs, "wildlife");
    assert.equal(tabs.current, "live");
    assert.equal(w.history.length, lengthBefore);
    assert.equal(w.history.url, "/kestrel/live");
  });
});
