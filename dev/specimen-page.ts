/** The specimen page: the "panel" the harness mounts in `<ha-panel-custom>` (it receives `hass`, `narrow`, `route` like any HA panel).
 *
 *   <hx-page>   toolbar (live controls), a banner for files the build had to skip, the environment cells, then one section per
 *               specimen group;
 *   <hx-cell>   one labelled specimen: `render(ctx)` inside the toolkit root (`spec-lu-root`), in a card surface (`ha-card`, with the
 *               theme's card variables) or, for `size: "full"`, a panel surface.
 *
 * Both render into their own light DOM, so a specimen's `setup(cell)` and a test's `document.querySelector` see the real elements. */
import { LitElement, html, nothing, type TemplateResult } from "lit";
import { html as staticHtml, unsafeStatic } from "lit/static-html.js";
import type { HaRoute, HomeAssistant } from "../src/ha/types.ts";
import type { ProfileState } from "../src/tokens/profile-model.ts";
import { deviceFor } from "./devices.ts";
import type { LuHarness, SafeInsets } from "./harness-api.ts";
import { THEME_NAMES, describeTheme } from "./ha-theme.ts";
import { MDI_PATHS } from "./mdi-subset.ts";
import type { PointerMode } from "./pointer-override.ts";
import type { Specimen, SpecimenContext } from "./specimen-types.ts";

const GROUPS: Record<string, string> = {
  shell: "Shell and navigation",
  view: "Views",
  sheet: "Sheets and toasts",
  ha: "Home Assistant helpers",
  controls: "Controls",
  content: "Content",
  state: "States",
  grid: "Grids",
  image: "Images",
  audio: "Audio",
};

/** The toolkit's token and profile provider, registered under the harness prefix (`spec`). Its job is to wrap every specimen. */
const ROOT_TAG = "spec-lu-root";

/** How long a specimen's `setup` may take before the page stops waiting for it. */
const SETUP_DEADLINE_MS = 5000;

const NOTCH_PORTRAIT: SafeInsets = [47, 0, 34, 0];
const NOTCH_LANDSCAPE: SafeInsets = [0, 47, 21, 47];

/** The variables a theme is judged by, for the swatch cell. */
const SWATCHES = [
  "--primary-color", "--accent-color", "--text-primary-color", "--primary-text-color", "--secondary-text-color", "--disabled-text-color",
  "--primary-background-color", "--secondary-background-color", "--card-background-color", "--ha-card-background", "--ha-dialog-surface-background", "--divider-color",
  "--success-color", "--warning-color", "--error-color", "--info-color", "--app-header-background-color", "--sidebar-background-color",
];

export class HxCell extends LitElement {
  static properties = {
    specimen: { attribute: false },
    hass: { attribute: false },
    narrow: { type: Boolean },
    plain: { type: Boolean },
    profile: { state: true },
  };
  declare specimen: Specimen;
  declare hass: HomeAssistant | undefined;
  declare narrow: boolean;
  declare plain: boolean;
  declare profile: ProfileState;

  /** Resolves once the first render is done and the specimen's `setup` hook has run. */
  readonly ready: Promise<void>;
  private markReady!: () => void;
  private cleanup: (() => void) | undefined;
  private watcher: MutationObserver | undefined;

  constructor() {
    super();
    this.narrow = false;
    this.plain = false;
    this.profile = { profile: "tablet", short: false, touch: false, nav: "pills" };
    this.ready = new Promise((resolve) => { this.markReady = resolve; });
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.watcher?.disconnect();
    this.cleanup?.();
    this.cleanup = undefined;
  }

  private context(): SpecimenContext {
    return { prefix: "spec", hass: this.hass as HomeAssistant, narrow: this.narrow, profile: this.profile };
  }

  protected willUpdate(): void {
    const { id, group, size } = this.specimen;
    this.dataset.id = id;
    this.dataset.group = group;
    this.dataset.size = size ?? "cell";
  }

