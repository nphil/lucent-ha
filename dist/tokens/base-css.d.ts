/** Focus, shared by every interactive element. Normal focus is not an outline; forced-colours mode keeps the
 * system one. !important so it also lands on controls that carry their own rest shadow. */
export declare const FOCUS_CSS: import("lit").CSSResult;
/** Reset, focus, icon and text helpers every toolkit element shares. */
export declare const BASE_CSS: import("lit").CSSResult;
/** Buttons: pills, icon buttons and text buttons. Class-based so a consumer can use the same look without a
 * nested element. Pressed = `:is(:active, [data-pressed])` + a wash (never a scale: a transform on press costs a
 * layer promotion and 6-13 ms of main-thread work per press, measured on the Kestrel panel), with `transition: none`
 * so the feedback lands in the first frame while the soft colour transition stays on release (see `trackPresses`). */
export declare const CONTROLS_CSS: import("lit").CSSResult;
/** The panel/card surfaces: sheet (card material), tile, raised, plus a status dot. */
export declare const SURFACE_CSS: import("lit").CSSResult;
