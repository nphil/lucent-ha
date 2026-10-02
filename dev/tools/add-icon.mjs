/** Adds Material Design Icons to dev/mdi-subset.ts, the icons the harness's `ha-icon` stand-in can draw.
 *
 *   node dev/tools/add-icon.mjs bird cctv weather-night        (names as in `mdi:bird`, without the prefix; needs internet)
 *
 * The artwork is fetched from the @mdi/svg 7.4.47 package (Apache-2.0); the file stays sorted. Run `scripts/lu-run node dev/build.mjs`
 * afterwards. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "mdi-subset.ts");
const VERSION = "7.4.47";
const names = process.argv.slice(2).map((name) => name.replace(/^mdi:/, ""));
if (names.length === 0) {
  console.error("usage: node dev/tools/add-icon.mjs <icon-name>... (for example: bird cctv)");
  process.exit(2);
}

const source = readFileSync(FILE, "utf8");
const icons = new Map([...source.matchAll(/^ {2}"([a-z0-9-]+)": "([^"]+)",$/gm)].map((match) => [match[1], match[2]]));
for (const name of names) {
  if (icons.has(name)) {
    console.log(`${name}: already there`);
    continue;
  }
  const response = await fetch(`https://cdn.jsdelivr.net/npm/@mdi/svg@${VERSION}/svg/${name}.svg`);
  const path = response.ok ? /\sd="([^"]+)"/.exec(await response.text())?.[1] : undefined;
  if (!path) {
    console.error(`${name}: not an icon of @mdi/svg ${VERSION} (HTTP ${response.status})`);
    process.exitCode = 1;
    continue;
  }
  icons.set(name, path);
  console.log(`${name}: added`);
}

const head = source.slice(0, source.indexOf("export const MDI_PATHS"));
const body = [...icons].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, path]) => `  "${name}": "${path}",`).join("\n");
writeFileSync(FILE, `${head}export const MDI_PATHS: Readonly<Record<string, string>> = {\n${body}\n};\n`);