  protected render(): TemplateResult {
    const { title, id, size = "cell" } = this.specimen;
    let content: TemplateResult;
    try {
      content = this.specimen.render(this.context());
    } catch (error) {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
      console.error(`specimen "${id}" threw while rendering:`, error);
      content = html`<div class="hx-error">Specimen "${id}" threw while rendering:\n${message}</div>`;
    }
    const tag = unsafeStatic(ROOT_TAG);
    const root = staticHtml`<${tag} mode=${size === "full" ? "panel" : "card"}>${content}</${tag}>`;
    return html`
      ${this.plain ? nothing : html`<div class="hx-head"><h3>${title}</h3><code>${id}</code></div>`}
      ${size === "full" ? html`<div class="hx-panel">${root}</div>` : html`<ha-card class="hx-card">${root}</ha-card>`}`;
  }

  protected firstUpdated(): void {
    void this.start();
  }

  /** The profile the root resolved is on its `data-lu-*` attributes; follow them so `ctx.profile` is what the specimen really lives in. */
  private watchProfile(): void {
    this.watcher?.disconnect();
    const root = this.querySelector(ROOT_TAG);
    if (!root) return;
    const read = (): void => {
      const next: ProfileState = {
        profile: (root.getAttribute("data-lu-profile") as ProfileState["profile"] | null) ?? this.profile.profile,
        short: root.hasAttribute("data-lu-short"),
        touch: root.hasAttribute("data-lu-touch"),
        nav: (root.getAttribute("data-lu-nav") as ProfileState["nav"] | null) ?? this.profile.nav,
      };
      const { profile, short, touch, nav } = this.profile;
      if (next.profile !== profile || next.short !== short || next.touch !== touch || next.nav !== nav) this.profile = next;
    };
    this.watcher = new MutationObserver(read);
    this.watcher.observe(root, { attributes: true, attributeFilter: ["data-lu-profile", "data-lu-short", "data-lu-touch", "data-lu-nav"] });
    read();
  }

  private async start(): Promise<void> {
    await this.updateComplete;
    this.watchProfile();
    try {
      // A setup that never finishes must not keep the whole page from becoming ready.
      const setup = Promise.resolve(this.specimen.setup?.(this, this.context()));
      const deadline = new Promise<"late">((resolve) => window.setTimeout(() => resolve("late"), SETUP_DEADLINE_MS));
      const cleanup = await Promise.race([setup, deadline]);
      if (cleanup === "late") console.warn(`specimen "${this.specimen.id}": setup() did not finish within ${SETUP_DEADLINE_MS} ms; the page goes on without it`);
      else if (typeof cleanup === "function") this.cleanup = cleanup;
    } catch (error) {
      console.error(`specimen "${this.specimen.id}" setup failed:`, error);
    }
    this.markReady();
  }
}

/** Pairs shown in the environment cell. */
type Fact = readonly [label: string, value: string];

export class HxPage extends LitElement {
  static properties = {
    lu: { attribute: false },
    hass: { attribute: false },
    narrow: { type: Boolean },
    route: { attribute: false },
    panel: { attribute: false },
  };
  declare lu: LuHarness;
  declare hass: HomeAssistant | undefined;
  declare narrow: boolean;
  declare route: HaRoute | undefined;
  declare panel: unknown;

  constructor() {
    super();
    this.narrow = false;
  }

  protected createRenderRoot(): HTMLElement {
    return this;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.lu.addEventListener("change", this.refresh);
    window.addEventListener("resize", this.refresh);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.lu.removeEventListener("change", this.refresh);
    window.removeEventListener("resize", this.refresh);
  }

  private refresh = (): void => this.requestUpdate();

  protected willUpdate(): void {
    this.toggleAttribute("data-plain", this.lu.params.plain);
  }

  /** The specimens that pass the `?group=` and `?only=` filters, grouped in catalogue order. */
  private sections(): [string, Specimen[]][] {
    const { group, only } = this.lu.params;
    const shown = this.lu.specimens.filter((specimen) => (group === undefined || specimen.group === group) && (only.length === 0 || only.includes(specimen.id)));
    const order = Object.keys(GROUPS);
    return order.map((name): [string, Specimen[]] => [name, shown.filter((specimen) => specimen.group === name)]).filter(([, items]) => items.length > 0);
  }

