import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SwipeModel, classifyStart, followOpacity } from "../src/sheet/swipe-model.ts";
import type { SwipeNode } from "../src/sheet/swipe-model.ts";
import { SWIPE } from "../src/tokens/constants.ts";

const node = (over: Partial<SwipeNode> = {}): SwipeNode => ({ tag: "div", role: "", inputType: "", scrollTop: 0, handle: false, grab: false, noDrag: false, editable: false, ...over });

describe("classifyStart: what a press at the start of a gesture means", () => {
  it("the handle always drags, with a finger or a mouse", () => {
    const path = [node({ handle: true }), node({ grab: true })];
    assert.equal(classifyStart(path, true), "handle");
    assert.equal(classifyStart(path, false), "handle");
  });

  it("the header band is grabbed by a finger, but a mouse keeps it for selecting text", () => {
    const path = [node({ tag: "h2" }), node({ grab: true })];
    assert.equal(classifyStart(path, true), "handle");
    assert.equal(classifyStart(path, false), "none");
  });

  it("a button, link or field in the header band is not a grab, but a finger may still swipe from it", () => {
    for (const tag of ["button", "a", "select"]) {
      assert.notEqual(classifyStart([node({ tag }), node({ grab: true })], true), "handle", tag);
    }
    assert.equal(classifyStart([node({ tag: "button" }), node({ grab: true })], true), "swipe");
    assert.equal(classifyStart([node({ role: "menuitem" }), node({ grab: true })], true), "swipe");
    assert.equal(classifyStart([node({ tag: "button" }), node({ grab: true })], false), "none");
  });

  it("anywhere else a finger swipes and a mouse does nothing", () => {
    const path = [node({ tag: "p" }), node({ tag: "div" })];
    assert.equal(classifyStart(path, true), "swipe");
    assert.equal(classifyStart(path, false), "none");
  });

  it("buttons and checkboxes in the body do not stop a swipe", () => {
    assert.equal(classifyStart([node({ tag: "button" })], true), "swipe");
    assert.equal(classifyStart([node({ tag: "input", inputType: "checkbox" })], true), "swipe");
  });

  it("sliders, maps and text fields keep their own drags", () => {
    const blocked: Array<Partial<SwipeNode>> = [
      { tag: "input", inputType: "range" },
      { tag: "ha-control-slider" },
      { tag: "ha-map" },
      { tag: "kestrel-lu-slider" },
      { tag: "lu-slider" },
      { tag: "input", inputType: "text" },
      { tag: "input", inputType: "" },
      { tag: "input", inputType: "search" },
      { tag: "textarea" },
      { tag: "select" },
      { editable: true },
      { noDrag: true },
    ];
    for (const over of blocked) assert.equal(classifyStart([node(over), node()], true), "none", JSON.stringify(over));
  });

  it("a slider deeper down the path blocks the swipe too", () => {
    assert.equal(classifyStart([node({ tag: "span" }), node({ tag: "ha-control-slider" }), node()], true), "none");
  });

  it("something already scrolled down owns the move; one at the top does not", () => {
    assert.equal(classifyStart([node({ tag: "li" }), node({ scrollTop: 120 })], true), "none");
    assert.equal(classifyStart([node({ tag: "li" }), node({ scrollTop: 0 })], true), "swipe");
  });

  it("data-no-sheet-drag inside the header band stops the grab and the swipe", () => {
    assert.equal(classifyStart([node({ noDrag: true }), node({ grab: true })], true), "none");
  });
});

describe("SwipeModel: handle drag", () => {
  it("starts at once and follows the finger, never above where it started", () => {
    const model = new SwipeModel();
    assert.equal(model.begin(1, 100, 300, "handle"), "engaged");
    assert.equal(model.dragging, true);
    assert.equal(model.move(1, 100, 340), "drag");
    assert.equal(model.distance, 40);
    assert.equal(model.move(1, 100, 250), "drag");
    assert.equal(model.distance, 0);
  });

  it("dismisses from 24 px, not from 23", () => {
    const short = new SwipeModel();
    short.begin(1, 0, 0, "handle");
    short.move(1, 0, SWIPE.handleDismiss - 1);
    assert.equal(short.end(1, 0), "reset");

    const enough = new SwipeModel();
    enough.begin(1, 0, 0, "handle");
    enough.move(1, 0, SWIPE.handleDismiss);
    assert.equal(enough.end(1, 0), "dismiss");
  });

  it("a release that has come back up does not dismiss", () => {
    const model = new SwipeModel();
    model.begin(1, 0, 0, "handle");
    model.move(1, 0, 200);
    model.move(1, 0, 10);
    assert.equal(model.end(1, 0), "reset");
  });
});

