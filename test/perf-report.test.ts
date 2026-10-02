import assert from "node:assert/strict";
import { test } from "node:test";
import { judge } from "../dev/lib/perf-budgets.ts";
import { classifyLoad, describeLoad, parseLoad, QUIET_LOAD } from "../dev/lib/perf-load.ts";
import { cellStatus, formatValue, renderCell, renderMarkdown, resultFailed, type CellResult, type PerfResult } from "../dev/lib/perf-report.ts";
import { maxOf, median, summarize } from "../dev/lib/perf-stats.ts";

const cell = (load: [number | null, number | null], metrics: Parameters<typeof judge>[0], overrides: Partial<CellResult> = {}): CellResult => {
  const reading = classifyLoad(load[0], load[1]);
  return {
    key: "phone|flat-light|1", size: "phone", width: 390, height: 844, theme: "flat-light", cpu: 1, startedAt: "2026-10-01T00:00:00Z", seconds: 12,
    load: reading, provisional: !reading.quiet, calibrationMs: 40, page: { nodes: 900, images: null }, metrics,
    verdicts: judge(metrics, { cpu: 1, quiet: reading.quiet }), flaky: [], notes: [], details: [{ title: "Press", columns: ["control", "ms"], rows: [["camera tile", 12]] }], raw: {}, ...overrides,
  };
};
const ok = { pressThread: 20, pressWall: 30, tabFirst: 60, tabStable: 200, sheetOpen: 150, back: 50, scrollLongTask: 0, cls: 0 };

test("the load is quiet only when both readings are known and below 8", () => {
  assert.equal(QUIET_LOAD, 8);
  assert.equal(classifyLoad(3, 7.9).quiet, true);
  assert.equal(classifyLoad(3, 8).quiet, false);
  assert.equal(classifyLoad(9, 2).quiet, false);
  assert.equal(classifyLoad(3, null).quiet, false);
  assert.equal(classifyLoad(3, 12).max, 12);
  assert.equal(classifyLoad(null, null).max, null);
});

test("load text is read leniently and unknown text is not a number", () => {
  assert.equal(parseLoad("20.72\n"), 20.72);
  assert.equal(parseLoad("1.50 2.00 3.00 1/200 99"), 1.5);
  assert.equal(parseLoad("unknown"), null);
  assert.equal(parseLoad(""), null);
  assert.equal(describeLoad({ before: 3.21, after: null }), "load 3.2 > ?");
});

test("statistics ignore what is not a number and handle even counts and empty input", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.ok(Number.isNaN(median([])));
  assert.deepEqual(summarize([5, Number.NaN, 1, 3]), { n: 3, median: 3, min: 1, max: 5 });
  assert.equal(summarize([]), null);
  assert.equal(maxOf([]), null);
});

test("a cell is FAIL when a gate failed, PROVISIONAL when the host was busy, PASS otherwise", () => {
  assert.equal(cellStatus(cell([2, 3], ok)), "PASS");
  assert.equal(cellStatus(cell([2, 30], ok)), "PROVISIONAL");
  assert.equal(cellStatus(cell([2, 3], { ...ok, back: 400 })), "FAIL");
  assert.equal(cellStatus(cell([2, 30], { ...ok, back: 400 })), "PROVISIONAL");
  assert.equal(cellStatus(cell([2, 30], { ...ok, pressThread: 400 })), "FAIL");
});

test("the run fails when any cell failed for real", () => {
  const result = (cells: CellResult[]): Pick<PerfResult, "cells"> => ({ cells });
  assert.equal(resultFailed(result([cell([2, 3], ok), cell([2, 3], { ...ok, cls: 0.5 })])), true);
  assert.equal(resultFailed(result([cell([2, 3], ok), cell([20, 30], { ...ok, back: 900 })])), false);
});

test("every row of a provisional cell says so, and the console table names the status of each budget", () => {
  const text = renderCell(cell([20, 30], { ...ok, back: 400 }));
  const rows = text.split("\n").filter((line) => /ms|^cumulative|layout shift/.test(line) && !line.startsWith("=="));
  assert.ok(rows.length >= 8);
  for (const row of rows) assert.match(row, /PROVISIONAL/, row);
  assert.match(text, /Back closes the top layer\s+400 ms\s+<= 100 ms\s+PROVISIONAL/);
  assert.doesNotMatch(renderCell(cell([2, 3], ok)), /PROVISIONAL/);
});

test("the markdown page has a summary line per cell, the detail tables and the flaky list", () => {
  const result: PerfResult = { version: 1, generatedAt: "2026-10-01T10:20:00Z", target: "harness", config: { runs: 3, passes: 6, sheetGate: "shown", only: ["tabs"] }, cells: [cell([2, 3], ok, { flaky: ["sheet"] }), cell([2, 3], { ...ok, back: 400 }, { theme: "glass-dark" })] };
  const page = renderMarkdown(result);
  assert.match(page, /\| phone \| flat-light \| 1x \| PASS \|/);
  assert.match(page, /\| phone \| glass-dark \| 1x \| FAIL \|/);
  assert.match(page, /Flaky \(needed a retry\): sheet/);
  assert.match(page, /\| camera tile \| 12 \|/);
  assert.match(page, /2 cells: 1 PASS, 1 FAIL, 0 PROVISIONAL/);
});

test("values are shown in a readable unit", () => {
  assert.equal(formatValue(12.345, "ms"), "12.3 ms");
  assert.equal(formatValue(123.4, "ms"), "123 ms");
  assert.equal(formatValue(0.00412, ""), "0.004");
  assert.equal(formatValue(null, "ms"), "-");
});
