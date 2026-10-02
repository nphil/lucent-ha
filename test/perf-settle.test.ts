import assert from "node:assert/strict";
import { test } from "node:test";
import { analyseTimeline, paintedAt, type Timeline } from "../dev/lib/perf-settle.ts";

/** 60 fps frames from 1000 to `until`. */
const frames = (until: number): number[] => Array.from({ length: Math.floor((until - 1000) / 16) + 1 }, (_, index) => 1000 + index * 16);
const timeline = (overrides: Partial<Timeline>): Timeline => ({ t0: 1000, mutations: [], animationFrames: [], shifts: [], images: [], frames: frames(2000), until: 2000, ...overrides });

test("a change reaches the screen at the second frame after it", () => {
  assert.equal(paintedAt(1003, [1000, 1016, 1032, 1048], 2000), 1032);
  assert.equal(paintedAt(1016, [1000, 1016, 1032, 1048], 2000), 1048);
});

test("when the recording ends before the second frame, the end of the recording is used", () => {
  assert.equal(paintedAt(1040, [1000, 1016, 1032, 1048], 1060), 1060);
});

test("a tap that changes nothing has no first and no stable time", () => {
  assert.deepEqual(analyseTimeline(timeline({})), { firstMs: null, stableMs: null, settled: false });
});

test("first is the earliest reaction, stable the last one, both counted from the tap", () => {
  const result = analyseTimeline(timeline({ mutations: [1005, 1020], animationFrames: [1032, 1048, 1064, 1080, 1096, 1112, 1128, 1144, 1160, 1176, 1192, 1208] }));
  assert.equal(result.firstMs, 1032 - 1000);
  assert.equal(result.stableMs, 1208 - 1000);
  assert.equal(result.settled, true);
});

test("changes before the tap are not the tap's doing", () => {
  const result = analyseTimeline(timeline({ mutations: [900, 950], shifts: [1100] }));
  assert.equal(result.firstMs, 100);
  assert.equal(result.stableMs, 100);
});

test("a late picture or layout shift moves stable even after a quiet stretch", () => {
  assert.equal(analyseTimeline(timeline({ mutations: [1005], images: [1500] })).stableMs, 528);
  assert.equal(analyseTimeline(timeline({ mutations: [1005], shifts: [1520] })).stableMs, 520);
});

test("stable is not claimed when the recording ended less than the quiet time after the last change", () => {
  const result = analyseTimeline(timeline({ mutations: [1005], animationFrames: [1900], until: 1950 }), { quietMs: 100 });
  assert.equal(result.stableMs, 900);
  assert.equal(result.settled, false);
  assert.equal(analyseTimeline(timeline({ animationFrames: [1900], until: 2000 }), { quietMs: 100 }).settled, true);
});
