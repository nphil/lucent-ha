import { css, html } from "lit";
import type { PropertyValues } from "lit";
import { LuElement } from "../core/element.ts";
import { prefersReducedMotion } from "../core/dom.ts";
import { emit } from "../core/events.ts";
import { findScroller } from "../core/scroller.ts";
import type { LuScroller } from "../core/scroller.ts";
import { MOTION } from "../tokens/constants.ts";
import { ScrollRestorer } from "./scroll-restore.ts";
import type { RestoreScroller } from "./scroll-restore.ts";
import { DEFAULT_MAX_VIEWS, ViewStackModel, scrollMemoryFor } from "./view-model.ts";

/** What scrolls the page. A `LuScroller` fits; a bare `{ top, scrollTo }` works too, but then a returning view
 * is put back without waiting for its content to grow, and the offset is only remembered when a view is left. */
export type ViewScroller = Pick<LuScroller, "top" | "scrollTo"> & Partial<Pick<LuScroller, "target" | "element">>;

export interface LuViewEventDetail {
  /** The view's `data-view` id. */
  id: string;
}

declare global {
  interface HTMLElementEventMap {
    "lu-view-shown": CustomEvent<LuViewEventDetail>;
    "lu-view-hidden": CustomEvent<LuViewEventDetail>;
    "lu-view-evict": CustomEvent<LuViewEventDetail>;
  }
}

/** `motion.card` is an out-cubic ease (LANGUAGE.md section 8): the `--lu-ease` token, spelled out because the
 * Web Animations API cannot read custom properties. */
const FADE_EASING = "cubic-bezier(.33, 1, .68, 1)";

/** What `updated()` announces once the DOM is in its new state. */
interface Switch {
  hide: string | null;
  show: string | null;
  first: boolean;
}

/** Keeps the views of a panel alive and shows one at a time (a tab bar's pages).
 *
 * Put the views inside as light-DOM children, each with `data-view="<id>"`, and set `current` to the id to
 * show. The others stay in the page, `inert` and skipped by rendering (`content-visibility: hidden`), so
 * coming back is a repaint, not a rebuild. The stack remembers how far each view was scrolled and puts it
 * back, fades a returning view in, and tells the views when they are shown, hidden or pushed out.
 *
 * Events (bubbling, composed; fired on the view's element, or on the stack when that view has none yet):
 * `lu-view-shown {id}`, `lu-view-hidden {id}` (pause live streams here), `lu-view-evict {id}` (more than
 * `max` views are alive: remove that view's element, the stack never removes nodes you render). */
export class LuViewStack extends LuElement {
  static override luName = "view-stack";

  static override properties = {
    current: { type: String },
    max: { type: Number },
    memoryKey: { type: String, attribute: "memory-key" },
    scroller: { attribute: false },
  };

  /** The `data-view` id to show; empty shows nothing. */
  declare current: string;
  /** How many views stay alive (default 4, at least 1). */
  declare max: number;
  /** Names the scroll memory. Stacks with the same key share it, so give each stack on a page its own. */
  declare memoryKey: string;
  /** What scrolls: default is the app shell's scroller when inside one in `contained` mode, else the page. */
  declare scroller: ViewScroller | undefined;

  private readonly _model = new ViewStackModel();
  private readonly _restorer = new ScrollRestorer({ onActiveChange: (active) => this.toggleAttribute("restoring", active) });
  private _switch: Switch | null = null;
  private _evicted: string[] = [];
  private _fade: Animation | null = null;
  private _tracked: EventTarget | null = null;
  private _stopTracking: (() => void) | null = null;

  constructor() {
    super();
    this.current = "";
    this.max = DEFAULT_MAX_VIEWS;
    this.memoryKey = "default";
    this.scroller = undefined;
  }

