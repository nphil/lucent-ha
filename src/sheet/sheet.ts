import { css, nothing, unsafeCSS } from "lit";
import type { PropertyValues, TemplateResult } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import { html } from "lit/static-html.js";
import { LuElement } from "../core/element.ts";
import type { LuElementClass } from "../core/element.ts";
import { deepActiveElement, isTextEntry, isTouchPrimary } from "../core/dom.ts";
import { renderIcon } from "../core/icon.ts";
import { findScroller } from "../core/scroller.ts";
import type { LuScroller } from "../core/scroller.ts";
import { pushLayer } from "../ha/layers.ts";
import { BASE_CSS, CONTROLS_CSS } from "../tokens/base-css.ts";
import { LAYOUT, MOTION, SWIPE } from "../tokens/constants.ts";
import { ICON_CLOSE } from "./sheet-icons.ts";
import { SheetLifecycle, dialogLook, initialFocus, keyScroll, keyboardInset, rootsItsBackdrop, scrolledTo } from "./sheet-model.ts";
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

/** Elements that keep their own keys: fields move a caret, sliders and menus change value or selection. */
const KEY_OWNERS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="spinbutton"], [role="listbox"], [role="combobox"], [role="menu"], [role="radiogroup"]';
/** Elements Space presses. */
const PRESSABLE = 'button, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"]';

