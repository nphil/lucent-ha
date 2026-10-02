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
export declare const TOKENS_CSS: import("lit").CSSResult;
