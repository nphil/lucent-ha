/** Proves the package works the way a consumer uses it: install -> type-check -> esbuild bundle -> load in a real
 * browser, with two differently-prefixed consumers (and a lean tree-shaken one) on ONE page.
 *
 *   scripts/lu-browser node scripts/consumer-test.mjs [--spec <npm spec>]
 *
 * Default spec: the tarball `npm pack` makes from this checkout. After a release pass
 * `--spec github:nphil/lucent-ha#v0.1.1` to test the published tag. Uses /tmp/lucent-consumer-test (removed at the end). */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = "/tmp/lucent-consumer-test";
const args = process.argv.slice(2);
const specIndex = args.indexOf("--spec");
let spec = specIndex >= 0 ? args[specIndex + 1] : "";
const run = (cmd, argv, cwd) => execFileSync(cmd, argv, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8", env: { ...process.env, NODE_ENV: "development" } });

rmSync(work, { recursive: true, force: true });
mkdirSync(join(work, "src"), { recursive: true });
if (!spec) {
  const out = run("npm", ["pack", "--silent", "--pack-destination", work], root).trim().split("\n").pop();
  spec = join(work, out);
}
console.log(`spec: ${spec}`);
writeFileSync(join(work, "package.json"), JSON.stringify({ name: "consumer-test", private: true, type: "module" }));
run("npm", ["install", "--include=dev", "--no-audit", "--no-fund", "--silent", spec, "lit@^3.3.0", "esbuild@^0.25.0", "typescript@^5.9.3"], work);
const installed = JSON.parse(readFileSync(join(work, "node_modules/lucent-ha/package.json"), "utf8"));
console.log(`installed lucent-ha ${installed.version}`);
cpSync(join(root, "examples/consumer"), join(work, "src"), { recursive: true });

// 1. Types: a consumer with strict flags and NO allowImportingTsExtensions must type-check against the package.
writeFileSync(join(work, "tsconfig.json"), JSON.stringify({
  compilerOptions: { target: "ES2021", module: "ESNext", moduleResolution: "bundler", lib: ["ES2022", "DOM", "DOM.Iterable"], strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: false, useDefineForClassFields: false, noEmit: true, skipLibCheck: false, types: [] },
  include: ["src"],
}));
run(join(work, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], work);
console.log("types: ok (strict consumer, skipLibCheck off)");

// 2. Bundles: each consumer bundles its own copy of the toolkit.
const bundles = [["alpha", "panel.ts"], ["beta", "panel.ts"], ["gamma", "lean.ts"]];
const sizes = {};
for (const [prefix, file] of bundles) {
  const out = join(work, `${prefix}.js`);
  run(join(work, "node_modules/.bin/esbuild"), [join("src", file), "--bundle", "--format=esm", "--target=es2021", "--minify", "--legal-comments=none", `--define:PREFIX="${prefix}"`, `--outfile=${out}`], work);
  const code = readFileSync(out);
  sizes[prefix] = { bytes: code.length, gzip: gzipSync(code).length };
}
console.log("bundle sizes:", JSON.stringify(sizes));
if (!(sizes.gamma.gzip < sizes.alpha.gzip * 0.6)) throw new Error(`lean bundle is not clearly smaller than the full one: ${JSON.stringify(sizes)}`);

// 3. Browser: both on one page; record every customElements.define.
const browser = await chromium.connectOverCDP("http://127.0.0.1:43977");
const context = browser.contexts()[0];
const page = await context.newPage();
const problems = [];
try {
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console.error: ${message.text()}`); });
  await page.addInitScript(() => {
    const defined = [];
    const original = customElements.define.bind(customElements);
    customElements.define = (name, ctor, options) => { defined.push(name); return original(name, ctor, options); };
    window.__defined = defined;
  });
  await page.goto("about:blank");
  await page.setContent("<!doctype html><body style='margin:0'><div id=host style='width:520px;height:420px'></div></body>");
  for (const [prefix] of bundles) await page.addScriptTag({ content: readFileSync(join(work, `${prefix}.js`), "utf8"), type: "module" });
  const result = await page.evaluate(async () => {
    const host = document.getElementById("host");
    const tags = ["alpha-sample-panel", "beta-sample-panel", "gamma-lean-panel"];
    for (const tag of tags) { host.appendChild(document.createElement(tag)); await customElements.whenDefined(tag); }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 400));
    const defined = window.__defined.slice();
    const panels = tags.map((tag) => {
      const element = host.querySelector(tag);
      const text = (element.shadowRoot?.textContent ?? "").replace(/\s+/g, " ").trim();
      const nested = [...(element.shadowRoot?.querySelectorAll("*") ?? [])].filter((child) => child.localName.includes("-lu-")).map((child) => ({ tag: child.localName, upgraded: !!customElements.get(child.localName) && child.constructor === customElements.get(child.localName), hasShadow: !!child.shadowRoot }));
      return { tag, size: [element.offsetWidth, element.offsetHeight], text, nested };
    });
    return { defined, panels };
  });
  console.log(JSON.stringify(result, null, 1));
  const bad = result.defined.filter((name) => !/^(alpha|beta|gamma)-/.test(name));
  if (bad.length) problems.push(`tags outside the consumers' prefixes: ${bad.join(", ")}`);
  for (const name of result.defined) {
    if (/^(lu|ha)-/.test(name)) problems.push(`forbidden namespace: ${name}`);
    if (name.startsWith("alpha-") === false && name.startsWith("beta-") === false && name.startsWith("gamma-") === false) problems.push(`unprefixed: ${name}`);
  }
  for (const prefix of ["alpha", "beta"]) {
    const luTags = result.defined.filter((name) => name.startsWith(`${prefix}-lu-`));
    if (luTags.length < 5) problems.push(`${prefix}: only ${luTags.length} toolkit tags registered`);
  }
  for (const panel of result.panels) {
    if (panel.size[0] === 0 || panel.size[1] === 0) problems.push(`${panel.tag} has no size`);
    if (!panel.text) problems.push(`${panel.tag} rendered no text`);
    for (const child of panel.nested) if (!child.upgraded || !child.hasShadow) problems.push(`${panel.tag}: ${child.tag} not upgraded`);
  }
  const gammaLu = result.defined.filter((name) => name.startsWith("gamma-lu-"));
  if (gammaLu.length > 4) problems.push(`lean consumer registered ${gammaLu.length} toolkit tags (${gammaLu.join(", ")}); expected only button, chip and their dependencies`);
  console.log(`alpha toolkit tags: ${result.defined.filter((n) => n.startsWith("alpha-lu-")).length}; beta: ${result.defined.filter((n) => n.startsWith("beta-lu-")).length}; gamma (lean): ${gammaLu.length}`);
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
  rmSync(work, { recursive: true, force: true });
}
if (problems.length) {
  console.error(`FAILED:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("consumer test passed: installs, type-checks (strict), bundles, registers only <prefix>-lu-* tags, two prefixes coexist on one page");
