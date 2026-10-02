import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keyScroll, scrolledTo } from "../src/sheet/sheet-model.ts";

const view = { top: 200, height: 400, scrollHeight: 1500 };

describe("keyScroll: which keys scroll, and which way", () => {
  it("arrows move a line, Page keys and Space a page, Home and End all the way", () => {
    assert.deepEqual(keyScroll("ArrowDown", false), { direction: 1, unit: "line" });
    assert.deepEqual(keyScroll("ArrowUp", false), { direction: -1, unit: "line" });
    assert.deepEqual(keyScroll("PageDown", false), { direction: 1, unit: "page" });
    assert.deepEqual(keyScroll("PageUp", false), { direction: -1, unit: "page" });
    assert.deepEqual(keyScroll("End", false), { direction: 1, unit: "edge" });
    assert.deepEqual(keyScroll("Home", false), { direction: -1, unit: "edge" });
  });

  it("Space goes down, Shift+Space goes up", () => {
    assert.deepEqual(keyScroll(" ", false), { direction: 1, unit: "page" });
    assert.deepEqual(keyScroll(" ", true), { direction: -1, unit: "page" });
  });

  it("every other key does not scroll", () => {
    for (const key of ["Enter", "Tab", "a", "Escape", "ArrowLeft", "ArrowRight", "Shift"]) assert.equal(keyScroll(key, false), null, key);
  });
});

describe("scrolledTo: where a key takes a scroller", () => {
  it("a line is 40 px and a page is 87.5 % of the height", () => {
    assert.equal(scrolledTo({ direction: 1, unit: "line" }, view), 240);
    assert.equal(scrolledTo({ direction: -1, unit: "line" }, view), 160);
    assert.equal(scrolledTo({ direction: 1, unit: "page" }, view), 550);
    assert.equal(scrolledTo({ direction: -1, unit: "page" }, { ...view, top: 900 }), 550);
  });

  it("never goes past the top or the bottom of the content", () => {
    assert.equal(scrolledTo({ direction: -1, unit: "line" }, { ...view, top: 10 }), 0);
    assert.equal(scrolledTo({ direction: 1, unit: "page" }, { ...view, top: 1000 }), 1100);
    assert.equal(scrolledTo({ direction: 1, unit: "line" }, { ...view, top: 1100 }), 1100);
  });

  it("Home goes to the top and End to the bottom", () => {
    assert.equal(scrolledTo({ direction: -1, unit: "edge" }, view), 0);
    assert.equal(scrolledTo({ direction: 1, unit: "edge" }, view), 1100);
  });

  it("content that fits cannot scroll at all", () => {
    for (const unit of ["line", "page", "edge"] as const) {
      for (const direction of [-1, 1] as const) assert.equal(scrolledTo({ direction, unit }, { top: 0, height: 400, scrollHeight: 300 }), 0);
    }
  });
});
