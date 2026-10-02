import { html } from "lit";
import type { TemplateResult } from "lit";
import type { Specimen, SpecimenContext } from "../specimen-types.ts";
import type { LuDestination } from "../../src/shell/nav-model.ts";
import type { LuNavigateDetail } from "../../src/shell/nav.ts";

/** Specimens of the shell slice: the app shell in every layout (all of them `scroll="contained"`, so the page of
 * specimens keeps scrolling normally), its back page, the strip above the bottom bar, wall mode and the bare root.
 * A shell never routes, so each specimen answers `lu-navigate` the way a panel would: it sets `current`. */

const DESTINATIONS: LuDestination[] = [
  { id: "live", label: "Live", icon: "mdi:cctv" },
  { id: "wildlife", label: "Wildlife", icon: "mdi:bird", badge: 3 },
  { id: "checkup", label: "Check-up", icon: "mdi:heart-pulse" },
  { id: "settings", label: "Settings", icon: "mdi:cog" },
];

/** The height every full-size shell specimen gets: as tall as the screen, so the layout is judged at its real proportions. */
const FRAME = "height:min(100dvh,900px);border:1px solid var(--lu-edge)";
/** The fixed-height cells of the forced-layout specimens. */
const BOX = "height:440px;border:1px solid var(--lu-edge)";

type ShellElement = HTMLElement & { current: string; wall: boolean };

/** What a panel does with `lu-navigate`: route, then set `current`. The specimen has no router, so it only sets `current`. */
function follow(event: CustomEvent<LuNavigateDetail>): void {
  (event.currentTarget as ShellElement).current = event.detail.id;
}

/** A picture-like band, so a glass bar has something colourful to be readable over while it scrolls. */
function band(index: number): TemplateResult {
  const paint = `linear-gradient(${100 + index * 23}deg, color-mix(in srgb, var(--lu-accent) ${35 + (index % 4) * 12}%, var(--lu-canvas)), color-mix(in srgb, var(--lu-ink) ${10 + (index % 3) * 8}%, var(--lu-canvas)))`;
  return html`<div style=${`height:132px;margin:var(--lu-space-3) 0;border-radius:var(--lu-radius-tile);background:${paint}`}></div>`;
}

/** Readable filler: a heading, a line of text and a picture band, repeated, so there is plenty to scroll. */
function view(title: string, repeat: number): TemplateResult {
  return html`<section data-view=${title}>
    <h2 style="margin:0 0 var(--lu-space-2);font:600 var(--lu-type-title)/1.25 var(--lu-font)">${title}</h2>
    ${Array.from({ length: repeat }, (_, index) => html`
      <p style="margin:0;color:var(--lu-ink-2)">Garden camera ${index + 1}: a robin at the feeder, ${index + 2} minutes ago. The sticky bar stays put while this scrolls.</p>
      ${band(index)}`)}
  </section>`;
}

const actions = (): TemplateResult => html`
  <spec-lu-button slot="actions" kind="quiet" icon-only icon="mdi:keyboard" label="Keyboard shortcuts"></spec-lu-button>
  <spec-lu-button slot="actions" kind="quiet" icon-only icon="mdi:open-in-new" label="Open in Scrypted"></spec-lu-button>`;

function shell(ctx: SpecimenContext, attributes: { id: string; style: string; mode?: string; current?: string; heading?: string; extra?: TemplateResult }): TemplateResult {
  return html`<spec-lu-app-shell data-spec=${attributes.id} style=${attributes.style} scroll="contained" nav-mode=${attributes.mode ?? "auto"} nav-label="Camera sections"
      heading=${attributes.heading ?? "Kestrel"} current=${attributes.current ?? "live"} .hass=${ctx.hass} ?narrow=${ctx.narrow} .destinations=${DESTINATIONS}
      @lu-navigate=${follow}>
    ${actions()}${view("Live cameras", 8)}${attributes.extra ?? html``}
  </spec-lu-app-shell>`;
}

