/** Sizes a server is asked for, smallest first. Matches the idea of Music Assistant's image proxy (a short
 * whitelist, so caches see few distinct URLs); the numbers are this toolkit's own. Apps with their own
 * thumbnail sizes pass `options.widths` (Kestrel: 160 / 320 / 640). */
export const DEFAULT_WIDTHS: readonly number[] = [80, 160, 256, 512, 1024];

/** A wide-screen phone is 3x; asking for more pixels than that only wastes bytes. */
export const MAX_DPR = 3;

/** Layout widths are fractions of a pixel (1/64); a width this close below a whitelist entry still counts as it. */
const LAYOUT_SLACK = 0.02;

export interface SizedUrlOptions {
  /** The widths the server accepts. Default `DEFAULT_WIDTHS`. */
  widths?: readonly number[];
  /** Query parameter that carries the width. Default `width`: the one extra parameter Home Assistant's signed media
   * links accept. */
  param?: string;
  /** Highest device-pixel-ratio worth serving. Default 3. */
  maxDpr?: number;
}

/** The smallest whitelisted width that has at least `needed` pixels; the largest one when none is big enough.
 * Returns null for an empty whitelist. */
export function pickWidth(needed: number, widths: readonly number[] = DEFAULT_WIDTHS): number | null {
  const sorted = widths.filter((width) => Number.isFinite(width) && width > 0).sort((a, b) => a - b);
  const last = sorted[sorted.length - 1];
  if (last === undefined) return null;
  return sorted.find((width) => width >= needed - LAYOUT_SLACK) ?? last;
}

/** True for URLs a query parameter can be added to: relative paths and http(s). `data:`, `blob:` and every
 * other scheme are left alone. */
export function canResize(url: string): boolean {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  return !scheme || /^https?$/i.test(scheme[1] ?? "");
}

/** Asks a media route for a picture just big enough (the server must resize: the helper cannot know; the caller decides
 * by using it only for routes that do): the smallest whitelisted width that is at least
 * `cssWidth x dpr` (rounded UP, so a tile is never soft and caches see few distinct URLs), clamped to the
 * largest width. The width goes in the query (`?width=320`); an existing query and `#fragment` are kept, and an
 * existing parameter of the same name is replaced. Returns the URL unchanged when it cannot be resized
 * (`data:`, `blob:`, other schemes), when `cssWidth` is not a positive number, or when the whitelist is empty. */
export function sizedUrl(url: string, cssWidth: number, dpr: number, options: SizedUrlOptions = {}): string {
  if (!url || !canResize(url) || !(cssWidth > 0)) return url;
  const maxDpr = options.maxDpr ?? MAX_DPR;
  const ratio = Math.min(Number.isFinite(dpr) && dpr > 0 ? dpr : 1, maxDpr);
  const width = pickWidth(cssWidth * ratio, options.widths ?? DEFAULT_WIDTHS);
  if (width === null) return url;
  return withQueryParam(url, options.param ?? "width", String(width));
}

/** Sets one query parameter, keeping the rest of the query and the fragment as they were. */
export function withQueryParam(url: string, name: string, value: string): string {
  const hash = url.indexOf("#");
  const fragment = hash >= 0 ? url.slice(hash) : "";
  const rest = hash >= 0 ? url.slice(0, hash) : url;
  const question = rest.indexOf("?");
  const path = question >= 0 ? rest.slice(0, question) : rest;
  const query = question >= 0 ? rest.slice(question + 1) : "";
  const key = encodeURIComponent(name);
  const kept = query.split("&").filter((pair) => pair !== "" && pair.split("=")[0] !== key);
  kept.push(`${key}=${encodeURIComponent(value)}`);
  return `${path}?${kept.join("&")}${fragment}`;
}
