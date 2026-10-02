import { nothing } from "lit";
import type { PropertyValues, TemplateResult } from "lit";
import { LuElement } from "../core/element.js";
import type { LuElementClass } from "../core/element.js";
import type { SheetCloseReason } from "./sheet-model.js";
/** Which dialog draws the sheet: `auto` uses Home Assistant's own adaptive dialog when the page has it and a native
 * `<dialog>` otherwise; `native` and `ha` force one (`ha` falls back, with a console warning, when HA's is missing). */
export type SheetEngine = "auto" | "native" | "ha";
/** What `lu-close` carries. */
export interface LuCloseDetail {
    reason: SheetCloseReason;
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
export declare class LuSheet extends LuElement {
    static luName: string;
    static luDeps: readonly LuElementClass[];
    static properties: {
        open: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        heading: {
            type: StringConstructor;
        };
        subheading: {
            type: StringConstructor;
        };
        closeLabel: {
            type: StringConstructor;
            attribute: string;
        };
        layer: {
            type: StringConstructor;
        };
        history: {
            converter: {
                fromAttribute: (value: string | null) => boolean;
            };
        };
        engine: {
            type: StringConstructor;
        };
        _engine: {
            state: boolean;
        };
        _haShown: {
            state: boolean;
        };
        _haOpen: {
            state: boolean;
        };
        _hasFooter: {
            state: boolean;
        };
    };
    open: boolean;
    heading: string;
    subheading: string;
    /** Accessible name of the close button. */
    closeLabel: string;
    /** Id of the history layer this sheet adds while it is open. */
    layer: string;
    /** Add a history entry while open, so the system Back button closes the sheet. False in cards. */
    history: boolean;
    engine: SheetEngine;
    _engine: "native" | "ha";
    _haShown: boolean;
    _haOpen: boolean;
    _hasFooter: boolean;
    private readonly _lifecycle;
    private readonly _swipe;
    private _opener;
    private _scrimDown;
    private _scrimUp;
    private _exitToken;
    private _exitTimer;
    private _tracking;
    private _inset;
    private _viewportFrame;
    private _haIntent;
    private _haClosedItself;
    private _liftedAutofocus;
    private _scroller;
    private _lockedTop;
    private _themeWatch;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    /** Opens the sheet. */
    show(): void;
    /** Closes the sheet with an exit motion; `lu-close` follows with this reason (default `api`). */
    close(reason?: SheetCloseReason): void;
    protected updated(changed: PropertyValues<this>): void;
    /** Brings the lifecycle in line with `open`. The dialog engine is chosen while the sheet is closed, and the matching
     * structure is rendered before it opens; it never changes while the sheet is open. */
    private _sync;
    private _pickEngine;
    private get _dialog();
    /** Puts the sheet on screen. */
    private _present;
    /** Reads the theme's two dialog filters and has the sheet draw them the cheap way where that gives the same picture (see
     * `dialogLook`). Read at every opening, and again while open when the theme changes (`_watchTheme`). */
    private _setLook;
    /** While open, looks at the filters again whenever the page's root element changes its `style` or `class`: Home Assistant applies
     * a theme as custom properties on it, so a theme switched with the sheet on screen is followed, not only the next opening. */
    private _watchTheme;
    private _liftAutofocus;
    private _restoreAutofocus;
    /** Starts the exit: toasts go to the page, a swipe in progress lets go, the exit motion plays. */
    private _leave;
    /** The exit is over: close the dialog, give focus back, tell the owner. */
    private _finish;
    /** Everything the open sheet changed, undone. */
    private _reset;
    /** The toast host inside the open sheet. */
    private get _toastHost();
    /** A toast raised inside the open sheet shows in the sheet (see the class comment). */
    private _onToast;
    private _onCancel;
    /** Something closed the `<dialog>` itself (a script): follow it. The event is queued, so it can arrive after the sheet
     * was opened again; a dialog that is open now is not closed. */
    private _onNativeClose;
    /** Only a press that both started and ended on the scrim dismisses. A browser reports the click on the nearest common
     * ancestor of where the press began and ended, so "began on the scrim, ended on the sheet" also arrives as a click on the
     * scrim: the end of the press is checked on its own. */
    private _onScrimDown;
    private _onScrimUp;
    private _onScrimClick;
    /** The page behind must not scroll. Wheel movement over anything in the sheet that cannot scroll that way (the scrim,
     * the header, a body that is short or already at its end) is cancelled before it can reach the page. */
    private _onWheel;
    /** Scroll keys scroll whatever scrolls under the focused element, and with focus on the sheet itself or a header button
     * that is the page behind. The sheet takes those keys: a scroller under the focus that can still move handles the key
     * itself (the browser does that), anything else scrolls the sheet's body, never the page. Fields, sliders and menus keep
     * their keys, and Space still presses a focused button. */
    private _onKeydown;
    /** Keeps the page behind where it was. Wheel, touch and keys are stopped on the way in (above and in the CSS); this
     * catches whatever else moves the page while a sheet is open (dragging the page's own scrollbar, find in page, a script)
     * by putting it back. It never writes a style of the page, only its scroll position, and only when something moved it. */
    private _lockPage;
    private _onPageScroll;
    private _onFooterSlot;
    /** While open, keeps the sheet's bottom edge above the on-screen keyboard (`--lu-keyboard-inset`) and the focused field in view. */
    private _trackViewport;
    private _onViewport;
    /** Home Assistant does not say how it was closed: Escape and its close button are noticed on the way in, everything
     * else (its scrim, its own swipe) reports `scrim`. */
    private _noteHaIntent;
    /** Home Assistant has put its dialog on screen: the lifted `autofocus` attributes go back, and a mouse and keyboard user gets
     * the element the content asked for (Home Assistant's own lookup cannot see content that is passed through slots). On a
     * touch screen a field that took focus anyway gives it up. */
    private _onHaOpened;
    private _onHaClosed;
    private _renderToasts;
    private _renderHa;
    private _renderNative;
    render(): TemplateResult | typeof nothing;
    static styles: import("lit").CSSResult[];
}
declare global {
    interface HTMLElementEventMap {
        "lu-close": CustomEvent<LuCloseDetail>;
    }
}