export const specimens: Specimen[] = [
  {
    id: "shell-app",
    title: "App shell: follows the screen (bottom bar, rail, pills or tabs), contained",
    group: "shell",
    size: "full",
    render: (ctx) => shell(ctx, { id: "shell-app", style: FRAME }),
  },
  {
    id: "shell-tabs",
    title: "App shell, forced tabs (>= 900 px): destinations inside the app bar",
    group: "shell",
    size: "full",
    render: (ctx) => shell(ctx, { id: "shell-tabs", style: BOX, mode: "tabs", current: "wildlife" }),
  },
  {
    id: "shell-pills",
    title: "App shell, forced pills (680-899 px): a row under the bar, sticky with it",
    group: "shell",
    size: "full",
    render: (ctx) => shell(ctx, { id: "shell-pills", style: BOX, mode: "pills", current: "checkup" }),
  },
  {
    id: "shell-bottom",
    title: "App shell, forced bottom bar (< 680 px)",
    group: "shell",
    size: "full",
    render: (ctx) => shell(ctx, { id: "shell-bottom", style: BOX, mode: "bottom", current: "wildlife" }),
  },
  {
    id: "shell-rail",
    title: "App shell, forced left rail (short screens, wall displays)",
    group: "shell",
    size: "full",
    render: (ctx) => shell(ctx, { id: "shell-rail", style: BOX, mode: "rail", current: "live" }),
  },
  {
    id: "shell-bottom-strip",
    title: "App shell: a strip above the bottom bar (slot bottom), published as --lu-bottom-bar",
    group: "shell",
    size: "full",
    render: (ctx) => shell(ctx, {
      id: "shell-bottom-strip",
      style: BOX,
      mode: "bottom",
      extra: html`<div slot="bottom" data-strip style="display:flex;align-items:center;gap:var(--lu-space-3);min-height:var(--lu-target);padding:var(--lu-space-2) var(--lu-space-4);background:var(--lu-reading);border-top:1px solid var(--lu-edge);color:var(--lu-ink)"><strong>Robin song</strong><span style="color:var(--lu-ink-2)">0:12 / 0:31</span></div>`,
    }),
  },
  {
    id: "shell-back",
    title: "App shell: a detail page (leading=back, no destinations); Escape or the arrow fires lu-back",
    group: "shell",
    size: "full",
    render: (ctx) => html`<spec-lu-app-shell data-spec="shell-back" style=${BOX} scroll="contained" leading="back" heading="Robin at the feeder, 12 min ago" .hass=${ctx.hass} ?narrow=${ctx.narrow}
        @lu-back=${(event: Event) => { (event.currentTarget as HTMLElement).setAttribute("data-back-fired", ""); }}>
      ${actions()}${view("Visit", 4)}
    </spec-lu-app-shell>`,
  },
  {
    id: "shell-wall",
    title: "App shell: wall mode (the button asks Home Assistant to hide its own header and sidebar)",
    group: "shell",
    size: "full",
    render: (ctx) => html`<spec-lu-app-shell data-spec="shell-wall" style=${BOX} scroll="contained" heading="Wall display" current="live" .hass=${ctx.hass} ?narrow=${ctx.narrow} .destinations=${DESTINATIONS} @lu-navigate=${follow}>
      <div style="display:grid;gap:var(--lu-space-3);justify-items:start">
        <p style="margin:0;color:var(--lu-ink-2)">Wall mode is off. In wall mode the menu button is always in the bar, because Home Assistant hides its own.</p>
        <spec-lu-button data-wall-toggle kind="secondary" label="Turn wall mode on" @click=${(event: Event) => {
          const shellElement = (event.currentTarget as HTMLElement).closest("[data-spec=shell-wall]") as ShellElement;
          shellElement.wall = !shellElement.wall;
          (event.currentTarget as HTMLElement).setAttribute("label", shellElement.wall ? "Turn wall mode off" : "Turn wall mode on");
        }}></spec-lu-button>
      </div>
    </spec-lu-app-shell>`,
  },
  {
    id: "shell-nav",
    title: "Nav on its own: tabs, pills, bottom and rail rows (badge, selected, shortcut hints)",
    group: "shell",
    size: "wide",
    render: () => html`<div data-spec="shell-nav" style="display:grid;gap:var(--lu-space-4)">
      ${(["tabs", "pills", "bottom", "rail"] as const).map((mode) => html`<div style=${mode === "rail" ? "width:96px" : "max-width:560px"}>
        <spec-lu-nav mode=${mode} current="wildlife" label=${`${mode} navigation`} shortcuts .destinations=${DESTINATIONS}></spec-lu-nav>
      </div>`)}
    </div>`,
  },
  {
    id: "shell-root",
    title: "Root: tokens, profile and toast host for a card (content only, no app bar)",
    group: "shell",
    size: "cell",
    render: () => html`<spec-lu-root data-spec="shell-root" style="padding:var(--lu-space-4);background:var(--lu-card);border:1px solid var(--lu-edge);border-radius:var(--lu-radius-card)">
      <h3 style="margin:0 0 var(--lu-space-2);font:600 var(--lu-type-title)/1.25 var(--lu-font)">A card inside a root</h3>
      <p style="margin:0;color:var(--lu-ink-2)">It reads the same tokens as a panel and sizes itself by its own width.</p>
    </spec-lu-root>`,
  },
];
