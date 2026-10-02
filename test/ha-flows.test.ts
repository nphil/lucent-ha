/** Whole stories on one fake history: the real tab history, layer manager and navigator working together, the way a
 * Kestrel panel uses them. Each test is something Nitin does with his thumb or his keyboard. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldEscapeNavigateBack } from "../src/ha/escape.ts";
import type { EscapeEnv } from "../src/ha/escape.ts";
import { createWorld, settle } from "./ha-fakes.ts";
import type { World } from "./ha-fakes.ts";

const OTHER_PAGE = "/lovelace/0";

/** Presses the system Back button and lets every consequence (bounces included) play out. */
async function systemBack(world: World): Promise<void> {
  world.history.back();
  for (let i = 0; i < 6; i++) {
    world.history.flush();
    await settle();
  }
}

describe("Back walks out of the panel one meaningful step at a time", () => {
  it("sheet, then the other tab, then home tab, then out of the panel", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    const tabChanges: string[] = [];
    tabs.onChange((id) => tabChanges.push(id));
    const sheetEvents: string[] = [];

    tabs.select("wildlife", "/kestrel/wildlife", w.panel);
    await settle();
    w.layers.pushLayer("species", (reason) => sheetEvents.push(reason));
    assert.equal(w.history.url, "/kestrel/wildlife");

    await systemBack(w);
    assert.deepEqual(sheetEvents, ["back"], "first Back closes only the sheet");
    assert.equal(w.history.url, "/kestrel/wildlife");
    assert.deepEqual(tabChanges, []);

    await systemBack(w);
    assert.equal(w.history.url, "/kestrel/live", "second Back returns to the home tab");
    assert.deepEqual(tabChanges, ["live"]);

    await systemBack(w);
    assert.equal(w.history.url, OTHER_PAGE, "third Back leaves the panel");
    assert.deepEqual(w.errors, []);
  });

  it("tab switching never fills the Back stack, however many times he taps", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    const start = w.history.length;
    for (const id of ["wildlife", "insights", "wildlife", "insights", "wildlife"]) {
      tabs.select(id, `/kestrel/${id}`, w.panel);
      await settle();
    }
    assert.equal(w.history.length, start + 1, "exactly one entry more than the home tab alone");
  });
});

describe("a sheet that leads to another page", () => {
  it("the sheet closes, the page changes, and Back lands on the page the sheet was on without a ghost step", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    tabs.select("wildlife", "/kestrel/wildlife", w.panel);
    await settle();
    const wildlifeEntry = w.history.index;
    const sheetEvents: string[] = [];
    w.layers.pushLayer("species", (reason) => sheetEvents.push(reason));

    w.navigator.navigate(w.panel, "/kestrel/visit?v=7");
    await settle();
    assert.deepEqual(sheetEvents, ["navigate"]);
    assert.equal(w.history.url, "/kestrel/visit?v=7");
    assert.equal(w.navigator.canGoBack(), true);

    w.navigator.goBack(w.panel, "/kestrel/live");
    for (let i = 0; i < 4; i++) {
      await settle();
      w.history.flush();
    }
    assert.equal(w.history.url, "/kestrel/wildlife");
    assert.equal(w.history.index, wildlifeEntry, "landed on the Wildlife entry itself, the leftover sheet entry was skipped");
    assert.equal(tabs.current, "wildlife");
    assert.deepEqual(w.errors, []);
  });

  it("closing the sheet and navigating in the same tick still ends on the new page", async () => {
    const w = createWorld();
    const sheet = w.layers.pushLayer("species", () => undefined);
    sheet.close("button");
    w.navigator.navigate(w.panel, "/kestrel/visit?v=7");
    for (let i = 0; i < 4; i++) {
      await settle();
      w.history.flush();
    }
    assert.equal(w.history.url, "/kestrel/visit?v=7");
    assert.equal(w.history.index, w.history.length - 1);
    assert.equal(w.navigator.canGoBack(), true);
  });

  it("closing one sheet and opening the next in the same tick leaves exactly one layer entry", async () => {
    const w = createWorld();
    const first = w.layers.pushLayer("species", () => undefined);
    const events: string[] = [];
    first.close("button");
    const second = w.layers.pushLayer("correction", (reason) => events.push(reason));
    for (let i = 0; i < 3; i++) {
      await settle();
      w.history.flush();
    }
    assert.equal(second.open, true);
    assert.equal(w.layers.layerDepth(), 1);
    await systemBack(w);
    assert.deepEqual(events, ["back"]);
    assert.equal(w.history.url, "/kestrel/live");
    assert.equal(w.history.index, w.history.length - 2, "one leftover forward entry, nothing under us was lost");
  });
});

describe("a visit opened from a notification (a deep link)", () => {
  it("has no way back inside the panel, so the arrow replaces the page with the live view and never leaves", async () => {
    const w = createWorld({ first: { url: "/kestrel/visit?v=9" } });
    assert.equal(w.navigator.canGoBack(), false);
    w.navigator.goBack(w.panel, "/kestrel/live");
    await settle();
    assert.equal(w.history.url, "/kestrel/live");
    assert.deepEqual(w.history.traversals, []);
    await systemBack(w);
    assert.equal(w.history.url, OTHER_PAGE, "Back from there leaves the panel as it would from any first page");
  });

  it("a visit opened inside the panel goes back to where it was opened from", async () => {
    const w = createWorld();
    const tabs = w.makeTabs({ defaultId: "live" });
    tabs.select("wildlife", "/kestrel/wildlife", w.panel);
    await settle();
    w.navigator.navigate(w.panel, "/kestrel/visit?v=3");
    await settle();
    assert.equal(w.navigator.canGoBack(), true);
    w.navigator.goBack(w.panel, "/kestrel/live");
    await settle();
    w.history.flush();
    assert.equal(w.history.url, "/kestrel/wildlife");
  });
});

describe("Escape on a keyboard", () => {
  function escapeEnv(world: World): EscapeEnv {
    return { activeElement: () => null, ownsEscape: () => false, insideOverlay: () => false, layerDepth: () => world.layers.layerDepth() };
  }
  const escape = { key: "Escape", defaultPrevented: false, repeat: false, isComposing: false, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false } as unknown as KeyboardEvent;

  it("closes the sheet first; only a second Escape goes back a page", async () => {
    const w = createWorld({ first: { url: "/kestrel/visit?v=9" } });
    const events: string[] = [];
    w.layers.pushLayer("species", (reason) => events.push(reason));

    assert.equal(shouldEscapeNavigateBack(escape, escapeEnv(w)), false, "a layer is open: the sheet handles Escape itself");
    w.layers.closeTopLayer("escape");
    assert.deepEqual(events, ["escape"]);
    w.history.flush();

    assert.equal(shouldEscapeNavigateBack(escape, escapeEnv(w)), true);
    w.navigator.goBack(w.panel, "/kestrel/live");
    await settle();
    assert.equal(w.history.url, "/kestrel/live");
  });
});

describe("a reload while a sheet was open", () => {
  it("the sheet's entry from before the reload is skipped, so one Back press leaves the panel", async () => {
    const before = createWorld();
    before.layers.pushLayer("species", () => undefined);
    const pageEntry = before.history.index - 1;
    // The page life ends (its managers are gone) but the history, with the sheet's entry in it, stays.
    before.layers.dispose();
    const after = createWorld({ history: before.history, clockStart: 5_000_000 });
    after.history.flush();
    assert.equal(after.history.index, pageEntry, "the new page life stepped over the leftover by itself");
    await systemBack(after);
    assert.equal(after.history.url, OTHER_PAGE);
    assert.deepEqual(after.errors, []);
  });
});
