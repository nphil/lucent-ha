import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WallMode, initialWall } from "../src/shell/wall-mode.ts";

/** A stand-in for `setKioskMode`: counts how often kiosk was switched on and how often it was released. */
function fakeKiosk() {
  const log = { on: 0, off: 0 };
  const setKiosk = (enable: boolean): (() => void) => {
    assert.equal(enable, true, "wall mode only ever asks for kiosk to be switched on");
    log.on += 1;
    return () => { log.off += 1; };
  };
  return { log, setKiosk };
}

describe("WallMode", () => {
  it("switching on asks for kiosk mode once, however often it is asked", () => {
    const { log, setKiosk } = fakeKiosk();
    const wall = new WallMode(setKiosk);
    wall.set(true);
    wall.set(true);
    wall.set(true);
    assert.equal(log.on, 1);
    assert.equal(wall.active, true);
  });

  it("switching off releases kiosk mode exactly once", () => {
    const { log, setKiosk } = fakeKiosk();
    const wall = new WallMode(setKiosk);
    wall.set(true);
    wall.set(false);
    wall.set(false);
    assert.equal(log.off, 1);
    assert.equal(wall.active, false);
  });

  it("asking for off while it was never on does nothing", () => {
    const { log, setKiosk } = fakeKiosk();
    const wall = new WallMode(setKiosk);
    wall.set(false);
    wall.dispose();
    assert.deepEqual(log, { on: 0, off: 0 });
  });

  it("dispose releases kiosk mode, so a removed panel never leaves Home Assistant's header hidden", () => {
    const { log, setKiosk } = fakeKiosk();
    const wall = new WallMode(setKiosk);
    wall.set(true);
    wall.dispose();
    assert.deepEqual(log, { on: 1, off: 1 });
    assert.equal(wall.active, false);
  });

  it("after dispose it can be switched on again (the panel was re-attached)", () => {
    const { log, setKiosk } = fakeKiosk();
    const wall = new WallMode(setKiosk);
    wall.set(true);
    wall.dispose();
    wall.set(true);
    assert.deepEqual(log, { on: 2, off: 1 });
    assert.equal(wall.active, true);
  });

  it("turning off then on again asks for kiosk mode again each time", () => {
    const { log, setKiosk } = fakeKiosk();
    const wall = new WallMode(setKiosk);
    for (let round = 0; round < 3; round += 1) {
      wall.set(true);
      wall.set(false);
    }
    assert.deepEqual(log, { on: 3, off: 3 });
  });
});

describe("initialWall", () => {
  it("an explicit wall wins", () => {
    assert.equal(initialWall(true, false), true);
    assert.equal(initialWall(true, undefined), true);
  });

  it("otherwise what the device remembered", () => {
    assert.equal(initialWall(false, true), true);
    assert.equal(initialWall(false, false), false);
  });

  it("only a stored true counts: missing or corrupt values mean off", () => {
    for (const stored of [undefined, null, "true", 1, "yes", {}, []]) assert.equal(initialWall(false, stored), false, JSON.stringify(stored));
  });
});
