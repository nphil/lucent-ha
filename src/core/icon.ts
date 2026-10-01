import { html, nothing, type TemplateResult } from "lit";

/** SVG path data (Material Design Icons style) as opposed to an `mdi:name` icon id. */
function isPath(icon: string): boolean {
  return /^[Mm][\s\d.,-]/.test(icon);
}

/** Renders an icon: an `mdi:camera`-style id through Home Assistant's `<ha-icon>`, or raw 24x24 SVG path data
 * inline (no Home Assistant needed). Size comes from `--lu-icon` (default 24px) / `--mdc-icon-size`; the
 * colour is `currentColor`. Always decorative: give the control its own accessible name. */
export function renderIcon(icon: string | undefined | null, className = "icon"): TemplateResult | typeof nothing {
  if (!icon) return nothing;
  if (isPath(icon)) {
    return html`<svg class=${className} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d=${icon}></path></svg>`;
  }
  return html`<ha-icon class=${className} .icon=${icon} aria-hidden="true"></ha-icon>`;
}
