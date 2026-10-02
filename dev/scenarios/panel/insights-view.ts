/** Insights: sections, rows with thumbnails, every state of `lu-state` on demand, and the controls (stepper, slider, buttons, hold button). */
import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import type { SwrSnapshot } from "../../../src/index.ts";
import { ago, errorText, picture } from "./data.ts";
import type { Insights, Visit } from "./types.ts";

/** Which state the "State previews" section shows. */
export type Preview = "loading" | "empty" | "error" | "stale";

const PREVIEWS: readonly { value: Preview; label: string }[] = [
  { value: "loading", label: "Loading" },
  { value: "empty", label: "Empty" },
  { value: "error", label: "Error" },
  { value: "stale", label: "Stale" },
];

/** The 12-minutes-old stale preview: counted once, when the page loads, so it reads "12 min ago" for a while. */
const STALE_SINCE = Date.now() - 12 * 60_000;

export interface InsightsProps {
  insights: SwrSnapshot<Insights>;
  preview: Preview;
  /** The detector settings (kept in the panel; nothing is saved anywhere). */
  clip: number;
  sensitivity: number;
  /** The next request will fail (see `failNext`). */
  failArmed: boolean;
  /** The "Hold to confirm all" action is running. */
  confirming: boolean;
  onOpenVisit(id: string): void;
  onRetry(): void;
  onPreview(value: Preview): void;
  onClip(value: number): void;
  /** The slider is being dragged (live) or let go (committed). */
  onSensitivity(value: number, committed: boolean): void;
  onSave(): void;
  onReset(): void;
  onDiscard(): void;
  onHelp(): void;
  onToggleFail(): void;
  onReload(): void;
  onSimulate(): void;
  onResetWorld(): void;
  onPreviewRetry(): void;
  onConfirmAll(): void;
}

function reviewRow(visit: Visit, onOpen: (id: string) => void): TemplateResult {
  return html`<spec-lu-row interactive chevron .heading=${visit.species} .detail=${`${visit.cameraName} · ${ago(visit.startedAt)}`} @click=${() => onOpen(visit.id)}>
    <spec-lu-image slot="leading" class="thumb" ratio="1" .src=${picture(`visit:${visit.id}`, visit.species)} alt=""></spec-lu-image>
    <spec-lu-chip slot="trailing" kind="warning" label=${`${Math.round(visit.score * 100)}% sure`}></spec-lu-chip>
  </spec-lu-row>`;
}

/** One `lu-state` in the state the segmented control asks for. */
function previewState(props: InsightsProps): TemplateResult {
  switch (props.preview) {
    case "loading":
      return html`<spec-lu-state kind="loading" variant="rows" count="3" heading="Loading the preview"></spec-lu-state>`;
    case "empty":
      return html`<spec-lu-state kind="empty" icon="mdi:inbox-outline" heading="Nothing to show" message="An empty state says why it is empty and offers the next step.">
        <spec-lu-button slot="action" kind="secondary" label="Run a new check" @click=${props.onReload}></spec-lu-button>
      </spec-lu-state>`;
    case "error":
      return html`<spec-lu-state kind="error" heading="Couldn't load this" message="An error says what failed and keeps a Retry within reach." @lu-retry=${props.onPreviewRetry}></spec-lu-state>`;
    default:
      return html`<spec-lu-state kind="stale" .since=${STALE_SINCE} message="Last check-up">
        <spec-lu-row heading="Detector" detail="Wildlife detector 3.2"><span slot="trailing">online</span></spec-lu-row>
        <spec-lu-row heading="Storage" detail="412 of 800 MB"><span slot="trailing">51%</span></spec-lu-row>
      </spec-lu-state>`;
  }
}

