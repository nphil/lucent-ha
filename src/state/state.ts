import { css, nothing } from "lit";
import { html } from "lit/static-html.js";
import { LuElement } from "../core/element.ts";
import { InViewController } from "../core/in-view.ts";
import { renderIcon } from "../core/icon.ts";
import { LuGrid } from "../grid/grid.ts";
import type { GridKind } from "../grid/grid.ts";
import { BASE_CSS, CONTROLS_CSS } from "../tokens/base-css.ts";
import { formatAgo } from "./format-ago.ts";

export type StateKind = "loading" | "empty" | "error" | "stale";
export type StateVariant = "rows" | "thumbs" | "tiles" | "text";

/** How often the "12 min ago" of a stale strip is recomputed while it is on screen. */
const AGO_REFRESH_MS = 30_000;
/** Placeholders shown when `count` is 0, per variant: enough to look like a list, few enough to be quick. */
const DEFAULT_COUNT: Record<StateVariant, number> = { rows: 3, thumbs: 4, tiles: 6, text: 3 };
const DEFAULT_ICON: Record<StateKind, string> = { loading: "", empty: "mdi:inbox-outline", error: "mdi:alert-circle-outline", stale: "mdi:clock-alert-outline" };

/** One element for the four honest states of a list, grid or card that is not simply "showing its data".
 *
 * - `loading`: a STATIC skeleton (no pulse, no shimmer) with the geometry of the content it stands for. Show it
 *   only while there is no data yet. `variant` picks the shape: `rows` (row-high bars with a leading icon and two
 *   lines), `thumbs` (16:10 rail tiles), `tiles` (a real `lu-grid` of image-plus-caption tiles; `tile` picks the
 *   grid kind and `ratio` the image shape), `text` (lines). `count` is how many (0 = a sensible default).
 * - `empty`: icon, `heading`, `message` and a next step in the `action` slot. Say WHY it is empty.
 * - `error`: `heading`/`message` and a Retry button (`retryLabel`, event `lu-retry`). With last-good content in the
 *   default slot the content stays and a one-line "couldn't refresh" strip follows it: an error never replaces data.
 * - `stale`: a slim strip "Showing data from 12 min ago" (`since` = ms epoch; `message` adds the reason) above the
 *   slotted content.
 *
 * `compact` renders empty/error as a single line instead of a centred block. */
export class LuState extends LuElement {
  static override luName = "state";
  static override luDeps = [LuGrid] as const;

  static properties = {
    kind: { type: String, reflect: true },
    variant: { type: String, reflect: true },
    count: { type: Number },
    heading: { type: String },
    message: { type: String },
    icon: { type: String },
    since: { type: Number },
    retryLabel: { type: String, attribute: "retry-label" },
    tile: { type: String },
    ratio: { type: String },
    compact: { type: Boolean, reflect: true },
    _hasContent: { state: true },
  };

  declare kind: StateKind;
  declare variant: StateVariant;
  declare count: number;
  declare heading: string;
  declare message: string;
  declare icon: string;
  declare since: number;
  declare retryLabel: string;
  declare tile: GridKind;
  declare ratio: string;
  declare compact: boolean;
  declare _hasContent: boolean;