/** True when `element` is a scroller that can still move one more step in `direction` (-1 up, 1 down). */
function canScrollFurther(element: HTMLElement, direction: -1 | 1): boolean {
  if (element.scrollHeight <= element.clientHeight) return false;
  const overflow = getComputedStyle(element).overflowY;
  if (overflow !== "auto" && overflow !== "scroll") return false;
  return direction < 0 ? element.scrollTop > 0 : element.scrollTop + element.clientHeight < element.scrollHeight - 1;
}

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
 * - The page behind cannot be scrolled: wheel and keys are taken by the sheet, touch is kept inside it by CSS, and
 *   anything else that moves the page (its own scrollbar, a script) is put back.
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
  private _scrimUp = false;
  private _exitToken = 0;
  private _exitTimer: ReturnType<typeof setTimeout> | undefined;
  private _tracking = false;
  private _inset = 0;
  private _viewportFrame = 0;
  private _haIntent: SheetCloseReason = "scrim";
  private _haClosedItself = false;
  private _liftedAutofocus: HTMLElement[] = [];
  private _scroller: LuScroller | null = null;
  private _lockedTop = 0;
  private _themeWatch: MutationObserver | null = null;

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
    const touch = isTouchPrimary();
    const autofocus = Array.from(this.querySelectorAll<HTMLElement>("[autofocus]"));
    // Chrome's dialog focusing steps ignore `autofocus` on the dialog itself and focus the first `autofocus` element, or else
    // the first control. On a touch screen the attribute is lifted for the moment the dialog opens, so no text field is
    // ever focused (that would raise the on-screen keyboard); it is put back right after.
    if (touch) this._liftAutofocus(autofocus);
    if (this._engine === "ha") {
      this._haClosedItself = false;
      this._haIntent = "scrim";
      this._haShown = true;
      this._haOpen = true;
      this._lockPage(true);
      return;
    }
    const dialog = this._dialog;
    if (!dialog) throw new Error("lucent-ha: a sheet was opened before it was rendered.");
    dialog.removeAttribute("data-leaving");
    this._swipe.clear();
    this._setLook(dialog);
    try {
      dialog.showModal();
    } finally {
      this._restoreAutofocus();
    }
    // The browser remembers the scroll position of a hidden element, so a sheet that was closed scrolled down would reopen
    // scrolled down (and a swipe down would then scroll the body instead of closing the sheet): every opening starts at the top.
    this.renderRoot.querySelector<HTMLElement>(".body")?.scrollTo({ top: 0 });
    // Focus lands on the sheet itself (a named container, nothing that opens the keyboard, nothing that Space or Enter
    // would press), or for a mouse and keyboard user on the element the content asked for.
    const target = initialFocus(touch, autofocus.length > 0) === "target" ? autofocus[0] : undefined;
    (target ?? dialog).focus({ preventScroll: true });
    this._trackViewport(true);
    this._watchTheme(true);
    this._lockPage(true);
  }

  /** Reads the theme's two dialog filters and has the sheet draw them the cheap way where that gives the same picture (see
   * `dialogLook`). Read at every opening, and again while open when the theme changes (`_watchTheme`). */
  private _setLook(dialog: HTMLDialogElement): void {
    const style = getComputedStyle(this);
    const look = dialogLook(style.getPropertyValue("--lu-scrim-blur"), style.getPropertyValue("--lu-sheet-blur"), rootsItsBackdrop(navigator.userAgent));
    dialog.toggleAttribute("data-dim", look.dim !== null);
    if (look.dim === null) dialog.style.removeProperty("--_dim");
    else dialog.style.setProperty("--_dim", String(look.dim));
    dialog.toggleAttribute("data-flat-frost", look.flatFrost);
  }

  /** While open, looks at the filters again whenever the page's root element changes its `style` or `class`: Home Assistant applies
   * a theme as custom properties on it, so a theme switched with the sheet on screen is followed, not only the next opening. */
  private _watchTheme(on: boolean): void {
    if (!on) {
      this._themeWatch?.disconnect();
      this._themeWatch = null;
      return;
    }
    if (this._themeWatch) return;
    this._themeWatch = new MutationObserver(() => {
      const dialog = this._dialog;
      if (dialog?.open) this._setLook(dialog);
    });
    this._themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
  }

  private _liftAutofocus(elements: HTMLElement[]): void {
    this._liftedAutofocus = elements;
    for (const element of elements) element.removeAttribute("autofocus");
  }

  private _restoreAutofocus(): void {
    for (const element of this._liftedAutofocus) element.setAttribute("autofocus", "");
    this._liftedAutofocus = [];
  }

  /** Starts the exit: toasts go to the page, a swipe in progress lets go, the exit motion plays. */
  private _leave(reason: SheetCloseReason): void {
    this._swipe.abort();
    this._lockPage(false);
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
    this._restoreAutofocus();
    this._lockPage(false);
    this._trackViewport(false);
    this._watchTheme(false);
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
    event.preventDefault();
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

  /** Only a press that both started and ended on the scrim dismisses. A browser reports the click on the nearest common
   * ancestor of where the press began and ended, so "began on the scrim, ended on the sheet" also arrives as a click on the
   * scrim: the end of the press is checked on its own. */
  private _onScrimDown = (event: Event): void => {
    this._scrimDown = event.target === event.currentTarget;
    this._scrimUp = false;
  };

  private _onScrimUp = (event: Event): void => {
    this._scrimUp = event.target === event.currentTarget;
  };

  private _onScrimClick = (event: Event): void => {
    if (this._scrimDown && this._scrimUp && event.target === event.currentTarget) this._lifecycle.close("scrim");
    this._scrimDown = false;
    this._scrimUp = false;
  };

  /** The page behind must not scroll. Wheel movement over anything in the sheet that cannot scroll that way (the scrim,
   * the header, a body that is short or already at its end) is cancelled before it can reach the page. */
  private _onWheel = (event: WheelEvent): void => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const direction = event.deltaY < 0 ? -1 : 1;
    for (const node of event.composedPath()) {
      if (node === event.currentTarget) break;
      if (node instanceof HTMLElement && canScrollFurther(node, direction)) return;
    }
    event.preventDefault();
  };

  /** Scroll keys scroll whatever scrolls under the focused element, and with focus on the sheet itself or a header button
   * that is the page behind. The sheet takes those keys: a scroller under the focus that can still move handles the key
   * itself (the browser does that), anything else scrolls the sheet's body, never the page. Fields, sliders and menus keep
   * their keys, and Space still presses a focused button. */
  private _onKeydown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const scroll = keyScroll(event.key, event.shiftKey);
    if (!scroll) return;
    const path = event.composedPath();
    const focused = path[0];
    if (focused instanceof Element && (focused.matches(KEY_OWNERS) || (event.key === " " && focused.matches(PRESSABLE)))) return;
    for (const node of path) {
      if (node === event.currentTarget) break;
      if (node instanceof HTMLElement && canScrollFurther(node, scroll.direction)) return;
    }
    event.preventDefault();
    const body = this.renderRoot.querySelector<HTMLElement>(".body");
    if (body) body.scrollTo({ top: scrolledTo(scroll, { top: body.scrollTop, height: body.clientHeight, scrollHeight: body.scrollHeight }) });
  };

  /** Keeps the page behind where it was. Wheel, touch and keys are stopped on the way in (above and in the CSS); this
   * catches whatever else moves the page while a sheet is open (dragging the page's own scrollbar, find in page, a script)
   * by putting it back. It never writes a style of the page, only its scroll position, and only when something moved it. */
  private _lockPage(on: boolean): void {
    if (on === (this._scroller !== null)) return;
    if (on) {
      const scroller = findScroller(this);
      this._scroller = scroller;
      this._lockedTop = scroller.top;
      scroller.target.addEventListener("scroll", this._onPageScroll, { passive: true });
      return;
    }
    this._scroller?.target.removeEventListener("scroll", this._onPageScroll);
    this._scroller = null;
  }

  private _onPageScroll = (): void => {
    const scroller = this._scroller;
    if (scroller && scroller.top !== this._lockedTop) scroller.scrollTo(this._lockedTop);
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

  /** Home Assistant has put its dialog on screen: the lifted `autofocus` attributes go back, and a mouse and keyboard user gets
   * the element the content asked for (Home Assistant's own lookup cannot see content that is passed through slots). On a
   * touch screen a field that took focus anyway gives it up. */
  private _onHaOpened = (event: Event): void => {
    if (event.target !== event.currentTarget) return;
    const touch = this._liftedAutofocus.length > 0 || isTouchPrimary();
    const autofocus = this._liftedAutofocus.length > 0 ? this._liftedAutofocus : Array.from(this.querySelectorAll<HTMLElement>("[autofocus]"));
    this._restoreAutofocus();
    if (initialFocus(touch, autofocus.length > 0) === "target") autofocus[0]?.focus({ preventScroll: true });
    else if (isTextEntry(deepActiveElement())) deepActiveElement()?.blur();
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
      @opened=${this._onHaOpened} @closed=${this._onHaClosed} @keydown=${{ handleEvent: this._noteHaIntent, capture: true }} @click=${{ handleEvent: this._noteHaIntent, capture: true }}>
      <slot name="actions" slot="headerActionItems"></slot>
      <slot></slot>
      <slot name="footer" slot="footer"></slot>
      ${this._renderToasts()}
    </ha-adaptive-dialog>`;
  }

  private _renderNative(): TemplateResult {
    return html`<dialog tabindex="-1" aria-modal="true" aria-labelledby=${ifDefined(this.heading ? "title" : undefined)}
      @cancel=${this._onCancel} @close=${this._onNativeClose} @wheel=${this._onWheel} @keydown=${this._onKeydown}>
      <div class="dim" aria-hidden="true"></div>
      <div class="scrim" @pointerdown=${this._onScrimDown} @pointerup=${this._onScrimUp} @click=${this._onScrimClick}>
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
        touch-action: none; background: var(--lu-scrim); backdrop-filter: var(--lu-scrim-blur);
        animation: scrim-in var(--lu-motion-layer) var(--lu-ease) both;
      }
      .panel {
        --_x: 0px; --_y: var(--lu-travel-layer); --_pad-bottom: 0px;
        position: relative; display: flex; flex-direction: column; width: min(100%, 640px); max-height: min(var(--lu-sheet-max, 90dvh), 820px); overflow: hidden;
        border: 1px solid var(--lu-edge); border-radius: var(--lu-radius-sheet); color: var(--lu-ink); background: var(--lu-sheet);
        backdrop-filter: var(--lu-sheet-blur);
        box-shadow: var(--lu-highlight-rest), var(--lu-shadow-rest); animation: panel-in var(--lu-motion-layer) var(--lu-ease) both;
      }

      /* The theme's dialog filters, drawn without a filter where that gives the same picture (see dialogLook in sheet-model.ts).
         A scrim that only darkens (Home Assistant's brightness(68%)) is a black layer of its own, a sibling in front of the page and
         behind the scrim, with the scrim's motion. A panel blur that only ever sees the scrim is the scrim's colour painted
         under the panel's own. Both avoid a backdrop filter that the compositor redoes over the whole screen or panel in every
         frame that changes anything inside the sheet. */
      .dim { display: none; position: absolute; inset: 0; pointer-events: none; background: rgb(0 0 0 / var(--_dim, 0)); animation: scrim-in var(--lu-motion-layer) var(--lu-ease) both; }
      dialog[data-dim] .dim { display: block; }
      dialog[data-dim] .scrim { backdrop-filter: none; }
      dialog[data-flat-frost] .panel { background: linear-gradient(var(--lu-sheet), var(--lu-sheet)), var(--lu-scrim); backdrop-filter: none; }

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
      dialog[data-leaving] .scrim, dialog[data-leaving] .dim { animation: scrim-out var(--lu-motion-exit) var(--lu-ease-exit) both; }
      dialog[data-leaving] .panel { animation: panel-out var(--lu-motion-exit) var(--lu-ease-exit) both; }
      /* A swipe carries on downward from where the finger let go. */
      dialog[data-leaving="swipe"] .scrim, dialog[data-leaving="swipe"] .dim { animation-duration: ${unsafeCSS(`${SWIPE.dismissMs}ms`)}; }
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
