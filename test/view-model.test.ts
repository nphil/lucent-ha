import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ViewStackModel, createScrollMemory, scrollMemoryFor } from "../src/view/view-model.ts";

/** Shows each id in turn and returns what the model decided. */
function visit(model: ViewStackModel, ...ids: string[]) {
  return ids.map((id) => model.show(id));
}

describe("ViewStackModel: keeping views alive", () => {
  it("keeps the 4 most recently shown views by default and pushes out the one shown longest ago", () => {
    const model = new ViewStackModel();
    const changes = visit(model, "a", "b", "c", "d", "e");
    assert.deepEqual(changes.map((change) => change.evict), [[], [], [], [], ["a"]]);
    assert.deepEqual(model.mounted, ["b", "c", "d", "e"]);
  });

  it("showing a kept view again makes it the newest, so the next one pushed out is a different view", () => {
    const model = new ViewStackModel({ max: 3 });
    visit(model, "a", "b", "c", "a");
    assert.deepEqual(model.mounted, ["b", "c", "a"]);
    assert.deepEqual(model.show("d").evict, ["b"]);
  });

  it("reports what was hidden, what is shown, and whether the view is new", () => {
    const model = new ViewStackModel({ max: 2 });
    assert.deepEqual(model.show("a"), { hide: null, show: "a", evict: [], first: true });
    assert.deepEqual(model.show("b"), { hide: "a", show: "b", evict: [], first: true });
    assert.deepEqual(model.show("a"), { hide: "b", show: "a", evict: [], first: false });
    assert.deepEqual(model.show("c"), { hide: "a", show: "c", evict: ["b"], first: true });
    // b was pushed out: showing it again builds it from scratch
    assert.equal(model.show("b").first, true);
  });

  it("showing the view that is already showing changes nothing", () => {
    const model = new ViewStackModel({ max: 2 });
    visit(model, "a", "b");
    assert.deepEqual(model.show("b"), { hide: null, show: "b", evict: [], first: false });
    assert.deepEqual(model.mounted, ["a", "b"]);
  });

  it("never pushes out the view being shown, even with the smallest cap", () => {
    const model = new ViewStackModel({ max: 1 });
    for (const id of ["a", "b", "a", "c"]) {
      const change = model.show(id);
      assert.ok(!change.evict.includes(id), `${id} must stay`);
      assert.deepEqual(model.mounted, [id]);
    }
  });

  it("cap values that make no sense still keep the showing view: 0, negative, fractions, NaN", () => {
    const model = new ViewStackModel();
    model.max = 0;
    assert.equal(model.max, 1);
    model.max = -3;
    assert.equal(model.max, 1);
    model.max = 2.9;
    assert.equal(model.max, 2);
    model.max = Number.NaN;
    assert.equal(model.max, 4, "back to the default");
    model.max = Number.POSITIVE_INFINITY;
    visit(model, "a", "b", "c", "d", "e", "f");
    assert.equal(model.mounted.length, 6, "unlimited");
  });

  it("lowering the cap pushes out the least recently shown views on trim()", () => {
    const model = new ViewStackModel({ max: 4 });
    visit(model, "a", "b", "c", "d");
    model.max = 2;
    assert.deepEqual(model.trim(), ["a", "b"]);
    assert.deepEqual(model.mounted, ["c", "d"]);
    assert.deepEqual(model.trim(), [], "nothing more to push out");
  });

  it("clear() says which view was showing and the next show hides nothing", () => {
    const model = new ViewStackModel();
    visit(model, "a", "b");
    assert.equal(model.clear(), "b");
    assert.equal(model.current, null);
    assert.equal(model.clear(), null);
    assert.equal(model.show("a").hide, null);
    assert.deepEqual(model.mounted, ["b", "a"], "b is still kept alive");
  });
});

describe("ViewStackModel: scroll memory", () => {
  it("a view that was never left has no remembered offset, so it starts at the top", () => {
    const model = new ViewStackModel();
    assert.equal(model.scrollFor("a"), undefined);
    model.show("a");
    assert.equal(model.scrollFor("a"), undefined);
  });

  it("A scrolled to 1400, then B, then A again: A returns to exactly 1400, B to its own offset", () => {
    const model = new ViewStackModel();
    model.show("a");
    model.saveScroll("a", 1400);
    model.show("b");
    model.saveScroll("b", 220.5);
    model.show("a");
    assert.equal(model.scrollFor("a"), 1400);
    assert.equal(model.scrollFor("b"), 220.5);
  });

  it("keeps the offset of a view that was pushed out, so it can be put back when the view is rebuilt", () => {
    const model = new ViewStackModel({ max: 1 });
    model.show("a");
    model.saveScroll("a", 900);
    assert.deepEqual(model.show("b").evict, ["a"]);
    assert.equal(model.scrollFor("a"), 900);
  });

  it("forgetScroll makes the next show of that view start at the top, and leaves other views alone", () => {
    const model = new ViewStackModel();
    model.saveScroll("visit", 640);
    model.saveScroll("list", 1200);
    model.forgetScroll("visit");
    assert.equal(model.scrollFor("visit"), undefined);
    assert.equal(model.scrollFor("list"), 1200);
  });

  it("ignores offsets that cannot be real and never stores below the top", () => {
    const model = new ViewStackModel();
    model.saveScroll("a", 300);
    model.saveScroll("a", Number.NaN);
    model.saveScroll("a", Number.POSITIVE_INFINITY);
    assert.equal(model.scrollFor("a"), 300);
    model.saveScroll("a", -40);
    assert.equal(model.scrollFor("a"), 0);
  });
});

describe("scroll memory shared at module level", () => {
  it("two stacks with the same key see each other's offsets (a re-created panel finds them)", () => {
    const first = new ViewStackModel({ memory: scrollMemoryFor("test-shared") });
    first.saveScroll("wildlife", 2755);
    const recreated = new ViewStackModel({ memory: scrollMemoryFor("test-shared") });
    assert.equal(recreated.scrollFor("wildlife"), 2755);
  });

  it("different keys are separate worlds even for the same view id", () => {
    scrollMemoryFor("test-left").set("list", 100);
    assert.equal(scrollMemoryFor("test-right").get("list"), undefined);
  });

  it("a model can be pointed at another key later", () => {
    scrollMemoryFor("test-from").set("a", 50);
    scrollMemoryFor("test-to").set("a", 75);
    const model = new ViewStackModel({ memory: scrollMemoryFor("test-from") });
    assert.equal(model.scrollFor("a"), 50);
    model.memory = scrollMemoryFor("test-to");
    assert.equal(model.scrollFor("a"), 75);
  });

  it("holds a bounded number of views: the ones untouched for longest are forgotten first", () => {
    const memory = createScrollMemory(3);
    for (const id of ["a", "b", "c"]) memory.set(id, 10);
    memory.set("a", 20); // touching a makes b the oldest
    memory.set("d", 30);
    assert.equal(memory.get("b"), undefined);
    assert.deepEqual(["a", "c", "d"].map((id) => memory.get(id)), [20, 10, 30]);
  });
});
