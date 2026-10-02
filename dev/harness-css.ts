/** The harness's own CSS, injected once into <head> (the page, the cells and the Home Assistant stand-ins are light DOM so tests can
 * `document.querySelector` them). Every rule is scoped to an `hx-*` element, a `.hx-*` class or `ha-panel-custom`: nothing here
 * can reach into a specimen's markup. Colours are Home Assistant's theme variables, never raw values. */
export const HARNESS_CSS = `
ha-panel-custom {
  background-color: var(--primary-background-color);
  padding-top: var(--safe-area-inset-top);
  padding-bottom: var(--safe-area-inset-bottom);
  padding-left: var(--safe-area-content-inset-left, var(--safe-area-inset-left));
  padding-right: var(--safe-area-content-inset-right, var(--safe-area-inset-right));
}
ha-panel-custom[data-handle-safe-area] { padding: 0; }
/* The surface switch: a Lovelace dashboard paints the theme's wallpaper behind its cards, a panel only paints the background colour. */
html[data-hx-surface="dashboard"] ha-panel-custom { min-height: 100vh; background: var(--lovelace-background, var(--primary-background-color)); background-attachment: fixed; }

.hx-elsewhere { padding: 32px 16px; display: grid; gap: 12px; justify-items: start; font-family: var(--ha-font-family-body); color: var(--primary-text-color); }
.hx-elsewhere p { margin: 0; }
.hx-elsewhere button, .hx-toolbar button, .hx-toolbar select { font: inherit; }

hx-page { display: block; box-sizing: border-box; padding: 12px 16px 48px; color: var(--primary-text-color); font-family: var(--ha-font-family-body); }
hx-page[data-plain] { padding: 12px; }
.hx-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin: 0 0 12px; padding: 8px 12px; border: 1px solid var(--divider-color); border-radius: 12px; background: color-mix(in srgb, var(--card-background-color) 82%, transparent); font-size: 12px; }
.hx-toolbar label, .hx-toolbar .hx-field { display: inline-flex; align-items: center; gap: 6px; color: var(--secondary-text-color); }
.hx-toolbar select, .hx-toolbar button { min-height: 28px; padding: 0 8px; border: 1px solid var(--divider-color); border-radius: 8px; background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer; }
.hx-toolbar button[aria-pressed="true"] { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color); }
.hx-toolbar .hx-menu { display: inline-grid; place-items: center; width: 32px; padding: 0; }
.hx-toolbar .hx-segment { display: inline-flex; gap: 4px; }
.hx-toolbar .hx-size { margin-inline-start: auto; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
.hx-problems { display: grid; gap: 4px; margin: 0 0 12px; padding: 8px 12px; border: 1px solid var(--error-color); border-radius: 12px; background: color-mix(in srgb, var(--error-color) 12%, var(--card-background-color)); font-size: 12px; }
.hx-problems code { white-space: pre-wrap; word-break: break-word; }
.hx-section { margin: 0 0 8px; container: hx / inline-size; }
.hx-section > h2 { margin: 20px 4px 8px; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--secondary-text-color); }
.hx-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); align-items: start; }
hx-cell { display: block; min-width: 0; }
hx-cell[data-size="full"] { grid-column: 1 / -1; }
@container hx (min-width: 760px) { hx-cell[data-size="wide"] { grid-column: span 2; } }
.hx-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 0 4px 6px; font-size: 12px; color: var(--secondary-text-color); }
.hx-head h3 { margin: 0; font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
.hx-head code { font-family: var(--ha-font-family-code); opacity: 0.7; }
.hx-card { padding: 16px; }
.hx-panel { border: 1px dashed var(--divider-color); border-radius: 8px; background: var(--primary-background-color); }
.hx-error { padding: 12px; color: var(--error-color); font-size: 12px; white-space: pre-wrap; }
.hx-empty { padding: 24px; display: grid; gap: 8px; }
.hx-empty h2 { margin: 0; font-size: 16px; font-weight: 500; }
.hx-empty p { margin: 0; color: var(--secondary-text-color); }
.hx-facts { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0; font-size: 13px; }
.hx-facts dt { color: var(--secondary-text-color); }
.hx-facts dd { margin: 0; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.hx-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.hx-swatch { display: grid; grid-template-columns: 28px 1fr; gap: 8px; align-items: center; font-size: 11px; line-height: 1.3; }
.hx-swatch i { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--divider-color); background-image: repeating-conic-gradient(#8884 0 25%, transparent 0 50%); background-size: 10px 10px; }
.hx-swatch i b { display: block; width: 100%; height: 100%; border-radius: inherit; }
.hx-swatch span { overflow-wrap: anywhere; color: var(--secondary-text-color); }
.hx-swatch span strong { display: block; color: var(--primary-text-color); font-weight: 500; }
`;
