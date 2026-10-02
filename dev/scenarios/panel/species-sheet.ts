/** The species sheet: a `lu-sheet` that the ADDRESS opens (`?s=Robin`), so it can be linked to and Back closes it. Inside: a picture and the
 * month's total, a rail of clips, the newest recording in a player (with its Original toggle) and the older ones in a list. */
import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import type { AudioListRow, LuCloseDetail, RailItem, SwrSnapshot } from "../../../src/index.ts";
import { RECORDING_LENGTH, ago, picture, recordingsOf } from "./data.ts";
import type { Kind, Species, Visit, VisitPage } from "./types.ts";

/** The rail's tiles for some visits: a clip has a play glyph, a recording says "Heard". */
export function railItems(visits: readonly Visit[]): RailItem[] {
  return visits.map((visit) => {
    const item: RailItem = {
      id: visit.id,
      image: picture(`visit:${visit.id}`, visit.species),
      title: ago(visit.startedAt),
      caption: visit.cameraName,
      label: `Open the ${visit.species} visit from ${ago(visit.startedAt)} at ${visit.cameraName}`,
    };
    if (visit.kind === "seen") item.play = true;
    else {
      item.badge = "Heard";
      item.badgeIcon = "mdi:microphone";
    }
    return item;
  });
}

/** The audio list's rows: the cleaned preview plays, the untouched original is the fallback if the preview cannot load. */
function audioRows(visits: readonly Visit[]): AudioListRow[] {
  return visits.map((visit) => {
    const sources = recordingsOf(visit);
    return {
      id: visit.id,
      src: sources.preview,
      fallback: sources.original,
      title: ago(visit.startedAt),
      caption: visit.cameraName,
      meta: RECORDING_LENGTH,
      mark: "Cleaned",
      label: `${visit.species} recording from ${ago(visit.startedAt)} at ${visit.cameraName}`,
    };
  });
}

export interface SpeciesSheetProps {
  open: boolean;
  /** Whose content is drawn. It stays until the sheet has finished closing, so nothing blanks mid-exit. Empty = never opened. */
  name: string;
  /** The library's numbers for it, once the library has loaded. */
  species: Species | undefined;
  seen: SwrSnapshot<VisitPage> | undefined;
  heard: SwrSnapshot<VisitPage> | undefined;
  /** "Show more" is waiting for its page. */
  loadingMore: Record<Kind, boolean>;
  muted: boolean;
  onClose(event: CustomEvent<LuCloseDetail>): void;
  onOpenVisit(id: string): void;
  onWarm(id: string): void;
  onMore(kind: Kind): void;
  onRetry(kind: Kind): void;
  onMute(): void;
}

const GROUP = { bird: "Bird", mammal: "Mammal", other: "Other" } as const;

/** `lu-section`'s three states from what `swr` knows. */
function sectionState(page: SwrSnapshot<VisitPage> | undefined): "loading" | "ready" | "error" {
  if (page?.error) return "error";
  return page?.data ? "ready" : "loading";
}

function content(props: SpeciesSheetProps): TemplateResult {
  const seen = props.seen?.data?.items ?? [];
  const heard = props.heard?.data?.items ?? [];
  const newest = heard[0];
  const total = props.species ? props.species.seenCount + props.species.heardCount : 0;
  return html`<div class="sheet-body">
    <div class="intro">
      <spec-lu-image ratio="16/10" .src=${picture(`species:${props.name}`, props.name)} alt=""></spec-lu-image>
      ${props.species ? html`<div class="total"><strong>${total}</strong><span>${total === 1 ? "visit" : "visits"} in the last 30 days</span></div>` : nothing}
    </div>
    <spec-lu-section icon="mdi:camera-outline" heading="On camera" .summary=${seen.length > 0 ? `${seen.length}${props.seen?.data?.next ? "+" : ""} clips` : ""} .state=${sectionState(props.seen)} .count=${seen.length} noun="clips" empty="No clips saved yet" variant="thumbs" @lu-retry=${() => props.onRetry("seen")}>
      <spec-lu-media-rail .items=${railItems(seen)} .more=${Boolean(props.seen?.data?.next)} .loading=${props.loadingMore.seen}
        @lu-select=${(event: CustomEvent<{ id: string }>) => props.onOpenVisit(event.detail.id)} @lu-warm=${(event: CustomEvent<{ id: string }>) => props.onWarm(event.detail.id)} @lu-more=${() => props.onMore("seen")}></spec-lu-media-rail>
    </spec-lu-section>
    <spec-lu-section icon="mdi:microphone" heading="Heard" .summary=${heard.length > 0 ? `${heard.length}${props.heard?.data?.next ? "+" : ""} recordings` : ""} .state=${sectionState(props.heard)} .count=${heard.length} noun="recordings" empty="No recordings yet" @lu-retry=${() => props.onRetry("heard")}>
      ${newest
        ? html`<spec-lu-audio-player .src=${recordingsOf(newest).preview} .original=${recordingsOf(newest).original} mark="Cleaned" caption=${`Newest: ${ago(newest.startedAt)} at ${newest.cameraName}`} label=${`${newest.species} recording from ${ago(newest.startedAt)} at ${newest.cameraName}`} preload="metadata"></spec-lu-audio-player>`
        : nothing}
      ${heard.length > 1 || props.heard?.data?.next
        ? html`<spec-lu-audio-list .rows=${audioRows(heard.slice(1))} .more=${Boolean(props.heard?.data?.next)} .loading=${props.loadingMore.heard}
            @lu-select=${(event: CustomEvent<{ id: string }>) => props.onOpenVisit(event.detail.id)} @lu-more=${() => props.onMore("heard")}></spec-lu-audio-list>`
        : nothing}
    </spec-lu-section>
  </div>`;
}

export function speciesSheet(props: SpeciesSheetProps): TemplateResult {
  const species = props.species;
  const subheading = species ? `${GROUP[species.group]} · ${species.lastKind === "seen" ? "seen" : "heard"} ${ago(species.lastAt)}` : "";
  // `history` is off: the address is the history. The page opens the sheet by putting `?s=` in the address and Back takes it out again.
  return html`<spec-lu-sheet .open=${props.open} .history=${false} layer="species" .heading=${props.name} .subheading=${subheading} @lu-close=${props.onClose}>
    ${props.name ? content(props) : nothing}
    <spec-lu-button slot="footer" kind="secondary" icon=${props.muted ? "mdi:bell-outline" : "mdi:bell-off"} label=${props.muted ? "Unmute alerts" : "Mute alerts"} @click=${props.onMute}></spec-lu-button>
  </spec-lu-sheet>`;
}
