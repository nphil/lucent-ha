import { css, nothing } from "lit";
import { html } from "lit/static-html.js";
import { LuElement } from "../core/element.js";
import { renderIcon } from "../core/icon.js";
import { trackPresses } from "../core/press.js";
import { createDeviceSettings } from "../ha/device-settings.js";
import { shouldEscapeNavigateBack } from "../ha/escape.js";
import { layerDepth } from "../ha/layers.js";
import { setKioskMode, showMenuButton, toggleHaMenu } from "../ha/menu.js";
import { LuToast } from "../sheet/toast.js";
import { BASE_CSS, CONTROLS_CSS } from "../tokens/base-css.js";
import { PanelProfile } from "../tokens/profile.js";
import { TOKENS_CSS } from "../tokens/tokens-css.js";
import { ChromeMeter } from "./chrome-meter.js";
import { LuNav } from "./nav.js";
import { ICON_ARROW_LEFT, ICON_MENU } from "./shell-icons.js";
import { shouldRender } from "./update-gate.js";
import { initialWall, WallMode } from "./wall-mode.js";
const NAV_MODES = ["tabs", "pills", "bottom", "rail"];
/** The frame of a Home Assistant panel: a sticky app bar, the panel's destinations as tabs, pills, a bottom bar or a
 * left rail (whichever fits the panel's own width and the screen's height), the content, an optional strip pinned
 * above the bottom bar, and the toast host. It also declares the design tokens and the device profile for everything
 * inside, so a panel needs no other root.
 *
 * Home Assistant draws no header for a custom panel and scrolls the page itself, so by default (`scroll="document"`)
 * the bars are `position: sticky` in the page and the shell never touches `html` or `body`. It expects Home Assistant's
 * own safe-area padding around the panel (the default; do not register the panel with `handle_safe_area`), pulls its
 * bars over that padding so they reach the screen edges, and pads their contents by the safe areas itself.
 * With `scroll="contained"` the shell is `height: 100%` of its parent and scrolls inside itself (specimens, previews),
 * and exposes `luScroller` so a view stack finds that scroll area.
 *
 * The shell never routes. Choosing a destination fires `lu-navigate` (from the nav inside, it crosses the shadow
 * boundary); you navigate and set `current`. `lu-back` fires from the back arrow and from Escape (`leading="back"`).
 * The shell publishes the measured size of its chrome on itself as `--lu-top-chrome`, `--lu-bottom-bar` and
 * `--lu-rail-w`, which views and toasts use to stay clear of it.
 *
 * Home Assistant hands a panel a new `hass` object on every state change in the house; the shell re-renders only
 * when something it reads from it (kiosk mode, sidebar setting, companion sidebar, language) changed. */
