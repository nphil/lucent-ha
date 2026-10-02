import { css, html, nothing } from "lit";
import { html as staticHtml } from "lit/static-html.js";
import { LuElement } from "../core/element.ts";
import { fireHaptic } from "../core/haptics.ts";
import { renderIcon } from "../core/icon.ts";
import { BASE_CSS, CONTROLS_CSS } from "../tokens/base-css.ts";
import { PILL_SURFACE_CSS, LuButton } from "./button.ts";
import { ICON_ALERT, ICON_CHECK, ICON_INFO } from "./controls-icons.ts";
import { HOLD_DEFAULTS, HOLD_IDLE, holdDrainRemainingMs, holdProgress, holdRelease, holdPress, holdRemainingMs, type HoldState } from "./hold-model.ts";

/** How long the "done" label stays before the button is ready again (ms). */
const SETTLE_MS = 900;
/** A finger that slides this far (px) outside the button has let go of it. */
const SLIP_PX = 8;

type View = "idle" | "charging" | "draining" | "done" | "asking";

/** Hold to confirm. Press and hold the button for 1.5 seconds and a fill sweeps across it; letting go early drains
 * the fill back and does nothing. Completing the hold fires ONE `lu-confirm`.
 *
 * The hold is a shortcut, never the only way: a quick tap, or Enter / Space, turns the button into an ordinary
 * "Cancel / Confirm" pair in the same place, and Confirm fires the same `lu-confirm` (detail `{ via: "button" }`;
 * `{ via: "hold" }` for the hold). Use `consequence` to say, in one line, exactly what will happen to what. The
 * hold also stops when the pointer is cancelled, the finger slides off, the key is released, focus moves away or
 * the page is hidden. Set `busy` while your action runs. */
export class LuHoldButton extends LuElement {
  static luName = "hold-button";
  static luDeps = [LuButton];

  static properties = {
    label: { type: String },
    completeLabel: { type: String, attribute: "complete-label" },
    confirmLabel: { type: String, attribute: "confirm-label" },
    holdingLabel: { type: String, attribute: "holding-label" },
    cancelLabel: { type: String, attribute: "cancel-label" },
    icon: { type: String },
    kind: { type: String, reflect: true },
    consequence: { type: String },
    duration: { type: Number },
    busy: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    view: { state: true },
  };

  declare label: string;
  /** Shown briefly after the action is confirmed. */
  declare completeLabel: string;
  /** Text of the confirm button in the tap alternative. */
  declare confirmLabel: string;
  /** Shown while the button is being held. */
  declare holdingLabel: string;
  declare cancelLabel: string;
  /** `mdi:name` or SVG path data; default is none (a check appears when done). */
  declare icon: string;
  /** "secondary" (default) | "danger". */
  declare kind: "secondary" | "danger";
  /** One line naming the exact target and outcome, shown above the button. */
  declare consequence: string;
  /** Milliseconds to hold (default 1500, Lucent's `--lu-hold`). */
  declare duration: number;
  /** The confirmed action is running: spinner, no presses. */
  declare busy: boolean;
  declare disabled: boolean;
  declare view: View;

  private hold: HoldState = HOLD_IDLE;
  private animation: Animation | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private pressRect: DOMRect | undefined;
  private keyHeld = false;

  constructor() {
    super();
    this.label = "Hold to confirm";
    this.completeLabel = "Done";
    this.confirmLabel = "Confirm";
    this.holdingLabel = "Holding…";
    this.cancelLabel = "Cancel";
    this.icon = "";
    this.kind = "secondary";
    this.consequence = "";
    this.duration = HOLD_DEFAULTS.durationMs;
    this.busy = false;
    this.disabled = false;
    this.view = "idle";
  }

  private get config() {
    return { ...HOLD_DEFAULTS, durationMs: this.duration > 0 ? this.duration : HOLD_DEFAULTS.durationMs };
  }

  private get locked(): boolean {
    return this.disabled || this.busy || this.view === "done";
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopListening();
    this.animation?.cancel();
    clearTimeout(this.settleTimer);
    this.hold = HOLD_IDLE;
    this.keyHeld = false;
    if (this.view !== "idle") this.view = "idle";
  }

