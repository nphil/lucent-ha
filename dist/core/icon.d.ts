import { nothing, type TemplateResult } from "lit";
/** Renders an icon: an `mdi:camera`-style id through Home Assistant's `<ha-icon>`, or raw 24x24 SVG path data
 * inline (no Home Assistant needed). Size comes from `--lu-icon` (default 24px) / `--mdc-icon-size`; the
 * colour is `currentColor`. Always decorative: give the control its own accessible name. */
export declare function renderIcon(icon: string | undefined | null, className?: string): TemplateResult | typeof nothing;
