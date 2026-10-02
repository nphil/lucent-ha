/** Builds the harness: dev/harness.ts -> dev/dist/harness.js (+ chunks), ES modules with source maps.
 *
 *   scripts/lu-run node dev/build.mjs [--strict]
 *
 * What goes in, found by looking at the folders (nothing to register by hand):
 *   - the toolkit: every src/<area>/index.ts barrel (for an area without one, each of its files) and src/index.ts;
 *     the harness registers every element class they export as `spec-lu-<name>`;
 *   - dev/specimens/*.ts   (each exports `specimens: Specimen[]`)
 *   - dev/scenarios/*.ts   (each exports `scenario: Scenario`)
 * A file that does not build yet (a sibling slice is half-way through writing it) is LEFT OUT and reported here and on the page, so one
 * unfinished file never blocks everybody else's page. `--strict` turns any left-out file into a failure (use it before a release).
 * The in-memory module "lucent-dev:index" (typed in dev/virtual.d.ts) carries the list; nothing is generated on disk. */
import { build, formatMessages } from "esbuild";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEV = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(DEV, "..");
const SRC = join(REPO, "src");
const DIST = join(DEV, "dist");
const strict = process.argv.includes("--strict");

const tsFiles = (dir) => (existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts")).sort().map((file) => ({ file: join(dir, file), base: file })) : []);

/** Everything that may go into the page, each independently buildable: { kind, name, file }. */
function discover() {
  const found = [];
  for (const area of readdirSync(SRC, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    const barrel = join(SRC, area, "index.ts");
    if (existsSync(barrel)) found.push({ kind: "toolkit", name: area, file: barrel });
    else for (const { file, base } of tsFiles(join(SRC, area))) found.push({ kind: "toolkit", name: `${area}/${base}`, file });
  }
  if (existsSync(join(SRC, "index.ts"))) found.push({ kind: "toolkit", name: "index", file: join(SRC, "index.ts") });
  for (const { file, base } of tsFiles(join(DEV, "specimens"))) found.push({ kind: "specimen", name: `specimens/${base}`, file });
  for (const { file, base } of tsFiles(join(DEV, "scenarios"))) found.push({ kind: "scenario", name: `scenarios/${base}`, file });
  return found;
}

const common = { bundle: true, format: "esm", target: "es2021", platform: "browser", logLevel: "silent", tsconfig: join(REPO, "tsconfig.json") };

/** The in-memory "lucent-dev:index" module for the given entries. */
function virtualModule(entries, problems) {
  const list = (kind) => entries.filter((entry) => entry.kind === kind).map((entry) => `{ name: ${JSON.stringify(entry.name)}, load: () => import(${JSON.stringify(entry.file)}) }`).join(",\n  ");
  return {
    name: "lucent-dev-index",
    setup(b) {
      b.onResolve({ filter: /^lucent-dev:index$/ }, () => ({ path: "index", namespace: "lucent-dev" }));
      b.onLoad({ filter: /.*/, namespace: "lucent-dev" }, () => ({
        resolveDir: DEV,
        loader: "js",
        contents: [
          `export const toolkitLoaders = [\n  ${list("toolkit")}\n];`,
          `export const specimenLoaders = [\n  ${list("specimen")}\n];`,
          `export const scenarioLoaders = [\n  ${list("scenario")}\n];`,
          `export const buildProblems = ${JSON.stringify(problems)};`,
          `export const builtAt = ${JSON.stringify(new Date().toISOString())};`,
        ].join("\n"),
      }));
    },
  };
}

function bundle(entries, problems) {
  rmSync(join(DIST, "chunks"), { recursive: true, force: true });
  return build({
    ...common,
    entryPoints: { harness: join(DEV, "harness.ts") },
    outdir: DIST,
    splitting: true,
    sourcemap: true,
    chunkNames: "chunks/[name]-[hash]",
    plugins: [virtualModule(entries, problems)],
  });
}

/** First error of a failed build as one line: "src/shell/root.ts:12:3: Expected ..." */
function firstError(failure) {
  const error = failure.errors?.[0];
  if (!error) return String(failure.message ?? failure);
  const where = error.location ? `${error.location.file}:${error.location.line}:${error.location.column}: ` : "";
  return `${where}${error.text}`;
}

/** Builds one entry on its own (nothing written) to learn whether it compiles. */
async function compiles(entry) {
  try {
    await build({ ...common, entryPoints: [entry.file], write: false, outdir: join(DIST, ".check") });
    return undefined;
  } catch (failure) {
    return firstError(failure);
  }
}

const started = performance.now();
let entries = discover();
const problems = [];
try {
  await bundle(entries, problems);
} catch (firstFailure) {
  // Something does not build: find out which entries, leave them out, try again.
  for (const entry of entries.slice()) {
    const message = await compiles(entry);
    if (message) {
      problems.push({ file: entry.name, message });
      entries = entries.filter((other) => other !== entry);
    }
  }
  try {
    await bundle(entries, problems);
  } catch (secondFailure) {
    const text = (await formatMessages(secondFailure.errors ?? firstFailure.errors ?? [], { kind: "error", color: false, terminalWidth: 110 })).join("\n");
    console.error(`The harness itself does not build:\n${text || secondFailure.message}`);
    process.exit(1);
  }
}

const names = (kind) => entries.filter((entry) => entry.kind === kind).map((entry) => entry.name);
console.log(`harness built in ${Math.round(performance.now() - started)} ms -> dev/dist/harness.js`);
console.log(`  toolkit:   ${names("toolkit").join(", ") || "none yet"}`);
console.log(`  specimens: ${names("specimen").map((name) => name.replace("specimens/", "")).join(", ") || "none yet"}`);
console.log(`  scenarios: ${names("scenario").map((name) => name.replace("scenarios/", "")).join(", ") || "none yet"}`);
if (problems.length > 0) {
  console.log(`  LEFT OUT (does not build yet): ${problems.length}`);
  for (const problem of problems) console.log(`    ${problem.file}\n      ${problem.message}`);
  if (strict) process.exit(1);
}