describe("SwipeModel: swipe anywhere", () => {
  it("does nothing until the finger has moved 10 px", () => {
    const model = new SwipeModel();
    assert.equal(model.begin(1, 50, 100, "swipe"), "candidate");
    assert.equal(model.dragging, false);
    assert.equal(model.move(1, 50, 100 + SWIPE.slop - 1), "pending");
    assert.equal(model.dragging, false);
    assert.equal(model.move(1, 50 + SWIPE.slop - 1, 100 + SWIPE.slop - 1), "pending");
  });

  it("becomes a drag on a downward move past the slop and measures from that point", () => {
    const model = new SwipeModel();
    model.begin(1, 50, 100, "swipe");
    assert.equal(model.move(1, 52, 100 + SWIPE.slop), "engaged");
    assert.equal(model.distance, 0, "the panel does not jump by the slop");
    model.move(1, 52, 100 + SWIPE.slop + 30);
    assert.equal(model.distance, 30);
  });

  it("dismisses from 72 px (counted after the slop), not from 71", () => {
    const short = new SwipeModel();
    short.begin(1, 0, 0, "swipe");
    short.move(1, 0, SWIPE.slop);
    short.move(1, 0, SWIPE.slop + SWIPE.anywhereDismiss - 1);
    assert.equal(short.end(1, 0), "reset");

    const enough = new SwipeModel();
    enough.begin(1, 0, 0, "swipe");
    enough.move(1, 0, SWIPE.slop);
    enough.move(1, 0, SWIPE.slop + SWIPE.anywhereDismiss);
    assert.equal(enough.end(1, 0), "dismiss");
  });

  it("an upward or sideways move hands the gesture back for good", () => {
    for (const [x, y] of [[0, -40], [60, 15], [-60, 15], [40, 40]] as const) {
      const model = new SwipeModel();
      model.begin(1, 0, 0, "swipe");
      assert.equal(model.move(1, x, y), "none", `${x},${y}`);
      assert.equal(model.active, false);
      assert.equal(model.move(1, x, y + 200), "none", "a later downward move does not revive it");
      assert.equal(model.end(1, 0), "none");
    }
  });

  it("a perfectly diagonal move is not vertical enough", () => {
    const model = new SwipeModel();
    model.begin(1, 0, 0, "swipe");
    assert.equal(model.move(1, 30, 30), "none");
  });
});

describe("SwipeModel: other fingers, cancel, taps", () => {
  it("ignores moves and releases from another pointer", () => {
    const model = new SwipeModel();
    model.begin(1, 0, 0, "handle");
    assert.equal(model.move(2, 0, 200), "none");
    assert.equal(model.distance, 0);
    assert.equal(model.end(2, 0), "none");
    assert.equal(model.dragging, true);
  });

  it("does not start a second gesture while one is being dragged", () => {
    const model = new SwipeModel();
    model.begin(1, 0, 0, "handle");
    assert.equal(model.begin(2, 0, 0, "handle"), "none");
    model.move(1, 0, 30);
    assert.equal(model.end(1, 0), "dismiss");
  });

  it("`none` never starts anything", () => {
    const model = new SwipeModel();
    assert.equal(model.begin(1, 0, 0, "none"), "none");
    assert.equal(model.active, false);
  });

  it("cancel (the browser took the gesture) puts the panel back and a later release does nothing", () => {
    const model = new SwipeModel();
    model.begin(1, 0, 0, "handle");
    model.move(1, 0, 100);
    assert.equal(model.cancel(), true);
    assert.equal(model.end(1, 0), "none");
    assert.equal(model.cancel(), false);
  });

  it("a candidate that never became a drag is a plain tap: nothing to dismiss, nothing swallowed", () => {
    const model = new SwipeModel();
    model.begin(1, 0, 0, "swipe");
    model.move(1, 0, 3);
    assert.equal(model.end(1, 1000), "none");
    assert.equal(model.swallowsClick(1001), false);
  });
});

describe("SwipeModel: click guard", () => {
  it("swallows a click for 400 ms after a swipe and not after", () => {
    const model = new SwipeModel();
    model.begin(1, 0, 0, "swipe");
    model.move(1, 0, SWIPE.slop);
    model.move(1, 0, SWIPE.slop + 20);
    model.end(1, 5000);
    assert.equal(model.swallowsClick(5000), true);
    assert.equal(model.swallowsClick(5000 + SWIPE.clickGuardMs), true);
    assert.equal(model.swallowsClick(5000 + SWIPE.clickGuardMs + 1), false);
  });

  it("does not swallow before any swipe has happened", () => {
    assert.equal(new SwipeModel().swallowsClick(0), false);
  });

  it("a tap on the handle (no real movement) still lets its click through, a long handle drag does not", () => {
    const tap = new SwipeModel();
    tap.begin(1, 0, 0, "handle");
    tap.move(1, 0, 2);
    tap.end(1, 100);
    assert.equal(tap.swallowsClick(110), false);

    const drag = new SwipeModel();
    drag.begin(1, 0, 0, "handle");
    drag.move(1, 0, 60);
    drag.end(1, 100);
    assert.equal(drag.swallowsClick(110), true);
  });
});

describe("followOpacity", () => {
  it("is opaque at rest, fades with distance and never goes below half", () => {
    assert.equal(followOpacity(0), 1);
    assert.ok(followOpacity(100) < followOpacity(40));
    assert.equal(followOpacity(200), 0.5);
    assert.equal(followOpacity(900), 0.5);
  });
});
