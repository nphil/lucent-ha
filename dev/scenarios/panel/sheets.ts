/** The two sheets that use the sheet's own history entry (`history` stays on): "What was it?" and the shortcut list. Back closes them, and
 * `layerDepth()` counts them. */
import { html, nothing } from "lit";
import type { TemplateResult } from "lit";
import type { LuCloseDetail, SwrSnapshot } from "../../../src/index.ts";
import { ago, errorText } from "./data.ts";
import type { Species, Suggestion, Visit } from "./types.ts";

const WHY: Record<Suggestion["why"], string> = { usual: "Common here", model: "The model's other guess", heard: "Heard here" };

/** The species to offer for a visit: the suggestions first (with their reason), then the busiest species, narrowed by what was typed. */
function candidates(visit: Visit, species: readonly Species[], query: string): { name: string; reason: string }[] {
  const taken = new Set([visit.species]);
  const rows: { name: string; reason: string }[] = [];
  const add = (name: string, reason: string): void => {
    if (taken.has(name)) return;
    taken.add(name);
    rows.push({ name, reason });
  };
  for (const suggestion of visit.suggestions) add(suggestion.species, WHY[suggestion.why]);
  for (const item of [...species].sort((a, b) => b.seenCount + b.heardCount - (a.seenCount + a.heardCount))) add(item.name, "");
  const needle = query.trim().toLowerCase();
  return (needle ? rows.filter((row) => row.name.toLowerCase().includes(needle)) : rows).slice(0, 16);
}

export interface PickerProps {
  open: boolean;
  visit: SwrSnapshot<Visit | null> | undefined;
  species: SwrSnapshot<Species[]> | undefined;
  query: string;
  onClose(event: CustomEvent<LuCloseDetail>): void;
  onQuery(value: string): void;
  /** A species, or `not_animal` / `unknown`. */
  onPick(choice: string): void;
  onRetry(): void;
}

function pickerBody(props: PickerProps): TemplateResult {
  const visit = props.visit?.data;
  const species = props.species?.data;
  const failure = props.visit?.error && visit === undefined ? props.visit.error : props.species?.error && species === undefined ? props.species.error : undefined;
  if (failure) return html`<spec-lu-state kind="error" compact heading="Couldn't load the choices" .message=${errorText(failure)} @lu-retry=${props.onRetry}></spec-lu-state>`;
  if (!visit || !species) return html`<spec-lu-state kind="loading" variant="rows" count="4" heading="Loading the choices"></spec-lu-state>`;
  const rows = candidates(visit, species, props.query);
  return html`${rows.map((row) => html`<spec-lu-row interactive chevron .heading=${row.name} .detail=${row.reason} @click=${() => props.onPick(row.name)}></spec-lu-row>`)}
    ${rows.length === 0 ? html`<spec-lu-state kind="empty" compact message=${`No species match "${props.query.trim()}".`}></spec-lu-state>` : nothing}`;
}

/** "What was it?": a search field and the likeliest species as rows above the fold. On a touch screen the sheet never focuses the field by
 * itself (that would raise the keyboard over half of it), even though the markup says `autofocus`. */
export function pickerSheet(props: PickerProps): TemplateResult {
  const visit = props.visit?.data;
  return html`<spec-lu-sheet .open=${props.open} layer="picker" heading="What was it?" .subheading=${visit ? `${visit.species} at ${visit.cameraName}, ${ago(visit.startedAt)}` : "Pick the right species"} @lu-close=${props.onClose}>
    <input class="search" type="search" autofocus placeholder="Search species" aria-label="Search species" .value=${props.query} @input=${(event: Event) => props.onQuery((event.currentTarget as HTMLInputElement).value)} />
    <div class="choices">${pickerBody(props)}</div>
    <div slot="footer" class="special">
      <spec-lu-button kind="secondary" label="Not an animal" @click=${() => props.onPick("not_animal")}></spec-lu-button>
      <spec-lu-button kind="secondary" label="Can't tell" @click=${() => props.onPick("unknown")}></spec-lu-button>
    </div>
  </spec-lu-sheet>`;
}

const SHORTCUTS: readonly (readonly [key: string, what: string])[] = [
  ["1", "Live"], ["2", "Library"], ["3", "Insights"], ["?", "Show this list"], ["Esc", "Close a sheet, or go back"],
];

export function helpSheet(props: { open: boolean; onClose(event: CustomEvent<LuCloseDetail>): void }): TemplateResult {
  return html`<spec-lu-sheet .open=${props.open} layer="help" heading="Keyboard shortcuts" subheading="With a keyboard, single keys work anywhere in the panel." @lu-close=${props.onClose}>
    ${SHORTCUTS.map(([key, what]) => html`<spec-lu-row .heading=${what}><kbd slot="trailing">${key}</kbd></spec-lu-row>`)}
  </spec-lu-sheet>`;
}
