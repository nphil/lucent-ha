import { css } from "lit";

/** Focus, shared by every interactive element. Normal focus is not an outline; forced-colours mode keeps the
 * system one. !important so it also lands on controls that carry their own rest shadow. */
export const FOCUS_CSS = css`
  button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible, [tabindex]:focus-visible, [role="radio"]:focus-visible, [role="tab"]:focus-visible, [role="option"]:focus-visible { outline: none; box-shadow: var(--lu-focus-ring) !important; }
  @media (forced-colors: active) {
    button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible, [tabindex]:focus-visible, [role="radio"]:focus-visible, [role="tab"]:focus-visible, [role="option"]:focus-visible { outline: 2px solid CanvasText; }
  }
`;

/** Reset, focus, icon and text helpers every toolkit element shares. */
export const BASE_CSS = css`
  *, *::before, *::after { box-sizing: border-box; }
  button, input, select, textarea { font: inherit; }
  button { color: inherit; }
  a { color: var(--lu-accent); }
  ${FOCUS_CSS}
  .muted { color: var(--lu-ink-2); }
  .caption { color: var(--lu-ink-3); font-size: var(--lu-type-caption); }
  .icon { display: inline-block; flex: none; width: var(--lu-icon, 24px); height: var(--lu-icon, 24px); --mdc-icon-size: var(--lu-icon, 24px); fill: currentColor; }
  .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;

/** Buttons: pills, icon buttons and text buttons. Class-based so a consumer can use the same look without a
 * nested element. Press styles use `:is(:active, [data-pressed])` + a wash so feedback also shows when reduced
 * motion removes the scale (see `trackPresses`). */
export const CONTROLS_CSS = css`
  .pill { display: inline-flex; align-items: center; justify-content: center; gap: var(--lu-space-2); min-height: var(--lu-target); padding: 0 var(--lu-space-5); border: 1px solid transparent; border-radius: var(--lu-radius-pill); cursor: pointer; font-size: var(--lu-type-label); font-weight: 600; text-decoration: none; transition: transform var(--lu-motion-press) var(--lu-ease-press), background-color var(--lu-motion-label) var(--lu-ease); }
  .pill:is(:active, [data-pressed]):not(:disabled) { transform: scale(var(--lu-scale-pressed)); }
  .pill:is(:active, [data-pressed]):not(:disabled), .icon-button:is(:active, [data-pressed]), .text-button:is(:active, [data-pressed]) { background-image: linear-gradient(var(--lu-material-press-wash), var(--lu-material-press-wash)); }
  .pill.primary { color: var(--lu-accent-ink); background: var(--lu-accent); }
  .pill.secondary { color: var(--lu-ink); background: var(--lu-glass-raised); border-color: var(--lu-edge-raised); box-shadow: var(--lu-highlight-rest); }
  .pill.danger { color: var(--lu-danger); background: var(--lu-glass-raised); border-color: color-mix(in srgb, var(--lu-danger) 36%, var(--lu-edge)); }
  .pill:disabled, .pill[aria-disabled="true"] { color: var(--lu-ink-3); background: var(--lu-tile); border-color: var(--lu-edge); cursor: not-allowed; }
  .icon-button { display: inline-grid; flex: none; width: var(--lu-target); height: var(--lu-target); place-items: center; padding: 0; border: 0; border-radius: 50%; color: var(--lu-ink-2); background: transparent; cursor: pointer; }
  .text-button { display: inline-flex; align-items: center; min-height: var(--lu-target); padding: 0 var(--lu-space-3); border: 0; border-radius: var(--lu-radius-pill); color: var(--lu-accent); background: transparent; font: 600 var(--lu-type-label) var(--lu-font); text-decoration: none; cursor: pointer; }
  @media (hover: hover) and (pointer: fine) { .icon-button:hover { color: var(--lu-ink); background: var(--lu-glass-raised); } .pill.secondary:hover:not(:disabled) { background: color-mix(in srgb, var(--lu-glass-raised) 100%, var(--lu-material-hover-wash)); } }
  @media (prefers-reduced-motion: reduce) { .pill { transition: none; } }
`;

/** The panel/card surfaces: sheet (card material), tile, raised, plus a status dot. */
export const SURFACE_CSS = css`
  .sheet { background: var(--lu-card); border: 1px solid var(--lu-edge); border-radius: var(--lu-radius-card); box-shadow: var(--lu-highlight-rest), var(--lu-shadow-rest); }
  .tile { background: var(--lu-tile); border: 1px solid var(--lu-edge); border-radius: var(--lu-radius-tile); }
  .raised { background: var(--lu-glass-raised); border-color: var(--lu-edge-raised); box-shadow: var(--lu-highlight-raised), var(--lu-shadow-raised); }
  .status-dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: var(--lu-ink-3); }
  .status-dot.ok { background: var(--lu-positive); }
  .status-dot.warn { background: var(--lu-warning); }
  .status-dot.danger { background: var(--lu-danger); }
`;
