import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LitElement } from "lit";
import { LuElement } from "../src/core/element.ts";
import type { LuElementClass } from "../src/core/element.ts";
import { assertValidPrefix, luTagName, prefixFromTag } from "../src/core/tag.ts";
import { defineElements } from "../src/define.ts";

class Leaf extends LuElement { static override luName = "t-leaf"; }
class Branch extends LuElement {
  static override luName = "t-branch";
  static override luDeps: readonly LuElementClass[] = [Leaf as unknown as LuElementClass];
}

describe("assertValidPrefix", () => {
  it("accepts app names", () => {
    for (const prefix of ["kestrel", "aquarium", "my-app", "a1"]) assert.doesNotThrow(() => assertValidPrefix(prefix));
  });
  it("rejects names that could collide with iLedClock or Home Assistant", () => {
    for (const prefix of ["", "ha", "ha-foo", "lu", "Kestrel", "1app", "a b", "-x", "x-"]) assert.throws(() => assertValidPrefix(prefix), /lucent-ha/, prefix);
  });
});

describe("tag names", () => {
  it("are <prefix>-lu-<name> and round-trip", () => {
    assert.equal(luTagName("kestrel", "sheet"), "kestrel-lu-sheet");
    assert.equal(prefixFromTag("kestrel-lu-sheet", "sheet"), "kestrel");
    assert.equal(prefixFromTag("my-app-lu-app-shell", "app-shell"), "my-app");
    assert.equal(prefixFromTag("other-thing", "sheet"), "");
  });
});

describe("defineElements", () => {
  it("registers only <prefix>-lu-* tags, dependencies included, and returns them", () => {
    const before = new Set(["t-leaf", "t-branch"].map((n) => customElements.get(`alpha-lu-${n}`)));
    assert.deepEqual([...before], [undefined]);
    const registry = defineElements("alpha", [Branch as unknown as LuElementClass]);
    assert.deepEqual(registry.tags, { "t-leaf": "alpha-lu-t-leaf", "t-branch": "alpha-lu-t-branch" });
    assert.equal(registry.tag("t-branch"), "alpha-lu-t-branch");
    assert.ok(customElements.get("alpha-lu-t-leaf"));
    assert.ok(customElements.get("alpha-lu-t-branch"));
    assert.equal(customElements.get("lu-t-leaf"), undefined, "never a bare lu-* tag");
    assert.equal(customElements.get("t-leaf"), undefined);
    assert.throws(() => registry.tag("nope"), /no "nope" element/);
  });

  it("two prefixes from one bundle do not conflict and each element knows its own prefix", () => {
    const a = defineElements("one", [Branch as unknown as LuElementClass]);
    const b = defineElements("two", [Branch as unknown as LuElementClass]);
    assert.notEqual(customElements.get(a.tag("t-branch")), customElements.get(b.tag("t-branch")));
    const first = customElements.get(a.tag("t-branch")) as unknown as { luRegisteredPrefix: string };
    const second = customElements.get(b.tag("t-branch")) as unknown as { luRegisteredPrefix: string };
    assert.equal(first.luRegisteredPrefix, "one");
    assert.equal(second.luRegisteredPrefix, "two");
    // the registered classes are still toolkit elements
    assert.ok(Object.getPrototypeOf(customElements.get(a.tag("t-branch"))) === Branch);
    assert.ok(Branch.prototype instanceof LitElement);
  });

  it("calling it again for the same prefix reuses what exists", () => {
    const first = defineElements("again", [Leaf as unknown as LuElementClass]);
    const ctor = customElements.get(first.tag("t-leaf"));
    const second = defineElements("again", [Leaf as unknown as LuElementClass]);
    assert.equal(customElements.get(second.tag("t-leaf")), ctor);
  });

  it("refuses a bad prefix before registering anything", () => {
    assert.throws(() => defineElements("ha", [Leaf as unknown as LuElementClass]), /ha-\* namespace/);
    assert.equal(customElements.get("ha-lu-t-leaf"), undefined);
  });
});