  private control<T extends string>(label: string, value: T, options: readonly (readonly [T, string])[], change: (value: T) => void): TemplateResult {
    return html`<label>${label}
      <select .value=${value} @change=${(event: Event) => change((event.target as HTMLSelectElement).value as T)}>
        ${options.map(([option, text]) => html`<option value=${option} ?selected=${option === value}>${text}</option>`)}
      </select></label>`;
  }

  private toolbar(): TemplateResult {
    const { lu } = this;
    const device = deviceFor(innerWidth, innerHeight);
    const safe = lu.safeArea;
    const safeKey = safe === undefined ? "none" : safe.join(",") === NOTCH_PORTRAIT.join(",") ? "portrait" : safe.join(",") === NOTCH_LANDSCAPE.join(",") ? "landscape" : "custom";
    return html`
      <div class="hx-toolbar" role="toolbar" aria-label="Harness controls">
        <button type="button" class="hx-menu" aria-label="Sidebar toggle" title="Sends hass-toggle-menu, like the menu button a panel draws" @click=${(event: Event) => event.target?.dispatchEvent(new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true }))}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d=${MDI_PATHS.menu ?? ""}></path></svg>
        </button>
        <span class="hx-field">Theme
          <span class="hx-segment">${THEME_NAMES.map((name) => html`<button type="button" aria-pressed=${lu.theme === name} @click=${() => lu.setTheme(name)}>${describeTheme(name).label}</button>`)}</span>
        </span>
        ${this.control<PointerMode>("Pointer", lu.pointer, [["auto", "auto"], ["touch", "touch"], ["fine", "mouse"]], (value) => lu.setPointer(value))}
        ${this.control("Sidebar", this.hass?.dockedSidebar ?? "docked", [["docked", "docked (256)"], ["auto", "collapsed (56)"], ["always_hidden", "hidden (drawer)"]], (value) => lu.setSidebar(value))}
        <label><input type="checkbox" .checked=${this.hass?.kioskMode === true} @change=${(event: Event) => lu.setKiosk((event.target as HTMLInputElement).checked)} /> Wall (kiosk)</label>
        ${this.control("Background", lu.surface, [["dashboard", "dashboard"], ["panel", "panel"]], (value) => lu.setSurface(value))}
        ${this.control("Safe area", safeKey, [["none", "none"], ["portrait", "notch portrait"], ["landscape", "notch landscape"], ["custom", "custom"]], (value) => lu.setSafeArea(value === "portrait" ? NOTCH_PORTRAIT : value === "landscape" ? NOTCH_LANDSCAPE : value === "none" ? undefined : lu.safeArea))}
        <label><input type="checkbox" .checked=${document.documentElement.dir === "rtl"} @change=${(event: Event) => lu.setDirection((event.target as HTMLInputElement).checked ? "rtl" : "ltr")} /> RTL</label>
        <span class="hx-field">Connection
          <button type="button" @click=${() => lu.mock.disconnect()} ?disabled=${this.hass?.connected === false}>Disconnect</button>
          <button type="button" @click=${() => lu.mock.reconnect()} ?disabled=${this.hass?.connected !== false}>Reconnect</button>
        </span>
        <span class="hx-size">${innerWidth}×${innerHeight} @${devicePixelRatio}x${device ? ` · ${device}` : ""}</span>
      </div>`;
  }

  private problems(): TemplateResult | typeof nothing {
    const { problems } = this.lu;
    if (problems.length === 0) return nothing;
    return html`<div class="hx-problems" role="alert"><strong>Left out of this page (does not build or load yet):</strong>
      ${problems.map((problem) => html`<div><b>${problem.file}</b> <code>${problem.message}</code></div>`)}</div>`;
  }

