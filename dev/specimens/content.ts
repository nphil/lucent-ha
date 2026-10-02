import { html } from "lit";
import type { TemplateResult } from "lit";
import type { Specimen } from "../specimen-types.ts";

/** Specimens of the content slice: grid, states, section, row. Tiles are painted with CSS (no network). */

const caption = (text: string) => html`<p style="margin:var(--lu-space-4) 0 var(--lu-space-2);color:var(--lu-ink-2);font:600 var(--lu-type-caption)/1.3 var(--lu-font);text-transform:uppercase;letter-spacing:.04em">${text}</p>`;

/** A stand-in tile: painted picture at `ratio` plus two caption lines (the shape the tiles skeleton mimics). */
function tile(index: number, ratio: string, title: string, sub: string): TemplateResult {
  const paint = `linear-gradient(${120 + index * 17}deg, color-mix(in srgb, var(--lu-accent) ${25 + (index % 5) * 9}%, var(--lu-canvas)), color-mix(in srgb, var(--lu-ink) ${8 + (index % 4) * 4}%, var(--lu-canvas)))`;
  return html`<div data-tile style="display:grid;gap:var(--lu-space-2);align-content:start">
    <div style=${`aspect-ratio:${ratio};border-radius:var(--lu-radius-tile);background:${paint}`}></div>
    <div style="overflow:hidden;color:var(--lu-ink);font:600 var(--lu-type-label)/1.3 var(--lu-font);text-overflow:ellipsis;white-space:nowrap">${title}</div>
    <div style="overflow:hidden;color:var(--lu-ink-2);font:400 var(--lu-type-caption)/1.3 var(--lu-font);text-overflow:ellipsis;white-space:nowrap">${sub}</div>
  </div>`;
}

const twelve = (ratio: string, noun: string) => Array.from({ length: 12 }, (_, index) => tile(index, ratio, `${noun} ${index + 1}`, `${index + 3} min ago`));

const SPECIES = ["Robin", "Blue tit", "Great spotted woodpecker", "Hedgehog", "Fox", "Blackbird", "Wren", "Magpie", "Jay", "Goldfinch", "Nuthatch", "Squirrel"];

/** Rows for the section / state-with-content specimens. */
const rows = (count: number) => Array.from({ length: count }, (_, index) => html`<spec-lu-row icon="mdi:cctv" heading=${`Garden camera ${index + 1}`} detail=${`${index + 2} visits today`} interactive chevron></spec-lu-row>`);