  protected willUpdate(): void {
    if ((this.disabled || this.busy) && this.view !== "idle" && this.view !== "done") {
      this.animation?.cancel();
      this.hold = HOLD_IDLE;
      this.keyHeld = false;
      this.stopListening();
      this.view = "idle";
    }
  }

  /** The fill bar sweeps with the Web Animations API: linear, compositor-driven, nothing runs on a timer while idle. */
  private sweep(from: number, to: number, ms: number, onDone: () => void): void {
    const fill = this.renderRoot.querySelector<HTMLElement>(".fill");
    this.animation?.cancel();
    if (!fill) return;
    this.animation = fill.animate([{ transform: `scaleX(${from})` }, { transform: `scaleX(${to})` }], { duration: Math.max(1, ms), easing: "linear", fill: "forwards" });
    this.animation.onfinish = onDone;
  }

  private begin(): void {
    const now = performance.now();
    this.hold = holdPress(this.hold, now, this.config);
    this.view = "charging";
    fireHaptic("light");
    this.sweep(holdProgress(this.hold, now, this.config), 1, holdRemainingMs(this.hold, now, this.config), () => this.complete());
    window.addEventListener("blur", this.cancel);
    document.addEventListener("visibilitychange", this.cancel);
  }

  /** The press ended. `cancelled` = it did not end normally (never counts as a tap). */
  private end(cancelled: boolean): void {
    if (this.hold.phase !== "charging") return;
    const now = performance.now();
    const released = holdRelease(this.hold, now, this.config);
    this.hold = released.state;
    this.stopListening();
    if (released.state.phase === "completed") return this.complete();
    const progress = holdProgress(released.state, now, this.config);
    this.view = "draining";
    this.sweep(progress, 0, holdDrainRemainingMs(released.state, now, this.config), () => this.drained());
    if (released.tap && !cancelled) this.ask();
  }

  private cancel = (): void => {
    this.keyHeld = false;
    this.end(true);
  };

  private stopListening(): void {
    window.removeEventListener("blur", this.cancel);
    document.removeEventListener("visibilitychange", this.cancel);
    window.removeEventListener("pointermove", this.onPointerMove);
    this.pressRect = undefined;
  }

  private drained(): void {
    this.hold = HOLD_IDLE;
    this.animation?.cancel();
    if (this.view === "draining") this.view = "idle";
  }

  private complete(): void {
    if (this.view === "done" || (this.hold.phase !== "charging" && this.hold.phase !== "completed")) return;
    this.hold = { ...this.hold, phase: "completed" };
    this.stopListening();
    this.keyHeld = false;
    fireHaptic("success");
    this.confirmed("hold");
  }

