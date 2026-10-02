import { html } from "lit";
import type { TemplateResult } from "lit";
import { createRef, ref } from "lit/directives/ref.js";
import type { Ref } from "lit/directives/ref.js";
import type { Specimen } from "../specimen-types.ts";
import { showToast } from "../../src/sheet/toast-event.ts";
import type { LuCloseDetail, LuSheet } from "../../src/sheet/index.ts";

/** Specimens of the sheet slice: the sheet in every state it has (short, with header actions and a footer, long, with a
 * search field, nested, with no history entry as in a card, drawn by Home Assistant's own dialog) and the toast with Undo.
 * Where the sheet sits (bottom sheet, centred, side pane) follows the screen, so one specimen shows all three across the
 * device matrix. Every sheet reports how it closed in the line under its button. */

const paragraph = (text: string): TemplateResult => html`<p style="margin:0 0 var(--lu-space-3);color:var(--lu-ink-2);font:400 var(--lu-type-body)/1.45 var(--lu-font)">${text}</p>`;

const RESULTS = ["Robin", "Blue tit", "Great tit", "Coal tit", "Blackbird", "Song thrush", "Dunnock", "Wren", "Chaffinch", "Goldfinch", "Greenfinch", "House sparrow", "Magpie", "Jay", "Woodpigeon", "Collared dove"];

const SENTENCES = [
  "A robin visited the feeder at 06:52 and stayed for two minutes.",
  "The garden camera saw a fox cross the lawn just after midnight.",
  "Three blue tits shared the peanut feeder in the late afternoon.",
  "A hedgehog came out from under the shed when the lights went off.",
];

/** One row of a list: a 48px+ target with a label, like the species picker of the correction sheet. */
function result(name: string, index: number): TemplateResult {
  return html`<button type="button" data-result style="display:flex;align-items:center;gap:var(--lu-space-3);width:100%;min-height:var(--lu-target);padding:0 var(--lu-space-3);border:0;border-radius:var(--lu-radius-row);background:transparent;color:var(--lu-ink);font:500 var(--lu-type-body) var(--lu-font);text-align:start;cursor:pointer">
    <span aria-hidden="true" style="flex:none;width:32px;height:32px;border-radius:50%;background:color-mix(in srgb,var(--lu-accent) ${25 + (index % 5) * 10}%,var(--lu-canvas))"></span>${name}</button>`;
}

/** The line under a button: where the last close came from. */
function status(target: Ref<HTMLElement>): TemplateResult {
  return html`<p ${ref(target)} data-status style="margin:var(--lu-space-2) 0 0;color:var(--lu-ink-2);font:400 var(--lu-type-caption)/1.3 var(--lu-font)">Not opened yet.</p>`;
}

function report(target: Ref<HTMLElement>): (event: CustomEvent<LuCloseDetail>) => void {
  return (event) => {
    event.stopPropagation();
    if (target.value) target.value.textContent = `Closed by: ${event.detail.reason}`;
  };
}

/** A button that opens `sheet`. */
function opener(sheet: Ref<LuSheet>, label: string, id: string): TemplateResult {
  return html`<spec-lu-button kind="primary" data-open=${id} @click=${() => sheet.value?.show()}>${label}</spec-lu-button>`;
}

function basic(): TemplateResult {
  const sheet = createRef<LuSheet>();
  const line = createRef<HTMLElement>();
  return html`${opener(sheet, "Open sheet", "basic")}${status(line)}
    <spec-lu-sheet ${ref(sheet)} heading="Robin" subheading="Seen 12 times in 30 days" @lu-close=${report(line)}>
      ${SENTENCES.map(paragraph)}
    </spec-lu-sheet>`;
}

