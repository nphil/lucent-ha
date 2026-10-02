/** Library: a filter with counts and a lazy grid of species tiles, 24 at a time. Tiles are keyed by id, so fresh data updates them in place
 * and never resets the scroll position or how many are shown. */
import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { SwrSnapshot } from "../../../src/index.ts";
import { ago, errorText, picture } from "./data.ts";
import type { Species } from "./types.ts";

export type Filter = "all" | "seen" | "heard";

/** Tiles per step of "Show more". */
export const STEP = 24;

const FILTERS: readonly { value: Filter; label: string; icon: string }[] = [
  { value: "all", label: "All", icon: "mdi:paw" },
  { value: "seen", label: "On camera", icon: "mdi:camera-outline" },
  { value: "heard", label: "Heard", icon: "mdi:microphone" },
];

const matches = (species: Species, filter: Filter): boolean => filter === "all" || (filter === "seen" ? species.seen : species.heard);

export interface LibraryProps {
  species: SwrSnapshot<Species[]>;
  filter: Filter;
  /** How many tiles are shown (a multiple of `STEP`). */
  visible: number;
  onFilter(value: Filter): void;
  onMore(): void;
  onOpen(name: string): void;
  /** The finger just went down on a tile: start loading what it opens. */
  onWarm(name: string): void;
  onRetry(): void;
}

function speciesTile(species: Species, index: number, props: Pick<LibraryProps, "onOpen" | "onWarm">): TemplateResult {
  const last = `${species.lastKind === "seen" ? "Seen" : "Heard"} ${ago(species.lastAt)} · ${species.lastCamera}`;
  const counts = [species.seen ? `${species.seenCount} on camera` : "", species.heard ? `${species.heardCount} heard` : ""].filter(Boolean).join(", ");
  return html`<button class="tile" type="button" data-demo="species-tile" aria-label=${`${species.name}. ${counts}. ${last}`} @pointerdown=${() => props.onWarm(species.name)} @click=${() => props.onOpen(species.name)}>
    <span class="picture">
      <spec-lu-image .src=${picture(`species:${species.id}`, species.name)} priority=${index < 8 ? "high" : "auto"} alt=""></spec-lu-image>
      <span class="badges">
        ${species.seen ? html`<spec-lu-chip kind="evidence" overlay icon="mdi:camera-outline" label="On camera" .count=${species.seenCount}></spec-lu-chip>` : nothing}
        ${species.heard ? html`<spec-lu-chip kind="evidence" overlay icon="mdi:microphone" label="Heard" .count=${species.heardCount}></spec-lu-chip>` : nothing}
      </span>
    </span>
    <span class="name">${species.name}</span>
    <span class="sub">${last}</span>
    ${species.newThisYear ? html`<span class="sub"><spec-lu-chip kind="info" icon="mdi:star-outline" label="New this year"></spec-lu-chip></span>` : nothing}
  </button>`;
}

export function libraryView(props: LibraryProps): TemplateResult {
  const list = props.species.data;
  if (!list) {
    return html`<div class="page"><h2 class="sr-only">Library</h2>${props.species.error
      ? html`<spec-lu-state kind="error" icon="mdi:paw-outline" heading="Couldn't load the species" .message=${errorText(props.species.error)} @lu-retry=${props.onRetry}></spec-lu-state>`
      : html`<spec-lu-state kind="loading" variant="tiles" tile="species" count="8" heading="Loading species"></spec-lu-state>`}</div>`;
  }
  const counts = { all: list.length, seen: list.filter((item) => item.seen).length, heard: list.filter((item) => item.heard).length };
  const options = FILTERS.map((item) => ({ ...item, count: counts[item.value] }));
  const shown = list.filter((item) => matches(item, props.filter));
  const visible = shown.slice(0, props.visible);
  return html`<div class="page">
    <h2 class="sr-only">Library</h2>
    <div class="toolbar">
      <spec-lu-segmented label="Show species" .options=${options} .value=${props.filter} @lu-change=${(event: CustomEvent<{ value: string }>) => props.onFilter(event.detail.value as Filter)}></spec-lu-segmented>
    </div>
    ${visible.length === 0
      ? html`<spec-lu-state kind="empty" icon="mdi:paw-outline" heading="Nothing here yet" message="No species match this filter.">
          <spec-lu-button slot="action" kind="secondary" label="Show all species" @click=${() => props.onFilter("all")}></spec-lu-button>
        </spec-lu-state>`
      : html`<spec-lu-section class="flush" icon="mdi:paw" heading="Species" .summary=${`${shown.length}`} .state=${props.species.error ? "error" : "ready"} .count=${visible.length} noun="species" @lu-retry=${props.onRetry}>
          <spec-lu-grid kind="species" lazy data-demo="species-grid">${repeat(visible, (item) => item.id, (item, index) => speciesTile(item, index, props))}</spec-lu-grid>
          ${visible.length < shown.length
            ? html`<div class="more"><spec-lu-button kind="secondary" label=${`Show ${Math.min(STEP, shown.length - visible.length)} more`} data-demo="species-more" @click=${props.onMore}></spec-lu-button><span>Showing ${visible.length} of ${shown.length}</span></div>`
            : nothing}
        </spec-lu-section>`}
  </div>`;
}