export function insightsView(props: InsightsProps): TemplateResult {
  const { insights } = props;
  const data = insights.data;
  const review = data?.review ?? [];
  const health = data?.health;
  const reviewState = insights.error ? "error" : data ? "ready" : "loading";
  return html`<div class="page text">
    <h2 class="sr-only">AI check-up</h2>
    <spec-lu-section class="flush" icon="mdi:eye" heading="Needs a look" .summary=${data ? `${review.length} ${review.length === 1 ? "sighting" : "sightings"}` : ""} .state=${reviewState} .count=${review.length} noun="sightings" empty="Nothing needs a look. Nice." @lu-retry=${props.onRetry}>
      ${review.map((visit) => reviewRow(visit, props.onOpenVisit))}
    </spec-lu-section>

    <spec-lu-section icon="mdi:heart-pulse" heading="Detector" .summary=${health ? health.detector : ""} .state=${data ? "ready" : insights.error ? "error" : "loading"} .count=${health ? 3 : 0} noun="numbers" @lu-retry=${props.onRetry}>
      ${health
        ? html`<spec-lu-row heading="Checks today" .detail=${`${health.averageMs} ms on average`}><span slot="trailing">${health.checksToday}</span></spec-lu-row>
            <spec-lu-row heading="Storage" .detail=${`${health.storageMB} of ${health.budgetMB} MB`}><span slot="trailing">${Math.round((health.storageMB / health.budgetMB) * 100)}%</span></spec-lu-row>
            <spec-lu-row heading="Corrections" detail="Since the last retrain"><span slot="trailing">${health.corrections}</span></spec-lu-row>`
        : nothing}
    </spec-lu-section>

    <spec-lu-section icon="mdi:tune" heading="Detector settings" summary="Nothing is saved" .count=${1}>
      <div class="controls">
        <spec-lu-stepper label="Clip length" unit="s" .value=${props.clip} min="1" max="60" step="1" @lu-change=${(event: CustomEvent<{ value: number }>) => props.onClip(event.detail.value)}></spec-lu-stepper>
        <spec-lu-slider label="Sensitivity" unit="%" .value=${props.sensitivity} min="0" max="100" step="1"
          @lu-input=${(event: CustomEvent<{ value: number }>) => props.onSensitivity(event.detail.value, false)}
          @lu-change=${(event: CustomEvent<{ value: number }>) => props.onSensitivity(event.detail.value, true)}></spec-lu-slider>
        <div class="buttons">
          <spec-lu-button kind="primary" icon="mdi:content-save" label="Save" @click=${props.onSave}></spec-lu-button>
          <spec-lu-button kind="secondary" label="Reset" @click=${props.onReset}></spec-lu-button>
          <spec-lu-button kind="danger" icon="mdi:close" label="Discard" @click=${props.onDiscard}></spec-lu-button>
          <spec-lu-button kind="quiet" icon="mdi:keyboard" label="Keyboard shortcuts" @click=${props.onHelp}></spec-lu-button>
        </div>
      </div>
    </spec-lu-section>

    <spec-lu-section icon="mdi:flask" heading="State previews" summary="Pick one" .count=${1}>
      <div class="controls">
        <spec-lu-segmented label="State to preview" .options=${PREVIEWS} .value=${props.preview} @lu-change=${(event: CustomEvent<{ value: string }>) => props.onPreview(event.detail.value as Preview)}></spec-lu-segmented>
        <div class="preview">${previewState(props)}</div>
      </div>
    </spec-lu-section>

    <spec-lu-section icon="mdi:cloud-off-outline" heading="Try the data layer" .count=${1}>
      <div class="controls">
        <spec-lu-row heading="Failure drill" detail="The next load or save answers with an error; the one after works again.">
          <spec-lu-chip slot="trailing" interactive .selected=${props.failArmed} label="Fail next request" @click=${props.onToggleFail}></spec-lu-chip>
        </spec-lu-row>
        <div class="buttons">
          <spec-lu-button kind="secondary" icon="mdi:refresh" label="Reload this page's data" @click=${props.onReload}></spec-lu-button>
          <spec-lu-button kind="secondary" icon="mdi:bird" label="Simulate a new sighting" @click=${props.onSimulate}></spec-lu-button>
          <spec-lu-button kind="quiet" icon="mdi:undo" label="Reset the sample data" @click=${props.onResetWorld}></spec-lu-button>
        </div>
        ${insights.error && data ? html`<p class="note">${errorText(insights.error)} The last good data stays on screen.</p>` : nothing}
      </div>
    </spec-lu-section>

    <spec-lu-section icon="mdi:check-all" heading="Review" summary="Hard to undo" .count=${1}>
      <div class="controls">
        <spec-lu-hold-button icon="mdi:check-all" label="Hold to confirm them all" confirm-label="Confirm all" .busy=${props.confirming} .disabled=${review.length === 0}
          .consequence=${review.length > 0 ? `Marks ${review.length} sightings in "Needs a look" as correct.` : "There is nothing to confirm."} @lu-confirm=${props.onConfirmAll}></spec-lu-hold-button>
      </div>
    </spec-lu-section>
  </div>`;
}
