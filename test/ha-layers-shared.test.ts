import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import * as layers from "../src/ha/layers.ts";
import { FakeHistory } from "./ha-fakes.ts";

type LayersModule = typeof layers;

describe("one layer manager per page", () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const SHARED = Symbol.for("lucent-ha:layers");
  const slot = globalThis as unknown as Record<symbol, { apiVersion?: unknown } | undefined>;
  let history: FakeHistory;
  const popstateListeners = new Set<unknown>();
  /** Read through a function so the compiler does not remember what an earlier assert said about the slot. */
  const installed = (): { apiVersion?: unknown } | undefined => slot[SHARED];

  before(() => {
    history = new FakeHistory({ url: "/kestrel/live" }, [{ state: null, url: "/lovelace/0" }]);
    globals.window = {
      history,
      addEventListener: (type: string, listener: (event: { state: unknown }) => void) => {
        if (type !== "popstate") return;
        popstateListeners.add(listener);
        history.addPopstate(listener);
      },
      removeEventListener: (type: string, listener: unknown) => {
        if (type === "popstate") popstateListeners.delete(listener);
      },
    };
  });

  after(() => {
    delete globals.window;
    delete slot[SHARED];
  });

  it("is created on first use, not on import, and parked on globalThis with an apiVersion", () => {
    assert.equal(installed(), undefined);
    layers.pushLayer("sheet", () => undefined);
    assert.equal(installed()?.apiVersion, 1);
    assert.equal(layers.layerDepth(), 1);
    assert.equal(popstateListeners.size, 1);
  });

  it("a second copy of the toolkit (another bundle on the page) shares it instead of adding a second listener", async () => {
    // A dynamic import on purpose: the query string makes Node load the file a second time, which stands in for another
    // bundle of the toolkit on the same page. A static import would hand back the first instance.
    const specifier = "../src/ha/layers.ts?another-bundle";
    const other = (await import(specifier)) as LayersModule;
    assert.notEqual(other.pushLayer, layers.pushLayer, "really a second module instance");
    assert.equal(other.layerDepth(), 1, "sees the layer the first copy opened");
    const closed: string[] = [];
    other.pushLayer("picker", (reason) => closed.push(`picker:${reason}`));
    assert.equal(layers.layerDepth(), 2);
    assert.equal(popstateListeners.size, 1, "still ONE popstate listener on the page");
    history.back();
    history.flush();
    assert.deepEqual(closed, ["picker:back"], "one Back press is handled once");
    assert.equal(layers.closeTopLayer("api"), true, "closeTopLayer works from either copy and sees the same stack");
    assert.equal(other.layerDepth(), 0);
  });

  it("refuses a manager with an unknown apiVersion rather than letting two managers fight over Back", () => {
    const real = slot[SHARED];
    slot[SHARED] = { apiVersion: 99 };
    try {
      assert.throws(() => layers.layerDepth(), /apiVersion 99/);
    } finally {
      slot[SHARED] = real;
    }
  });
});
