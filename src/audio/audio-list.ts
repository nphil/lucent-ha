import { css, html, nothing, type PropertyValues } from "lit";
import { BASE_CSS, CONTROLS_CSS } from "../tokens/base-css.ts";
import { LuElement } from "../core/element.ts";
import { renderIcon } from "../core/icon.ts";
import { SharedAudio, type AudioListRow } from "./audio-model.ts";

/** A list of recordings, each with a play button that plays right in the row.
 *
 * - ONE shared `<audio>` for the whole list and `claimAudio` for the page: only one recording plays at a time,
 *   in the list or anywhere else (another `lu-audio-player`, another list).
 * - Pressing play starts the download a moment before the tap completes; the newest row is loaded when the list
 *   appears, so its first play is instant. A row plays its CURRENT `src`, also when it changed while listed.
 * - `src` fails -> the row's `fallback` plays (e.g. the untouched recording behind a cleaned preview); when that
 *   fails too the row says "Couldn't load this recording." and tapping its play button tries again.
 * - The progress hairline of the playing row moves by direct style: the list does not re-render four times a second.
 * - Tapping the rest of a row fires `lu-select {id}`; the trailing "Show more" button fires `lu-more`.
 * - `stop()` stops whatever plays. A row that disappears while playing stops the sound.
 *
 * Rows are a fixed `--lu-row` high with `content-visibility: auto`, so long lists stay cheap. Needs the host's `--lu-*` tokens. */
export class LuAudioList extends LuElement {
  static override luName = "audio-list";

  static properties = {
    rows: { attribute: false },
    more: { type: Boolean },
    loading: { type: Boolean },
    moreLabel: { type: String, attribute: "more-label" },
  };

  declare rows: readonly AudioListRow[];
  declare more: boolean;
  declare loading: boolean;
  declare moreLabel: string;

  private _shared: SharedAudio | undefined;

  constructor() {
    super();
    this.rows = [];
    this.more = false;
    this.loading = false;
    this.moreLabel = "Show more recordings";
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this._shared) this._shared.setRows(this.rows); // came back after a removal: warm the newest row again
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._shared?.dispose();
  }

  protected override firstUpdated(): void {
    const audio = this.renderRoot.querySelector("audio");
    if (!audio) return;
    this._shared = new SharedAudio(audio, {
      changed: () => this.requestUpdate(),
      progress: (fraction) => {
        const bar = this.renderRoot.querySelector<HTMLElement>(".progress");
        if (bar) bar.style.transform = `scaleX(${fraction})`;
      },
    });
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has("rows")) this._shared?.setRows(this.rows);
  }

  /** Stops whatever is playing. */
  stop(): void {
    this._shared?.stop();
  }

  static override styles = [BASE_CSS, CONTROLS_CSS, css`
    :host { display: block; }
    ul { margin: 0; padding: 0; list-style: none; }
    li { position: relative; display: flex; align-items: center; gap: var(--lu-space-2); height: var(--lu-row); border-bottom: 1px solid var(--lu-edge); content-visibility: auto; contain-intrinsic-size: auto var(--lu-row); }
    li:last-child { border-bottom: 0; }
    .play { display: grid; flex: none; width: var(--lu-target); height: var(--lu-target); place-items: center; padding: 0; border: 1px solid var(--lu-edge-raised); border-radius: 50%; color: var(--lu-ink); background: var(--lu-glass-raised); box-shadow: var(--lu-highlight-raised); cursor: pointer; transition: background-color var(--lu-motion-label) var(--lu-ease); }
    .play:is(:active, [data-pressed]):not(:disabled) { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); transition: none; }
    .active .play { border-color: transparent; color: var(--lu-accent-ink); background: var(--lu-accent); box-shadow: none; }
    .play:disabled { color: var(--lu-ink-3); background: var(--lu-tile); box-shadow: none; cursor: not-allowed; }
    .open { display: flex; flex: 1; align-items: center; gap: var(--lu-space-3); min-width: 0; height: 100%; padding: 0 var(--lu-space-2) 0 var(--lu-space-3); border: 0; border-radius: var(--lu-radius-row); color: var(--lu-ink); background: transparent; text-align: left; cursor: pointer; transition: background-color var(--lu-motion-label) var(--lu-ease); }
    .open:is(:active, [data-pressed]) { background: var(--lu-material-press-wash); }
    @media (hover: hover) and (pointer: fine) { .open:hover { background: var(--lu-material-hover-wash); } }
    .open > .icon { color: var(--lu-ink-3); }
    .text { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
    .title { overflow: hidden; font-size: var(--lu-type-label); font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
    .mark { margin-left: var(--lu-space-2); padding: 1px var(--lu-space-2); border: 1px solid var(--lu-edge); border-radius: var(--lu-radius-pill); color: var(--lu-ink-2); font-size: var(--lu-type-caption); font-weight: 600; vertical-align: 1px; }
    .note { overflow: hidden; color: var(--lu-ink-2); font-size: var(--lu-type-caption); text-overflow: ellipsis; white-space: nowrap; }
    .note.failed { color: var(--lu-danger); }
    .meta { color: var(--lu-ink-2); font-size: var(--lu-type-label); font-variant-numeric: tabular-nums; }
    .progress { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--lu-accent); transform: scaleX(0); transform-origin: left; transition: transform 250ms linear; }
    @media (prefers-reduced-motion: reduce) { .progress, .play, .open { transition: none; } }
  `];

  protected override render() {
    const shared = this._shared;
    return html`<ul role="list">
      ${this.rows.map((row) => {
        const active = shared?.isActive(row) ?? false;
        const playing = shared?.isPlaying(row) ?? false;
        const failed = shared?.isFailed(row) ?? false;
        const note = failed ? "Couldn't load this recording." : !row.src ? "No recording saved" : row.caption ?? "";
        return html`<li class=${active ? "active" : ""}>
          <button class="play" type="button" ?disabled=${!row.src} aria-label=${`${playing ? "Pause" : "Play"} ${row.label}`} @pointerdown=${() => this._shared?.warm(row)} @click=${() => this._shared?.toggle(row)}>${renderIcon(!row.src ? "mdi:volume-off" : playing ? "mdi:pause" : "mdi:play")}</button>
          <button class="open" type="button" aria-label=${`Open ${row.label}`} @click=${() => this.emit("lu-select", { id: row.id })}>
            <span class="text"><span class="title">${row.title}${row.mark ? html`<span class="mark">${row.mark}</span>` : nothing}</span>${note ? html`<span class=${failed ? "note failed" : "note"}>${note}</span>` : nothing}</span>
            ${row.meta ? html`<span class="meta">${row.meta}</span>` : nothing}
            ${renderIcon("mdi:chevron-right")}
          </button>
          ${active ? html`<span class="progress" aria-hidden="true"></span>` : nothing}
        </li>`;
      })}
    </ul>
    ${this.more ? html`<button class="text-button" type="button" ?disabled=${this.loading} @click=${() => this.emit("lu-more")}>${this.loading ? "Loading…" : this.moreLabel}</button>` : nothing}
    <audio hidden preload="none" @play=${() => this._shared?.handlePlay()} @pause=${() => this._shared?.handlePause()} @ended=${() => this._shared?.handleEnded()} @timeupdate=${() => this._shared?.handleTime()} @error=${() => this._shared?.handleError()}></audio>`;
  }
}
