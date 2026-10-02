/** `<ha-adaptive-dialog>` stand-in, registered ONLY with `?ha-dialog=1` (Home Assistant 2026.9, src/components/ha-adaptive-dialog.ts).
 *
 * Same surface as the real element, for testing the toolkit's Home Assistant adapter:
 *   attributes  open, type, width (small|medium|large|full), prevent-scrim-close, header-title, header-subtitle, without-header,
 *               hide-close-button, flexcontent, allow-mode-change
 *   slots       header, headerNavigationIcon, headerTitle, headerSubtitle, headerActionItems, (default), footer
 *   events      `opened` (shown), `after-show` (show animation done), `closed` (hidden and animation done)
 *   behaviour   a bottom sheet when `(max-width: 870px), (max-height: 500px)` matches, otherwise a centred dialog; the mode is
 *               decided once when the element connects (unless allow-mode-change); Escape, the scrim and any element with
 *               `data-dialog="close"` close it (the scrim does not with prevent-scrim-close); it sets `open` to false itself and fires `closed`.
 * Colours come from the dialog variables themes set: --ha-dialog-surface-background, --ha-dialog-border-radius, --dialog-box-shadow,
 * --mdc-dialog-scrim-color, --ha-dialog-scrim-backdrop-filter. */
import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { MDI_PATHS } from "./mdi-subset.ts";

const ADAPTIVE_QUERY = "(max-width: 870px), (max-height: 500px)";
const WIDTHS = { small: "320px", medium: "580px", large: "1024px", full: "100vw" } as const;

export class HaAdaptiveDialog extends LitElement {
  static properties = {
    open: { type: Boolean, reflect: true },
    type: { reflect: true },
    width: { reflect: true },
    preventScrimClose: { type: Boolean, reflect: true, attribute: "prevent-scrim-close" },
    headerTitle: { attribute: "header-title" },
    headerSubtitle: { attribute: "header-subtitle" },
    withoutHeader: { type: Boolean, attribute: "without-header" },
    hideCloseButton: { type: Boolean, attribute: "hide-close-button" },
    flexContent: { type: Boolean, reflect: true, attribute: "flexcontent" },
    allowModeChange: { type: Boolean, attribute: "allow-mode-change" },
    mode: { state: true },
  };
  declare open: boolean;
  declare type: "alert" | "standard";
  declare width: keyof typeof WIDTHS;
  declare preventScrimClose: boolean;
  declare headerTitle: string | undefined;
  declare headerSubtitle: string | undefined;
  declare withoutHeader: boolean;
  declare hideCloseButton: boolean;
  declare flexContent: boolean;
  declare allowModeChange: boolean;
  declare mode: "dialog" | "bottom-sheet";

  private query: MediaQueryList | undefined;
  private modeSet = false;

  constructor() {
    super();
    this.open = false;
    this.type = "standard";
    this.width = "medium";
    this.preventScrimClose = false;
    this.withoutHeader = false;
    this.hideCloseButton = false;
    this.flexContent = false;
    this.allowModeChange = false;
    this.mode = "dialog";
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.query = matchMedia(ADAPTIVE_QUERY);
    this.query.addEventListener("change", this.onQuery);
    this.onQuery();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.query?.removeEventListener("change", this.onQuery);
    this.modeSet = false;
  }

  private onQuery = (): void => {
    if (this.modeSet && !this.allowModeChange) return;
    this.mode = this.query?.matches ? "bottom-sheet" : "dialog";
    this.modeSet = true;
  };

  private get dialog(): HTMLDialogElement | null {
    return this.renderRoot.querySelector("dialog");
  }

  protected updated(changed: PropertyValues<this>): void {
    const dialog = this.dialog;
    if (!dialog) return;
    if (this.open && !dialog.open) {
      dialog.showModal();
      this.dispatchEvent(new CustomEvent("opened", { bubbles: true, composed: true }));
      void this.afterAnimation(dialog).then(() => { if (dialog.open) this.dispatchEvent(new CustomEvent("after-show", { bubbles: true, composed: true })); });
    } else if (!this.open && dialog.open && changed.has("open")) {
      dialog.close();
      void this.afterAnimation(dialog).then(() => this.dispatchEvent(new CustomEvent("closed", { bubbles: true, composed: true })));
    }
  }

