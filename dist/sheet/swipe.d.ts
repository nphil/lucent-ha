import type { ReactiveController, ReactiveControllerHost } from "lit";
export interface SwipeDismissOptions {
    /** The element that follows the finger (the sheet's panel). */
    panel: () => HTMLElement | null;
    /** Gestures are ignored while this is false (another layout, another engine, a sheet that is not open). */
    enabled: () => boolean;
    /** The release passed the dismiss distance. The panel is left where the finger put it: the host plays its own exit
     * from there and calls `clear()` afterwards. */
    onDismiss: () => void;
}
/** Swipe down to dismiss, for a bottom sheet. The handle and the header can be dragged by a finger, a mouse or a pen;
 * a finger can also swipe down from anywhere in the sheet that is not scrolled, a slider, a text field or marked
 * `data-no-sheet-drag`. The panel follows the finger (translate + fade); a release past 24 px (handle) or 72 px
 * (swipe) calls `onDismiss`, a shorter one springs back. A click that arrives right after a swipe is swallowed.
 *
 * Mouse and pen drags need the panel to be hit by pointer events; touch needs nothing but `touch-action: none` on
 * the handle and header (the sheet's CSS sets it). Attaches its listeners to the panel while the host is connected. */
export declare class SwipeDismiss implements ReactiveController {
    private readonly _host;
    private readonly _options;
    private readonly _model;
    private _panel;
    private _resetTimer;
    constructor(host: ReactiveControllerHost, options: SwipeDismissOptions);
    hostConnected(): void;
    hostUpdated(): void;
    hostDisconnected(): void;
    /** Stops following a finger without moving the panel: the sheet is closing for another reason and its exit starts from
     * wherever the panel is. */
    abort(): void;
    /** Puts the panel back to its resting style immediately (after the dialog closed, ready for the next opening). */
    clear(): void;
    private _sync;
    private _attach;
    private _detach;
    /** The panel starts to follow: no CSS transition in the way, and a compositor layer of its own for the duration. */
    private _grab;
    private _follow;
    private _release;
    /** A short drag: the panel goes back to rest (at once under reduced motion). */
    private _springBack;
    private _onTouchStart;
    private _onTouchMove;
    private _onTouchEnd;
    private _onTouchCancel;
    private _onPointerDown;
    private _onPointerMove;
    private _onPointerUp;
    private _onPointerCancel;
    /** The click that follows the lift of a swipe must not press whatever the finger ended over. */
    private _onClick;
}