export const specimens: Specimen[] = [
  {
    id: "grid-camera",
    title: "Grid: camera tiles (min 360, 16:9)",
    group: "grid",
    size: "full",
    render: () => html`<spec-lu-grid kind="camera" data-spec="grid-camera">${twelve("16/9", "Camera")}</spec-lu-grid>`,
  },
  {
    id: "grid-species",
    title: "Grid: species tiles (min 176, square, two always fit)",
    group: "grid",
    size: "full",
    render: () => html`<spec-lu-grid kind="species" data-spec="grid-species">${SPECIES.map((name, index) => tile(index, "1/1", name, `${index + 2} visits`))}</spec-lu-grid>`,
  },
  {
    id: "grid-visit",
    title: "Grid: visit tiles (min 280, 4:3)",
    group: "grid",
    size: "full",
    render: () => html`<spec-lu-grid kind="visit" data-spec="grid-visit">${twelve("4/3", "Visit")}</spec-lu-grid>`,
  },
  {
    id: "grid-custom",
    title: "Grid: custom min (220 px), lazy",
    group: "grid",
    size: "full",
    render: () => html`<spec-lu-grid kind="custom" min="220" lazy data-spec="grid-custom">${twelve("3/2", "Item")}</spec-lu-grid>`,
  },
  {
    id: "grid-few",
    title: "Grid: two tiles only (never wider than 560)",
    group: "grid",
    size: "full",
    render: () => html`<spec-lu-grid kind="visit" data-spec="grid-few">${tile(0, "4/3", "Visit 1", "3 min ago")}${tile(1, "4/3", "Visit 2", "9 min ago")}</spec-lu-grid>`,
  },
  {
    id: "state-loading",
    title: "State: loading (static skeletons)",
    group: "state",
    size: "full",
    render: () => html`
      ${caption("rows")}<spec-lu-state kind="loading" variant="rows" heading="Loading visits" data-spec="loading-rows"></spec-lu-state>
      ${caption("thumbs")}<spec-lu-state kind="loading" variant="thumbs" heading="Loading clips" data-spec="loading-thumbs"></spec-lu-state>
      ${caption("tiles (species, square)")}<spec-lu-state kind="loading" variant="tiles" tile="species" ratio="1/1" heading="Loading species" data-spec="loading-tiles"></spec-lu-state>
      ${caption("tiles (camera, 16:9)")}<spec-lu-state kind="loading" variant="tiles" tile="camera" ratio="16/9" count="4" data-spec="loading-tiles-camera"></spec-lu-state>
      ${caption("text")}<spec-lu-state kind="loading" variant="text" heading="Loading summary" data-spec="loading-text"></spec-lu-state>`,
  },
  {
    id: "state-empty",
    title: "State: empty (cause + next step)",
    group: "state",
    render: () => html`
      <spec-lu-state kind="empty" icon="mdi:cctv-off" heading="No cameras yet" message="Kestrel hasn't received a camera list. Add a camera in Home Assistant, then refresh." data-spec="empty">
        <spec-lu-button slot="action" kind="secondary" icon="mdi:refresh">Refresh</spec-lu-button>
      </spec-lu-state>
      ${caption("compact")}<spec-lu-state kind="empty" compact heading="Nothing heard yet" data-spec="empty-compact"></spec-lu-state>`,
  },
  {
    id: "state-error",
    title: "State: error + Retry",
    group: "state",
    render: () => html`
      <spec-lu-state kind="error" heading="This visit didn't load" message="The server couldn't be reached. Check the connection and try again." retry-label="Try again" data-spec="error"></spec-lu-state>
      ${caption("last-good content stays")}
      <spec-lu-state kind="error" message="Couldn't refresh the list." retry-label="Try again" data-spec="error-content">${rows(2)}</spec-lu-state>`,
  },
  {
    id: "state-stale",
    title: "State: stale strip with timestamp",
    group: "state",
    render: () => html`
      <spec-lu-state kind="stale" since=${Date.now() - 12 * 60_000} message="Reconnecting" data-spec="stale">${rows(2)}</spec-lu-state>`,
  },
  {
    id: "section",
    title: "Section: ready, loading, empty, error",
    group: "state",
    size: "full",
    render: () => html`
      <spec-lu-section icon="mdi:cctv" heading="Cameras" summary="3 online" state="ready" count="3" noun="cameras" data-spec="section-ready">
        <spec-lu-button slot="actions" kind="quiet" icon="mdi:refresh" icon-only label="Refresh"></spec-lu-button>
        <spec-lu-grid kind="camera">${twelve("16/9", "Camera").slice(0, 3)}</spec-lu-grid>
      </spec-lu-section>
      <spec-lu-section icon="mdi:timeline-clock-outline" heading="Recent visits" state="loading" noun="visits" data-spec="section-loading"></spec-lu-section>
      <spec-lu-section icon="mdi:image-multiple-outline" heading="Clips" state="loading" variant="thumbs" noun="clips" data-spec="section-thumbs"></spec-lu-section>
      <spec-lu-section icon="mdi:paw-outline" heading="Wildlife" state="ready" empty="No wildlife visits yet" data-spec="section-empty"></spec-lu-section>
      <spec-lu-section icon="mdi:alert-outline" heading="Needs a look" state="error" noun="visits" data-spec="section-error"></spec-lu-section>
      <spec-lu-section icon="mdi:format-list-bulleted" heading="Review" summary="2 of 9" state="error" count="2" data-spec="section-error-content">${rows(2)}</spec-lu-section>`,
  },
  {
    id: "row",
    title: "Row: plain, link, selected, disabled, trailing, long text",
    group: "content",
    size: "wide",
    render: () => html`
      <div data-spec="rows">
        <spec-lu-row icon="mdi:information-outline" heading="Plain row" detail="Not interactive"></spec-lu-row>
        <spec-lu-row icon="mdi:cctv" heading="Button row" detail="Press me" interactive chevron></spec-lu-row>
        <spec-lu-row icon="mdi:open-in-new" heading="Link row" detail="Real anchor" href="#linked" chevron></spec-lu-row>
        <spec-lu-row icon="mdi:check" heading="Selected row" detail="Current choice" selected></spec-lu-row>
        <spec-lu-row icon="mdi:lock-outline" heading="Disabled row" detail="Needs a camera to be online first" interactive disabled></spec-lu-row>
        <spec-lu-row icon="mdi:bird" heading="With a value" interactive chevron><spec-lu-chip slot="trailing" kind="positive" label="Online"></spec-lu-chip></spec-lu-row>
        <spec-lu-row icon="mdi:timer-outline" heading="With a separate control" detail="The switch is its own target"><span slot="trailing" role="switch" aria-checked="true" tabindex="0" style="display:inline-block;width:44px;height:24px;border-radius:12px;background:var(--lu-accent)"></span></spec-lu-row>
        <spec-lu-row heading="With a thumbnail" detail="Slot leading replaces the icon" interactive>
          <div slot="leading" style="width:56px;height:56px;border-radius:var(--lu-radius-control);background:linear-gradient(135deg,var(--lu-accent),var(--lu-canvas))"></div>
        </spec-lu-row>
        <spec-lu-row icon="mdi:text-long" heading="A very long heading that has to be cut with an ellipsis instead of pushing the trailing value out of the row" detail="A very long detail line that also has to be cut with an ellipsis instead of wrapping into three lines" interactive chevron><span slot="trailing">12:41</span></spec-lu-row>
      </div>`,
  },
];