  private facts(): Fact[] {
    const { lu } = this;
    const hass = this.hass;
    const style = getComputedStyle(document.documentElement);
    const drawer = lu.frame?.modal === true;
    const sidebar = drawer ? `drawer (${hass?.kioskMode ? "kiosk" : this.narrow ? "narrow" : "setting: hidden"})` : hass?.dockedSidebar === "docked" ? "docked, 256px" : "collapsed, 56px";
    const safe = lu.safeArea;
    const theme = describeTheme(lu.theme);
    return [
      ["viewport", `${innerWidth}×${innerHeight} CSS px @${devicePixelRatio}x${deviceFor(innerWidth, innerHeight) ? ` (${deviceFor(innerWidth, innerHeight)})` : ""}`],
      ["pointer", `${lu.pointer === "auto" ? "browser" : `forced ${lu.pointer}`}: hover ${matchMedia("(hover: hover)").matches ? "yes" : "no"}, pointer ${matchMedia("(pointer: fine)").matches ? "fine" : matchMedia("(pointer: coarse)").matches ? "coarse" : "none"}`],
      ["Home Assistant", `narrow ${this.narrow ? "yes" : "no"} (max-width 870px) · sidebar ${sidebar} · dockedSidebar ${hass?.dockedSidebar} · kioskMode ${hass?.kioskMode}`],
      ["panel area", `${this.clientWidth}px wide, safe area ${safe ? safe.join("/") : "none"}${this.lu.params.handleSafeArea ? " (panel handles it)" : ""}`],
      ["theme", `${theme.label} = ${theme.haTheme} ${theme.dark ? "dark" : "light"} · surface ${lu.surface}`],
      ["toolkit", `lucent-ha ${lu.version} · ${lu.registry ? Object.keys(lu.registry.tags).length : 0} elements as spec-lu-*`],
      ["font stack", style.getPropertyValue("--ha-font-family-body").trim()],
      ["built", lu.builtAt],
    ];
  }

  private environment(): TemplateResult {
    return html`
      <section class="hx-section">
        <h2>Harness</h2>
        <div class="hx-grid">
          <div>
            <div class="hx-head"><h3>Environment</h3><code>what this page emulates</code></div>
            <ha-card class="hx-card"><dl class="hx-facts">${this.facts().map(([label, value]) => html`<dt>${label}</dt><dd>${value}</dd>`)}</dl></ha-card>
          </div>
          <div>
            <div class="hx-head"><h3>Theme variables</h3><code>${this.lu.theme}</code></div>
            <ha-card class="hx-card"><div class="hx-swatches">${this.swatches()}</div></ha-card>
          </div>
        </div>
      </section>`;
  }

  private swatches(): TemplateResult[] {
    const style = getComputedStyle(document.documentElement);
    return SWATCHES.map((name) => html`<div class="hx-swatch"><i><b style="background: var(${name})"></b></i><span><strong>${name.slice(2)}</strong>${style.getPropertyValue(name).trim() || "(not set)"}</span></div>`);
  }

  private empty(): TemplateResult {
    return html`<ha-card class="hx-card hx-empty">
      <h2>No specimens to show</h2>
      <p>${this.lu.specimens.length === 0 ? "Add dev/specimens/<area>.ts exporting `specimens: Specimen[]` (types in dev/specimen-types.ts), then run `scripts/lu-run node dev/build.mjs` and reload." : "The ?group= / ?only= filter matches nothing."}</p>
    </ha-card>`;
  }

  protected render(): TemplateResult {
    const sections = this.sections();
    const { plain } = this.lu.params;
    return html`
      ${plain ? nothing : this.toolbar()}
      ${this.problems()}
      ${plain ? nothing : this.environment()}
      ${sections.length === 0 ? this.empty() : sections.map(([name, items]) => html`
        <section class="hx-section" data-group=${name}>
          ${plain ? nothing : html`<h2>${GROUPS[name]}</h2>`}
          <div class="hx-grid">${items.map((specimen) => html`<hx-cell .specimen=${specimen} .hass=${this.hass} .narrow=${this.narrow} .plain=${plain}></hx-cell>`)}</div>
        </section>`)}`;
  }
}