  /** The next time `id` is shown it starts at the top. Call it before showing a view that now holds different
   * content under the same id (a detail page reused for another item). It does nothing for the showing view. */
  forgetScroll(id: string): void {
    this._model.forgetScroll(id);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasUpdated) return;
    // Moved in the page: the scroll offset was lost with the content.
    this._track();
    const id = this._model.current;
    if (id !== null) this._restorer.begin(this._restoreScroller(), this._model.scrollFor(id) ?? 0);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._restorer.cancel();
    this._fade?.cancel();
    this._stopTracking?.();
    this._stopTracking = null;
    this._tracked = null;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("memoryKey")) this._model.memory = scrollMemoryFor(this.memoryKey || "default");
    if (changed.has("max")) this._model.max = this.max;
    if (changed.has("current")) this._decide();
    else if (changed.has("max")) this._evicted.push(...this._model.trim());
  }

  protected override updated(): void {
    this._track();
    this._syncViews();
    const change = this._switch;
    if (!change) {
      this._announceEvictions();
      return;
    }
    this._switch = null;
    this._fade?.cancel();
    this._fade = null;
    if (change.show !== null) this._enter(change.show, change.first);
    if (change.hide !== null) this._announce("lu-view-hidden", change.hide);
    if (change.show !== null) this._announce("lu-view-shown", change.show);
    this._announceEvictions();
  }

  /** Settles what `current` changed to while the old view is still the one on screen. */
  private _decide(): void {
    // A restore that has not finished knows where the user really was; the scroller may be somewhere else yet.
    const pending = this._restorer.cancel();
    const leaving = this._model.current;
    if (leaving !== null) this._model.saveScroll(leaving, pending ?? this._scrollerNow().top);
    if (this.current === "") {
      this._switch = { hide: this._model.clear(), show: null, first: false };
      return;
    }
    const change = this._model.show(this.current);
    this._evicted.push(...change.evict);
    this._switch = { hide: change.hide, show: change.show, first: change.first };
  }

  /** The showing view is put back where it was and fades in. The first show of a view does not fade: it is
   * still filling in, and a fade would only delay it. */
  private _enter(id: string, first: boolean): void {
    this._restorer.begin(this._restoreScroller(), this._model.scrollFor(id) ?? 0);
    const view = this._viewElement(id);
    if (view && !first && !prefersReducedMotion() && typeof view.animate === "function") {
      this._fade = view.animate({ opacity: [0, 1] }, { duration: MOTION.card, easing: FADE_EASING });
    }
  }

  /** Every view but the showing one is inert (no focus, hidden from assistive technology). */
  private _syncViews(): void {
    const current = this._model.current;
    for (const child of this.children) {
      const id = child.getAttribute("data-view");
      if (id !== null) child.toggleAttribute("inert", id !== current);
    }
  }

  private _viewElement(id: string): HTMLElement | null {
    for (const child of this.children) {
      if (child.getAttribute("data-view") === id && child instanceof HTMLElement) return child;
    }
    return null;
  }

  private _announce(name: "lu-view-shown" | "lu-view-hidden" | "lu-view-evict", id: string): void {
    emit<LuViewEventDetail>(this._viewElement(id) ?? this, name, { id });
  }

  private _announceEvictions(): void {
    const evicted = this._evicted;
    this._evicted = [];
    for (const id of evicted) this._announce("lu-view-evict", id);
  }

  private _scrollerNow(): ViewScroller {
    return this.scroller ?? findScroller(this);
  }

  private _restoreScroller(): RestoreScroller {
    const scroller = this._scrollerNow();
    const element = scroller.element;
    return {
      get top() {
        return scroller.top;
      },
      scrollTo: (top) => scroller.scrollTo(top),
      maxTop: () => (element ? Math.max(0, element.scrollHeight - element.clientHeight) : Number.POSITIVE_INFINITY),
    };
  }

  /** Keeps the showing view's offset up to date while the user scrolls, so it survives the panel being
   * re-created (Home Assistant does that), when there is no moment left to read it. While a restore is holding
   * the offset the scroller is not where the user left it, so nothing is recorded. */
  private _track(): void {
    const scroller = this._scrollerNow();
    const target = scroller.target ?? null;
    if (target === this._tracked) return;
    this._stopTracking?.();
    this._tracked = target;
    this._stopTracking = null;
    if (!target) return;
    const onScroll = (): void => {
      const id = this._model.current;
      if (id !== null && !this._restorer.active) this._model.saveScroll(id, scroller.top);
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    this._stopTracking = () => target.removeEventListener("scroll", onScroll);
  }

  protected override render() {
    return html`<slot @slotchange=${this._syncViews}></slot>`;
  }

  static override styles = css`
    :host { display: block; }
    /* A view that is not showing keeps its DOM and its layout state but is skipped by rendering. It is made a
       block first, so a view root that is a custom element (inline by default) is skipped too. */
    ::slotted([data-view][inert]) { display: block; content-visibility: hidden; }
    @supports not (content-visibility: hidden) { ::slotted([data-view][inert]) { display: none; } }
    /* The browser's own scroll anchoring would second-guess a restore that is holding an offset. */
    :host([restoring]) { overflow-anchor: none; }
  `;
}