function footerAndActions(): TemplateResult {
  const sheet = createRef<LuSheet>();
  const line = createRef<HTMLElement>();
  const raise = (event: Event) => showToast(event.currentTarget as HTMLElement, {
    message: "Saved as robin",
    kind: "success",
    actionLabel: "Undo",
    onAction: () => { if (line.value) line.value.textContent = "Undo pressed (toast raised inside the sheet)."; },
  });
  return html`${opener(sheet, "Open sheet with footer", "footer")}${status(line)}
    <spec-lu-sheet ${ref(sheet)} heading="Correct this visit" subheading="Garden camera, today 06:52" @lu-close=${report(line)}>
      <spec-lu-button slot="actions" kind="quiet" icon-only icon="mdi:share-variant" label="Share"></spec-lu-button>
      ${SENTENCES.slice(0, 2).map(paragraph)}
      <spec-lu-button data-save kind="secondary" @click=${raise}>Raise a toast from inside</spec-lu-button>
      <spec-lu-button slot="footer" kind="secondary" @click=${() => sheet.value?.close("button")}>Cancel</spec-lu-button>
      <spec-lu-button slot="footer" kind="primary" @click=${() => sheet.value?.close("api")}>That's right</spec-lu-button>
    </spec-lu-sheet>`;
}

function long(): TemplateResult {
  const sheet = createRef<LuSheet>();
  const line = createRef<HTMLElement>();
  return html`${opener(sheet, "Open long sheet", "long")}${status(line)}
    <spec-lu-sheet ${ref(sheet)} heading="Recent visits" subheading="Scroll inside; the page behind stays put" @lu-close=${report(line)}>
      ${Array.from({ length: 36 }, (_, index) => html`<div data-row style="display:flex;align-items:center;min-height:var(--lu-row);border-bottom:1px solid var(--lu-edge);color:var(--lu-ink);font:400 var(--lu-type-body) var(--lu-font)">Visit ${index + 1}: ${RESULTS[index % RESULTS.length]}, ${index * 7 + 3} minutes ago</div>`)}
    </spec-lu-sheet>`;
}

function withField(): TemplateResult {
  const sheet = createRef<LuSheet>();
  const line = createRef<HTMLElement>();
  const field = "display:block;box-sizing:border-box;width:100%;min-height:var(--lu-target);margin:0 0 var(--lu-space-2);padding:0 var(--lu-space-4);border:1px solid var(--lu-edge-raised);border-radius:var(--lu-radius-control);background:var(--lu-tile);color:var(--lu-ink);font:400 var(--lu-type-body) var(--lu-font)";
  return html`${opener(sheet, "Open sheet with a search field", "field")}${status(line)}
    <spec-lu-sheet ${ref(sheet)} heading="What was it?" subheading="Pick the species or search" @lu-close=${report(line)}>
      <input data-field type="search" autofocus placeholder="Search species" aria-label="Search species" style=${field} />
      ${RESULTS.map(result)}
    </spec-lu-sheet>`;
}

function nested(): TemplateResult {
  const outer = createRef<LuSheet>();
  const inner = createRef<LuSheet>();
  const line = createRef<HTMLElement>();
  const innerClosed = (event: CustomEvent<LuCloseDetail>) => {
    event.stopPropagation();
    if (line.value) line.value.textContent = `Second sheet closed by: ${event.detail.reason}`;
  };
  return html`${opener(outer, "Open sheet, then another on top", "nested")}${status(line)}
    <spec-lu-sheet ${ref(outer)} heading="Species" subheading="First sheet" @lu-close=${report(line)}>
      ${paragraph("Press the button to open a second sheet on top of this one. Back, Escape and the close button always close the top sheet first.")}
      <spec-lu-button data-open="inner" kind="primary" @click=${() => inner.value?.show()}>Open the second sheet</spec-lu-button>
      <spec-lu-sheet ${ref(inner)} heading="Correction" subheading="Second sheet" @lu-close=${innerClosed}>
        ${paragraph("This sheet is above the first one; the first one is behind it and inert.")}
        ${RESULTS.slice(0, 4).map(result)}
      </spec-lu-sheet>
    </spec-lu-sheet>`;
}

/** What a Lovelace card does: no history entry, so a card never touches the page's history. (Every specimen cell is also inside a
 * card with the theme's `backdrop-filter`, which traps `position: fixed` children; the sheet must cover the screen all the same.) */
function withoutHistory(): TemplateResult {
  const sheet = createRef<LuSheet>();
  const line = createRef<HTMLElement>();
  return html`${opener(sheet, "Open sheet without history", "card")}${status(line)}
    <spec-lu-sheet ${ref(sheet)} .history=${false} heading="Card sheet" subheading="No history entry" @lu-close=${report(line)}>
      ${SENTENCES.slice(0, 2).map(paragraph)}
    </spec-lu-sheet>`;
}

