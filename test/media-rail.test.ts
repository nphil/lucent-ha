import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { railFocusIndex, railPerView, railTileWidth } from "../src/image/rail-model.ts";

/** How many tiles show, counting the last one by the part of it that is visible. */
function visibleTiles(container: number, gap: number, tile: number): number {
  let used = 0;
  let tiles = 0;
  while (used < container) {
    const room = container - used;
    tiles += Math.min(1, room / tile);
    used += tile + gap;
  }
  return tiles;
}

describe("railTileWidth", () => {
  it("makes N and a half tiles fill the container exactly (two tiles, two gaps, half a tile)", () => {
    const tile = railTileWidth(360, 12, 2.5, 100, 400);
    assert.equal(tile, 134);
    assert.ok(Math.abs(2.5 * 134 + 2 * 12 - 360) < 2.5);
    assert.ok(Math.abs(visibleTiles(360, 12, tile) - 2.5) < 0.05);
  });
  it("counts one gap per whole tile before the peeking one", () => {
    // 1.5 tiles: one whole tile, one gap, half a tile
    assert.equal(railTileWidth(300, 20, 1.5, 100, 400), Math.round((300 - 20) / 1.5));
    // 3.5 tiles: three gaps
    assert.equal(railTileWidth(700, 10, 3.5, 100, 400), Math.round((700 - 30) / 3.5));
  });
  it("clamps to the minimum and maximum tile", () => {
    assert.equal(railTileWidth(200, 12, 2.5), 120);
    assert.equal(railTileWidth(2000, 12, 1.5), 280);
    assert.equal(railTileWidth(600, 12, 2.5, 150, 160), 160);
  });
  it("gives the minimum for a container that is not measured yet", () => {
    assert.equal(railTileWidth(0, 12, 2.5), 120);
    assert.equal(railTileWidth(-5, 12, 2.5), 120);
    assert.equal(railTileWidth(500, 12, 0), 120);
  });
});

describe("railPerView", () => {
  const gap = 12;
  // Content widths of: phone 390x844 (390-32 inset -> 358), Echo Show 960x480 beside the rail, tablet, laptop, desktop.
  for (const [name, width] of [["phone", 358], ["phone landscape", 700], ["echo show", 860], ["tablet", 980], ["laptop", 1100], ["desktop", 1600]] as const) {
    it(`always peeks a half tile at ${name} (${width}px) with tiles inside 120-280`, () => {
      const perView = railPerView(width, gap);
      assert.equal(perView % 1, 0.5, "N.5");
      const tile = railTileWidth(width, gap, perView);
      assert.ok(tile >= 120 && tile <= 280, `tile ${tile}`);
      assert.ok(Math.abs(visibleTiles(width, gap, tile) - perView) < 0.1, `shows ${visibleTiles(width, gap, tile)} for ${perView}`);
    });
  }
  it("shows fewer, bigger tiles on a narrow container and more on a wide one", () => {
    assert.ok(railPerView(358, gap) < railPerView(860, gap));
    assert.ok(railPerView(860, gap) < railPerView(1600, gap));
  });
  it("picks the biggest tile that is not over the maximum", () => {
    const perView = railPerView(860, gap);
    assert.ok(railTileWidth(860, gap, perView) <= 280);
    assert.ok((860 - Math.floor(perView - 1) * gap) / (perView - 1) > 280, "one tile fewer would be too wide");
  });
  it("backs off to bigger tiles rather than going under the minimum", () => {
    // 500px, tiles 200-220: 2.5 would make 190px tiles (too small), 1.5 makes 325px (clamped to 220)
    assert.equal(railPerView(500, 12, 200, 220), 1.5);
    assert.equal(railTileWidth(500, 12, 1.5, 200, 220), 220);
  });
  it("answers 1.5 before the container is measured", () => {
    assert.equal(railPerView(0, gap), 1.5);
  });
});

describe("railFocusIndex", () => {
  it("moves one tile with the arrows and stops at the ends (a shelf does not wrap)", () => {
    assert.equal(railFocusIndex("ArrowRight", 1, 4), 2);
    assert.equal(railFocusIndex("ArrowLeft", 1, 4), 0);
    assert.equal(railFocusIndex("ArrowRight", 3, 4), 3);
    assert.equal(railFocusIndex("ArrowLeft", 0, 4), 0);
  });
  it("jumps with Home and End", () => {
    assert.equal(railFocusIndex("Home", 2, 5), 0);
    assert.equal(railFocusIndex("End", 2, 5), 4);
  });
  it("mirrors the arrows in a right-to-left page", () => {
    assert.equal(railFocusIndex("ArrowLeft", 1, 4, true), 2);
    assert.equal(railFocusIndex("ArrowRight", 1, 4, true), 0);
  });
  it("leaves every other key (and vertical arrows, which scroll the page) alone", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Enter", " ", "Tab", "a"]) assert.equal(railFocusIndex(key, 1, 4), null, key);
    assert.equal(railFocusIndex("ArrowRight", 0, 0), null);
  });
});
