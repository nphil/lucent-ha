import { css, nothing, unsafeCSS } from "lit";
import type { PropertyValues, TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { html } from "lit/static-html.js";
import { LuElement } from "../core/element.ts";
import type { LuElementClass } from "../core/element.ts";
import { deepActiveElement, isTextEntry, isTouchPrimary } from "../core/dom.ts";
import { renderIcon } from "../core/icon.ts";
import { pushLayer } from "../ha/layers.ts";
import { BASE_CSS, CONTROLS_CSS } from "../tokens/base-css.ts";
import { LAYOUT, MOTION, SWIPE } from "../tokens/constants.ts";
import { ICON_CLOSE } from "./sheet-icons.ts";
import { SheetLifecycle, initialFocus, keyboardInset } from "./sheet-model.ts";
import type { SheetCloseReason } from "./sheet-model.ts";
import { SwipeDismiss } from "./swipe.ts";
import { showToast } from "./toast-event.ts";
import type { ToastEventDetail } from "./toast-event.ts";
import { LuToast } from "./toast.ts";

/** Which dialog draws the sheet: `auto` uses Home Assistant's own adaptive dialog when the page has it and a native
 * `<dialog>` otherwise; `native` and `ha` force one (`ha` falls back, with a console warning, when HA's is missing). */
export type SheetEngine = "auto" | "native" | "ha";

/** What `lu-close` carries. */
export interface LuCloseDetail {
  reason: SheetCloseReason;
}

/** Where the native dialog sits is decided by the VIEWPORT, not the panel: the dialog covers the whole screen, Home
 * Assistant's sidebar included. Narrower than 680 px: a bottom sheet. From 900 px, and on short screens (500 px high or
 * less) from 680 px: a side pane. In between: a centred dialog. */
const BOTTOM = `(max-width: ${LAYOUT.compact - 0.02}px)`;
const SIDE = `(min-width: ${LAYOUT.wide}px), (min-width: ${LAYOUT.compact}px) and (max-height: ${LAYOUT.short}px)`;

/** Longest we wait for an exit motion that never reports back (a hidden tab does not run animations). */
const EXIT_SLACK_MS = 120;
const HA_EXIT_LIMIT_MS = 600;

let warnedMissingHa = false;

/** One sheet for panels and cards: a bottom sheet on a phone, a side pane on a wide or short screen, a centred dialog in
 * between. Modal: the page behind is inert and cannot scroll, Tab stays inside, Escape, the scrim, the close button, a
 * swipe down (bottom sheet) and the system Back button all close it, and focus goes back to what opened it.
 *
 * It draws a native `<dialog>` in the browser's top layer (so a glass theme's `backdrop-filter` on `ha-card` cannot trap
 * it, in a card or anywhere), or hands the job to Home Assistant's `ha-adaptive-dialog` when the page has one.
 *
 * - `open` / `show()` / `close(reason?)` control it; `lu-close {reason}` fires after it has closed (exit motion done).
 *   `open` turns false the moment a close starts.
 * - History: by default opening adds one history entry (`layer` is its id), so the system Back button closes the sheet
 *   and nothing else. Cards set `history = false`: they never touch history.
 * - A touch screen never gets a text field focused on open (that would raise the keyboard over the sheet); the sheet
 *   itself takes focus. Mouse and keyboard users get the content's `autofocus` element. While open, the sheet keeps
 *   its bottom edge above the on-screen keyboard.
 * - Slots: default (the scrolling body), `footer` (pinned at the bottom), `actions` (buttons in the header).
 * - A toast raised from inside an open sheet (`showToast`) is shown by the sheet itself, because everything outside a modal
 *   dialog is inert and its Undo button could not be pressed; the page gets it when the sheet closes. */
export class LuSheet extends LuElement {
  static luName = "sheet";
  static luDeps: readonly LuElementClass[] = [LuToast];

  static properties = {
    open: { type: Boolean, reflect: true },
    heading: { type: String },
    subheading: { type: String },
    closeLabel: { type: String, attribute: "close-label" },
    layer: { type: String },
    history: { converter: { fromAttribute: (value: string | null) => value !== "false" } },
    engine: { type: String },
    _engine: { state: true },
    _haShown: { state: true },
    _haOpen: { state: true },
    _hasFooter: { state: true },
  };

  declare open: boolean;
  declare heading: string;
  declare subheading: string;
  /** Accessible name of the close button. */
  declare closeLabel: string;
  /** Id of the history layer this sheet adds while it is open. */
  declare layer: string;
  /** Add a history entry while open, so the system Back button closes the sheet. False in cards. */
  declare history: boolean;
  declare engine: SheetEngine;
  declare _engine: "native" | "ha";
  declare _haShown: boolean;
  declare _haOpen: boolean;
  declare _hasFooter: boolean;

  private readonly _lifecycle: SheetLifecycle;
  private readonly _swipe: SwipeDismiss;
  private _opener: HTMLElement | null = null;
  private _scrimDown = false;
  private _exitToken = 0;
  private _exitTimer: ReturnType<typeof setTimeout> | undefined;
  private _tracking = false;
  private _inset = 0;
  private _viewportFrame = 0;
  private _haIntent: SheetCloseReason = "scrim";
  private _haClosedItself = false;

  constructor() {
    super();
    this.open = false;
    this.heading = "";
    this.subheading = "";
    this.closeLabel = "Close";
    this.layer = "sheet";
    this.history = true;
    this.engine = "auto";
    this._engine = "native";
    this._haShown = false;
    this._haOpen = false;
    this._hasFooter = false;
    this._lifecycle = new SheetLifecycle(
      {
        show: () => this._present(),
        exit: (reason) => this._leave(reason),
        closed: (reason) => this._finish(reason),
        setOpen: (open) => {
          this.open = open;
        },
        wantsOpen: () => this.open,
      },
      pushLayer,
    );
    this._swipe = new SwipeDismiss(this, {
      panel: () => this.renderRoot.querySelector<HTMLElement>(".panel"),
      enabled: () => this._engine === "native" && this._lifecycle.phase === "open" && matchMedia(BOTTOM).matches,
      onDismiss: () => {
        this._lifecycle.close("swipe");
      },
    });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("lu-toast", this._onToast);
    if (this.hasUpdated && this.open) this._sync();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("lu-toast", this._onToast);
    this._exitToken += 1;
    this._lifecycle.dispose();
    this._reset();
  }

  /** Opens the sheet. */
  show(): void {
    this.open = true;
  }

  /** Closes the sheet with an exit motion; `lu-close` follows with this reason (default `api`). */
  close(reason: SheetCloseReason = "api"): void {
    this._lifecycle.close(reason);
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has("open")) this._sync();
  }

  /** Brings the lifecycle in line with `open`. The dialog engine is chosen while the sheet is closed, and the matching
   * structure is rendered before it opens; it never changes while the sheet is open. */
  private _sync(): void {
    if (!this.open) {
      this._lifecycle.close("api");
      return;
    }
    if (this._lifecycle.phase === "closed") {
      const engine = this._pickEngine();
      if (engine !== this._engine) {
        this._engine = engine;
        void this.updateComplete.then(() => this._sync());
        return;
      }
    }
    this._lifecycle.open({ history: this.history, layer: this.layer || "sheet" });
  }

  private _pickEngine(): "native" | "ha" {
    if (this.engine === "native") return "native";
    const available = customElements.get("ha-adaptive-dialog") !== undefined;
    if (this.engine === "ha" && !available && !warnedMissingHa) {
      warnedMissingHa = true;
      console.warn('lucent-ha: <lu-sheet engine="ha"> needs Home Assistant\'s <ha-adaptive-dialog>, which this page does not have. Using the native dialog.');
    }
    return available ? "ha" : "native";
  }

  private get _dialog(): HTMLDialogElement | null {
    return this.renderRoot.querySelector("dialog");
  }

  /** Puts the sheet on screen. */
  private _present(): void {
    this._opener = deepActiveElement();
    if (this._engine === "ha") {
      this._haClosedItself = false;
      this._haIntent = "scrim";
      this._haShown = true;
      this._haOpen = true;
      return;
    }
    const dialog = this._dialog;
    if (!dialog) throw new Error("lucent-ha: a sheet was opened before it was rendered.");
    dialog.removeAttribute("data-leaving");
    this._swipe.clear();
    const target = this.querySelector<HTMLElement>("[autofocus]");
    // The dialog carries `autofocus` itself, so showModal() puts focus on the dialog and never on a text field.
    dialog.showModal();
    if (initialFocus(isTouchPrimary(), target !== null) === "target") target?.focus({ preventScroll: true });
    this._trackViewport(true);
  }

  /** Starts the exit: toasts go to the page, a swipe in progress lets go, the exit motion plays. */
  private _leave(reason: SheetCloseReason): void {
    this._swipe.abort();
    for (const toast of this._toastHost?.takeAll() ?? []) showToast(this, toast);
    this._exitToken += 1;
    const token = this._exitToken;
    const done = (): void => {
      if (token === this._exitToken) this._lifecycle.exited();
    };
    if (this._engine === "ha") {
      this._haOpen = false;
      if (this._haClosedItself) queueMicrotask(done);
      else this._exitTimer = setTimeout(done, HA_EXIT_LIMIT_MS);
      return;
    }
    this._dialog?.setAttribute("data-leaving", reason === "swipe" ? "swipe" : "");
    const animations = Array.from(this.renderRoot.querySelectorAll(".scrim, .panel"), (part) => part.getAnimations()).flat();
    this._exitTimer = setTimeout(done, MOTION.exit + EXIT_SLACK_MS);
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(done);
  }

  /** The exit is over: close the dialog, give focus back, tell the owner. */
  private _finish(reason: SheetCloseReason): void {
    this._reset();
    const opener = this._opener;
    this._opener = null;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    this.emit<{ reason: SheetCloseReason }>("lu-close", { reason });
  }

  /** Everything the open sheet changed, undone. */
  private _reset(): void {
    clearTimeout(this._exitTimer);
    this._trackViewport(false);
    this._haShown = false;
    this._haOpen = false;
    const dialog = this._dialog;
    if (dialog) {
      dialog.close();
      dialog.removeAttribute("data-leaving");
    }
    this._swipe.clear();
  }

  /** The toast host inside the open sheet. */
  private get _toastHost(): LuToast | null {
    return this.renderRoot.querySelector<LuToast>(".toasts");
  }

  /** A toast raised inside the open sheet shows in the sheet (see the class comment). */
  private _onToast = (event: CustomEvent<ToastEventDetail>): void => {
    if (this._lifecycle.phase !== "open") return;
    const host = this._toastHost;
    if (!host) return;
    event.stopPropagation();
    host.show(event.detail);
  };

  // ---- native dialog events ----

  private _onCancel = (event: Event): void => {
    event.preventDefault();
    this._lifecycle.close("escape");
  };

  /** Something closed the `<dialog>` itself (a script): follow it. The event is queued, so it can arrive after the sheet
   * was opened again; a dialog that is open now is not closed. */
  private _onNativeClose = (): void => {
    if (this._lifecycle.phase === "open" && !this._dialog?.open) this._lifecycle.close("api");
  };

  /** Only a press that both started and ended on the scrim dismisses; dragging out of the sheet does not. */
  private _onScrimDown = (event: Event): void => {
    this._scrimDown = event.target === event.currentTarget;
  };

  private _onScrimClick = (event: Event): void => {
    if (this._scrimDown && event.target === event.currentTarget) this._lifecycle.close("scrim");
    this._scrimDown = false;
  };

  /** The page behind must not scroll. Wheel movement over anything in the sheet that cannot scroll that way (the scrim,
   * the header, a body that is short or already at its end) is cancelled before it can reach the page. */
  private _onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    for (const node of event.composedPath()) {
      if (node === event.currentTarget) break;
      if (!(node instanceof HTMLElement) || node.scrollHeight <= node.clientHeight) continue;
      const overflow = getComputedStyle(node).overflowY;
      if (overflow !== "auto" && overflow !== "scroll") continue;
      const canScroll = event.deltaY < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight - 1;
      if (canScroll) return;
    }
    event.preventDefault();
  };

  private _onFooterSlot = (event: Event): void => {
    this._hasFooter = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  // ---- on-screen keyboard ----

  /** While open, keeps the sheet's bottom edge above the on-screen keyboard (`--lu-keyboard-inset`) and the focused field in view. */
  private _trackViewport(on: boolean): void {
    const viewport = window.visualViewport;
    if (!viewport || on === this._tracking) return;
    this._tracking = on;
    if (on) {
      viewport.addEventListener("resize", this._onViewport);
      viewport.addEventListener("scroll", this._onViewport);
      this._onViewport();
      return;
    }
    viewport.removeEventListener("resize", this._onViewport);
    viewport.removeEventListener("scroll", this._onViewport);
    cancelAnimationFrame(this._viewportFrame);
    this._viewportFrame = 0;
    this._inset = 0;
    this._dialog?.style.removeProperty("--lu-keyboard-inset");
  }

  private _onViewport = (): void => {
    if (this._viewportFrame) return;
    this._viewportFrame = requestAnimationFrame(() => {
      this._viewportFrame = 0;
      const viewport = window.visualViewport;
      const dialog = this._dialog;
      if (!viewport || !dialog) return;
      const inset = keyboardInset({ innerHeight: window.innerHeight, height: viewport.height, offsetTop: viewport.offsetTop, scale: viewport.scale });
      if (inset === this._inset) return;
      const grew = inset > this._inset;
      this._inset = inset;
      dialog.style.setProperty("--lu-keyboard-inset", `${inset}px`);
      const active = deepActiveElement();
      if (grew && isTextEntry(active)) active?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  };

  // ---- Home Assistant's dialog ----

  /** Home Assistant does not say how it was closed: Escape and its close button are noticed on the way in, everything
   * else (its scrim, its own swipe) reports `scrim`. */
  private _noteHaIntent = (event: Event): void => {
    if (event.type === "keydown") {
      if ((event as KeyboardEvent).key === "Escape") this._haIntent = "escape";
    } else if (event.composedPath().some((node) => node instanceof Element && node.getAttribute("data-dialog") === "close")) {
      this._haIntent = "button";
    }
  };

  private _onHaClosed = (event: Event): void => {
    // `closed` also bubbles up from a dialog nested in the content; only this dialog's own counts.
    if (event.target !== event.currentTarget) return;
    if (this._lifecycle.phase === "open") {
      this._haClosedItself = true;
      this._lifecycle.close(this._haIntent);
    } else if (this._lifecycle.phase === "closing") {
      this._exitToken += 1;
      this._lifecycle.exited();
    }
  };

  // ---- rendering ----

  private _renderToasts(): TemplateResult {
    return html`<${this.luTag("toast")} class="toasts"></${this.luTag("toast")}>`;
  }

  private _renderHa(): TemplateResult {
    return html`<ha-adaptive-dialog .open=${this._haOpen} header-title=${this.heading} header-subtitle=${ifDefined(this.subheading || undefined)}
      @closed=${this._onHaClosed} @keydown=${{ handleEvent: this._noteHaIntent, capture: true }} @click=${{ handleEvent: this._noteHaIntent, capture: true }}>
      <slot name="actions" slot="headerActionItems"></slot>
      <slot></slot>
      <slot name="footer" slot="footer"></slot>
      ${this._renderToasts()}
    </ha-adaptive-dialog>`;
  }

  private _renderNative(): TemplateResult {
    return html`<dialog tabindex="-1" autofocus aria-modal="true" aria-labelledby=${ifDefined(this.heading ? "title" : undefined)}
      @cancel=${this._onCancel} @close=${this._onNativeClose} @wheel=${this._onWheel}>
      <div class="scrim" @pointerdown=${this._onScrimDown} @click=${this._onScrimClick}>
        <section class="panel${this._hasFooter ? " has-footer" : ""}">
          <div class="grab" data-sheet-grab>
            <div class="handle" data-sheet-handle aria-hidden="true"></div>
            <header class="head">
              <div class="titles">
                ${this.heading ? html`<h2 id="title">${this.heading}</h2>` : nothing}
                ${this.subheading ? html`<p class="sub">${this.subheading}</p>` : nothing}
              </div>
              <div class="actions"><slot name="actions"></slot></div>
              <button class="icon-button close" type="button" aria-label=${this.closeLabel} @click=${() => this._lifecycle.close("button")}>${renderIcon(ICON_CLOSE)}</button>
            </header>
          </div>
          <div class="body"><slot></slot></div>
          <footer class="footer"><slot name="footer" @slotchange=${this._onFooterSlot}></slot></footer>
        </section>
      </div>
      ${this._renderToasts()}
    </dialog>`;
  }

  render() {
    if (this._engine === "ha") return this._haShown ? this._renderHa() : nothing;
    return this._renderNative();
  }

  static styles = [
    BASE_CSS,
    CONTROLS_CSS,
    css`
      :host { display: contents; }
      h2, p { margin: 0; }
      .toasts { --lu-bottom-bar: 0px; }

      /* The dialog covers the whole screen and draws nothing itself; the scrim and the panel are inside. */
      dialog { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; overflow: hidden; border: 0; color: var(--lu-ink); background: transparent; font-family: var(--lu-font); }
      dialog::backdrop { background: transparent; }
      dialog:focus { outline: none; }
      dialog[tabindex]:focus-visible { box-shadow: none !important; }
      dialog[data-leaving] { pointer-events: none; }

      /* Centred dialog (680-899 px wide, taller than 500 px). The other two placements override below. */
      .scrim {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        padding: var(--lu-space-6) var(--lu-space-6) calc(var(--lu-space-6) + var(--lu-keyboard-inset, 0px));
        touch-action: none; background: var(--lu-scrim); backdrop-filter: var(--ha-dialog-scrim-backdrop-filter, none);
        animation: scrim-in var(--lu-motion-layer) var(--lu-ease) both;
      }
      .panel {
        --_x: 0px; --_y: var(--lu-travel-layer); --_pad-bottom: 0px;
        position: relative; display: flex; flex-direction: column; width: min(100%, 640px); max-height: min(var(--lu-sheet-max, 90dvh), 820px); overflow: hidden;
        border: 1px solid var(--lu-edge); border-radius: var(--lu-radius-sheet); color: var(--lu-ink); background: var(--lu-sheet);
        box-shadow: var(--lu-highlight-rest), var(--lu-shadow-rest); animation: panel-in var(--lu-motion-layer) var(--lu-ease) both;
      }

      .grab { flex: none; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
      .handle { display: none; place-items: center; height: var(--lu-space-7); cursor: grab; }
      .handle::after { content: ""; width: var(--lu-space-8); height: var(--lu-space-1); border-radius: var(--lu-radius-pill); background: var(--lu-edge-raised); }
      .head { display: flex; align-items: flex-start; gap: var(--lu-space-2); padding: var(--lu-space-3) var(--lu-space-2) var(--lu-space-2) var(--lu-space-5); }
      .titles { flex: 1 1 auto; min-width: 0; padding-top: calc((var(--lu-target) - var(--lu-type-title) * 1.25) / 2); }
      h2 { font-size: var(--lu-type-title); font-weight: 600; letter-spacing: -0.012em; line-height: 1.25; overflow-wrap: anywhere; }
      .sub { margin-top: var(--lu-space-1); color: var(--lu-ink-2); font-size: var(--lu-type-label); }
      .actions { display: flex; flex: none; align-items: center; min-height: var(--lu-target); }
      .close { flex: none; }
      .body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 var(--lu-space-5) calc(var(--lu-space-5) + var(--_pad-bottom)); }
      .has-footer .body { padding-bottom: var(--lu-space-5); }
      .footer { flex: none; padding: var(--lu-space-3) var(--lu-space-5) calc(var(--lu-space-4) + var(--_pad-bottom)); border-top: 1px solid var(--lu-edge); }
      .panel:not(.has-footer) .footer { display: none; }

      /* Bottom sheet (phones): full width, rounded on top, a handle to drag. */
      @media ${unsafeCSS(BOTTOM)} {
        .scrim { align-items: flex-end; padding: 0 0 var(--lu-keyboard-inset, 0px); }
        .panel { --_pad-bottom: var(--lu-safe-bottom, 0px); width: 100%; max-height: min(var(--lu-sheet-max, 90dvh), 100%); padding-inline: var(--lu-safe-left, 0px) var(--lu-safe-right, 0px); border-bottom-width: 0; border-radius: var(--lu-radius-sheet) var(--lu-radius-sheet) 0 0; }
        .handle { display: grid; }
        .head { padding-top: 0; }
      }

      /* Side pane (wide and short screens): full height, against the screen edge, rounded on the inner side. */
      @media ${unsafeCSS(SIDE)} {
        .scrim { align-items: stretch; justify-content: flex-end; padding: 0 0 var(--lu-keyboard-inset, 0px); }
        .panel {
          --_x: var(--lu-travel-drawer); --_y: 0px; --_pad-bottom: var(--lu-safe-bottom, 0px);
          width: min(520px, 42vw); max-height: none; padding-top: var(--lu-safe-top, 0px); padding-inline-end: var(--lu-safe-right, 0px); border-inline-end-width: 0;
          border-start-end-radius: 0; border-end-end-radius: 0;
        }
      }

      @keyframes scrim-in { from { opacity: 0; } }
      @keyframes scrim-out { to { opacity: 0; } }
      @keyframes panel-in { from { opacity: 0; transform: translate(var(--_x), var(--_y)); } }
      @keyframes panel-out { to { opacity: 0; transform: translate(var(--_x), var(--_y)); } }
      @keyframes panel-swipe-out { to { opacity: 0; transform: translate3d(0, 100%, 0); } }
      dialog[data-leaving] .scrim { animation: scrim-out var(--lu-motion-exit) var(--lu-ease-exit) both; }
      dialog[data-leaving] .panel { animation: panel-out var(--lu-motion-exit) var(--lu-ease-exit) both; }
      /* A swipe carries on downward from where the finger let go. */
      dialog[data-leaving="swipe"] .scrim { animation-duration: ${unsafeCSS(`${SWIPE.dismissMs}ms`)}; }
      dialog[data-leaving="swipe"] .panel { animation: panel-swipe-out ${unsafeCSS(`${SWIPE.dismissMs}ms`)} var(--lu-ease-exit) both; }
      @media (prefers-reduced-motion: reduce) {
        dialog[data-leaving="swipe"] .panel { animation: panel-out var(--lu-motion-exit) var(--lu-ease-exit) both; }
      }
    `,
  ];
}

declare global {
  interface HTMLElementEventMap {
    "lu-close": CustomEvent<LuCloseDetail>;
  }
}
