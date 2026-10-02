/** Turns the results of a run into the table printed on the console and the markdown page (docs/perf/latest.md). Pure. */
import { isFailure, type BudgetId, type StepName, type Verdict } from "./perf-budgets.ts";
import { DEFAULT_LOAD_LIMIT, describeLoad, type LoadReading } from "./perf-load.ts";

/** A table a step wants shown under its cell (per-control press costs, the tab switches one by one). */
export interface DetailTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface CellResult {
  key: string;
  size: string;
  width: number;
  height: number;
  theme: string;
  cpu: number;
  startedAt: string;
  seconds: number;
  load: LoadReading;
  /** The numbers were measured on a busy host: wall-clock gates are not enforced. */
  provisional: boolean;
  /** Time a fixed 30-million-step loop took in the page (how fast the host is right now). */
  calibrationMs: number | null;
  /** Facts about the scenario that are not gated. */
  page: Record<string, number | string | null>;
  metrics: Partial<Record<BudgetId, number | null>>;
  verdicts: Verdict[];
  /** Steps that needed a retry to produce their numbers. */
  flaky: string[];
  /** Warnings: skipped controls, page errors. */
  notes: string[];
  details: DetailTable[];
  /** The raw samples of every step. */
  raw: Partial<Record<StepName | "load", unknown>>;
}

export interface PerfResult {
  version: 1;
  generatedAt: string;
  target: "harness";
  /** The options the cells were measured with; a resumed run must match them. */
  config: { runs: number; passes: number; sheetGate: "shown" | "done"; only: StepName[] };
  cells: CellResult[];
}

export type CellStatus = "PASS" | "FAIL" | "PROVISIONAL";

/** FAIL when any budget failed for real; PROVISIONAL when the host was busy (whatever passed is a pass, but not yet a clean one); else PASS. */
export function cellStatus(cell: Pick<CellResult, "verdicts" | "provisional">): CellStatus {
  if (cell.verdicts.some(isFailure)) return "FAIL";
  return cell.provisional ? "PROVISIONAL" : "PASS";
}

export function resultFailed(result: Pick<PerfResult, "cells">): boolean {
  return result.cells.some((cell) => cellStatus(cell) === "FAIL");
}

export function formatValue(value: number | null, unit: "ms" | ""): string {
  if (value === null || !Number.isFinite(value)) return "-";
  if (unit === "") return String(Math.round(value * 1000) / 1000);
  return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10} ms`;
}

export function cellTitle(cell: CellResult): string {
  const tag = cell.provisional ? `PROVISIONAL (load ${cell.load.limit} or more)` : `load under ${cell.load.limit}`;
  return `${cell.size} ${cell.width}x${cell.height} | ${cell.theme} | cpu ${cell.cpu}x | ${describeLoad(cell.load)} | ${tag}`;
}

function verdictRow(cell: CellResult, verdict: Verdict): string[] {
  const note = verdict.note ? `  (${verdict.note})` : "";
  return [verdict.label, formatValue(verdict.value, verdict.unit), `<= ${formatValue(verdict.limit, verdict.unit)}`, verdict.status + (cell.provisional ? " [PROVISIONAL]" : "") + note];
}

/** Rows as aligned columns; `markdown` makes a pipe table with a header rule. */
export function renderRows(header: readonly string[], rows: readonly (readonly (string | number)[])[], markdown = false): string {
  const cells = rows.map((row) => row.map(String));
  if (markdown) {
    const line = (row: readonly string[]): string => `| ${row.map((cell) => cell.replace(/\|/g, "/")).join(" | ")} |`;
    return [line(header), line(header.map(() => "---")), ...cells.map(line)].join("\n");
  }
  const widths = header.map((title, column) => Math.max(title.length, ...cells.map((row) => (row[column] ?? "").length)));
  const line = (row: readonly string[]): string => row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join("  ").trimEnd();
  return [line(header), ...cells.map(line)].join("\n");
}

/** What the console prints for one cell. */
export function renderCell(cell: CellResult): string {
  const lines = [`== ${cellTitle(cell)}`];
  lines.push(renderRows(["budget", "measured", "limit", "status"], cell.verdicts.map((verdict) => verdictRow(cell, verdict))));
  if (cell.flaky.length) lines.push(`flaky (needed a retry): ${cell.flaky.join(", ")}`);
  for (const note of cell.notes) lines.push(`note: ${note}`);
  return lines.join("\n");
}

/** One line per cell for the top of the page: size, theme, cpu, status. */
function summaryTable(cells: readonly CellResult[]): string {
  const rows = cells.map((cell) => [cell.size, cell.theme, `${cell.cpu}x`, cellStatus(cell), describeLoad(cell.load)]);
  return renderRows(["size", "theme", "cpu", "result", "host"], rows, true);
}

export function renderMarkdown(result: PerfResult): string {
  const counts = { PASS: 0, FAIL: 0, PROVISIONAL: 0 };
  for (const cell of result.cells) counts[cellStatus(cell)] += 1;
  const lines = [
    "# Performance budget results",
    "",
    `Measured ${result.generatedAt.slice(0, 16).replace("T", " ")} UTC against the scenario panel of the dev harness (\`?scenario=panel\`), ${result.config.runs} run${result.config.runs === 1 ? "" : "s"} per measurement, ${result.config.passes} scroll passes. See [docs/perf.md](../perf.md) for what each number means.`,
    "",
    `**${result.cells.length} cells: ${counts.PASS} PASS, ${counts.FAIL} FAIL, ${counts.PROVISIONAL} PROVISIONAL.** PROVISIONAL = the host's one-minute load was ${result.cells[0]?.load.limit ?? DEFAULT_LOAD_LIMIT} or more (or unknown) while the cell was measured, so slow wall-clock numbers are not blamed on the toolkit; measure again when the load is lower. The load is shown for every cell.`,
    "",
    summaryTable(result.cells),
  ];
  for (const cell of result.cells) {
    lines.push("", `## ${cellTitle(cell)}`, "", `Result: **${cellStatus(cell)}**. Calibration loop ${cell.calibrationMs ?? "-"} ms. Took ${cell.seconds} s.`, "");
    lines.push(renderRows(["budget", "measured", "limit", "status"], cell.verdicts.map((verdict) => verdictRow(cell, verdict)), true));
    if (cell.flaky.length) lines.push("", `Flaky (needed a retry): ${cell.flaky.join(", ")}.`);
    for (const note of cell.notes) lines.push("", `Note: ${note}`);
    const facts = Object.entries(cell.page).filter(([, value]) => value !== null);
    if (facts.length) lines.push("", `Scenario facts (not gated): ${facts.map(([name, value]) => `${name} ${value}`).join(", ")}.`);
    for (const table of cell.details) lines.push("", `**${table.title}**`, "", renderRows(table.columns, table.rows, true));
  }
  return `${lines.join("\n")}\n`;
}
