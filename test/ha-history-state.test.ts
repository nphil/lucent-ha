import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { depthOf, layerSeqOf, tabOf, withLu } from "../src/ha/history-state.ts";

/** What other scripts or older builds might have left in `history.state`. */
const junk: unknown[] = [null, undefined, "text", 42, true, [], [1, 2], { lu: null }, { lu: "x" }, { lu: [] }, { lu: 5 }];

describe("reading the marker is forgiving", () => {
  it("anything that is not our marker reads as nothing", () => {
    for (const state of junk) {
      assert.equal(depthOf(state), 0, String(state));
      assert.equal(layerSeqOf(state), 0, String(state));
      assert.equal(tabOf(state), undefined, String(state));
    }
  });

  it("reads a good depth and refuses bad ones", () => {
    assert.equal(depthOf({ lu: { depth: 3 } }), 3);
    for (const depth of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "2", null, {}]) {
      assert.equal(depthOf({ lu: { depth } }), 0, String(depth));
    }
  });

  it("reads a good layer number and refuses bad ones", () => {
    assert.equal(layerSeqOf({ lu: { layer: { id: "sheet", seq: 1700000000001 } } }), 1700000000001);
    for (const seq of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, "7", null]) {
      assert.equal(layerSeqOf({ lu: { layer: { id: "sheet", seq } } }), 0, String(seq));
    }
    assert.equal(layerSeqOf({ lu: { layer: "sheet" } }), 0);
    assert.equal(layerSeqOf({ lu: { layer: null } }), 0);
  });

  it("reads a tab stamp; the marker flag only counts when it is exactly true", () => {
    assert.deepEqual(tabOf({ lu: { tab: { id: "wildlife", marker: true } } }), { id: "wildlife", marker: true });
    assert.deepEqual(tabOf({ lu: { tab: { id: "live" } } }), { id: "live", marker: false });
    assert.deepEqual(tabOf({ lu: { tab: { id: "live", marker: "yes" } } }), { id: "live", marker: false });
    for (const tab of [{ id: "" }, { id: 7 }, { marker: true }, "live", null]) {
      assert.equal(tabOf({ lu: { tab } }), undefined, JSON.stringify(tab));
    }
  });
});

describe("withLu", () => {
  it("keeps every foreign key and every field of lu the patch does not mention", () => {
    const state = { root: true, from: "/lovelace/0", dialog: "x", lu: { depth: 2, tab: { id: "wildlife" }, future: { kept: 1 } } };
    const next = withLu(state, { layer: { id: "sheet", seq: 9 } });
    assert.deepEqual(next, { root: true, from: "/lovelace/0", dialog: "x", lu: { depth: 2, tab: { id: "wildlife" }, future: { kept: 1 }, layer: { id: "sheet", seq: 9 } } });
  });

  it("replaces fields the patch mentions and removes the ones it sets to undefined", () => {
    const next = withLu({ lu: { depth: 2, tab: { id: "wildlife", marker: true }, layer: { id: "a", seq: 1 } } }, { depth: 3, tab: undefined });
    assert.deepEqual(next, { lu: { depth: 3, layer: { id: "a", seq: 1 } } });
  });

  it("does not change what it was given", () => {
    const state = { lu: { depth: 1 } };
    const copy = structuredClone(state);
    withLu(state, { depth: 2 });
    assert.deepEqual(state, copy);
  });

  it("starts from an empty state when the old one is not a plain object", () => {
    for (const state of junk) {
      const next = withLu(state, { depth: 1 });
      assert.deepEqual(next, { lu: { depth: 1 } }, String(state));
    }
  });

  it("produces plain data the browser can store (no functions, no class instances)", () => {
    const next = withLu({ root: true }, { depth: 1, tab: { id: "a", marker: true }, layer: { id: "b", seq: 3 } });
    assert.deepEqual(structuredClone(next), next);
  });
});
