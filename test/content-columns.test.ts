import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gridWidth, tileColumns, tileWidth } from "../src/grid/columns.ts";
import { SHELL, TILE_MIN } from "../src/tokens/constants.ts";

const GAPS = [12, 16, 24];

describe("tileColumns", () => {
  it("shows at least 4 camera columns in a 1664 px panel (1920x1080 with HA's sidebar)", () => {
    assert.ok(tileColumns(1664, TILE_MIN.camera, 24, { contentMax: SHELL.contentMaxGrid }) >= 4);
    assert.ok(tileColumns(1664, TILE_MIN.camera, 24) >= 4);
  });

  it("is exact at the boundary: n tiles and n-1 gaps fit n columns, one pixel less fits n-1", () => {
    for (const gap of GAPS) {
      for (const min of [TILE_MIN.species, TILE_MIN.visit, TILE_MIN.camera]) {
        for (const n of [2, 3, 4, 5]) {
          const exact = n * min + (n - 1) * gap;
          assert.equal(tileColumns(exact, min, gap), n, `${n} columns at ${exact} (min ${min}, gap ${gap})`);
          assert.equal(tileColumns(exact - 1, min, gap), n - 1, `${n - 1} columns at ${exact - 1} (min ${min}, gap ${gap})`);
        }
      }
    }
  });

  it("falls back to one column when a tile does not fit at all, or the container is empty", () => {
    assert.equal(tileColumns(300, TILE_MIN.camera, 16), 1);
    assert.equal(tileColumns(0, TILE_MIN.camera, 16), 1);
    assert.equal(tileColumns(-5, TILE_MIN.species, 16), 1);
  });

  it("loses columns when the gap grows", () => {
    assert.equal(tileColumns(1000, 176, 0), 5);
    assert.equal(tileColumns(1000, 176, 24), 5);
    assert.equal(tileColumns(1000, 176, 60), 4);
  });

  it("never shows fewer columns in a wider container (no flicker while resizing)", () => {
    for (const gap of GAPS) {
      for (const min of [TILE_MIN.species, TILE_MIN.visit, TILE_MIN.camera]) {
        let before = 0;
        for (let width = 0; width <= 3000; width += 1) {
          const columns = tileColumns(width, min, gap, { contentMax: SHELL.contentMaxGrid, minColumns: min === TILE_MIN.species ? 2 : 1 });
          assert.ok(columns >= before, `${columns} < ${before} at ${width} (min ${min}, gap ${gap})`);
          before = columns;
        }
      }
    }
  });

  it("stops growing at the content maximum", () => {
    const capped = tileColumns(2294, TILE_MIN.species, 24, { contentMax: SHELL.contentMaxGrid });
    assert.equal(capped, tileColumns(SHELL.contentMaxGrid, TILE_MIN.species, 24));
    assert.ok(tileColumns(2294, TILE_MIN.species, 24) > capped);
    assert.equal(tileColumns(900, TILE_MIN.species, 24, { contentMax: SHELL.contentMaxGrid }), tileColumns(900, TILE_MIN.species, 24));
  });

  it("keeps two small tiles side by side on a phone when asked, and changes nothing once they fit anyway", () => {
    // A 390 px phone leaves 358 px: two 176 px tiles and a 12 px gap need 364.
    assert.equal(tileColumns(358, TILE_MIN.species, 12), 1);
    assert.equal(tileColumns(358, TILE_MIN.species, 12, { minColumns: 2 }), 2);
    for (const width of [364, 500, 960, 1500]) assert.equal(tileColumns(width, TILE_MIN.species, 12, { minColumns: 2 }), tileColumns(width, TILE_MIN.species, 12));
  });

  it("matches the written ladder for 176 px species tiles at the sizes the toolkit supports", () => {
    const ladder: Array<[number, number]> = [[358, 2], [600, 3], [960, 4], [1176, 6], [1600, 8]];
    for (const [width, columns] of ladder) assert.equal(tileColumns(width, TILE_MIN.species, 24, { minColumns: 2 }), columns, `${width}px`);
  });
});

describe("tileWidth", () => {
  it("never exceeds the tile maximum, whatever the container, kind or gap", () => {
    for (const gap of GAPS) {
      for (const min of [TILE_MIN.species, TILE_MIN.visit, TILE_MIN.camera]) {
        for (let width = 200; width <= 2800; width += 7) {
          const tile = tileWidth(width, min, gap, { contentMax: SHELL.contentMaxGrid, minColumns: min === TILE_MIN.species ? 2 : 1 });
          assert.ok(tile <= SHELL.tileMax, `${tile} at ${width} (min ${min}, gap ${gap})`);
        }
      }
    }
  });

  it("caps a lone wide column instead of stretching it", () => {
    assert.equal(tileWidth(700, TILE_MIN.camera, 16), SHELL.tileMax);
    assert.equal(tileWidth(358, TILE_MIN.camera, 12), 358);
  });

  it("splits the free width evenly between the columns", () => {
    assert.equal(tileWidth(1000, 300, 20), (1000 - 2 * 20) / 3);
  });
});

describe("gridWidth", () => {
  it("is the container, capped, and never negative", () => {
    assert.equal(gridWidth(1664, 1600), 1600);
    assert.equal(gridWidth(900, 1600), 900);
    assert.equal(gridWidth(-4), 0);
  });
});