  /** Resolves when the dialog's transition has finished (or 400ms passed, e.g. with reduced motion nothing transitions). */
  private afterAnimation(dialog: HTMLDialogElement): Promise<void> {
    return new Promise((resolve) => {
      const done = (): void => {
        dialog.removeEventListener("transitionend", done);
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(done, 400);
      dialog.addEventListener("transitionend", done, { once: true });
    });
  }

  private close(): void {
    this.open = false;
  }

  private onClick = (click: Event): void => {
    const dialog = this.dialog;
    if (click.target === dialog) {
      if (!this.preventScrimClose) this.close();
      return;
    }
    if (click.composedPath().some((node) => node instanceof HTMLElement && node.getAttribute("data-dialog") === "close")) this.close();
  };

  private header(): TemplateResult | typeof nothing {
    if (this.withoutHeader) return nothing;
    return html`<slot name="header">
      <header>
        <slot name="headerNavigationIcon">${this.hideCloseButton ? nothing : html`<button type="button" class="close" data-dialog="close" aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d=${MDI_PATHS.close ?? ""}></path></svg></button>`}</slot>
        <div class="titles">
          ${this.headerTitle !== undefined ? html`<span class="title" id="ha-dialog-title">${this.headerTitle}</span>` : html`<slot name="headerTitle"></slot>`}
          ${this.headerSubtitle !== undefined ? html`<span class="subtitle">${this.headerSubtitle}</span>` : html`<slot name="headerSubtitle"></slot>`}
        </div>
        <slot name="headerActionItems"></slot>
      </header>
    </slot>`;
  }

  protected render(): TemplateResult {
    return html`<dialog class=${this.mode} style="--hx-width: ${WIDTHS[this.width] ?? WIDTHS.medium}" aria-labelledby=${this.headerTitle !== undefined ? "ha-dialog-title" : nothing}
      @cancel=${(event: Event) => { event.preventDefault(); this.close(); }} @click=${this.onClick}>
      ${this.header()}
      <div class="body"><slot></slot></div>
      <slot name="footer"></slot>
    </dialog>`;
  }

  static styles = css`
    :host { display: contents; }
    dialog {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      padding: 0;
      border: 0;
      color: var(--primary-text-color);
      background: var(--ha-dialog-surface-background, var(--mdc-theme-surface, var(--card-background-color)));
      -webkit-backdrop-filter: var(--ha-dialog-surface-backdrop-filter, none);
      backdrop-filter: var(--ha-dialog-surface-backdrop-filter, none);
      box-shadow: var(--dialog-box-shadow, var(--ha-box-shadow-l));
      opacity: 0;
      transition: opacity var(--ha-animation-duration-normal, 250ms) ease, transform var(--ha-animation-duration-normal, 250ms) ease, overlay var(--ha-animation-duration-normal, 250ms) allow-discrete, display var(--ha-animation-duration-normal, 250ms) allow-discrete;
    }
    dialog[open] { opacity: 1; }
    dialog:not([open]) { display: none; }
    dialog.dialog { width: min(var(--hx-width), calc(100vw - 32px)); max-height: calc(100dvh - 64px); border-radius: var(--ha-dialog-border-radius, var(--ha-border-radius-4xl)); transform: scale(0.96); }
    dialog.dialog[open] { transform: none; }
    dialog.bottom-sheet { width: 100%; max-width: 100%; max-height: 90dvh; margin: auto 0 0; border-radius: var(--ha-border-radius-2xl) var(--ha-border-radius-2xl) 0 0; padding: 0 var(--safe-area-inset-right) var(--safe-area-inset-bottom) var(--safe-area-inset-left); transform: translateY(100%); }
    dialog.bottom-sheet[open] { transform: none; }
    @starting-style { dialog[open] { opacity: 0; } dialog.dialog[open] { transform: scale(0.96); } dialog.bottom-sheet[open] { transform: translateY(100%); } }
    dialog::backdrop { background: var(--mdc-dialog-scrim-color, rgba(0, 0, 0, 0.32)); -webkit-backdrop-filter: var(--ha-dialog-scrim-backdrop-filter, none); backdrop-filter: var(--ha-dialog-scrim-backdrop-filter, none); }
    header { display: flex; align-items: center; gap: 4px; padding: var(--ha-space-2) var(--ha-space-2) var(--ha-space-2) var(--ha-space-2); min-height: 64px; box-sizing: border-box; }
    .titles { flex: 1; min-width: 0; display: grid; }
    .title { font-size: var(--ha-font-size-xl); font-weight: var(--ha-font-weight-medium); line-height: var(--ha-line-height-condensed); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .subtitle { color: var(--secondary-text-color); font-size: var(--ha-font-size-m); }
    .close { display: inline-grid; place-items: center; width: 48px; height: 48px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--primary-text-color); cursor: pointer; }
    .close svg { width: 24px; height: 24px; fill: currentColor; }
    .body { flex: 1; min-height: 0; overflow: auto; padding: var(--dialog-content-padding, 0 var(--ha-space-6) var(--ha-space-6)); }
    :host([flexcontent]) .body { display: flex; flex-direction: column; }
  `;
}

customElements.define("ha-adaptive-dialog", HaAdaptiveDialog);
