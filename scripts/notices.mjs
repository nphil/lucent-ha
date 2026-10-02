/** Rebuilds the "Derived files" list in THIRD_PARTY_NOTICES.md from the header comment of every source file that says
 * "Derived from music-assistant/frontend ...". Run after adding or changing a derived file:
 *   scripts/lu-run node scripts/notices.mjs [--check]
 * `--check` fails when the file is out of date (used before a release). */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) { if (name !== "node_modules" && name !== "dist") walk(path); continue; }
    if (/\.(ts|mjs)$/.test(name)) files.push(path);
  }
}
walk(join(root, "src"));
walk(join(root, "dev"));

const rows = [];
for (const path of files.sort()) {
  const text = readFileSync(path, "utf8");
  const header = /^\/\*([\s\S]*?)\*\//.exec(text)?.[1];
  if (!header || !/Derived from music-assistant\/frontend/.test(header)) continue;
  const flat = header.replace(/\s*\n\s*\*?\s*/g, " ").trim();
  const from = /Derived from music-assistant\/frontend (.*?) \(Apache-2\.0/.exec(flat)?.[1];
  const change = /Modified:\s*(.*)$/.exec(flat)?.[1]?.replace(/\s+/g, " ").trim();
  if (!from || !change) throw new Error(`${relative(root, path)}: header must read "Derived from music-assistant/frontend <path> (Apache-2.0, ...). Modified: <what>."`);
  rows.push(`- \`${relative(root, path)}\` <- \`${from}\`: ${change.replace(/\.$/, "")}.`);
}
if (rows.length === 0) throw new Error("no derived files found: refusing to write an empty list");

const target = join(root, "THIRD_PARTY_NOTICES.md");
const current = readFileSync(target, "utf8");
const block = `<!-- DERIVED-FILES -->\n${rows.join("\n")}\n<!-- /DERIVED-FILES -->`;
const pattern = /<!-- DERIVED-FILES -->[\s\S]*?(?:<!-- \/DERIVED-FILES -->|(?=\n\nNot copied))/;
if (!pattern.test(current)) throw new Error("THIRD_PARTY_NOTICES.md has no <!-- DERIVED-FILES --> marker");
const next = current.replace(pattern, block);
if (check) {
  if (next !== current) { console.error("THIRD_PARTY_NOTICES.md is out of date: run scripts/lu-run node scripts/notices.mjs"); process.exit(1); }
  console.log(`THIRD_PARTY_NOTICES.md is current (${rows.length} derived files)`);
} else {
  writeFileSync(target, next);
  console.log(`THIRD_PARTY_NOTICES.md: ${rows.length} derived files listed`);
}
