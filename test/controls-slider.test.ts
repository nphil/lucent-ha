import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sliderExternal, sliderGrabbed, sliderMoved, sliderReleased, valueToFraction, type SliderShown } from "../src/components/slider-model.ts";

describe("valueToFraction", () => {
  it("maps the range to 0..1 and clamps outside it", () => {
    const range = { min: 10, max: 30, step: 1 };
    assert.equal(valueToFraction(10, range), 0);
    assert.equal(valueToFraction(20, range), 0.5);
    assert.equal(valueToFraction(30, range), 1);
    assert.equal(valueToFraction(99, range), 1);
    assert.equal(valueToFraction(-5, range), 0);
  });
  it("treats a flat range as 0 instead of dividing by zero", () => {
    assert.equal(valueToFraction(5, { min: 5, max: 5, step: 1 }), 0);
  });
});

describe("drag bookkeeping", () => {
  const rest: SliderShown = { value: 20, dragging: false };

  it("follows an outside value when nobody is holding the thumb", () => {
    assert.deepEqual(sliderExternal(rest, 35), { value: 35, dragging: false });
  });

  it("ignores an outside value while the thumb is held, so it never jumps under the finger", () => {
    const held = sliderMoved(sliderGrabbed(rest), 60);
    assert.deepEqual(sliderExternal(held, 22), { value: 60, dragging: true });
  });

  it("keeps the dragged value after release and then follows outside values again", () => {
    const released = sliderReleased(sliderMoved(sliderGrabbed(rest), 60));
    assert.deepEqual(released, { value: 60, dragging: false });
    assert.deepEqual(sliderExternal(released, 61), { value: 61, dragging: false });
  });

  it("moving the thumb with the keyboard does not mark it as held", () => {
    assert.equal(sliderMoved(rest, 21).dragging, false);
  });
});
