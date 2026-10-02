import { css } from "lit";
/** The Lucent v2 token layer for Home Assistant. Home Assistant supplies every colour (this file only ever
 * reads `--primary-color`, `--primary-text-color`, `--ha-card-*`, `--app-header-*`, `--divider-color` ...), so
 * a theme switch re-resolves everything live. This layer supplies structure: shape, space, type, motion,
 * targets, shell sizes and the device profiles. Names mirror skill://design-language `ha.css`.
 *
 * Included ONCE per root: the panel's root element (`lu-app-shell` does it for you), a card's root element, or
 * `lu-root`. Every toolkit element below inherits the custom properties; none declares tokens of its own.
 * The base is the host app's own profile; the `PanelProfile` controller sets `data-lu-profile` (phone, tablet,
 * desktop, smart), `data-lu-short` and `data-lu-touch` on the root, and the blocks at the end swap type,
 * target, row and margin sizes (LANGUAGE.md section 7). Added effect permissions stay off (tier T0). */
export const TOKENS_CSS = css `
  :host {
    /* ---- colour roles, resolved from the host theme ---- */
    --lu-accent: var(--primary-color);
    --lu-accent-ink: var(--text-primary-color, var(--primary-background-color));
    --lu-ink: var(--primary-text-color);
    --lu-ink-2: var(--secondary-text-color, var(--primary-text-color));
    --lu-ink-3: var(--disabled-text-color, var(--secondary-text-color));
    --lu-ink-readable: var(--primary-text-color);
    --lu-positive: var(--success-color, var(--state-active-color, var(--primary-color)));
    --lu-warning: var(--warning-color, var(--primary-color));
    --lu-danger: var(--error-color, var(--primary-color));
    --lu-info: var(--info-color, var(--primary-color));
    --lu-live: var(--error-color, var(--primary-color));
    --lu-canvas: var(--primary-background-color);
    --lu-card: var(--ha-card-background, var(--card-background-color));
    --lu-glass: var(--lu-card);
    /* What Home Assistant's own dialogs are made of: a surface that stays readable when the theme's cards are glass. */
    --lu-sheet: var(--ha-dialog-surface-background, var(--mdc-theme-surface, var(--card-background-color)));
    --lu-edge: var(--ha-card-border-color, var(--divider-color));
    --lu-tile: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
    --lu-glass-raised: color-mix(in srgb, var(--primary-text-color) 12%, transparent);
    --lu-edge-raised: color-mix(in srgb, var(--primary-text-color) 22%, transparent);
    --lu-track-off: color-mix(in srgb, var(--primary-text-color) 16%, transparent);
    --lu-track-readable: color-mix(in srgb, var(--primary-text-color) 60%, transparent);
    --lu-accent-soft: color-mix(in srgb, var(--primary-color) 18%, transparent);
    --lu-scrim: color-mix(in srgb, var(--primary-background-color) 70%, transparent);
    --lu-focus: var(--primary-text-color);
    --lu-focus-ink: var(--primary-background-color);
    --lu-focus-wash: color-mix(in srgb, var(--primary-text-color) 7%, transparent);
    /* A near-opaque reading surface for text that sits on photos, video or a scrolling page (uncontrolled backgrounds). */
    --lu-reading: color-mix(in srgb, var(--primary-background-color) 88%, transparent);
    /* The app bar: Home Assistant's header colours over an opaque base, so it stays readable over scrolling content in glass themes. */
    --lu-bar-ink: var(--app-header-text-color, var(--primary-text-color));
    --lu-bar-tint: var(--app-header-background-color, var(--card-background-color));
    --lu-bar-edge: var(--app-header-border-bottom, 1px solid var(--lu-edge));

    /* ---- materials (LANGUAGE.md section 2) ---- */
    --lu-material-canvas: var(--lu-canvas);
    --lu-material-sheet: var(--lu-card);
    --lu-material-card: var(--lu-card);
    --lu-material-well: color-mix(in srgb, var(--primary-background-color) 30%, transparent);
    --lu-material-control: var(--lu-focus-wash);
    --lu-material-overlay: var(--lu-sheet);
    --lu-material-edge: var(--lu-edge);
    --lu-material-edge-width: var(--ha-card-border-width, 1px);
    --lu-material-hover-wash: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
    --lu-material-selected-wash: var(--lu-material-hover-wash);
    --lu-material-press-wash: color-mix(in srgb, var(--primary-text-color) 10%, transparent);
    --lu-material-disabled-opacity: .55;

    /* ---- shape, space, targets ---- */
    --lu-radius-card: var(--ha-card-border-radius, 24px);
    --lu-radius-sheet: max(var(--lu-radius-card), 28px);
    --lu-radius-tile: max(calc(var(--lu-radius-card) - 4px), 8px);
    --lu-radius-row: max(calc(var(--lu-radius-card) - 6px), 8px);
    --lu-radius-control: max(calc(var(--lu-radius-card) - 10px), 6px);
    --lu-radius-pill: 999px;
    --lu-target: 48px;
    --lu-row: 56px;
    --lu-space-1: 4px;
    --lu-space-2: 8px;
    --lu-space-3: 12px;
    --lu-space-4: 16px;
    --lu-space-5: 20px;
    --lu-space-6: 24px;
    --lu-space-7: 32px;
    --lu-space-8: 40px;
    --lu-edge-x: 16px;
    --lu-edge-y: 16px;
    --lu-gutter: 16px;
    --lu-blur: 0px;
    /* Glass themes blur what is behind Home Assistant's own dialogs; sheets follow the same variables (T0 adds none of its own). */
    --lu-sheet-blur: var(--ha-dialog-surface-backdrop-filter, none);
    --lu-scrim-blur: var(--ha-dialog-scrim-backdrop-filter, none);

    /* ---- light, depth, focus ---- */
    --lu-highlight-rest: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 7%, transparent);
    --lu-highlight-raised: inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 18%, transparent);
    /* Shadows: rest is the theme's own card shadow (never a second one); raised, pressed and overlay are neutral black lighting, readable on light and dark. */
    --lu-shadow-rest: var(--ha-card-box-shadow, none);
    --lu-shadow-raised: 0 10px 24px rgba(0, 0, 0, .22);
    --lu-shadow-pressed: 0 4px 10px rgba(0, 0, 0, .18);
    --lu-shadow-overlay: var(--dialog-box-shadow, 0 16px 48px rgba(0, 0, 0, .28));
    --lu-neumorphic-light: color-mix(in srgb, var(--primary-text-color) 8%, transparent);
    --lu-neumorphic-shade: color-mix(in srgb, var(--primary-background-color) 30%, transparent);
    --lu-neumorphic-raised: -2px -2px 4px var(--lu-neumorphic-light), 2px 2px 4px var(--lu-neumorphic-shade);
    --lu-neumorphic-inset: inset 2px 2px 4px var(--lu-neumorphic-shade), inset -2px -2px 4px var(--lu-neumorphic-light);
    --lu-sheen: linear-gradient(135deg, var(--lu-material-hover-wash), transparent 60%);
    /* Focus lands as light on the existing material: a lit edge, a faint wash and a 2px landing bar in ink. */
    --lu-focus-indicator: 2px;
    --lu-focus-indicator-inset: 12px;
    --lu-focus-scroll-clearance: 12px;
    --lu-focus-ring: var(--lu-highlight-raised), inset 0 0 0 999px var(--lu-focus-wash), inset 0 calc(var(--lu-focus-indicator) * -1) 0 var(--lu-ink);

    /* ---- type ---- */
    --lu-font: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, inherit));
    --lu-type-display: 56px;
    --lu-type-title: 24px;
    --lu-type-body: 16px;
    --lu-type-label: 14px;
    --lu-type-caption: 12px;
    --lu-type-numeral: tabular-nums;
    --lu-type-numeral-size: 20px;

    /* ---- motion ---- */
    --lu-ease: cubic-bezier(.33, 1, .68, 1);
    --lu-ease-press: cubic-bezier(.2, 0, 0, 1);
    --lu-ease-exit: cubic-bezier(.4, 0, 1, 1);
    --lu-motion-press: 90ms;
    --lu-motion-label: 120ms;
    --lu-motion-focus: 150ms;
    --lu-motion-card: 180ms;
    --lu-motion-layer: 220ms;
    --lu-motion-scroll: 300ms;
    --lu-motion-exit: 180ms;
    --lu-motion-reduce: 120ms;
    --lu-motion-reorder: 600ms;
    --lu-hold: 1500ms;
    --lu-scale-pressed: .97;
    --lu-scale-raised-row: 1.02;
    --lu-scale-raised-card: 1.03;
    --lu-scale-raised-button: 1.04;
    --lu-scale-raised-tile: 1.12;
    --lu-lift-raised: 4px;
    --lu-travel-layer: 16px;
    --lu-travel-drawer: 24px;
    --lu-travel-toast: 8px;

    /* ---- effect permissions (tier T0: nothing extra) ---- */
    --lu-tier-cached-blur: 0;
    --lu-tier-live-blur: 0;
    --lu-tier-sheen: 0;
    --lu-tier-soft-shadow: 0;
    --lu-tier-neumorphic: 0;
    --lu-tier-ambient: 0;

    /* ---- safe areas: Home Assistant's own tokens (the content insets exclude its sidebar) ---- */
    --lu-safe-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
    --lu-safe-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
    --lu-safe-left: var(--safe-area-content-inset-left, var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
    --lu-safe-right: var(--safe-area-content-inset-right, var(--safe-area-inset-right, env(safe-area-inset-right, 0px)));

    /* ---- shell: sizes the app shell publishes and consumers can build on ---- */
    --lu-app-bar: 56px;
    /* Measured by the shell: the whole sticky top chrome (app bar + pills row), the fixed bottom bar incl. its safe area, the rail width. */
    --lu-top-chrome: var(--lu-app-bar);
    --lu-bottom-bar: 0px;
    --lu-rail: 72px;
    --lu-rail-w: 0px;
    --lu-content-max: 1600px;
    --lu-content-max-text: 1100px;
    --lu-tile-min: 176px;
    --lu-tile-min-camera: 360px;
    --lu-tile-min-species: 176px;
    --lu-tile-min-visit: 280px;
    --lu-tile-max: 560px;
    --lu-sheet-max: 90dvh;
    /* Stacking bands: all below Home Assistant's own sidebar and drawer (6) and dialogs. */
    --lu-z-content: 0;
    --lu-z-raised: 1;
    --lu-z-sticky: 2;
    --lu-z-chrome: 3;
    --lu-z-popup: 4;
  }
  :host([data-lu-profile="phone"]) { --lu-row: 56px; --lu-type-display: 48px; --lu-type-title: 24px; --lu-type-body: 16px; --lu-type-label: 14px; --lu-type-caption: 12px; --lu-edge-x: 16px; --lu-edge-y: 16px; --lu-gutter: 12px; }
  :host([data-lu-profile="tablet"]) { --lu-row: 56px; --lu-type-display: 56px; --lu-type-title: 28px; --lu-type-body: 16px; --lu-type-label: 16px; --lu-type-caption: 13px; --lu-edge-x: 24px; --lu-edge-y: 24px; --lu-gutter: 24px; }
  :host([data-lu-profile="desktop"]) { --lu-row: 52px; --lu-type-display: 56px; --lu-type-title: 28px; --lu-type-body: 16px; --lu-type-label: 14px; --lu-type-caption: 12px; --lu-edge-x: 32px; --lu-edge-y: 24px; --lu-gutter: 24px; }
  :host([data-lu-profile="smart"]) { --lu-target: 64px; --lu-row: 64px; --lu-type-display: 72px; --lu-type-title: 28px; --lu-type-body: 20px; --lu-type-label: 18px; --lu-type-caption: 16px; --lu-edge-x: 24px; --lu-edge-y: 20px; --lu-gutter: 16px; }
  :host([data-lu-short]) { --lu-app-bar: 48px; --lu-sheet-max: 94dvh; --lu-edge-y: 12px; }
  @media (prefers-reduced-motion: reduce) {
    :host { --lu-scale-pressed: 1; --lu-scale-raised-row: 1; --lu-scale-raised-card: 1; --lu-scale-raised-button: 1; --lu-scale-raised-tile: 1; --lu-lift-raised: 0px; --lu-travel-layer: 0px; --lu-travel-drawer: 0px; --lu-travel-toast: 0px; --lu-motion-press: 0ms; --lu-motion-focus: 0ms; --lu-motion-card: 0ms; --lu-motion-layer: 120ms; --lu-motion-exit: 120ms; --lu-motion-scroll: 0ms; }
  }
`;
