/** The few rules the panel needs on top of the toolkit: how its own tiles and pages are laid out. Everything is a `--lu-*` token (colour, space,
 * radius, type, motion) or a plain layout number, so the panel follows the Home Assistant theme live, flat or glass. */
import { css } from "lit";

export const PANEL_CSS = css`
  :host { display: block; }

  /* Every view is a container of its own: the layout rules below ask how much room the VIEW has (sidebar, rail and page padding already taken off). */
  [data-view] { display: block; container-type: inline-size; min-width: 0; }
  /* A view that is not showing collapses to nothing (the stack skips its contents). The browser counts that as a huge layout shift when nobody touched the
     page, as with the system Back button (0.706 measured); hidden boxes are not counted. */
  [data-view][inert] { visibility: hidden; }
  .page { display: grid; gap: var(--lu-space-5); min-width: 0; }
  .page.text { width: 100%; max-width: var(--lu-content-max-text); margin-inline: auto; }
  /* The first section of a page has no hairline or gap above it (a section draws one when it is not the first child, and a page starts with its hidden heading). */
  .flush { margin-top: 0; padding-top: 0; border-top: 0; }

  /* ---- tiles: a button around a picture, a name and a line ---- */
  .tile { display: grid; align-content: start; gap: var(--lu-space-1); min-width: 0; padding: 0 0 var(--lu-space-2); border: 0; border-radius: var(--lu-radius-tile); color: var(--lu-ink); background: transparent; font: inherit; text-align: start; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .picture { position: relative; display: block; margin-bottom: var(--lu-space-1); }
  /* Press feedback is a wash over the picture, shown in the first frame and fading out on release. Nothing moves. */
  .picture::after { content: ""; position: absolute; inset: 0; border-radius: var(--lu-radius-tile); background: var(--lu-material-press-wash); opacity: 0; pointer-events: none; transition: opacity var(--lu-motion-label) var(--lu-ease); }
  .tile:is(:active, [data-pressed]) .picture::after { opacity: 1; transition: none; }
  .badges { position: absolute; inset-block-start: var(--lu-space-2); inset-inline-start: var(--lu-space-2); display: flex; flex-wrap: wrap; gap: var(--lu-space-1); max-width: calc(100% - var(--lu-space-4)); pointer-events: none; }
  .name { padding-inline: var(--lu-space-1); overflow: hidden; font: 600 var(--lu-type-body)/1.3 var(--lu-font); text-overflow: ellipsis; white-space: nowrap; }
  .sub { padding-inline: var(--lu-space-1); overflow: hidden; color: var(--lu-ink-2); font: 400 var(--lu-type-label)/1.35 var(--lu-font); text-overflow: ellipsis; white-space: nowrap; }
  @media (hover: hover) and (pointer: fine) { .tile:hover { background: var(--lu-material-hover-wash); } }
  @media (prefers-reduced-motion: reduce) { .picture::after { transition: none; } }

  /* ---- Library ---- */
  .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lu-space-3) var(--lu-space-4); }
  .toolbar spec-lu-segmented { flex: 1 1 280px; }
  .more { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--lu-space-3); margin-top: var(--lu-space-5); color: var(--lu-ink-2); font: 400 var(--lu-type-label)/1.4 var(--lu-font); font-variant-numeric: tabular-nums; }

  /* ---- Insights ---- */
  .thumb { width: 56px; --lu-image-radius: var(--lu-radius-control); }
  .controls { display: grid; gap: var(--lu-space-4); max-width: 560px; }
  .buttons { display: flex; flex-wrap: wrap; gap: var(--lu-space-2); }
  .preview { min-height: calc(var(--lu-row) * 3); }
  .note { margin: 0; color: var(--lu-ink-2); font: 400 var(--lu-type-label)/1.45 var(--lu-font); }

  /* ---- the detail page: media and facts side by side when there is room, stacked when there is not ---- */
  .visit { display: grid; gap: var(--lu-space-5); width: 100%; max-width: 1440px; margin-inline: auto; }
  .hero { position: relative; min-width: 0; }
  .side { display: grid; gap: var(--lu-space-4); min-width: 0; }
  @container (min-width: 900px) { .visit { grid-template-columns: minmax(0, 1.45fr) minmax(280px, .8fr); align-items: start; } }
  @media (max-height: 500px) { @container (min-width: 640px) { .visit { grid-template-columns: minmax(0, 1.1fr) minmax(260px, .9fr); align-items: start; } } }
  .title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--lu-space-4); }
  .title-row h2 { margin: 0; font: 620 var(--lu-type-title)/1.2 var(--lu-font); letter-spacing: -.015em; overflow-wrap: anywhere; }
  .title-row p { margin: var(--lu-space-1) 0 0; color: var(--lu-ink-2); font: 400 var(--lu-type-label)/1.4 var(--lu-font); }
  .score { flex: none; color: var(--lu-ink); font: 350 var(--lu-type-display)/1 var(--lu-font); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .score small { color: var(--lu-ink-3); font-size: var(--lu-type-label); }
  .tags, .actions { display: flex; flex-wrap: wrap; gap: var(--lu-space-2); }

  /* ---- sheets: the species sheet, the picker, the shortcut list ---- */
  .sheet-body { display: grid; gap: var(--lu-space-2); }
  .intro { display: flex; flex-wrap: wrap; align-items: center; gap: var(--lu-space-4); }
  .intro spec-lu-image { flex: 0 1 220px; min-width: 0; }
  .total { display: grid; flex: 1 1 96px; gap: var(--lu-space-1); text-align: center; }
  .total strong { font: 350 var(--lu-type-display)/1 var(--lu-font); font-variant-numeric: tabular-nums; }
  .total span { color: var(--lu-ink-2); font-size: var(--lu-type-caption); }
  .search { box-sizing: border-box; width: 100%; min-height: var(--lu-target); margin: 0 0 var(--lu-space-2); padding: 0 var(--lu-space-4); border: 1px solid var(--lu-edge-raised); border-radius: var(--lu-radius-control); color: var(--lu-ink); background: var(--lu-tile); font: 400 var(--lu-type-body) var(--lu-font); }
  .search::placeholder { color: var(--lu-ink-3); }
  .special { display: flex; flex-wrap: wrap; gap: var(--lu-space-2); }
  kbd { display: inline-grid; min-width: calc(var(--lu-type-caption) * 2); place-items: center; padding: 0 var(--lu-space-2); border: 1px solid var(--lu-edge-raised); border-radius: var(--lu-radius-control); background: var(--lu-glass-raised); font: 600 var(--lu-type-caption)/1.9 var(--lu-font); }

  /* ---- the app bar: on a phone three 48 px buttons leave the title no room, so the link out goes (the other two do something here) ---- */
  @container (max-width: 430px) { .link-out { display: none; } }

  /* ---- the strip that says the websocket is down ---- */
  spec-lu-state[slot="bottom"] { padding: 0 var(--lu-edge-x); }
`;
