import assert from "node:assert/strict";
import { test } from "node:test";
import { BUDGETS, budgetsOf, isFailure, judge, limitFor, stepsToRun, type BudgetId } from "../dev/lib/perf-budgets.ts";

const good: Partial<Record<BudgetId, number>> = { pressThread: 20, pressWall: 30, tabFirst: 60, tabStable: 200, sheetOpen: 150, back: 50, scrollLongTask: 0, cls: 0.001 };
const byId = (verdicts: ReturnType<typeof judge>) => Object.fromEntries(verdicts.map((verdict) => [verdict.id, verdict]));

test("a budget is met at exactly its limit and missed just above it", () => {
  const at = judge({ ...good, sheetOpen: 220, cls: 0.02 }, { cpu: 1, quiet: true });
  assert.equal(byId(at).sheetOpen?.status, "PASS");
  assert.equal(byId(at).cls?.status, "PASS");
  const over = judge({ ...good, sheetOpen: 220.1, cls: 0.0201 }, { cpu: 1, quiet: true });
  assert.equal(byId(over).sheetOpen?.status, "FAIL");
  assert.equal(byId(over).cls?.status, "FAIL");
});

test("only the tab switch gets twice the time at 4x CPU", () => {
  const limits = Object.fromEntries(BUDGETS.map((budget) => [budget.id, [limitFor(budget, 1), limitFor(budget, 4)]]));
  assert.deepEqual(limits.tabFirst, [100, 200]);
  assert.deepEqual(limits.tabStable, [300, 600]);
  for (const id of ["pressThread", "pressWall", "sheetOpen", "back", "scrollLongTask", "cls"]) assert.equal(limits[id]?.[0], limits[id]?.[1], id);
  const verdicts = byId(judge({ ...good, tabFirst: 190, sheetOpen: 230 }, { cpu: 4, quiet: true }));
  assert.equal(verdicts.tabFirst?.status, "PASS");
  assert.equal(verdicts.sheetOpen?.status, "FAIL");
});

test("on a busy host a slow wall-clock number is PROVISIONAL, but thread time and layout shift still fail the run", () => {
  const verdicts = byId(judge({ ...good, pressWall: 400, tabStable: 900, back: 300, scrollLongTask: 180, pressThread: 80, cls: 0.1 }, { cpu: 1, quiet: false }));
  for (const id of ["pressWall", "tabStable", "back", "scrollLongTask"] as const) {
    assert.equal(verdicts[id]?.status, "PROVISIONAL", id);
    assert.equal(isFailure(verdicts[id] as never), false, id);
  }
  for (const id of ["pressThread", "cls"] as const) {
    assert.equal(verdicts[id]?.status, "FAIL", id);
    assert.equal(isFailure(verdicts[id] as never), true, id);
  }
});

test("a number within its limit passes even on a busy host", () => {
  const verdicts = judge(good, { cpu: 1, quiet: false });
  assert.ok(verdicts.every((verdict) => verdict.status === "PASS"));
});

test("a missing number or a failed step is an ERROR that fails the run only on a quiet host", () => {
  const missing = judge({ ...good, back: null }, { cpu: 1, quiet: true });
  assert.equal(byId(missing).back?.status, "ERROR");
  assert.equal(isFailure(byId(missing).back as never), true);
  const busy = judge({ ...good, back: null }, { cpu: 1, quiet: false });
  assert.equal(isFailure(byId(busy).back as never), false);
  const stepFailed = judge(good, { cpu: 1, quiet: true, stepErrors: { sheet: "no tile to tap" } });
  assert.equal(byId(stepFailed).sheetOpen?.status, "ERROR");
  assert.equal(byId(stepFailed).sheetOpen?.note, "no tile to tap");
  assert.equal(byId(stepFailed).back?.status, "PASS");
});

test("a control that showed no feedback fails whatever the timing and whatever the load", () => {
  const verdicts = byId(judge(good, { cpu: 1, quiet: false, violations: { pressWall: "no visible feedback: species tile" } }));
  assert.equal(verdicts.pressWall?.status, "FAIL");
  assert.equal(isFailure(verdicts.pressWall as never), true);
});

test("only the budgets asked for are judged", () => {
  const verdicts = judge(good, { cpu: 1, quiet: true, wanted: budgetsOf(["tabs"]) });
  assert.deepEqual(verdicts.map((verdict) => verdict.id), ["tabFirst", "tabStable"]);
});

test("asking for Back runs the sheet step, asking for CLS runs everything that moves content, in cell order", () => {
  assert.deepEqual(stepsToRun(["back"]), ["sheet"]);
  assert.deepEqual(stepsToRun(["cls"]), ["tabs", "sheet", "scroll"]);
  assert.deepEqual(stepsToRun(["scroll", "press", "tabs"]), ["tabs", "press", "scroll"]);
});

test("a run can name a budget in its own words (the sheet number it chose)", () => {
  const verdicts = judge(good, { cpu: 1, quiet: true, labels: { sheetOpen: "sheet open, tap to enter motion finished" } });
  assert.equal(byId(verdicts).sheetOpen?.label, "sheet open, tap to enter motion finished");
  assert.equal(byId(verdicts).back?.label, "Back closes the top layer");
});