export class LuAppShell extends LuElement {
    /** The panel's own width in px as last measured (0 before the first measurement). */
    get panelWidth() { return this._profile.width; }
    /** The device profile the shell works with: `{ profile, short, touch, nav }` (see `lu-profile-change`). */
    get profile() { return this._profile.state; }
    constructor() {
        super();
        this._wallMode = new WallMode(setKioskMode);
        this._wallRestored = false;
        this._wallCommitted = false;
        this._stopPresses = null;
        this._onKeydown = (event) => {
            if (this.leading !== "back" || !shouldEscapeNavigateBack(event))
                return;
            event.preventDefault();
            this.emit("lu-back");
        };
        this._onToast = (event) => {
            const toast = this.renderRoot.querySelector("[data-toast]");
            if (!toast)
                return;
            toast.show(event.detail);
            // The nearest root shows it: a card inside the shell must not toast twice.
            event.preventDefault();
            event.stopPropagation();
        };
        this.hass = undefined;
        this.narrow = false;
        this.heading = "";
        this.destinations = [];
        this.current = "";
        this.leading = "auto";
        this.wall = false;
        this.wallKey = "";
        this.contentMax = "grid";
        this.scrollMode = "document";
        this.navMode = "auto";
        this.navLabel = "Sections";
        this.shortcuts = true;
        this._profile = new PanelProfile(this, { mode: "panel", onChange: (state) => { this._syncNavAttribute(); this.emit("lu-profile-change", state); } });
        this._meter = new ChromeMeter(this, () => ({
            mode: this._navMode(),
            regions: {
                top: this.renderRoot?.querySelector(".chrome") ?? null,
                rail: this.renderRoot?.querySelector(".rail") ?? null,
                dock: this.renderRoot?.querySelector(".dock") ?? null,
            },
        }));
    }
    /** The scroll area of a `contained` shell, for `findScroller` (a view stack inside it saves and restores scroll there). In `document` mode there is none: the page scrolls. */
    get luScroller() {
        if (this.scrollMode !== "contained")
            return undefined;
        const frame = this.renderRoot?.querySelector(".frame");
        if (!frame)
            return undefined;
        this._scroller ??= {
            get top() { return frame.scrollTop; },
            scrollTo(top) { frame.scrollTo({ top, behavior: "instant" }); },
            target: frame,
            element: frame,
        };
        return this._scroller;
    }
    connectedCallback() {
        super.connectedCallback();
        this._restoreWall();
        this._wallMode.set(this.wall);
        window.addEventListener("keydown", this._onKeydown);
        this.addEventListener("lu-toast", this._onToast);
        this._stopPresses ??= trackPresses(this);
        // A panel's Back handling must exist from the start. After a reload with a sheet open the sheet is gone but its history
        // entry is not, and the layer manager steps over such a leftover the moment it is created; any layer function creates it.
        layerDepth();
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener("keydown", this._onKeydown);
        this.removeEventListener("lu-toast", this._onToast);
        this._stopPresses?.();
        this._stopPresses = null;
        this._meter.disconnect();
        this._wallMode.dispose();
    }
    shouldUpdate(changed) {
        return shouldRender(changed.keys(), changed.get("hass"), this.hass);
    }
    willUpdate() {
        this._syncNavAttribute();
    }
    updated(changed) {
        if (changed.has("wall"))
            this._commitWall();
        this._meter.sync();
    }
    /** The layout in force: the forced one, or what the panel's size and the screen's height ask for. */
    _navMode() {
        return NAV_MODES.includes(this.navMode) ? this.navMode : this._profile.state.nav;
    }
    /** `data-lu-nav` on the host tells views and consumers which layout is showing; it follows a forced `nav-mode` too. */
    _syncNavAttribute() {
        const mode = this._navMode();
        if (this.getAttribute("data-lu-nav") !== mode)
            this.setAttribute("data-lu-nav", mode);
    }
    /** First connect only: with a `wall-key`, start from what this device remembered. */
    _restoreWall() {
        if (!this.wallKey || this._wallRestored)
            return;
        this._wallRestored = true;
        const stored = createDeviceSettings(this.luPrefix || "lucent").get(this.wallKey, false);
        this.wall = initialWall(this.wall, stored);
    }
    /** The wall state changed: switch kiosk mode, remember it when there is a key, and tell the app. */
    _commitWall() {
        this._wallMode.set(this.wall);
        if (this.wall === this._wallCommitted)
            return;
        this._wallCommitted = this.wall;
        if (this.wallKey)
            createDeviceSettings(this.luPrefix || "lucent").set(this.wallKey, this.wall);
        this.emit("lu-wall-change", { wall: this.wall });
    }
    _label(key, fallback) {
        return this.hass?.localize?.(key) || fallback;
    }
    _renderLeading() {
        const kind = this.leading === "auto" ? (showMenuButton(this.hass, this.narrow, { wall: this.wall }) ? "menu" : "none") : this.leading;
        if (kind === "menu") {
            return html `<button class="icon-button" type="button" aria-label=${this._label("ui.sidebar.sidebar_toggle", "Show sidebar")} @click=${() => toggleHaMenu(this)}>${renderIcon(ICON_MENU)}</button>`;
        }
        if (kind === "back") {
            return html `<button class="icon-button back" type="button" aria-label=${this._label("ui.common.back", "Back")} @click=${() => this.emit("lu-back")}>${renderIcon(ICON_ARROW_LEFT)}</button>`;
        }
        return nothing;
    }
    _renderNav(mode, className) {
        const tag = this.luTag("nav");
        return html `<${tag} class=${className} mode=${mode} .destinations=${this.destinations} .current=${this.current} .label=${this.navLabel} .shortcuts=${this.shortcuts}></${tag}>`;
    }
    render() {
        // A single destination is not navigation (Home Assistant's own tabs also need two): nothing to lay out.
        const layout = this.destinations.length < 2 ? "none" : this._navMode();
        const toast = this.luTag("toast");
        return html `
      <div class="frame" data-layout=${layout}>
        <div class="chrome">
          <header class="bar">
            ${this._renderLeading()}
            <h1 class="title" title=${this.heading || nothing}>${this.heading}</h1>
            ${layout === "tabs" ? this._renderNav("tabs", "tabs") : nothing}
            <div class="actions"><slot name="actions"></slot></div>
          </header>
          ${layout === "pills" ? this._renderNav("pills", "pills") : nothing}
        </div>
        ${layout === "rail" ? html `<div class="rail">${this._renderNav("rail", "rail-nav")}</div>` : nothing}
        <div class="column">
          <main class="content"><slot></slot></main>
          <div class="dock">
            <slot name="bottom"></slot>
            ${layout === "bottom" ? this._renderNav("bottom", "dock-nav") : nothing}
          </div>
        </div>
      </div>
      <${toast} data-toast></${toast}>`;
    }
}
LuAppShell.luName = "app-shell";
LuAppShell.luDeps = [LuNav, LuToast];
LuAppShell.properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    heading: { type: String },
    destinations: { attribute: false },
    current: { type: String },
    leading: { type: String },
    wall: { type: Boolean, reflect: true },
    wallKey: { type: String, attribute: "wall-key" },
    contentMax: { type: String, attribute: "content-max", reflect: true },
    scrollMode: { type: String, attribute: "scroll", reflect: true },
    navMode: { type: String, attribute: "nav-mode" },
    navLabel: { type: String, attribute: "nav-label" },
    shortcuts: { converter: { fromAttribute: (value) => value !== null && value !== "false" } },
};
LuAppShell.styles = [TOKENS_CSS, BASE_CSS, CONTROLS_CSS, css `
    :host {
      display: block;
      container-type: inline-size;
      min-height: 100vh;
      /* Home Assistant pads a custom panel by the safe areas; the shell cancels that padding so its bars reach the screen edges, and pads their contents itself. */
      margin: calc(var(--lu-safe-top) * -1) calc(var(--lu-safe-right) * -1) calc(var(--lu-safe-bottom) * -1) calc(var(--lu-safe-left) * -1);
      color: var(--lu-ink);
      font-family: var(--lu-font);
      font-size: var(--lu-type-body);
      line-height: 1.45;
      --_vh: 100vh;
      --_rail-w: max(var(--lu-rail), calc(var(--lu-target) * 1.5));
    }
    @supports (height: 100dvh) {
      :host { min-height: 100dvh; --_vh: 100dvh; }
    }
    :host([hidden]) { display: none; }
    :host([scroll="contained"]) { container-type: size; height: 100%; min-height: 0; margin: 0; --_vh: 100cqh; }

    .frame { display: flex; flex-direction: column; min-height: inherit; }
    /* Until the panel has been measured its layout would be a guess. A panel inside an element that has not rendered yet has no width at first, and drawing the wrong layout for a frame would move everything when the right one arrives. */
    :host(:not([data-lu-profile])) .frame { visibility: hidden; }
    :host([scroll="contained"]) .frame { height: 100%; min-height: 0; overflow: auto; overscroll-behavior: contain; }
    .frame[data-layout="rail"] { display: grid; grid-template-columns: calc(var(--_rail-w) + var(--lu-safe-left)) minmax(0, 1fr); grid-template-rows: auto 1fr; }

    /* One surface for all chrome: Home Assistant's header colours over an opaque canvas, so it stays readable over scrolling content in glass themes. */
    .chrome, .rail, .dock-nav { color: var(--lu-bar-ink); background: linear-gradient(var(--lu-bar-tint), var(--lu-bar-tint)), var(--lu-canvas); }
    .chrome { position: sticky; top: 0; z-index: var(--lu-z-chrome); flex: none; border-bottom: var(--lu-bar-edge); }
    /* Controls in the bars are always on screen, so focusing one must never scroll the page to "clear" the bars (the default focus clearance is for content). */
    .chrome, .dock { --lu-top-chrome: 0px; --lu-bottom-bar: 0px; --lu-focus-scroll-clearance: 0px; }
    .frame[data-layout="rail"] .chrome { grid-column: 1 / -1; }

    .bar { display: flex; align-items: center; gap: var(--lu-space-2); height: calc(var(--lu-app-bar) + var(--lu-safe-top)); padding: var(--lu-safe-top) calc(var(--lu-space-2) + var(--lu-safe-right)) 0 calc(var(--lu-space-2) + var(--lu-safe-left)); }
    .bar .icon-button { color: var(--lu-bar-ink); }
    .back:dir(rtl) .icon { transform: scaleX(-1); }
    .title { flex: 0 1 auto; min-width: 0; margin: 0 var(--lu-space-2); overflow: hidden; font: 600 var(--lu-type-title)/1.25 var(--lu-font); letter-spacing: -.01em; text-overflow: ellipsis; white-space: nowrap; }
    .tabs { flex: 0 1 auto; align-self: stretch; min-width: 0; margin-inline-start: var(--lu-space-4); }
    .actions { display: flex; flex: none; align-items: center; gap: var(--lu-space-1); margin-inline-start: auto; }

    .pills { padding: 0 calc(var(--lu-edge-x) + var(--lu-safe-right)) var(--lu-space-2) calc(var(--lu-edge-x) + var(--lu-safe-left)); overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none; }
    .pills::-webkit-scrollbar { display: none; }

    .rail { grid-column: 1; grid-row: 2; padding-left: var(--lu-safe-left); border-inline-end: var(--lu-bar-edge); }
    .rail-nav { position: sticky; top: var(--lu-top-chrome); max-height: calc(var(--_vh) - var(--lu-top-chrome)); overflow-y: auto; scrollbar-width: none; }
    .rail-nav::-webkit-scrollbar { display: none; }

    .column { display: flex; flex: 1 0 auto; flex-direction: column; min-width: 0; }
    .frame[data-layout="rail"] .column { grid-column: 2; grid-row: 2; }
    .content { flex: 1 0 auto; width: 100%; min-width: 0; max-width: calc(var(--lu-content-max) + var(--lu-edge-x) * 2); margin-inline: auto; padding: var(--lu-edge-y) calc(var(--lu-edge-x) + var(--lu-safe-right)) var(--lu-edge-y) calc(var(--lu-edge-x) + var(--lu-safe-left)); }
    :host([content-max="text"]) .content { max-width: calc(var(--lu-content-max-text) + var(--lu-edge-x) * 2); }
    :host([content-max="none"]) .content { max-width: none; }
    .frame[data-layout="rail"] .content { padding-left: var(--lu-edge-x); }

    /* Everything pinned to the bottom: the strip from the "bottom" slot, the bottom bar, and the home-indicator padding. As the last thing in the page it never covers the end of the content. */
    .dock { position: sticky; bottom: 0; z-index: var(--lu-z-chrome); flex: none; }
    .frame:not([data-layout="bottom"]) .dock { padding-bottom: var(--lu-safe-bottom); }
    .dock-nav { border-top: var(--lu-bar-edge); padding: 0 var(--lu-safe-right) var(--lu-safe-bottom) var(--lu-safe-left); }
    /* The strip gets the bar's surface unless the app styles its own: text pinned over scrolling content must stay readable. */
    ::slotted([slot="bottom"]) { color: var(--lu-bar-ink); background: linear-gradient(var(--lu-bar-tint), var(--lu-bar-tint)), var(--lu-canvas); border-top: var(--lu-bar-edge); }
  `];
