import type { ReactiveController, ReactiveControllerHost } from "lit";
import { deepActiveElement, isTextEntry } from "../core/dom.ts";
import { classifyPointer, resolveProfile } from "./profile-model.ts";
import type { LuPointer, ProfileState } from "./profile-model.ts";

export interface PanelProfileOptions {
  /** `panel` (default): sized by the panel width and the viewport height, listens to window resize.
   * `card`: container queries only, no global listeners, height never matters (a card lives in a dashboard). */
  mode?: "panel" | "card";
  /** Called after the state changed (the host is also asked to re-render). */
  onChange?: (state: ProfileState) => void;
}

/** True while a text field has focus (anywhere, through shadow roots): the on-screen keyboard is probably up,
 * so a shrinking viewport height must not flip the layout to "short". */
function isTyping(): boolean {
  return isTextEntry(deepActiveElement());
}

function readPointer(): LuPointer {
  if (typeof matchMedia !== "function") return "mixed";
  const hover = matchMedia("(hover: hover)").matches ? "hover" : matchMedia("(hover: none)").matches ? "none" : undefined;
  const pointer = matchMedia("(pointer: fine)").matches ? "fine" : matchMedia("(pointer: coarse)").matches ? "coarse" : "none";
  return classifyPointer(hover, pointer);
}

/** Keeps `data-lu-profile`, `data-lu-short`, `data-lu-touch` and `data-lu-nav` on the host current, so the token
 * layer switches type, target and margin sizes by profile and the shell picks its navigation, and re-renders
 * the host when they change. The profile comes from the panel's own width (a ResizeObserver, never the
 * viewport width alone), the window height (not the visual viewport, so pinch zoom and the on-screen
 * keyboard cannot flip it) and the primary input (`hover`/`pointer`), never from the user agent. */
export class PanelProfile implements ReactiveController {
  width = 0;
  height = 0;
  state: ProfileState = { profile: "tablet", short: false, touch: false, nav: "pills" };

  private readonly _host: ReactiveControllerHost & HTMLElement;
  private readonly _card: boolean;
  private readonly _onChange?: (state: ProfileState) => void;
  private _observer?: ResizeObserver;
  private _resolved = false;

  constructor(host: ReactiveControllerHost & HTMLElement, options: PanelProfileOptions = {}) {
    this._host = host;
    this._card = options.mode === "card";
    this._onChange = options.onChange;
    host.addController(this);
  }

  hostConnected(): void {
    if (typeof ResizeObserver !== "undefined") {
      this._observer = new ResizeObserver((entries) => this._apply(entries[0]?.contentRect.width ?? this._host.clientWidth));
      this._observer.observe(this._host);
    }
    if (!this._card) {
      window.addEventListener("resize", this._refresh);
      window.addEventListener("orientationchange", this._refresh);
    }
    this._apply(this._host.clientWidth);
  }

  hostDisconnected(): void {
    this._observer?.disconnect();
    this._observer = undefined;
    window.removeEventListener("resize", this._refresh);
    window.removeEventListener("orientationchange", this._refresh);
  }

  /** Re-reads the size and input now (for example after the host was moved or shown). */
  measure(): void {
    this._apply(this._host.clientWidth);
  }

  private _refresh = (): void => { this._apply(this._host.clientWidth); };

  private _apply(measured: number): void {
    const width = Math.round(measured);
    if (width <= 0) return;
    const wasHeight = this.height;
    let height = this._card ? 1000 : Math.round(window.innerHeight);
    if (!this._card && this._resolved && height < wasHeight && isTyping()) height = wasHeight;
    const pointer = readPointer();
    const viewportWidth = this._card ? width : Math.round(window.innerWidth);
    const next = resolveProfile({ width, height, viewportWidth, pointer }, this._resolved ? this.state : undefined);
    const prev = this.state;
    const changed = !this._resolved || Math.abs(width - this.width) > 1 || height !== this.height || next.profile !== prev.profile || next.short !== prev.short || next.touch !== prev.touch || next.nav !== prev.nav;
    if (!changed) return;
    this.width = width;
    this.height = height;
    this.state = next;
    this._resolved = true;
    const host = this._host;
    host.setAttribute("data-lu-profile", next.profile);
    host.toggleAttribute("data-lu-short", next.short);
    host.toggleAttribute("data-lu-touch", next.touch);
    if (this._card) host.removeAttribute("data-lu-nav");
    else host.setAttribute("data-lu-nav", next.nav);
    host.requestUpdate();
    this._onChange?.(next);
  }
}
