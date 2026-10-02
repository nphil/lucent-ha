import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyKey, atLimit, clampToStep, decimalsFor, decimalsOf, formatNumber, formatValueText, keyAction, nextValue, repeatDelayMs } from "../src/components/stepper-model.ts";

const tenths = { min: 0, max: 1, step: 0.1 };

describe("clampToStep", () => {
  it("snaps to the nearest grid value and stays inside the range", () => {
    assert.equal(clampToStep(4.4, { min: 0, max: 10, step: 1 }), 4);
    assert.equal(clampToStep(4.6, { min: 0, max: 10, step: 1 }), 5);
    assert.equal(clampToStep(-3, { min: 0, max: 10, step: 1 }), 0);
    assert.equal(clampToStep(99, { min: 0, max: 10, step: 1 }), 10);
  });

  it("anchors the grid at min, like a native range input", () => {
    const range = { min: 1, max: 20, step: 5 };
    assert.equal(clampToStep(5, range), 6);
    assert.equal(clampToStep(20, range), 16);
  });

  it("does not leave floating-point noise with 0.1 steps", () => {
    assert.equal(clampToStep(0.30000000000000004, tenths), 0.3);
    assert.equal(clampToStep(0.7000000000000001, tenths), 0.7);
  });

  it("falls back to min for NaN and to step 1 for a bad step; max never sits below min", () => {
    assert.equal(clampToStep(NaN, { min: 2, max: 9, step: 1 }), 2);
    assert.equal(clampToStep(3.4, { min: 0, max: 9, step: 0 }), 3);
    assert.equal(clampToStep(5, { min: 4, max: 1, step: 1 }), 4);
  });
});

describe("nextValue", () => {
  it("adds 0.1 ten times and lands exactly on 1", () => {
    let value = 0;
    for (let i = 0; i < 10; i += 1) value = nextValue(value, 1, tenths);
    assert.equal(value, 1);
  });

  it("stops at the limits instead of overshooting", () => {
    assert.equal(nextValue(1, 1, tenths), 1);
    assert.equal(nextValue(0, -1, tenths), 0);
    assert.equal(nextValue(8, 10, { min: 0, max: 10, step: 1 }), 10);
  });

  it("uses the largest grid value at or below max when max is off the grid", () => {
    const range = { min: 0, max: 10, step: 3 };
    assert.equal(nextValue(9, 1, range), 9);
    assert.equal(nextValue(6, 1, range), 9);
  });

  it("moves an off-grid value to the grid point in that direction first", () => {
    const range = { min: 0, max: 10, step: 1 };
    assert.equal(nextValue(4.2, 1, range), 5);
    assert.equal(nextValue(4.2, -1, range), 4);
  });

  it("takes several steps at once for page keys", () => {
    assert.equal(nextValue(4, 10, { min: 0, max: 100, step: 2 }), 24);
    assert.equal(nextValue(3, -10, { min: 0, max: 100, step: 1 }), 0);
  });
});

describe("atLimit", () => {
  it("is true at each end and false between", () => {
    const range = { min: 0, max: 10, step: 3 };
    assert.equal(atLimit(0, -1, range), true);
    assert.equal(atLimit(0, 1, range), false);
    assert.equal(atLimit(9, 1, range), true);
    assert.equal(atLimit(6, 1, range), false);
  });
});

describe("keys", () => {
  const range = { min: 5, max: 50, step: 5 };
  it("maps arrows, page keys, Home and End", () => {
    assert.equal(keyAction("ArrowUp"), 1);
    assert.equal(keyAction("ArrowDown"), -1);
    assert.equal(keyAction("PageUp"), 10);
    assert.equal(keyAction("Home"), "min");
    assert.equal(keyAction("a"), null);
  });
  it("Home and End go to the first and last grid value", () => {
    assert.equal(applyKey(20, "min", range), 5);
    assert.equal(applyKey(20, "max", { min: 0, max: 10, step: 3 }), 9);
    assert.equal(applyKey(20, 1, range), 25);
  });
});

describe("repeat schedule", () => {
  it("waits 400 ms for the first repeat, then 100 ms between repeats", () => {
    assert.equal(repeatDelayMs(0), 400);
    assert.equal(repeatDelayMs(1), 100);
    assert.equal(repeatDelayMs(50), 100);
  });
});

describe("number text", () => {
  it("counts decimals of steps, including tiny ones", () => {
    assert.equal(decimalsOf(1), 0);
    assert.equal(decimalsOf(0.25), 2);
    assert.equal(decimalsOf(1e-7), 7);
    assert.equal(decimalsFor({ min: 0.5, max: 9, step: 1 }), 1);
  });
  it("shows a fixed number of decimals", () => {
    assert.equal(formatNumber(2, 1, "en-US"), "2.0");
    assert.equal(formatNumber(1234.5, 1, "en-US"), "1,234.5");
  });
  it("puts % and degrees against the number and other units after a space", () => {
    assert.equal(formatValueText("40", "%"), "40%");
    assert.equal(formatValueText("21", "°C"), "21°C");
    assert.equal(formatValueText("3", "min"), "3 min");
    assert.equal(formatValueText("3", ""), "3");
  });
});
