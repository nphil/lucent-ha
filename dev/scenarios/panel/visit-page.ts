/** The detail page of one visit: a picture (or a recording), the species and how sure the model is, chips, one primary action, secondary
 * actions and sections. Side by side from 900 px of room, stacked below; the delete needs a hold. */
import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import type { SwrSnapshot } from "../../../src/index.ts";
import { ago, clock, errorText, picture, recordingsOf } from "./data.ts";
import { railItems } from "./species-sheet.ts";
import type { Status, Visit, VisitPage } from "./types.ts";

const STATUS: Record<Status, { kind: string; label: string }> = {
  auto: { kind: "neutral", label: "Model guess" },
  confirmed: { kind: "positive", label: "Confirmed" },
  corrected: { kind: "info", label: "Corrected" },
};

export interface VisitProps {
  /** The `?v=` of the address. */
  id: string;
  /** `null` = the server says this visit does not exist (any more). */
  visit: SwrSnapshot<Visit | null>;
  /** More visits of the same species and kind, for the rail. */
  related: SwrSnapshot<VisitPage> | undefined;
  busy: "" | "saving" | "deleting";
  onConfirm(): void;
  onWrong(): void;
  onDelete(): void;
  onOpenVisit(id: string): void;
  onWarm(id: string): void;
  onBrowse(): void;
  onRetry(): void;
}

function gone(props: VisitProps): TemplateResult {
  return html`<spec-lu-state kind="empty" icon="mdi:timeline-clock-outline" heading="This visit was merged or removed" message="Repeat sightings of the same animal are combined and false alarms are cleared, so an older link can point at one that is gone.">
    <spec-lu-button slot="action" kind="primary" label="See the library" @click=${props.onBrowse}></spec-lu-button>
  </spec-lu-state>`;
}

function skeleton(): TemplateResult {
  return html`<article class="visit">
    <section class="hero"><spec-lu-image ratio="16/10" alt=""></spec-lu-image></section>
    <div class="side"><spec-lu-state kind="loading" variant="text" count="4" heading="Loading this visit"></spec-lu-state></div>
  </article>`;
}

export function visitPage(props: VisitProps): TemplateResult {
  if (!props.id) {
    return html`<div class="page"><spec-lu-state kind="empty" icon="mdi:timeline-clock-outline" heading="No visit selected" message="Open a visit from a camera, from the library or from the check-up.">
      <spec-lu-button slot="action" kind="primary" label="See the library" @click=${props.onBrowse}></spec-lu-button>
    </spec-lu-state></div>`;
  }
  const visit = props.visit.data;
  if (visit === undefined) {
    return html`<div class="page">${props.visit.error
      ? html`<spec-lu-state kind="error" icon="mdi:cloud-off-outline" heading="This visit didn't load" .message=${errorText(props.visit.error)} @lu-retry=${props.onRetry}></spec-lu-state>`
      : skeleton()}</div>`;
  }
  if (visit === null) return html`<div class="page">${gone(props)}</div>`;

  const heard = visit.kind === "heard";
  const status = STATUS[visit.status];
  const percent = Math.round(visit.score * 100);
  const others = props.related?.data?.items.filter((item) => item.id !== visit.id) ?? [];
  const relatedState = props.related?.error && others.length === 0 ? "error" : props.related?.data ? "ready" : "loading";
  const recording = recordingsOf(visit);
  return html`<div class="page"><article class="visit">
    <section class="hero" aria-label=${heard ? `Reference picture of ${visit.species}` : `${visit.species} at ${visit.cameraName}`}>
      <spec-lu-image priority="high" ratio="16/10" .src=${picture(heard ? `species:${visit.species}` : `visit:${visit.id}`, visit.species)} alt=${heard ? "" : `${visit.species} at ${visit.cameraName}`}></spec-lu-image>
      <span class="badges"><spec-lu-chip kind="evidence" overlay icon=${heard ? "mdi:microphone" : "mdi:camera-outline"} label=${heard ? "Heard, reference picture" : "On camera"}></spec-lu-chip></span>
    </section>
    <div class="side">
      <div class="title-row">
        <div><h2>${visit.species}</h2><p>${visit.cameraName} · ${clock(visit.startedAt)}</p></div>
        <span class="score" role="img" aria-label=${`${percent} percent sure`}>${percent}<small>%</small></span>
      </div>
      <div class="tags">
        <spec-lu-chip kind=${status.kind} label=${status.label}></spec-lu-chip>
        <spec-lu-chip icon=${heard ? "mdi:microphone" : "mdi:camera-outline"} label=${heard ? "Heard" : "On camera"}></spec-lu-chip>
        <spec-lu-chip label=${visit.group === "bird" ? "Bird" : visit.group === "mammal" ? "Mammal" : "Other"}></spec-lu-chip>
      </div>
      <div class="actions">
        <spec-lu-button kind="primary" icon="mdi:check" data-demo="detail-primary" label=${visit.status === "confirmed" ? "Confirmed" : "That's right"} ?disabled=${visit.status === "confirmed" || props.busy !== ""} @click=${props.onConfirm}></spec-lu-button>
        <spec-lu-button kind="secondary" icon="mdi:tag-outline" label="Wrong?" ?disabled=${props.busy !== ""} @click=${props.onWrong}></spec-lu-button>
      </div>
      ${heard
        ? html`<spec-lu-section icon="mdi:microphone" heading="Recording" .count=${1}>
            <spec-lu-audio-player .src=${recording.preview} .original=${recording.original} mark="Cleaned" caption="Background noise taken out" label=${`Recording of ${visit.species} at ${visit.cameraName}, ${ago(visit.startedAt)}`} preload="metadata"></spec-lu-audio-player>
          </spec-lu-section>`
        : nothing}
      <spec-lu-section icon="mdi:information-outline" heading="Details" .count=${3}>
        <spec-lu-row heading="Camera"><span slot="trailing">${visit.cameraName}</span></spec-lu-row>
        <spec-lu-row heading="When"><span slot="trailing">${ago(visit.startedAt)}</span></spec-lu-row>
        <spec-lu-row heading="Group"><span slot="trailing">${visit.group}</span></spec-lu-row>
      </spec-lu-section>
      <spec-lu-section icon=${heard ? "mdi:waveform" : "mdi:image-multiple-outline"} heading=${`More ${visit.species}`} .state=${relatedState} .count=${others.length} noun="visits" empty="No other visits of this species." variant="thumbs" @lu-retry=${props.onRetry}>
        <spec-lu-media-rail .items=${railItems(others)} @lu-select=${(event: CustomEvent<{ id: string }>) => props.onOpenVisit(event.detail.id)} @lu-warm=${(event: CustomEvent<{ id: string }>) => props.onWarm(event.detail.id)}></spec-lu-media-rail>
      </spec-lu-section>
      <spec-lu-section icon="mdi:delete-outline" heading="Manage" .count=${1}>
        <spec-lu-hold-button kind="danger" icon="mdi:delete" label="Hold to delete" confirm-label="Delete" .busy=${props.busy === "deleting"} .consequence=${`Deletes this ${visit.species} visit${heard ? " and its recording" : " and its picture"}. This can't be undone.`} @lu-confirm=${props.onDelete}></spec-lu-hold-button>
      </spec-lu-section>
    </div>
  </article></div>`;
}
