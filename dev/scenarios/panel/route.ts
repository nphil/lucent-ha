/** The panel's addresses, read and written in one place. Pure (no `lit`, no DOM).
 *
 *   /<prefix>/live | /library | /insights      the three tabs (an empty path is Live)
 *   /<prefix>/library?s=Robin                  the species sheet over Library
 *   /<prefix>/visit?v=3                        the detail page
 *
 * `prefix` is whatever Home Assistant gave the panel (`route.prefix`, "/kestrel" in a real panel). */
import type { Page, Route, Tab } from "./types.ts";

export const TABS: readonly Tab[] = ["live", "library", "insights"];

/** The query parameters this panel owns. Any other parameter in the address belongs to somebody else (the dev harness keeps its
 * `scenario` and `theme` there) and is carried along when the panel moves, so a reload lands on the same page. */
const OWN_PARAMS = ["s", "v"];

export function isTab(value: string): value is Tab {
  return (TABS as readonly string[]).includes(value);
}

/** Reads an address. Anything unknown is Live. */
export function parseRoute(prefix: string, pathname: string, search: string): Route {
  const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : "";
  const first = path.split("/")[1] ?? "";
  const query = new URLSearchParams(search);
  if (first === "visit") return { page: "visit", species: "", visit: query.get("v") ?? "" };
  const page: Tab = isTab(first) ? first : "live";
  return { page, species: page === "library" ? (query.get("s") ?? "") : "", visit: "" };
}

/** The address of a page, keeping the current query's foreign parameters. */
export function routePath(prefix: string, target: { page: Page; species?: string; visit?: string }, search: string): string {
  const query = new URLSearchParams(search);
  for (const key of OWN_PARAMS) query.delete(key);
  if (target.page === "visit" && target.visit) query.set("v", target.visit);
  if (target.page === "library" && target.species) query.set("s", target.species);
  const text = query.toString();
  return `${prefix}/${target.page}${text ? `?${text}` : ""}`;
}

export function sameRoute(a: Route, b: Route): boolean {
  return a.page === b.page && a.species === b.species && a.visit === b.visit;
}
