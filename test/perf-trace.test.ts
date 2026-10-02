import assert from "node:assert/strict";
import { test } from "node:test";
import { pressThreadMs, type TraceEvent } from "../dev/lib/perf-trace.ts";

const down = (ts: number, tid = 7): TraceEvent => ({ name: "EventDispatch", ph: "X", pid: 1, tid, ts, dur: 100, args: { data: { type: "pointerdown" } } });
const work = (name: string, ts: number, dur: number, tdur: number | undefined, tid = 7): TraceEvent => ({ name, ph: "X", pid: 1, tid, ts, dur, tdur });

test("sums the thread time of the frame work in the 160 ms after the pointerdown", () => {
  const trace = [down(1_000_000), work("UpdateLayoutTree", 1_001_000, 3000, 2000), work("Paint", 1_010_000, 4000, 3500), work("Commit", 1_100_000, 1000, 500), work("Paint", 1_300_000, 9000, 9000)];
  const result = pressThreadMs(trace);
  assert.equal(result.found, true);
  assert.equal(result.ms, 6);
  assert.equal(result.events, 3);
});

test("uses the thread (CPU) time, not the wall time, and falls back to the wall time when a trace has none", () => {
  const loaded = [down(0), work("Layout", 1000, 40_000, 2000)];
  assert.equal(pressThreadMs(loaded).ms, 2);
  assert.equal(pressThreadMs([down(0), work("Layout", 1000, 4000, undefined)]).ms, 4);
});

test("work on other threads, work of other kinds and work before the pointerdown do not count", () => {
  const trace = [down(1_000_000), work("Layout", 1_001_000, 5000, 5000, 9), work("FunctionCall", 1_002_000, 5000, 5000), work("Layout", 990_000, 5000, 5000)];
  assert.equal(pressThreadMs(trace).ms, 0);
});

test("a slice nested inside another counted slice is not added twice", () => {
  const trace = [down(0), work("Paint", 1000, 10_000, 8000), work("Layerize", 2000, 3000, 2500), work("Commit", 20_000, 1000, 1000)];
  const result = pressThreadMs(trace);
  assert.equal(result.ms, 9);
  assert.equal(result.events, 2);
});

test("a trace without a pointerdown is reported as not found", () => {
  assert.deepEqual(pressThreadMs([work("Layout", 0, 100, 100)]), { found: false, ms: 0, events: 0 });
});
