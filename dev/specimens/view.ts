import { html, nothing, render } from "lit";
import type { TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { Specimen } from "../specimen-types.ts";
import type { LuDestination } from "../../src/shell/nav-model.ts";
import type { LuNavigateDetail } from "../../src/shell/nav.ts";
import { readSwr, subscribeSwr, swr } from "../../src/view/index.ts";
import type { LuViewEventDetail, LuViewStack } from "../../src/view/index.ts";

/** Specimens of the view slice: a small panel (app shell + view stack) with four tall views.
 *   - Scroll any view, switch tab, come back: it returns to exactly where you were; a returning view fades in.
 *   - `max` is 3, so opening the fourth view pushes out the one shown longest ago (`lu-view-evict`, see the log).
 *     The panel then removes that view, like a real consumer does.
 *   - "Visits" is fed by `swr`: its first visit shows a skeleton for a moment; after it was pushed out and comes
 *     back it paints its rows straight from memory and still returns to its scroll position.
 *   - The history button in the app bar calls `forgetScroll("wildlife")`: Wildlife then starts at the top.
 * `view-stack` scrolls inside the shell (`scroll="contained"`); `view-stack-page` is the Home Assistant way: the
 * page itself scrolls (open it alone, `?only=view-stack-page`, so no other specimen shares the page).
 * Pictures are painted SVGs with a reserved box, so nothing shifts while they load. */

const DESTINATIONS: LuDestination[] = [
  { id: "visits", label: "Visits", icon: "mdi:bird" },
  { id: "wildlife", label: "Wildlife", icon: "mdi:cat" },
  { id: "cameras", label: "Cameras", icon: "mdi:cctv" },
  { id: "settings", label: "Settings", icon: "mdi:cog" },
];

const VISITS_KEY = "view-specimen/visits";
const LOG_LINES = 3;
const SPECIES = ["Robin", "Blue tit", "Woodpecker", "Hedgehog", "Fox", "Blackbird", "Wren", "Magpie", "Jay", "Goldfinch", "Nuthatch", "Squirrel"];

interface Visit {
  title: string;
  when: string;
}

const pictures = new Map<number, string>();

/** A painted stand-in for a photo. */
function pictureUrl(index: number): string {
  let url = pictures.get(index);
  if (!url) {
    const hue = (index * 47) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 58%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 50% 34%)"/></linearGradient></defs><rect width="160" height="120" fill="url(#g)"/><circle cx="${40 + ((index * 13) % 80)}" cy="62" r="${18 + (index % 5) * 4}" fill="#fff" fill-opacity=".35"/></svg>`;
    pictures.set(index, (url = `data:image/svg+xml,${encodeURIComponent(svg)}`));
  }
  return url;
}

function tile(index: number, ratio: string): TemplateResult {
  const name = SPECIES[index % SPECIES.length];
  return html`<figure style="margin:0;display:grid;gap:var(--lu-space-1);align-content:start">
    <img src=${pictureUrl(index)} alt="" loading="lazy" decoding="async" style=${`display:block;width:100%;aspect-ratio:${ratio};object-fit:cover;border-radius:var(--lu-radius-tile)`} />
    <figcaption style="overflow:hidden;color:var(--lu-ink);font:600 var(--lu-type-label)/1.3 var(--lu-font);text-overflow:ellipsis;white-space:nowrap">${name} ${index + 1}</figcaption>
    <span style="color:var(--lu-ink-2);font:400 var(--lu-type-caption)/1.3 var(--lu-font)">${index + 3} min ago</span>
  </figure>`;
}

const rowStyle = "display:flex;align-items:center;justify-content:space-between;gap:var(--lu-space-3);box-sizing:border-box;min-height:var(--lu-row);padding:0 var(--lu-space-1);border-bottom:1px solid var(--lu-edge);font:400 var(--lu-type-body)/1.3 var(--lu-font)";
const heading = (text: string) => html`<h2 style="margin:0 0 var(--lu-space-3);color:var(--lu-ink);font:600 var(--lu-type-title)/1.25 var(--lu-font)">${text}</h2>`;

/** The views that never change are built once. */
const fixedViews = new Map<string, TemplateResult>();
function fixed(id: string, build: () => TemplateResult): TemplateResult {
  let view = fixedViews.get(id);
  if (!view) fixedViews.set(id, (view = build()));
  return view;
}

const wildlifeView = () => fixed("wildlife", () => html`<div data-view="wildlife">${heading("Wildlife")}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--lu-space-4) var(--lu-space-3)">${Array.from({ length: 80 }, (_, index) => tile(index, "4/3"))}</div>
</div>`);

const camerasView = () => fixed("cameras", () => html`<div data-view="cameras">${heading("Cameras")}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:var(--lu-space-4) var(--lu-space-3)">${Array.from({ length: 16 }, (_, index) => tile(index + 20, "16/9"))}</div>
</div>`);

const settingsView = () => fixed("settings", () => html`<div data-view="settings">${heading("Settings")}
  ${Array.from({ length: 48 }, (_, index) => html`<div style=${rowStyle}><span>Setting ${index + 1}</span><span style="color:var(--lu-ink-2)">${index % 2 ? "On" : "Off"}</span></div>`)}
</div>`);

/** The skeleton has the geometry of the rows, so the swap moves nothing that is on screen. */
const skeleton = () => fixed("skeleton", () => html`${Array.from({ length: 10 }, () => html`<div style=${rowStyle}><span style="width:55%;height:1em;border-radius:var(--lu-radius-row);background:var(--lu-material-hover-wash)"></span><span style="width:18%;height:1em;border-radius:var(--lu-radius-row);background:var(--lu-material-hover-wash)"></span></div>`)}`);

function visitsView(): TemplateResult {
  const { data } = readSwr<Visit[]>(VISITS_KEY);
  return html`<div data-view="visits">${heading("Visits")}
    ${data ? data.map((visit) => html`<div style=${rowStyle}><span>${visit.title}</span><span style="color:var(--lu-ink-2)">${visit.when}</span></div>`) : skeleton()}
  </div>`;
}

/** Stands in for the network: the visits arrive after 600 ms, unless the request is replaced meanwhile. */
function loadVisits(signal: AbortSignal): Promise<Visit[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(Array.from({ length: 60 }, (_, index) => ({ title: `${SPECIES[index % SPECIES.length]} at the feeder`, when: `${index + 2} min ago` }))), 600);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

const VIEWS: Record<string, () => TemplateResult> = { visits: visitsView, wildlife: wildlifeView, cameras: camerasView, settings: settingsView };

type ScrollArea = "contained" | "document";

/** The panel: shell + view stack + the log in the shell's bottom strip. Returns the function that tears it down. */
function mountDemo(host: HTMLElement, specimen: string, scroll: ScrollArea): () => void {
  const state = { current: "visits", mounted: ["visits"], log: [] as string[] };
  const hook = (name: string) => `${specimen}:${name}`;

  const note = (line: string): void => {
    state.log = [...state.log.slice(1 - LOG_LINES), line];
    draw();
  };

  /** Mounts the view if it is not alive, asks `swr` for the visits when that view is (re)built, and shows it. */
  const open = (id: string): void => {
    if (!state.mounted.includes(id)) state.mounted.push(id);
    if (id === "visits") swr(VISITS_KEY, loadVisits);
    state.current = id;
    draw();
  };

  const forgetWildlife = (): void => {
    host.querySelector<LuViewStack>(`[data-spec="${hook("stack")}"]`)?.forgetScroll("wildlife");
    note("forgot where Wildlife was scrolled to");
  };

  const draw = (): void => {
    const frame = scroll === "contained" ? "height:min(calc(100dvh - 32px),720px);border:1px solid var(--lu-edge)" : "";
    render(html`
      <spec-lu-app-shell data-spec=${hook("shell")} scroll=${scroll} style=${frame || nothing} heading="Lucent view stack" nav-label="Demo views"
          .destinations=${DESTINATIONS} .current=${state.current}
          @lu-navigate=${(event: CustomEvent<LuNavigateDetail>) => open(event.detail.id)}>
        <spec-lu-button slot="actions" kind="quiet" icon-only icon="mdi:history" label="Forget where Wildlife was scrolled to" data-spec=${hook("forget")} @click=${forgetWildlife}></spec-lu-button>
        <spec-lu-view-stack data-spec=${hook("stack")} .current=${state.current} max="3" memory-key=${`view-specimen-${scroll}`}
            @lu-view-shown=${(event: CustomEvent<LuViewEventDetail>) => note(`shown ${event.detail.id}`)}
            @lu-view-hidden=${(event: CustomEvent<LuViewEventDetail>) => note(`hidden ${event.detail.id}`)}
            @lu-view-evict=${(event: CustomEvent<LuViewEventDetail>) => {
              state.mounted = state.mounted.filter((id) => id !== event.detail.id);
              note(`evict ${event.detail.id} (removed)`);
            }}>
          ${repeat(state.mounted, (id) => id, (id) => VIEWS[id]?.() ?? nothing)}
        </spec-lu-view-stack>
        <div slot="bottom" data-spec=${hook("log")} role="log" aria-label="View events" style=${`box-sizing:border-box;height:calc(${LOG_LINES} * 1.5em + var(--lu-space-2) * 2);padding:var(--lu-space-2) var(--lu-space-4);overflow:hidden;color:var(--lu-ink-2);background:var(--lu-reading);border-top:1px solid var(--lu-edge);font:400 var(--lu-type-caption)/1.5 var(--lu-font)`}>${state.log.map((line) => html`<div>${line}</div>`)}</div>
      </spec-lu-app-shell>`, host);
  };

  const stopSwr = subscribeSwr(VISITS_KEY, draw);
  open("visits");
  return () => {
    stopSwr();
    render(nothing, host);
  };
}

/** Opened with `?only=<id>`: this specimen is the only one on the page. */
const shownAlone = (id: string): boolean => new URLSearchParams(location.search).get("only") === id;

/** The page-scrolling demo makes the whole specimen page scroll (as a Home Assistant panel does), so next to other
 * specimens it would swallow the page: there it shows a note and a link instead. */
function pageNote(id: string): TemplateResult {
  const url = new URL(location.href);
  url.searchParams.set("only", id);
  url.searchParams.set("plain", "1");
  return html`<p data-spec=${`${id}:note`} style="margin:0;padding:var(--lu-space-4);color:var(--lu-ink-2);font:400 var(--lu-type-body)/1.45 var(--lu-font)">
    This demo makes the whole page scroll, like a Home Assistant panel does, so it runs on a page of its own: <a href=${`${url.pathname}${url.search}`} style="color:var(--lu-accent)">open it alone</a>.
  </p>`;
}

export const specimens: Specimen[] = [
  {
    id: "view-stack",
    title: "View stack: keep-alive tabs, scroll memory, fade-in, eviction (max 3 of 4 views), swr; scrolls inside the shell",
    group: "view",
    size: "full",
    render: () => html`<div data-spec="view-stack:demo"></div>`,
    setup: (cell) => mountDemo(cell.querySelector<HTMLElement>('[data-spec="view-stack:demo"]') ?? cell, "view-stack", "contained"),
  },
  {
    id: "view-stack-page",
    title: "View stack on a scrolling page (the Home Assistant way); runs alone: ?only=view-stack-page",
    group: "view",
    size: "full",
    render: () => (shownAlone("view-stack-page") ? html`<div data-spec="view-stack-page:demo"></div>` : pageNote("view-stack-page")),
    setup: (cell) => (shownAlone("view-stack-page") ? mountDemo(cell.querySelector<HTMLElement>('[data-spec="view-stack-page:demo"]') ?? cell, "view-stack-page", "document") : undefined),
  },
];
