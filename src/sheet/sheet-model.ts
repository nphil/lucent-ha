/** The ways a sheet can be dismissed. `back` is the system Back button (its history entry was popped); `api` is code:
 * `close()`, `open = false`, or the history entry being closed by a page navigation. */
export type SheetCloseReason = "escape" | "scrim" | "swipe" | "button" | "back" | "api";

/** A history entry this sheet owns (the shape of `LayerHandle` from `src/ha/layers.ts`). */
export interface SheetLayer {
  readonly open: boolean;
  close(reason?: string): void;
}

/** `pushLayer` from `src/ha/layers.ts`, passed in so this file needs no browser and no other slice. */
export type PushSheetLayer = (id: string, onClose: (reason: string) => void) => SheetLayer;

/** What a sheet element does for its lifecycle; the element implements these against the DOM. */
export interface SheetEffects {
  /** Put the sheet on screen (the dialog's `showModal()`, or HA's dialog opened). May throw if it cannot. */
  show(): void;
  /** Play the exit motion; the element calls `exited()` when it has finished. */
  exit(reason: SheetCloseReason): void;
  /** The sheet is gone: return focus, tell the world (`lu-close`). */
  closed(reason: SheetCloseReason): void;
  /** Make the `open` property read this. Called with `false` the moment a close starts. */
  setOpen(open: boolean): void;
  /** Whether the owner wants the sheet open right now (the `open` property). */
  wantsOpen(): boolean;
}

export interface SheetOpenOptions {
  /** Add a history entry so the system Back button closes the sheet. False in cards. */
  history: boolean;
  /** Id of that history layer. */
  layer: string;
}

/** The life of one sheet: closed, open, closing (the exit motion is playing). Every way of closing goes through `close()`,
 * so a sheet is closed exactly once per opening, whichever of Escape, scrim, swipe, button, Back or code gets there first.
 *
 * - `open` flips to false the moment a close starts; `closed` (and `lu-close`) comes when the exit motion is over.
 * - A close started by the user or by code pops the sheet's history entry; a close that comes *from* the history entry
 *   (the system Back button) does not pop it again.
 * - If the owner asks for the sheet to open again while it is still leaving, it opens when the exit has finished. */
export class SheetLifecycle {
  phase: "closed" | "open" | "closing" = "closed";

  private readonly _effects: SheetEffects;
  private readonly _push: PushSheetLayer | null;
  private _layer: SheetLayer | null = null;
  private _reason: SheetCloseReason = "api";
  private _wanted: SheetOpenOptions = { history: false, layer: "sheet" };

  constructor(effects: SheetEffects, pushLayer: PushSheetLayer | null) {
    this._effects = effects;
    this._push = pushLayer;
  }

  /** Opens the sheet (and its history entry). Does nothing while it is open; while it is leaving, it opens afterwards. */
  open(options: SheetOpenOptions): void {
    this._wanted = options;
    if (this.phase !== "closed") return;
    this._effects.show();
    this.phase = "open";
    if (options.history && this._push) this._layer = this._push(options.layer, (reason) => this._layerClosed(reason));
  }

  /** Starts closing. Returns false when the sheet is not open (already closing, or closed): the first reason wins. */
  close(reason: SheetCloseReason): boolean {
    if (this.phase !== "open") return false;
    this.phase = "closing";
    this._reason = reason;
    this._effects.setOpen(false);
    const layer = this._layer;
    this._layer = null;
    if (layer?.open) layer.close(reason);
    this._effects.exit(reason);
    return true;
  }

  /** The exit motion has finished. */
  exited(): void {
    if (this.phase !== "closing") return;
    this.phase = "closed";
    this._effects.closed(this._reason);
    if (this._effects.wantsOpen()) this.open(this._wanted);
  }

  /** The element is leaving the page: give the history entry back without any motion or event. The sheet counts as closed
   * before the entry is given back, because the layer manager runs `onClose` inside `close()`. */
  dispose(): void {
    const layer = this._layer;
    this._layer = null;
    this.phase = "closed";
    if (layer?.open) layer.close("api");
  }

  private _layerClosed(reason: string): void {
    // The browser has already removed the history entry; closing the sheet must not remove it a second time.
    this._layer = null;
    this.close(reason === "back" ? "back" : "api");
  }
}

/** How far the on-screen keyboard covers the bottom of the page, in px, from the visual viewport (`window.visualViewport`):
 * the part of the layout viewport that is neither visible above `offsetTop` nor inside the visual viewport. A pinch-zoomed
 * page also has a smaller visual viewport; that is not a keyboard, so it counts as 0. */
export function keyboardInset(viewport: { innerHeight: number; height: number; offsetTop: number; scale: number }): number {
  if (viewport.scale > 1.01) return 0;
  return Math.max(0, Math.round(viewport.innerHeight - viewport.height - viewport.offsetTop));
}

