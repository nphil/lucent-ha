import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOLD_DEFAULTS, HOLD_IDLE, TAP_MAX_MS, holdDrainRemainingMs, holdPress, holdProgress, holdRelease, holdRemainingMs, holdSettle } from "../src/components/hold-model.ts";

const config = HOLD_DEFAULTS; // 1500 ms hold, 400 ms full drain

describe("charging", () => {
  it("charges linearly and reports the time left", () => {
    const state = holdPress(HOLD_IDLE, 1000, config);
    assert.equal(holdProgress(state, 1000, config), 0);
    assert.equal(holdProgress(state, 1750, config), 0.5);
    assert.equal(holdRemainingMs(state, 1750, config), 750);
  });

  it("clamps at full charge and settles into completed exactly at the duration", () => {
    const state = holdPress(HOLD_IDLE, 0, config);
    assert.equal(holdProgress(state, 5000, config), 1);
    assert.equal(holdSettle(state, 1499, config).phase, "charging");
    assert.equal(holdSettle(state, 1500, config).phase, "completed");
  });

  it("a second press while charging or completed changes nothing", () => {
    const charging = holdPress(HOLD_IDLE, 0, config);
    assert.equal(holdPress(charging, 500, config), charging);
    const done = holdSettle(charging, 1500, config);
    assert.equal(holdPress(done, 1600, config), done);
  });
});

describe("release", () => {
  it("a release just inside the tap window is a tap, at the boundary it is not", () => {
    const state = holdPress(HOLD_IDLE, 0, config);
    assert.equal(holdRelease(state, TAP_MAX_MS - 1, config).tap, true);
    assert.equal(holdRelease(state, TAP_MAX_MS, config).tap, false);
  });

  it("an early release drains from where the charge had reached", () => {
    const state = holdPress(HOLD_IDLE, 0, config);
    const { state: draining, tap } = holdRelease(state, 750, config);
    assert.equal(tap, false);
    assert.equal(draining.phase, "draining");
    assert.equal(holdProgress(draining, 750, config), 0.5);
  });

  it("a partial charge drains in proportion: half a charge takes half the drain time", () => {
    const state = holdPress(HOLD_IDLE, 0, config);
    const draining = holdRelease(state, 750, config).state;
    assert.equal(holdDrainRemainingMs(draining, 750, config), 200);
    assert.equal(holdProgress(draining, 850, config), 0.25);
    assert.equal(holdProgress(draining, 5000, config), 0);
    assert.equal(holdSettle(draining, 950, config).phase, "idle");
  });

  it("letting go exactly when the hold completes still completes it", () => {
    const state = holdPress(HOLD_IDLE, 0, config);
    const released = holdRelease(state, 1500, config);
    assert.equal(released.state.phase, "completed");
    assert.equal(released.tap, false);
  });

  it("releasing something that is not charging changes nothing", () => {
    assert.deepEqual(holdRelease(HOLD_IDLE, 100, config), { state: HOLD_IDLE, tap: false });
  });
});

describe("pressing again while draining", () => {
  it("continues from the charge it had reached instead of starting over", () => {
    const draining = holdRelease(holdPress(HOLD_IDLE, 0, config), 750, config).state;
    const again = holdPress(draining, 850, config); // charge had drained to 0.25
    assert.equal(again.phase, "charging");
    assert.equal(holdProgress(again, 850, config), 0.25);
    assert.equal(holdRemainingMs(again, 850, config), 1125);
  });
});

describe("custom duration", () => {
  it("a shorter hold completes sooner", () => {
    const short = { durationMs: 600, drainMs: 400 };
    const state = holdPress(HOLD_IDLE, 0, short);
    assert.equal(holdSettle(state, 600, short).phase, "completed");
    assert.equal(holdProgress(state, 300, short), 0.5);
  });
});