  private confirmed(via: "hold" | "button"): void {
    this.view = "done";
    this.emit("lu-confirm", { via });
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.animation?.cancel();
      this.hold = HOLD_IDLE;
      this.view = "idle";
    }, SETTLE_MS);
  }

  private ask(): void {
    this.view = "asking";
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(".cancel")?.focus());
  }

  private closeAsk(): void {
    this.view = "idle";
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>(".hold")?.focus());
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.locked || (event.pointerType === "mouse" && event.button !== 0)) return;
    const button = event.currentTarget as HTMLElement;
    button.setPointerCapture(event.pointerId);
    this.pressRect = button.getBoundingClientRect();
    window.addEventListener("pointermove", this.onPointerMove);
    this.begin();
  }

  /** A finger that slid off the button has let go of it. */
  private onPointerMove = (event: PointerEvent): void => {
    const rect = this.pressRect;
    if (rect && (event.clientX < rect.left - SLIP_PX || event.clientX > rect.right + SLIP_PX || event.clientY < rect.top - SLIP_PX || event.clientY > rect.bottom + SLIP_PX)) this.cancel();
  };

  private onPointerUp(): void {
    this.end(false);
  }

  private onKeydown(event: KeyboardEvent): void {
    if ((event.key !== " " && event.key !== "Enter") || this.locked) return;
    event.preventDefault();
    if (event.repeat || this.hold.phase === "charging") return;
    this.keyHeld = true;
    this.begin();
  }

  private onKeyup(event: KeyboardEvent): void {
    if ((event.key !== " " && event.key !== "Enter") || !this.keyHeld) return;
    event.preventDefault();
    this.keyHeld = false;
    this.end(false);
  }

  /** A click with no pointer press and no key hold behind it comes from assistive technology: treat it as a tap. */
  private onClick(event: MouseEvent): void {
    if (!this.locked && event.detail === 0) this.ask();
  }

  private onAskKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    this.closeAsk();
  }

  private renderAsk() {
    const danger = this.kind === "danger";
    return staticHtml`<div class="actions" role="group" aria-label=${this.consequence || this.label} @keydown=${this.onAskKeydown}>
      <${this.luTag("button")} class="cancel" kind="secondary" label=${this.cancelLabel} @click=${() => this.closeAsk()}></${this.luTag("button")}>
      <${this.luTag("button")} class="confirm" kind=${danger ? "danger" : "primary"} label=${this.confirmLabel} @click=${() => { this.confirmed("button"); }}></${this.luTag("button")}>
    </div>`;
  }

  render() {
    const danger = this.kind === "danger";
    const consequence = this.consequence
      ? html`<p class="consequence">${renderIcon(danger ? ICON_ALERT : ICON_INFO)}<span>${this.consequence}</span></p>`
      : nothing;
    if (this.view === "asking") return html`<div class="wrap">${consequence}${this.renderAsk()}</div>`;
    const text = this.view === "done" ? this.completeLabel : this.view === "charging" ? this.holdingLabel : this.label;
    const icon = this.busy ? html`<span class="spinner" aria-hidden="true"></span>` : renderIcon(this.view === "done" ? ICON_CHECK : this.icon);
    return html`<div class="wrap">
      ${consequence}
      <button class="hold pill ${danger ? "danger" : "secondary"}" type="button" ?disabled=${this.disabled} aria-busy=${this.busy ? "true" : nothing}
        @pointerdown=${this.onPointerDown} @pointerup=${this.onPointerUp} @pointercancel=${this.cancel} @keydown=${this.onKeydown} @keyup=${this.onKeyup}
        @blur=${this.cancel} @click=${this.onClick} @contextmenu=${(event: Event) => event.preventDefault()}>
        <span class="fill" aria-hidden="true"></span>
        <span class="content">${icon}<span class="text">${text}</span></span>
      </button>
      <span class="sr-only" role="status">${this.view === "charging" ? this.holdingLabel : this.view === "done" ? this.completeLabel : ""}</span>
    </div>`;
  }

  static styles = [
    BASE_CSS,
    CONTROLS_CSS,
    PILL_SURFACE_CSS,
    css`
      :host { display: block; min-width: 0; }
      :host([hidden]) { display: none; }
      .wrap { display: grid; gap: var(--lu-space-2); }
      .consequence { display: flex; align-items: flex-start; gap: var(--lu-space-2); margin: 0; color: var(--lu-ink); font: 400 var(--lu-type-label)/1.4 var(--lu-font); }
      .consequence .icon { --lu-icon: 18px; margin-top: 1px; color: var(--lu-ink); }
      :host([kind="danger"]) .consequence .icon { color: color-mix(in srgb, var(--lu-danger) 30%, var(--lu-ink)); }
      .hold { position: relative; width: 100%; overflow: hidden; padding: 0; touch-action: pan-y; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; font-family: var(--lu-font); }
      .fill { position: absolute; inset: 0; transform-origin: left center; transform: scaleX(0); background: var(--lu-accent-soft); pointer-events: none; }
      .danger .fill { background: color-mix(in srgb, var(--lu-danger) 26%, transparent); }
      .content { position: relative; display: flex; align-items: center; justify-content: center; gap: var(--lu-space-2); min-width: 0; min-height: calc(var(--lu-target) - 2px); padding: 0 var(--lu-space-5); }
      .content .icon { --lu-icon: 20px; }
      .text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .hold:disabled { opacity: var(--lu-material-disabled-opacity); }
      .hold:disabled { cursor: not-allowed; }
      .hold[aria-busy="true"] { cursor: progress; }
      .spinner { flex: none; width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; }
      @media (prefers-reduced-motion: no-preference) { .spinner { animation: lu-spin 0.9s linear infinite; } }
      @keyframes lu-spin { to { transform: rotate(360deg); } }
      .actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--lu-space-2); }
      .actions > * { display: flex; }
      .actions > * > * { flex: 1; }
    `,
  ];
}
