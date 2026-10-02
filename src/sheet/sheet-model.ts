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

  /** The element is leaving the page: give the history entry back without any motion or event. */
  dispose(): void {
    const layer = this._layer;
    this._layer = null;
    if (layer?.open) layer.close("api");
    this.phase = "closed";
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