/** The sheet drawn by Home Assistant's own `ha-adaptive-dialog`. The harness registers a stand-in for it (written from Home Assistant's
 * source) only with `?ha-dialog=1`; without it the sheet warns and falls back to its native dialog, which this specimen says out loud. */
function haEngine(): TemplateResult {
  const sheet = createRef<LuSheet>();
  const line = createRef<HTMLElement>();
  const present = customElements.get("ha-adaptive-dialog") !== undefined;
  return html`<spec-lu-button kind="primary" data-open="ha" @click=${() => { if (sheet.value) { sheet.value.engine = "ha"; sheet.value.show(); } }}>Open with Home Assistant's dialog</spec-lu-button>${status(line)}
    <p style="margin:var(--lu-space-2) 0 0;color:var(--lu-ink-3);font:400 var(--lu-type-caption)/1.3 var(--lu-font)">${present ? "Drawn by the ha-adaptive-dialog stand-in this harness registered." : "This page has no ha-adaptive-dialog: add ?ha-dialog=1 to the harness URL. Until then the sheet warns and draws its own dialog."}</p>
    <spec-lu-sheet ${ref(sheet)} heading="Drawn by Home Assistant" subheading="engine = ha" @lu-close=${report(line)}>
      <spec-lu-button slot="actions" kind="quiet" icon-only icon="mdi:share-variant" label="Share"></spec-lu-button>
      ${SENTENCES.slice(0, 2).map(paragraph)}
      <spec-lu-button slot="footer" kind="primary" @click=${() => sheet.value?.close("api")}>Done</spec-lu-button>
    </spec-lu-sheet>`;
}

function toasts(): TemplateResult {
  const line = createRef<HTMLElement>();
  const toast = (options: Parameters<typeof showToast>[1]) => (event: Event) => showToast(event.currentTarget as HTMLElement, options);
  const undone = () => { if (line.value) line.value.textContent = "Undo pressed."; };
  const queue = (event: Event) => {
    for (const word of ["one", "two", "three"]) showToast(event.currentTarget as HTMLElement, { message: `Queued toast ${word}` });
  };
  return html`<div style="display:flex;flex-wrap:wrap;gap:var(--lu-space-2)">
      <spec-lu-button kind="secondary" data-toast="info" @click=${toast({ message: "Camera list refreshed" })}>Info</spec-lu-button>
      <spec-lu-button kind="secondary" data-toast="success" @click=${toast({ message: "Saved as robin", kind: "success" })}>Success</spec-lu-button>
      <spec-lu-button kind="secondary" data-toast="error" @click=${toast({ message: "Couldn't reach the camera. Check the network and try again.", kind: "error", actionLabel: "Retry", onAction: undone })}>Error + Retry</spec-lu-button>
      <spec-lu-button kind="primary" data-toast="undo" @click=${toast({ message: "Corrected to robin", actionLabel: "Undo", onAction: undone })}>Undo toast</spec-lu-button>
      <spec-lu-button kind="secondary" data-toast="queue" @click=${queue}>Queue of three</spec-lu-button>
    </div>${status(line)}`;
}

export const specimens: Specimen[] = [
  { id: "sheet-basic", title: "Sheet: heading, subheading, short body (bottom sheet < 680, centred, side pane >= 900 or short)", group: "sheet", render: basic },
  { id: "sheet-footer-actions", title: "Sheet: header action, pinned footer, toast raised inside", group: "sheet", render: footerAndActions },
  { id: "sheet-long", title: "Sheet: long scrolling body, page behind locked", group: "sheet", render: long },
  { id: "sheet-field", title: "Sheet: search field (no keyboard on touch), 16 results", group: "sheet", render: withField },
  { id: "sheet-nested", title: "Sheet: two sheets on top of each other", group: "sheet", render: nested },
  { id: "sheet-no-history", title: "Sheet without a history entry (as in a card)", group: "sheet", render: withoutHistory },
  { id: "sheet-ha-engine", title: "Sheet drawn by Home Assistant's dialog (stand-in, ?ha-dialog=1)", group: "sheet", render: haEngine },
  { id: "toast", title: "Toast: info, success, error + Retry, Undo, queue", group: "sheet", render: toasts },
];
