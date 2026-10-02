import { css } from "lit";
import type { PropertyValues } from "lit";
import { html } from "lit/static-html.js";
import { LuElement } from "../core/element.ts";
import type { LuElementClass } from "../core/element.ts";
import { trackPresses } from "../core/press.ts";
import { LuToast } from "../sheet/toast.ts";
import type { ToastEventDetail } from "../sheet/toast-event.ts";
import { BASE_CSS } from "../tokens/base-css.ts";
import { PanelProfile } from "../tokens/profile.ts";
import { TOKENS_CSS } from "../tokens/tokens-css.ts";

export type LuRootMode = "panel" | "card";

/** The foundation for anything that is not a whole panel: it declares the design tokens, works out the device
 * profile and gives its content instant press feedback and a toast host. Put your card (or a standalone piece of UI)
 * inside it and everything inside, toolkit elements and your own CSS, can read the `--lu-*` tokens.
 *
 * - `mode="card"` (default): sized by its own width only, never by the window, and adds no global listeners, so
 *   many cards on one dashboard stay cheap.
 * - `mode="panel"`: also follows the window height and input type (short screens, touch or mouse), like the app shell.
 *
 * It sets `data-lu-profile`, `data-lu-short` and `data-lu-touch` on itself, which the tokens switch on. It has no app
 * bar and no navigation; for a full panel use the app shell. Toasts raised anywhere inside it (`showToast`) appear in it. */
export class LuRoot extends LuElement {
  static luName = "root";
  static luDeps: readonly LuElementClass[] = [LuToast];

  static properties = {
    mode: { type: String, reflect: true },
  };

  /** Set it in the markup (it is read when the element is connected); changing it later rebuilds the profile. */
  declare mode: LuRootMode;

  private _profile: PanelProfile | null = null;
  private _profileMode: LuRootMode | null = null;
  private _stopPresses: (() => void) | null = null;

  constructor() {
    super();
    this.mode = "card";
  }

  connectedCallback(): void {
    // The profile must exist before the first render, so the very first frame already has the right sizes.
    this._syncProfile();
    super.connectedCallback();
    this.addEventListener("lu-toast", this._onToast);
    this._stopPresses ??= trackPresses(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("lu-toast", this._onToast);
    this._stopPresses?.();
    this._stopPresses = null;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has("mode")) this._syncProfile();
  }

  /** One profile controller per mode: the mode decides whether it listens to the window. */
  private _syncProfile(): void {
    if (this._profile && this._profileMode === this.mode) return;
    if (this._profile) {
      this._profile.hostDisconnected();
      this.removeController(this._profile);
    }
    this._profile = new PanelProfile(this, { mode: this.mode === "panel" ? "panel" : "card" });
    this._profileMode = this.mode;
  }

  private _onToast = (event: Event): void => {
    const toast = this.renderRoot.querySelector<LuToast>("[data-toast]");
    if (!toast) return;
    toast.show((event as CustomEvent<ToastEventDetail>).detail);
    // The nearest root shows it: a card inside an app shell must not toast twice.
    event.stopPropagation();
  };

  render() {
    return html`<slot></slot><${this.luTag("toast")} data-toast></${this.luTag("toast")}>`;
  }

  static styles = [TOKENS_CSS, BASE_CSS, css`
    :host { display: block; container-type: inline-size; color: var(--lu-ink); font-family: var(--lu-font); }
  `];
}
