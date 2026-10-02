import { html, nothing, render } from "lit";
import type { TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { Specimen } from "../specimen-types.ts";
import type { LuDestination } from "../../src/shell/nav-model.ts";
import type { LuNavigateDetail } from "../../src/shell/nav.ts";
import { readSwr, subscribeSwr, swr } from "../../src/view/index.ts";
import type { LuViewEventDetail, LuViewStack } from "../../src/view/index.ts";

/** One specimen: a small panel (app shell + view stack) with four tall views.
 *   - Scroll any view, switch tab, come back: it returns to exactly where you were; a returning view fades in.
 *   - `max` is 3, so opening the fourth view pushes out the one shown longest ago (`lu-view-evict`, see the log).
 *     The panel then removes that view, like a real consumer does.
 *   - "Visits" is fed by `swr`: its first visit shows a skeleton for a moment; after it was pushed out and comes
 *     back it paints its rows straight from memory and still returns to its scroll position.
 * Pictures are painted SVGs with a reserved box, so nothing shifts while they load. */

const DESTINATIONS: LuDestination[] = [
  { id: "visits", label: "Visits", icon: "mdi:bird" },
  { id: "wildlife", label: "Wildlife", icon: "mdi:cat" },
  { id: "cameras", label: "Cameras", icon: "mdi:cctv" },
  { id: "settings", label: "Settings", icon: "mdi:cog" },
];

const VISITS_KEY = "view-specimen/visits";
const LOG_LINES = 6;

interface Visit {
  title: string;
  when: string;
}

/** A painted stand-in for a photo. */
function pictureUrl(index: number): string {
  const hue = (index * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 55% 58%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 50% 34%)"/></linearGradient></defs><rect width="160" height="120" fill="url(#g)"/><circle cx="${40 + ((index * 13) % 80)}" cy="62" r="${18 + (index % 5) * 4}" fill="#fff" fill-opacity=".35"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SPECIES = ["Robin", "Blue tit", "Woodpecker", "Hedgehog", "Fox", "Blackbird", "Wren", "Magpie", "Jay", "Goldfinch", "Nuthatch", "Squirrel"];

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

function wildlifeView(): TemplateResult {
  return html`<div data-view="wildlife" data-spec="view-wildlife">${heading("Wildlife")}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--lu-space-4) var(--lu-space-3)">${Array.from({ length: 80 }, (_, index) => tile(index, "4/3"))}</div>
  </div>`;
}

function camerasView(): TemplateResult {
  return html`<div data-view="cameras" data-spec="view-cameras">${heading("Cameras")}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:var(--lu-space-4) var(--lu-space-3)">${Array.from({ length: 16 }, (_, index) => tile(index + 20, "16/9"))}</div>
  </div>`;
}

function settingsView(): TemplateResult {
  return html`<div data-view="settings" data-spec="view-settings">${heading("Settings")}
    ${Array.from({ length: 48 }, (_, index) => html`<div style=${rowStyle}><span>Setting ${index + 1}</span><span style="color:var(--lu-ink-2)">${index % 2 ? "On" : "Off"}</span></div>`)}
  </div>`;
}

/** The skeleton has the geometry of the rows, so the swap moves nothing that is on screen. */
const SKELETON = html`${Array.from({ length: 10 }, () => html`<div style=${rowStyle}><span style="width:55%;height:1em;border-radius:var(--lu-radius-row);background:var(--lu-material-hover-wash)"></span><span style="width:18%;height:1em;border-radius:var(--lu-radius-row);background:var(--lu-material-hover-wash)"></span></div>`)}`;

function visitsView(): TemplateResult {
  const { data } = readSwr<Visit[]>(VISITS_KEY);
  return html`<div data-view="visits" data-spec="view-visits">${heading("Visits")}
    ${data ? data.map((visit) => html`<div style=${rowStyle}><span>${visit.title}</span><span style="color:var(--lu-ink-2)">${visit.when}</span></div>`) : SKELETON}
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

function mountDemo(host: HTMLElement): () => void {
  const panel = document.createElement("div");
  const footer = document.createElement("div");
  host.append(panel, footer);

  const state = { current: "visits", mounted: ["visits"], log: [] as string[] };

  const drawLog = (): void => {
    render(html`<div data-spec="view-log" role="log" aria-label="View events" style=${`flex:1;min-width:0;height:calc(${LOG_LINES} * 1.5em);overflow:hidden;color:var(--lu-ink-2);font:400 var(--lu-type-caption)/1.5 var(--lu-font)`}>${state.log.map((line) => html`<div>${line}</div>`)}</div>`, footer);
  };
  const note = (line: string): void => {
    state.log = [...state.log.slice(1 - LOG_LINES), line];
    drawLog();
  };

  /** Mounts the view if it is not alive, asks `swr` for the visits when that view is (re)built, and shows it. */
  const open = (id: string): void => {
    if (!state.mounted.includes(id)) state.mounted.push(id);
    if (id === "visits") swr(VISITS_KEY, loadVisits);
    state.current = id;
    draw();
  };

  const forgetWildlife = (): void => {
    panel.querySelector<LuViewStack>("[data-spec=view-stack]")?.forgetScroll("wildlife");
    note("forgot where Wildlife was scrolled to");
  };

  const draw = (): void => {
    render(html`
      <spec-lu-app-shell data-spec="view-shell" scroll="contained" style="height:min(100dvh,720px);border:1px solid var(--lu-edge)" heading="Lucent view stack" nav-label="Demo views"
          .destinations=${DESTINATIONS} .current=${state.current}
          @lu-navigate=${(event: CustomEvent<LuNavigateDetail>) => open(event.detail.id)}>
        <spec-lu-view-stack data-spec="view-stack" .current=${state.current} max="3" memory-key="view-specimen"
            @lu-view-shown=${(event: CustomEvent<LuViewEventDetail>) => note(`shown ${event.detail.id}`)}
            @lu-view-hidden=${(event: CustomEvent<LuViewEventDetail>) => note(`hidden ${event.detail.id}`)}
            @lu-view-evict=${(event: CustomEvent<LuViewEventDetail>) => {
              state.mounted = state.mounted.filter((id) => id !== event.detail.id);
              note(`evict ${event.detail.id} (removed)`);
              draw();
            }}>
          ${repeat(state.mounted, (id) => id, (id) => VIEWS[id]?.() ?? nothing)}
        </spec-lu-view-stack>
      </spec-lu-app-shell>
      <div style="display:flex;align-items:flex-start;gap:var(--lu-space-3);margin-top:var(--lu-space-2)">
        <spec-lu-button kind="secondary" data-spec="view-forget" @click=${forgetWildlife}>Forget Wildlife's place</spec-lu-button>
      </div>`, panel);
  };

  const stopSwr = subscribeSwr(VISITS_KEY, draw);
  drawLog();
  open("visits");
  return () => {
    stopSwr();
    render(nothing, panel);
    render(nothing, footer);
    host.replaceChildren();
  };
}

export const specimens: Specimen[] = [
  {
    id: "view-stack",
    title: "View stack: keep-alive tabs, scroll memory, fade-in, eviction (max 3 of 4 views), swr",
    group: "view",
    size: "full",
    render: () => html`<div data-spec="view-demo"></div>`,
    setup: (cell) => mountDemo(cell.querySelector<HTMLElement>("[data-spec=view-demo]") ?? cell),
  },
];