/** Where focus goes when a sheet opens: the sheet itself (a container with a name, nothing that opens the keyboard), or,
 * for a mouse and keyboard user, the element the content marked `autofocus`. On a touch screen a text field is never focused
 * on its own: that would raise the on-screen keyboard over half the sheet (idea from Music Assistant's `dialog_focus.ts`). */
export function initialFocus(touch: boolean, hasAutofocusTarget: boolean): "container" | "target" {
  return !touch && hasAutofocusTarget ? "target" : "container";
}

/** What a keyboard scroll key asks for: which way, and how far (a line, a page or all the way). `null` for any other key. */
export interface KeyScroll {
  direction: -1 | 1;
  unit: "line" | "page" | "edge";
}

export function keyScroll(key: string, shift: boolean): KeyScroll | null {
  switch (key) {
    case "ArrowDown": return { direction: 1, unit: "line" };
    case "ArrowUp": return { direction: -1, unit: "line" };
    case "PageDown": return { direction: 1, unit: "page" };
    case "PageUp": return { direction: -1, unit: "page" };
    case " ": return { direction: shift ? -1 : 1, unit: "page" };
    case "End": return { direction: 1, unit: "edge" };
    case "Home": return { direction: -1, unit: "edge" };
    default: return null;
  }
}

/** Where a scroller ends up after such a key: a line is 40 px, a page 87.5 % of its height (what browsers do), an edge is the
 * top or the bottom; never outside the content. */
export function scrolledTo(scroll: KeyScroll, view: { top: number; height: number; scrollHeight: number }): number {
  const max = Math.max(0, view.scrollHeight - view.height);
  const distance = scroll.unit === "line" ? 40 : scroll.unit === "page" ? Math.round(view.height * 0.875) : Infinity;
  return Math.min(max, Math.max(0, view.top + scroll.direction * distance));
}

/** How the theme's two dialog filters (`--lu-scrim-blur` and `--lu-sheet-blur`: Home Assistant's `--ha-dialog-scrim-backdrop-filter`
 * and `--ha-dialog-surface-backdrop-filter`) are drawn. A `backdrop-filter` makes the browser read back and filter everything behind
 * the element again in every frame in which anything inside it changes, and a compositor without a GPU (the headless test browser,
 * a weak device) does that on the CPU: with Home Assistant's `brightness(68%)` over the whole screen and a glass theme's `blur(8px)`
 * over the whole panel, one press on the close button cost 10 to 50 ms more. Where the same picture can be had without a filter,
 * the sheet draws it without one. */
export interface DialogLook {
  /** The scrim's filter is just `brightness(x)` with x at most 1 (Home Assistant's own is `brightness(68%)`): a black layer of opacity
   * 1 - x behind the scrim darkens the page instead, the same picture. `null`: no scrim filter, or another one, which stays. */
  dim: number | null;
  /** The panel blurs its backdrop while the scrim has a filter of its own. In Chromium an element with a backdrop filter is the root
   * of the backdrop of everything inside it, so that blur never sees the page: its backdrop is the scrim's flat colour, and all it
   * paints is one more layer of that colour under the panel. The panel paints that layer itself and does not blur. (Without a scrim
   * filter the blur does see the page and shows, so it stays; and in a browser where that rule was not checked, Safari and Firefox,
   * the blur stays too: it may well show the page there.) */
  flatFrost: boolean;
}

/** The browsers where "an element with a backdrop filter is the root of the backdrop of what is inside it" was checked, pixel by pixel:
 * Chromium's (Chrome, headless Chrome, Edge, Android's WebView and Silk, Samsung Internet), whose user agents all carry
 * `Chrome/<version>` (`HeadlessChrome/<version>` too). Safari, Firefox and every browser on iOS (`CriOS`, `FxiOS`) do not. */
export const rootsItsBackdrop = (userAgent: string): boolean => /Chrome\/\d/.test(userAgent);

const BRIGHTNESS = /^brightness\(\s*(\d*\.?\d+)\s*(%?)\s*\)$/i;

/** `none`, or nothing at all (a token that is not set), is no filter. */
const isFilter = (text: string): boolean => !/^(none)?$/i.test(text.trim());

/** `backdropRoot`: see `rootsItsBackdrop`. */
export function dialogLook(scrimFilter: string, surfaceFilter: string, backdropRoot: boolean): DialogLook {
  const scrim = scrimFilter.trim();
  const match = BRIGHTNESS.exec(scrim);
  const level = match ? Number(match[1]) / (match[2] ? 100 : 1) : Number.NaN;
  return {
    dim: level >= 0 && level <= 1 ? Math.round((1 - level) * 1e4) / 1e4 : null,
    flatFrost: backdropRoot && isFilter(scrim) && isFilter(surfaceFilter),
  };
}
