import assert from "node:assert/strict";
import { test } from "node:test";
import { parseArgs, UsageError } from "../dev/lib/perf-args.ts";

const known = { sizes: ["phone", "smart", "desktop"], themes: ["flat-light", "flat-dark", "glass-light", "glass-dark"] };

test("the defaults are every size, flat and glass, 1x and 4x CPU, all steps", () => {
  const options = parseArgs([], known);
  assert.deepEqual(options.sizes, known.sizes);
  assert.deepEqual(options.themes, ["flat-light", "glass-dark"]);
  assert.deepEqual(options.cpu, [1, 4]);
  assert.equal(options.only.length, 6);
  assert.equal(options.requireQuiet, false);
});

test("lists, all and flags are read", () => {
  const options = parseArgs(["--sizes", "phone,smart", "--themes", "all", "--cpu", "1", "--only", "tabs,back", "--runs", "5", "--require-quiet", "--out", "dev/out/dry"], known);
  assert.deepEqual(options.sizes, ["phone", "smart"]);
  assert.equal(options.themes.length, 4);
  assert.deepEqual(options.cpu, [1]);
  assert.deepEqual(options.only, ["tabs", "back"]);
  assert.equal(options.runs, 5);
  assert.equal(options.requireQuiet, true);
  assert.equal(options.out, "dev/out/dry");
});

test("wrong input is refused with a message that names the problem", () => {
  assert.throws(() => parseArgs(["--sizes", "toaster"], known), (error: Error) => error instanceof UsageError && /toaster/.test(error.message) && /phone/.test(error.message));
  assert.throws(() => parseArgs(["--runs", "0"], known), UsageError);
  assert.throws(() => parseArgs(["--runs"], known), UsageError);
  assert.throws(() => parseArgs(["--cpu", "0"], known), UsageError);
  assert.throws(() => parseArgs(["--only", "sparkle"], known), UsageError);
  assert.throws(() => parseArgs(["--target", "ha"], known), UsageError);
  assert.throws(() => parseArgs(["--bogus"], known), UsageError);
});

test("the sheet budget judges the sheet appearing unless told to judge the finished motion", () => {
  assert.equal(parseArgs([], known).sheetGate, "shown");
  assert.equal(parseArgs(["--sheet-gate", "done"], known).sheetGate, "done");
  assert.throws(() => parseArgs(["--sheet-gate", "fast"], known), UsageError);
});

test("results can only be written to docs/perf or inside dev/out", () => {
  for (const out of ["docs/perf", "./docs/perf/", "docs/perf/run1", "dev/out", "dev/out/perf-dry"]) assert.doesNotThrow(() => parseArgs(["--out", out], known), out);
  for (const out of ["/tmp/x", "src", "docs", "dev/out/../../src", "docs/perf/../api", "dev/outside"]) assert.throws(() => parseArgs(["--out", out], known), UsageError, out);
});
