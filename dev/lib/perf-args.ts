/** Command line of dev/perf-check.mjs. Pure: the lists of known sizes and themes are passed in. */
import { STEPS, type StepName } from "./perf-budgets.ts";

export interface PerfOptions {
  target: "harness";
  sizes: string[];
  themes: string[];
  cpu: number[];
  only: StepName[];
  runs: number;
  /** Scroll passes per cell (down and up alternately). */
  passes: number;
  /** Which sheet number the 220 ms budget judges: the sheet on screen and entering, or its finished enter motion (which takes 220 ms by design). */
  sheetGate: "shown" | "done";
  out: string;
  requireQuiet: boolean;
  /** Start over instead of resuming from the results already in `out`. */
  force: boolean;
  /** Seconds one cell (one tab) may take before the watchdog closes it. */
  cellTimeout: number;
  help: boolean;
}

export class UsageError extends Error {}

export const DEFAULT_THEMES = ["flat-light", "glass-dark"];

export const USAGE = `Usage: scripts/lu-browser node dev/perf-check.mjs [options]

  --sizes a,b|all     screen sizes of dev/devices.json (default: all nine)
  --themes a,b|all    flat-light, flat-dark, glass-light, glass-dark (default: flat-light,glass-dark)
  --cpu 1,4           CPU throttling rates (default: 1,4)
  --only a,b          press, tabs, sheet, back, scroll, cls (default: all)
  --runs 3            repeats of each press / tab switch / sheet open / Back (default: 3)
  --passes 6          scroll passes of about 2500 px (default: 6)
  --sheet-gate shown  judge the 220 ms sheet budget on the sheet appearing (shown) or on its enter motion ending (done)
  --out docs/perf     where latest.json and latest.md go (docs/perf or inside dev/out)
  --require-quiet     refuse to run (exit 3) while the host load is 8 or more
  --force             ignore results already in --out
  --cell-timeout 600  seconds before the watchdog closes a stuck tab
  --target harness    the scenario panel of the dev harness (the only target)

Exit codes: 0 = no gate failed, 1 = a gate failed on a quiet host (or a load-proof number failed), 2 = cannot run (usage, server down, scenario
missing), 3 = refused (--require-quiet on a busy host) or the watchdog stopped a stuck step.`;

function list(text: string, known: readonly string[], what: string): string[] {
  if (text === "all") return [...known];
  const items = text.split(",").map((item) => item.trim()).filter(Boolean);
  const unknown = items.filter((item) => !known.includes(item));
  if (!items.length || unknown.length) throw new UsageError(`${what}: ${unknown.length ? `unknown "${unknown.join('", "')}"` : "nothing given"} (known: ${known.join(", ")})`);
  return [...new Set(items)];
}

function whole(text: string, what: string, min: number): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < min) throw new UsageError(`${what}: expected a whole number of at least ${min}, got "${text}"`);
  return value;
}

/** `--out` may only point at docs/perf or inside dev/out: the tool writes nowhere else. */
export function checkOut(out: string): string {
  const clean = out.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (clean.split("/").includes("..")) throw new UsageError(`--out: "${out}" may not contain ..`);
  if (clean === "docs/perf" || clean.startsWith("docs/perf/") || clean === "dev/out" || clean.startsWith("dev/out/")) return clean;
  throw new UsageError(`--out: "${out}" is not allowed; the tool writes only to docs/perf or dev/out`);
}

export function parseArgs(argv: readonly string[], known: { sizes: readonly string[]; themes: readonly string[] }): PerfOptions {
  const options: PerfOptions = {
    target: "harness",
    sizes: [...known.sizes],
    themes: [...DEFAULT_THEMES],
    cpu: [1, 4],
    only: [...STEPS],
    runs: 3,
    passes: 6,
    sheetGate: "shown",
    out: "docs/perf",
    requireQuiet: false,
    force: false,
    cellTimeout: 600,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index] as string;
    const flag = (): string => {
      const value = argv[(index += 1)];
      if (value === undefined || value.startsWith("--")) throw new UsageError(`${name} needs a value`);
      return value;
    };
    switch (name) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--require-quiet":
        options.requireQuiet = true;
        break;
      case "--force":
        options.force = true;
        break;
      case "--target": {
        const value = flag();
        if (value !== "harness") throw new UsageError(`--target ${value}: only "harness" exists (the scenario panel of the dev harness)`);
        break;
      }
      case "--sizes":
        options.sizes = list(flag(), known.sizes, "--sizes");
        break;
      case "--themes":
        options.themes = list(flag(), known.themes, "--themes");
        break;
      case "--cpu": {
        const rates = flag().split(",").map((item) => Number(item.trim()));
        if (!rates.length || rates.some((rate) => !Number.isFinite(rate) || rate < 1)) throw new UsageError("--cpu: expected rates like 1,4 (1 = no throttling)");
        options.cpu = [...new Set(rates)];
        break;
      }
      case "--only":
        options.only = list(flag(), STEPS, "--only") as StepName[];
        break;
      case "--runs":
        options.runs = whole(flag(), "--runs", 1);
        break;
      case "--passes":
        options.passes = whole(flag(), "--passes", 1);
        break;
      case "--sheet-gate": {
        const value = flag();
        if (value !== "shown" && value !== "done") throw new UsageError(`--sheet-gate: "shown" or "done", got "${value}"`);
        options.sheetGate = value;
        break;
      }
      case "--cell-timeout":
        options.cellTimeout = whole(flag(), "--cell-timeout", 30);
        break;
      case "--out":
        options.out = checkOut(flag());
        break;
      default:
        throw new UsageError(`unknown option "${name}" (try --help)`);
    }
  }
  return options;
}
