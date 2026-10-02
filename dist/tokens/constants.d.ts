/** Layout thresholds, shell sizes, grid minimums, z-index bands, motion and gesture constants.
 * The same numbers exist as CSS custom properties in `TOKENS_CSS`; these are for JavaScript (matching
 * breakpoints, Web Animations, gesture maths). Container pixels unless stated. */
export declare const LAYOUT: {
    /** Below this container width a panel is "compact": a bottom bar. */
    readonly compact: 680;
    /** From this container width the destinations move into the app bar as tabs. */
    readonly wide: 900;
    /** At or below this viewport height a panel is "short" (phone held sideways, wall display): a left rail.
     * Home Assistant's own adaptive dialog uses the same number. */
    readonly short: 500;
    /** Below this container width the phone profile applies. */
    readonly phone: 600;
    /** A touch display needs at least this much height to count as a smart display (Echo Show 5 = 480). */
    readonly smartMinHeight: 440;
    /** A threshold is crossed by this much (px) before the layout switches back, so a scrollbar appearing at
     * the boundary cannot make it flicker. */
    readonly hysteresis: 20;
};
export declare const SHELL: {
    readonly appBar: 56;
    readonly appBarShort: 48;
    /** Left rail width (short screens). */
    readonly rail: 72;
    /** Content width caps: grids, and reading text. */
    readonly contentMaxGrid: 1600;
    readonly contentMaxText: 1100;
    /** A tile never grows past this (px), however few there are. */
    readonly tileMax: 560;
};
/** Smallest tile width per kind of tile (`auto-fill minmax(var(--lu-tile-min), 1fr)`). */
export declare const TILE_MIN: {
    readonly camera: 360;
    readonly species: 176;
    readonly visit: 280;
};
/** One written table of stacking bands (no ad-hoc numbers). Everything here stays BELOW Home Assistant's own
 * sidebar/drawer (6) and dialogs; modal toolkit layers use the browser's top layer and need no z-index. */
export declare const Z: {
    readonly content: 0;
    readonly raised: 1;
    /** Sticky headers inside a view (jump bars, section headers). */
    readonly sticky: 2;
    /** App bar, bottom bar, rail, "now playing" bar. */
    readonly chrome: 3;
    /** Panel-local popups that are not in the top layer. */
    readonly popup: 4;
};
/** Lucent motion durations in ms (LANGUAGE.md section 8), for Web Animations and timers. */
export declare const MOTION: {
    readonly press: 90;
    readonly label: 120;
    readonly focus: 150;
    readonly card: 180;
    readonly layer: 220;
    readonly exit: 180;
    readonly scroll: 300;
    readonly reduce: 120;
    readonly reorder: 600;
    readonly hold: 1500;
};
/** Swipe-to-dismiss constants, from Music Assistant's PanelDragHandle (see THIRD_PARTY_NOTICES.md). */
export declare const SWIPE: {
    /** Drag distance on the handle that dismisses (px). */
    readonly handleDismiss: 24;
    /** Drag distance anywhere on the sheet that dismisses (px). */
    readonly anywhereDismiss: 72;
    /** Movement before a gesture counts as a drag (px). */
    readonly slop: 10;
    /** Dismiss / reset animation durations (ms). */
    readonly dismissMs: 160;
    readonly resetMs: 180;
    /** A click right after a swipe is swallowed for this long (ms). */
    readonly clickGuardMs: 400;
};
/** The reconnect grace window: how long the last data stays on screen while the websocket reconnects. */
export declare const RECONNECT_GRACE_MS = 10000;
