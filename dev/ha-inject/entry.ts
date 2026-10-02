/** Injected into the REAL Home Assistant by `scripts/ha-check.mjs` (never shipped): registers the toolkit under the
 * throwaway prefix `chk`, builds a small panel (app shell, view stack, sheet, toast, wall mode) and mounts it in the panel
 * area of the page, inside a real `ha-panel-custom` when Home Assistant has defined it, so `hass-toggle-menu`,
 * `hass-kiosk-mode`, `hass-dock-sidebar`, history and the theme behave exactly as for a real custom panel. Nothing is
 * written to Home Assistant's configuration; `unmount()` puts the page back. */
import { LitElement, css, html } from "lit";
import { BASE_CSS, TOKENS_CSS, defineLucent, showToast } from "../../src/index.ts";
import type { LuDestination } from "../../src/index.ts";

defineLucent({ prefix: "chk" });

const DESTINATIONS: LuDestination[] = [
  { id: "overview", label: "Overview", icon: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" },
  { id: "library", label: "Library", icon: "M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" },
  { id: "settings", label: "Settings", icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-6 2 3h4v4l3 2-3 2v4h-4l-2 3-2-3H6v-4l-3-2 3-2V5h4z" },
];

class ChkPanel extends LitElement {
  static properties = {
    hass: { attribute: false },
    narrow: { type: Boolean },
    current: { state: true },
    sheetOpen: { state: true },
    wall: { state: true },
  };
  declare hass: unknown;
  declare narrow: boolean;
  declare current: string;
  declare sheetOpen: boolean;
  declare wall: boolean;

  constructor() {
    super();
    this.narrow = false;
    this.current = "overview";
    this.sheetOpen = false;
    this.wall = false;
  }

  static styles = [TOKENS_CSS, BASE_CSS, css`
    :host { display: block; }
    .row { display: flex; align-items: center; min-height: var(--lu-row); padding: 0 var(--lu-space-4); border-bottom: 1px solid var(--lu-edge); }
    .toolbar { display: flex; flex-wrap: wrap; gap: var(--lu-space-3); padding: var(--lu-space-4); }
  `];

  render() {
    const rows = Array.from({ length: 40 }, (_, index) => html`<div class="row">Row ${index + 1}</div>`);
    return html`
      <chk-lu-app-shell .hass=${this.hass} ?narrow=${this.narrow} heading="Toolkit check" .destinations=${DESTINATIONS} current=${this.current} ?wall=${this.wall}
        @lu-navigate=${(event: CustomEvent<{ id: string }>) => { this.current = event.detail.id; }}
        @lu-wall-change=${(event: CustomEvent<{ wall: boolean }>) => { this.wall = event.detail.wall; }}>
        <chk-lu-button slot="actions" kind="quiet" icon-only label="Wall mode" icon="M4 5h16v11H4zm6 13h4v2h-4z" @click=${() => { this.wall = !this.wall; }}></chk-lu-button>
        <chk-lu-view-stack current=${this.current}>
          <div data-view="overview">
            <div class="toolbar">
              <chk-lu-button kind="primary" data-act="open-sheet" @click=${() => { this.sheetOpen = true; }}>Open sheet</chk-lu-button>
              <chk-lu-button kind="secondary" data-act="toast" @click=${() => { showToast(this, { message: "Saved", actionLabel: "Undo", onAction: () => {} }); }}>Show toast</chk-lu-button>
            </div>
            ${rows}
          </div>
          <div data-view="library"><div class="toolbar"><chk-lu-chip kind="positive" label="Library"></chk-lu-chip></div>${rows}</div>
          <div data-view="settings"><div class="toolbar"><chk-lu-segmented label="Mode" .options=${[{ value: "a", label: "A" }, { value: "b", label: "B" }]} value="a"></chk-lu-segmented></div></div>
        </chk-lu-view-stack>
        <chk-lu-sheet ?open=${this.sheetOpen} heading="A sheet" @lu-close=${() => { this.sheetOpen = false; }}>
          <p style="padding: var(--lu-space-4)">Sheet body. Back, Escape, the scrim and the close button all close it.</p>
        </chk-lu-sheet>
      </chk-lu-app-shell>`;
  }
}
customElements.define("chk-panel", ChkPanel);

type Deep = ParentNode & { shadowRoot?: ShadowRoot | null };
function deepFind(root: Deep, selector: string): HTMLElement | null {
  const direct = root.querySelector<HTMLElement>(selector);
  if (direct) return direct;
  for (const element of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    if (element.shadowRoot) {
      const found = deepFind(element.shadowRoot, selector);
      if (found) return found;
    }
  }
  return null;
}

interface Mounted { panel: ChkPanel; host: HTMLElement; hidden: HTMLElement[]; timer: number }
let mounted: Mounted | null = null;

const api = {
  /** Mounts the panel where a custom panel would be. Returns facts about what it found. */
  mount() {
    if (mounted) return { already: true };
    const ha = document.querySelector("home-assistant") as (HTMLElement & { hass?: unknown }) | null;
    const main = ha?.shadowRoot ? deepFind(ha.shadowRoot, "home-assistant-main") as (HTMLElement & { narrow?: boolean }) | null : null;
    const resolver = main?.shadowRoot ? deepFind(main.shadowRoot, "partial-panel-resolver") : null;
    if (!ha || !main || !resolver) return { error: "Home Assistant's panel area was not found", ha: !!ha, main: !!main, resolver: !!resolver };
    const root: ParentNode = resolver.shadowRoot ?? resolver;
    const hidden = Array.from(root.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.localName !== "style" && child.style.display !== "none");
    for (const child of hidden) child.style.display = "none";
    const customDefined = !!customElements.get("ha-panel-custom");
    const host = document.createElement(customDefined ? "ha-panel-custom" : "div");
    host.style.cssText = "display:block;box-sizing:border-box;background-color:var(--primary-background-color);padding-top:var(--safe-area-inset-top);padding-bottom:var(--safe-area-inset-bottom);padding-left:var(--safe-area-content-inset-left,var(--safe-area-inset-left));padding-right:var(--safe-area-content-inset-right,var(--safe-area-inset-right));";
    const panel = document.createElement("chk-panel") as ChkPanel;
    panel.hass = ha.hass;
    panel.narrow = !!main.narrow;
    host.append(panel);
    (root as ShadowRoot | HTMLElement).append(host);
    // Home Assistant hands every panel a fresh `hass` on each change; do the same.
    const timer = window.setInterval(() => {
      if (panel.hass !== ha.hass) panel.hass = ha.hass;
      if (panel.narrow !== !!main.narrow) panel.narrow = !!main.narrow;
    }, 50);
    mounted = { panel, host, hidden, timer };
    return { mounted: true, customPanelHost: customDefined, resolverHasShadow: !!resolver.shadowRoot, hiddenPanels: hidden.map((child) => child.localName) };
  },
  unmount() {
    if (!mounted) return false;
    window.clearInterval(mounted.timer);
    mounted.host.remove();
    for (const child of mounted.hidden) child.style.display = "";
    mounted = null;
    return true;
  },
  panel: () => mounted?.panel ?? null,
  setWall: (on: boolean) => { if (mounted) mounted.panel.wall = on; },
  openSheet: () => { if (mounted) mounted.panel.sheetOpen = true; },
  find: (selector: string) => deepFind(document, selector),
};
(window as unknown as { __chk: typeof api }).__chk = api;