  private readonly _inView = new InViewController(this);
  private _timer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    super();
    this.kind = "empty";
    this.variant = "rows";
    this.count = 0;
    this.heading = "";
    this.message = "";
    this.icon = "";
    this.since = 0;
    this.retryLabel = "Retry";
    this.tile = "custom";
    this.ratio = "4/3";
    this.compact = false;
    this._hasContent = false;
  }

  static override styles = [BASE_CSS, CONTROLS_CSS, css`
    :host { display: block; min-width: 0; --lu-state-min: calc(var(--lu-row) * 3); }
    :host([variant="thumbs"]) { --lu-state-min: calc(var(--lu-target) * 2.1875); }
    :host([variant="text"]) { --lu-state-min: calc(var(--lu-type-body) * 3 + var(--lu-space-3) * 2); }

    /* Skeleton: fixed geometry, a flat fill, no animation of any kind. */
    .bone { display: block; border-radius: var(--lu-radius-control); background: var(--lu-tile); }
    .rows { display: grid; }
    .row-bone { display: flex; align-items: center; gap: var(--lu-space-3); height: var(--lu-row); padding-inline: var(--lu-space-3); }
    .row-bone .lead { flex: none; width: 24px; height: 24px; }
    .row-bone .lines { display: grid; flex: 1; gap: var(--lu-space-2); min-width: 0; }
    .row-bone .l1 { width: 60%; height: var(--lu-type-label); }
    .row-bone .l2 { width: 35%; height: var(--lu-type-caption); }
    .thumbs { display: flex; gap: var(--lu-space-3); overflow: hidden; }
    .thumb-bone { flex: none; width: calc(var(--lu-target) * 3.5); aspect-ratio: 16 / 10; border-radius: var(--lu-radius-tile); background: var(--lu-tile); }
    .tile-bone { display: grid; gap: var(--lu-space-2); align-content: start; }
    .tile-bone .art { border-radius: var(--lu-radius-tile); }
    .tile-bone .c1 { width: 70%; height: calc(var(--lu-type-label) * 1.3); }
    .tile-bone .c2 { width: 45%; height: calc(var(--lu-type-caption) * 1.3); }
    .text { display: grid; gap: var(--lu-space-3); }
    .text .bone { height: var(--lu-type-body); }
    .text .bone:last-child { width: 60%; }

    /* Empty and error: a centred block with the reason and a next step (never a card inside a card). */
    .block { display: grid; justify-items: center; align-content: center; gap: var(--lu-space-3); min-height: var(--lu-state-min); padding: var(--lu-space-6) var(--lu-space-4); color: var(--lu-ink-2); text-align: center; }
    .block .icon { --lu-icon: 40px; color: var(--lu-ink-3); }
    :host([kind="error"]) .icon { color: var(--lu-danger); }
    .copy { display: grid; gap: var(--lu-space-1); justify-items: center; min-width: 0; }
    .heading { margin: 0; color: var(--lu-ink); font: 600 var(--lu-type-title)/1.3 var(--lu-font); overflow-wrap: anywhere; }
    .message { max-width: 42ch; margin: 0; font: 400 var(--lu-type-body)/1.5 var(--lu-font); overflow-wrap: anywhere; }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--lu-space-2); }
    .actions:empty { display: none; }

    /* The same content as one line: used by compact states and whenever last-good content stays visible. */
    .line { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lu-space-1) var(--lu-space-3); min-height: var(--lu-target); color: var(--lu-ink-2); font: 400 var(--lu-type-label)/1.4 var(--lu-font); }
    .line .icon { --lu-icon: 20px; color: var(--lu-ink-3); }
    :host([kind="error"]) .line .icon { color: var(--lu-danger); }
    .line .heading { font: 600 var(--lu-type-label)/1.4 var(--lu-font); }
    .line .message { max-width: none; font: inherit; }
    .line .copy { display: flex; flex-wrap: wrap; gap: var(--lu-space-1) var(--lu-space-2); justify-items: start; }
    .strip { padding-inline: var(--lu-space-3); border-radius: var(--lu-radius-control); background: var(--lu-tile); }
    .after { margin-top: var(--lu-space-2); }
    .before { margin-bottom: var(--lu-space-2); }
  `];

  override connectedCallback(): void {
    super.connectedCallback();
    this._syncTimer();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._syncTimer();
  }

  protected override updated(): void {
    this._syncTimer();
  }

  /** The "ago" text only changes while it can be seen: one slow timer, on while a stale strip is on screen. */
  private _syncTimer(): void {
    const wanted = this.isConnected && this.kind === "stale" && this.since > 0 && this._inView.visible;
    if (wanted && this._timer === undefined) this._timer = setInterval(() => this.requestUpdate(), AGO_REFRESH_MS);
    else if (!wanted && this._timer !== undefined) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
  }

  private _contentChanged(event: Event): void {
    const slot = event.target as HTMLSlotElement;
    this._hasContent = slot.assignedNodes({ flatten: true }).some((node) => node.nodeType === Node.ELEMENT_NODE || (node.textContent ?? "").trim() !== "");
  }

  private _retry(): void {
    this.emit("lu-retry");
  }

  private _renderSkeleton() {
    const count = this.count > 0 ? this.count : DEFAULT_COUNT[this.variant];
    const label = this.heading || "Loading";
    const bones = Array.from({ length: count }, (_, index) => index);
    let shape;
    if (this.variant === "rows") {
      shape = html`<div class="rows" aria-hidden="true">${bones.map(() => html`<div class="row-bone"><span class="bone lead"></span><span class="lines"><span class="bone l1"></span><span class="bone l2"></span></span></div>`)}</div>`;
    } else if (this.variant === "thumbs") {
      shape = html`<div class="thumbs" aria-hidden="true">${bones.map(() => html`<span class="thumb-bone"></span>`)}</div>`;
    } else if (this.variant === "tiles") {
      const grid = this.luTag("grid");
      shape = html`<${grid} kind=${this.tile} aria-hidden="true">${bones.map(() => html`<div class="tile-bone"><span class="bone art" style=${`aspect-ratio: ${this.ratio}`}></span><span class="bone c1"></span><span class="bone c2"></span></div>`)}</${grid}>`;
    } else {
      shape = html`<div class="text" aria-hidden="true">${bones.map(() => html`<span class="bone"></span>`)}</div>`;
    }
    return html`<div role="status"><span class="sr-only">${label}</span>${shape}</div>`;
  }

  private _renderMessage(role: "status" | "alert", compact: boolean) {
    // A one-line "nothing here" reads best as plain text; every other state keeps its icon.
    const icon = this.icon || (this.kind === "empty" && compact ? "" : DEFAULT_ICON[this.kind]);
    const retry = this.kind === "error" ? html`<button class=${compact ? "text-button" : "pill secondary"} type="button" @click=${this._retry}>${this.retryLabel}</button>` : nothing;
    const copy = html`<span class="copy">${this.heading ? html`<p class="heading">${this.heading}</p>` : nothing}${this.message ? html`<p class="message">${this.message}</p>` : nothing}</span>`;
    if (compact) return html`<div class=${`line ${this._hasContent ? "after" : ""}`} role=${role}>${renderIcon(icon)}${copy}<slot name="action"></slot>${retry}</div>`;
    return html`<div class="block" role=${role}>${renderIcon(icon)}${copy}<div class="actions"><slot name="action"></slot>${retry}</div></div>`;
  }

  private _renderStale() {
    const since = this.since > 0 ? html`Showing data from <time datetime=${new Date(this.since).toISOString()}>${formatAgo(this.since)}</time>` : html`Showing older data`;
    return html`<div class="line strip before">${renderIcon(this.icon || DEFAULT_ICON.stale)}<span class="copy"><span>${since}${this.message ? html` · ${this.message}` : nothing}</span></span><slot name="action"></slot></div>`;
  }

  protected override render() {
    if (this.kind === "loading") return this._renderSkeleton();
    if (this.kind === "empty") return this._renderMessage("status", this.compact);
    const content = html`<slot @slotchange=${this._contentChanged}></slot>`;
    if (this.kind === "stale") return html`${this._renderStale()}${content}`;
    return html`${content}${this._renderMessage("alert", this.compact || this._hasContent)}`;
  }
}

declare global { interface HTMLElementEventMap { "lu-retry": CustomEvent<undefined> } }
