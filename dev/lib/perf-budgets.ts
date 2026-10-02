/** The performance budgets of the toolkit (plan B8) and the rule that turns a measured number into PASS / FAIL / PROVISIONAL / ERROR.
 * Pure. The budgets are release gates: a failing one stops the release, so what counts as "enforced" matters as much as the limits. */

export type BudgetId = "pressThread" | "pressWall" | "tabFirst" | "tabStable" | "sheetOpen" | "back" | "scrollLongTask" | "cls";
export type StepName = "press" | "tabs" | "sheet" | "back" | "scroll" | "cls";
export type Status = "PASS" | "FAIL" | "PROVISIONAL" | "ERROR";

export interface Budget {
  id: BudgetId;
  /** The step that produces the number. */
  step: StepName;
  label: string;
  unit: "ms" | "";
  /** The limit at 1x CPU. */
  limit: number;
  /** The limit is multiplied by this at 4x CPU throttling (a slow phone does the same work in more time; only the tab switch is allowed that). */
  slowCpuFactor: number;
  /** The number does not depend on how busy the host is (CPU time of the page's thread, or a layout-shift score), so it is enforced even on a
   * loaded host. Every other number is wall-clock time and is enforced only when the host is quiet. */
  loadProof: boolean;
}

export const BUDGETS: readonly Budget[] = [
  { id: "pressThread", step: "press", label: "press feedback, thread time", unit: "ms", limit: 50, slowCpuFactor: 1, loadProof: true },
  { id: "pressWall", step: "press", label: "press feedback, wall clock", unit: "ms", limit: 50, slowCpuFactor: 1, loadProof: false },
  { id: "tabFirst", step: "tabs", label: "cached tab switch, first paint", unit: "ms", limit: 100, slowCpuFactor: 2, loadProof: false },
  { id: "tabStable", step: "tabs", label: "cached tab switch, stable", unit: "ms", limit: 300, slowCpuFactor: 2, loadProof: false },
  { id: "sheetOpen", step: "sheet", label: "sheet open", unit: "ms", limit: 220, slowCpuFactor: 1, loadProof: false },
  { id: "back", step: "back", label: "Back closes the top layer", unit: "ms", limit: 100, slowCpuFactor: 1, loadProof: false },
  { id: "scrollLongTask", step: "scroll", label: "longest long task while scrolling", unit: "ms", limit: 50, slowCpuFactor: 1, loadProof: false },
  { id: "cls", step: "cls", label: "layout shift (CLS)", unit: "", limit: 0.02, slowCpuFactor: 1, loadProof: true },
];

/** The order a cell runs them in: the first visits of the tabs come first, while nothing has been cached yet. */
export const STEPS: readonly StepName[] = ["tabs", "press", "sheet", "back", "scroll", "cls"];

/** Steps that have to run to produce a step's number (CLS is read off the other steps' movement; sheet and back share their opening). */
export const STEPS_NEEDED: Readonly<Record<StepName, readonly StepName[]>> = {
  press: ["press"],
  tabs: ["tabs"],
  sheet: ["sheet"],
  back: ["sheet"],
  scroll: ["scroll"],
  cls: ["tabs", "sheet", "scroll"],
};

/** The limit that applies at this CPU throttling rate (1 = none). */
export function limitFor(budget: Budget, cpu: number): number {
  return cpu >= 4 ? budget.limit * budget.slowCpuFactor : budget.limit;
}

export interface Verdict {
  id: BudgetId;
  label: string;
  unit: "ms" | "";
  value: number | null;
  limit: number;
  status: Status;
  /** A failure here fails the run (exit code 1). */
  enforced: boolean;
  /** Why, when the number alone does not say (no feedback seen, step failed). */
  note?: string;
}

export interface JudgeOptions {
  cpu: number;
  /** The host load was below the limit (`PERF_MAX_LOAD`, default 64) before and after. */
  withinLimit: boolean;
  /** The budgets to report (the steps the user asked for). */
  wanted?: readonly BudgetId[];
  /** A step that could not be measured: its budgets get status ERROR with this message. */
  stepErrors?: Partial<Record<StepName, string>>;
  /** A condition that fails a budget whatever the timing is (a control that showed no feedback). Judged like a deterministic check, so enforced always. */
  violations?: Partial<Record<BudgetId, string>>;
  /** Replacement labels, for a budget whose definition the run chose (the sheet number). */
  labels?: Partial<Record<BudgetId, string>>;
}

/** PASS when within the limit (inclusive). Over the limit it is FAIL if the number is enforced (load-proof numbers always, wall-clock numbers when
 * the host load was within its limit) and PROVISIONAL otherwise: too slow, but the host was too busy to blame the toolkit. A passing wall-clock
 * number on a busy host is a real pass (a quieter host is never slower). A missing number is ERROR, enforced like a wall-clock number. */
export function judge(metrics: Partial<Record<BudgetId, number | null>>, options: JudgeOptions): Verdict[] {
  const wanted = new Set(options.wanted ?? BUDGETS.map((budget) => budget.id));
  const verdicts: Verdict[] = [];
  for (const budget of BUDGETS) {
    if (!wanted.has(budget.id)) continue;
    const limit = limitFor(budget, options.cpu);
    const value = metrics[budget.id] ?? null;
    const base = { id: budget.id, label: options.labels?.[budget.id] ?? budget.label, unit: budget.unit, value, limit };
    const enforcedIfOver = budget.loadProof || options.withinLimit;
    const violation = options.violations?.[budget.id];
    if (violation) {
      verdicts.push({ ...base, status: "FAIL", enforced: true, note: violation });
      continue;
    }
    const stepError = options.stepErrors?.[budget.step];
    if (value === null || stepError) {
      verdicts.push({ ...base, value: null, status: "ERROR", enforced: options.withinLimit, note: stepError ?? "not measured" });
      continue;
    }
    if (value <= limit) verdicts.push({ ...base, status: "PASS", enforced: enforcedIfOver });
    else verdicts.push({ ...base, status: enforcedIfOver ? "FAIL" : "PROVISIONAL", enforced: enforcedIfOver });
  }
  return verdicts;
}

/** Whether this verdict fails the run. */
export function isFailure(verdict: Verdict): boolean {
  return verdict.status === "FAIL" || (verdict.status === "ERROR" && verdict.enforced);
}

/** The steps to run for a set of budget steps the user asked for, in the order the cell runs them. */
export function stepsToRun(wanted: readonly StepName[]): StepName[] {
  const needed = new Set<StepName>();
  for (const step of wanted) for (const dependency of STEPS_NEEDED[step]) needed.add(dependency);
  return STEPS.filter((step) => needed.has(step) && step !== "back" && step !== "cls");
}

/** The budgets belonging to the steps asked for. */
export function budgetsOf(wanted: readonly StepName[]): BudgetId[] {
  return BUDGETS.filter((budget) => wanted.includes(budget.step)).map((budget) => budget.id);
}
