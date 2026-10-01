import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyPointer, resolveNavMode, resolveProfile } from "../src/tokens/profile-model.ts";
import type { LuPointer } from "../src/tokens/profile-model.ts";

/** One row per real-world case: the panel's container width, the viewport height, the viewport width, the input. */
const matrix: Array<[string, number, number, number, LuPointer, string, boolean, string]> = [
  // name,                              width, height, viewport, pointer, profile, short, nav
  ["phone portrait 390x844",             390,   844,   390,  "touch", "phone",   false, "bottom"],
  ["phone landscape 844x390",            844,   390,   844,  "touch", "phone",   true,  "rail"],
  ["big phone landscape 932x430",        932,   430,   932,  "touch", "phone",   true,  "rail"],
  ["tablet portrait 820x1180",           820,  1180,   820,  "touch", "tablet",  false, "pills"],
  ["tablet landscape 1180x820 (sidebar)", 924,  820,  1180,  "touch", "tablet",  false, "tabs"],
  ["Echo Show 960x480, wall mode",       960,   480,   960,  "touch", "smart",   true,  "rail"],
  ["Echo Show 960x480, docked sidebar",  704,   480,   960,  "touch", "smart",   true,  "rail"],
  ["wide touch display, tiny height",    960,   420,   960,  "touch", "phone",   true,  "rail"],
  ["Echo Show 8 1280x800",              1024,   800,  1280,  "touch", "tablet",  false, "tabs"],
  ["laptop 1366x768",                   1110,   768,  1366,  "fine",  "desktop", false, "tabs"],
  ["desktop 1280x800",                  1024,   800,  1280,  "fine",  "desktop", false, "tabs"],
  ["fhd 1920x1080",                     1664,  1080,  1920,  "fine",  "desktop", false, "tabs"],
  ["qhd 2560x1440",                     2304,  1440,  2560,  "fine",  "desktop", false, "tabs"],
  ["narrow browser window 500",          500,   700,   500,  "fine",  "phone",   false, "bottom"],
  ["mid browser window 750",             750,   700,   750,  "fine",  "tablet",  false, "pills"],
  ["short desktop window",              1000,   480,  1000,  "fine",  "desktop", true,  "rail"],
  ["mouse on a tablet (mixed)",          820,   900,   820,  "mixed", "tablet",  false, "pills"],
];

describe("resolveProfile: width x height x pointer matrix", () => {
  for (const [name, width, height, viewportWidth, pointer, profile, short, nav] of matrix) {
    it(name, () => {
      const state = resolveProfile({ width, height, viewportWidth, pointer });
      assert.equal(state.profile, profile);
      assert.equal(state.short, short);
      assert.equal(state.nav, nav);
      assert.equal(state.touch, pointer === "touch");
    });
  }

  it("960x480 is only a smart display when it is touch-operated", () => {
    assert.equal(resolveProfile({ width: 960, height: 480, pointer: "fine" }).profile, "desktop");
    assert.equal(resolveProfile({ width: 960, height: 480, pointer: "touch" }).profile, "smart");
  });

  it("viewport width defaults to the panel width", () => {
    assert.equal(resolveProfile({ width: 960, height: 480, pointer: "touch" }).profile, "smart");
    // 704 wide + no viewport information: a touch panel that short is a phone held sideways, not a wall display
    assert.equal(resolveProfile({ width: 704, height: 480, pointer: "touch" }).profile, "phone");
    // the same panel next to Home Assistant's docked sidebar on a 960-wide screen is the smart display
    assert.equal(resolveProfile({ width: 704, height: 480, viewportWidth: 960, pointer: "touch" }).profile, "smart");
  });
});

describe("resolveNavMode", () => {
  it("short screens always get a rail, whatever the width", () => {
    for (const width of [320, 704, 960, 2000]) assert.equal(resolveNavMode(width, true), "rail");
  });
  it("tabs from 900, pills from 680, a bottom bar below", () => {
    assert.equal(resolveNavMode(900, false), "tabs");
    assert.equal(resolveNavMode(899, false), "pills");
    assert.equal(resolveNavMode(680, false), "pills");
    assert.equal(resolveNavMode(679, false), "bottom");
    assert.equal(resolveNavMode(320, false), "bottom");
  });
});

describe("hysteresis", () => {
  it("a scrollbar appearing at the boundary does not flip the layout back and forth", () => {
    let state = resolveProfile({ width: 905, height: 800, pointer: "fine" });
    assert.equal(state.nav, "tabs");
    for (const width of [890, 905, 892, 900, 885, 905]) {
      state = resolveProfile({ width, height: 800, pointer: "fine" }, state);
      assert.equal(state.nav, "tabs", `width ${width}`);
      assert.equal(state.profile, "desktop", `width ${width}`);
    }
    state = resolveProfile({ width: 870, height: 800, pointer: "fine" }, state);
    assert.equal(state.nav, "pills");
    assert.equal(state.profile, "tablet");
    // and it needs the full threshold to climb back
    state = resolveProfile({ width: 895, height: 800, pointer: "fine" }, state);
    assert.equal(state.nav, "pills");
    state = resolveProfile({ width: 900, height: 800, pointer: "fine" }, state);
    assert.equal(state.nav, "tabs");
  });

  it("a height just over the short line stays short once it was short", () => {
    let state = resolveProfile({ width: 960, height: 480, pointer: "touch" });
    assert.equal(state.short, true);
    state = resolveProfile({ width: 960, height: 510, pointer: "touch" }, state);
    assert.equal(state.short, true);
    state = resolveProfile({ width: 960, height: 540, pointer: "touch" }, state);
    assert.equal(state.short, false);
  });
});

describe("classifyPointer", () => {
  it("maps the hover and pointer media features to the three input classes", () => {
    assert.equal(classifyPointer("none", "coarse"), "touch");
    assert.equal(classifyPointer("hover", "fine"), "fine");
    assert.equal(classifyPointer("hover", "coarse"), "mixed");
    assert.equal(classifyPointer("none", "none"), "mixed");
    assert.equal(classifyPointer(undefined, undefined), "mixed");
  });
});
