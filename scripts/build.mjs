/** Builds `dist/`: plain ES2021 modules (one per source file, `.ts` imports rewritten to `.js`) plus `.d.ts`
 * declarations whose relative imports end in `.js` (so a consumer needs no `allowImportingTsExtensions`).
 * `dist/` is committed: a git dependency (`github:nphil/lucent-ha#vX.Y.Z`) installs it as is, no build step. */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = /VERSION = "([^"]+)"/.exec(readFileSync(join(root, "src/version.ts"), "utf8"))?.[1];
if (version !== pkg.version) {
  console.error(`src/version.ts says ${version} but package.json says ${pkg.version}`);
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
execFileSync(join(root, "node_modules/.bin/tsc"), ["-p", join(root, "tsconfig.build.json")], { stdio: "inherit", cwd: root });

let files = 0;
let bytes = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    files += 1;
    bytes += statSync(path).size;
    if (name.endsWith(".d.ts")) {
      const before = readFileSync(path, "utf8");
      const after = before
        .replace(/(from\s+["'])(\.{1,2}\/[^"']*)\.ts(["'])/g, "$1$2.js$3")
        .replace(/(import\(\s*["'])(\.{1,2}\/[^"']*)\.ts(["']\s*\))/g, "$1$2.js$3");
      if (after !== before) writeFileSync(path, after);
    }
  }
}
walk(dist);
console.log(`lucent-ha ${version}: ${files} files, ${(bytes / 1024).toFixed(0)} KiB in dist/`);
