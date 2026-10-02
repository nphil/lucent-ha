import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accessibleName, formatBadge, resolveCurrent } from "../src/shell/nav-model.ts";
import type { LuDestination } from "../src/shell/nav-model.ts";

const destinations: LuDestination[] = [
  { id: "live", label: "Live" },
  { id: "wildlife", label: "Wildlife", badge: 3 },
  { id: "checkup", label: "Check-up" },
];

describe("resolveCurrent", () => {
  it("finds the destination with that id", () => {
    assert.equal(resolveCurrent(destinations, "wildlife")?.label, "Wildlife");
  });

  it("an unknown id (a detail page with no tab) marks nothing as current, it never falls back to the first tab", () => {
    assert.equal(resolveCurrent(destinations, "visit"), undefined);
    assert.equal(resolveCurrent(destinations, ""), undefined);
    assert.equal(resolveCurrent(destinations, undefined), undefined);
  });

  it("matches the id exactly (no case folding, no prefix match)", () => {
    assert.equal(resolveCurrent(destinations, "Wildlife"), undefined);
    assert.equal(resolveCurrent(destinations, "wild"), undefined);
  });

  it("with no destinations nothing is current", () => {
    assert.equal(resolveCurrent([], "live"), undefined);
  });
});

describe("formatBadge", () => {
  it("hides counts that are zero, negative, fractional below one or not numbers", () => {
    for (const hidden of [0, -3, 0.9, Number.NaN, Number.POSITIVE_INFINITY, undefined, null, "", "   "]) {
      assert.equal(formatBadge(hidden as number | string | undefined), "", String(hidden));
    }
  });

  it("shows counts up to 99 and 99+ above that; fractions round down", () => {
    assert.equal(formatBadge(1), "1");
    assert.equal(formatBadge(99), "99");
    assert.equal(formatBadge(99.9), "99");
    assert.equal(formatBadge(100), "99+");
    assert.equal(formatBadge(12345), "99+");
  });

  it("passes short words through, trimmed", () => {
    assert.equal(formatBadge("  new "), "new");
    assert.equal(formatBadge("0"), "0");
  });
});

describe("accessibleName", () => {
  it("adds the badge after the label so a screen reader hears both", () => {
    assert.equal(accessibleName({ id: "w", label: "Wildlife", badge: 3 }), "Wildlife, 3");
    assert.equal(accessibleName({ id: "w", label: "Wildlife", badge: "new" }), "Wildlife, new");
  });

  it("is just the label when the badge is hidden", () => {
    assert.equal(accessibleName({ id: "w", label: "Wildlife", badge: 0 }), "Wildlife");
    assert.equal(accessibleName({ id: "w", label: "Wildlife" }), "Wildlife");
  });
});
