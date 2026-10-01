/** Layout thresholds, shell sizes, grid minimums, z-index bands, motion and gesture constants.
 * The same numbers exist as CSS custom properties in `TOKENS_CSS`; these are for JavaScript (matching
 * breakpoints, Web Animations, gesture maths). Container pixels unless stated. */

export const LAYOUT = {
  /** Below this container width a panel is "compact": a bottom bar. */
  compact: 680,
  /** From this container width the destinations move into the app bar as tabs. */
  wide: 900,
  /** At or below this viewport height a panel is "short" (phone held sideways, wall display): a left rail.
   * Home Assistant's own adaptive dialog uses the same number. */
  short: 500,
  /** Below this container width the phone profile applies. */
  phone: 600,
  /** A touch display needs at least this much height to count as a smart display (Echo Show 5 = 480). */
  smartMinHeight: 440,
  /** A threshold is crossed by this much (px) before the layout switches back, so a scrollbar appearing at
   * the boundary cannot make it flicker. */
  hysteresis: 20,
} as const;

export const SHELL = {
  appBar: 56,
  appBarShort: 48,
  /** Left rail width (short screens). */
  rail: 72,
  /** Content width caps: grids, and reading text. */
  contentMaxGrid: 1600,
  contentMaxText: 1100,
  /** A tile never grows past this (px), however few there are. */
  tileMax: 560,
} as const;

/** Smallest tile width per kind of tile (`auto-fill minmax(var(--lu-tile-min), 1fr)`). */
export const TILE_MIN = { camera: 360, species: 176, visit: 280 } as const;

/** One written table of stacking bands (no ad-hoc numbers). Everything here stays BELOW Home Assistant's own
 * sidebar/drawer (6) and dialogs; modal toolkit layers use the browser's top layer and need no z-index. */
export const Z = {
  content: 0,
  raised: 1,
  /** Sticky headers inside a view (jump bars, section headers). */
  sticky: 2,
  /** App bar, bottom bar, rail, "now playing" bar. */
  chrome: 3,
  /** Panel-local popups that are not in the top layer. */
  popup: 4,
} as const;

/** Lucent motion durations in ms (LANGUAGE.md section 8), for Web Animations and timers. */
export const MOTION = {
  press: 90,
  label: 120,
  focus: 150,
  card: 180,
  layer: 220,
  exit: 180,
  scroll: 300,
  reduce: 120,
  reorder: 600,
  hold: 1500,
} as const;

/** Swipe-to-dismiss constants, from Music Assistant's PanelDragHandle (see THIRD_PARTY_NOTICES.md). */
export const SWIPE = {
  /** Drag distance on the handle that dismisses (px). */
  handleDismiss: 24,
  /** Drag distance anywhere on the sheet that dismisses (px). */
  anywhereDismiss: 72,
  /** Movement before a gesture counts as a drag (px). */
  slop: 10,
  /** Dismiss / reset animation durations (ms). */
  dismissMs: 160,
  resetMs: 180,
  /** A click right after a swipe is swallowed for this long (ms). */
  clickGuardMs: 400,
} as const;

/** The reconnect grace window: how long the last data stays on screen while the websocket reconnects. */
export const RECONNECT_GRACE_MS = 10_000;
