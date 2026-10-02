import { html } from "lit";
import type { Specimen } from "../specimen-types.ts";

/** Specimens of the controls slice: button, chip, segmented, stepper, slider, hold-button. */

const caption = (text: string) => html`<p style="margin:var(--lu-space-4) 0 var(--lu-space-2);color:var(--lu-ink-2);font:600 var(--lu-type-caption)/1.3 var(--lu-font);text-transform:uppercase;letter-spacing:.04em">${text}</p>`;
const row = "display:flex;flex-wrap:wrap;gap:var(--lu-space-2);align-items:center";

const PHOTO = "linear-gradient(135deg,#3b6b4a 0%,#c9b27c 45%,#4a5c8a 100%)";

const TIME_RANGES = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
];
const SPECIES_FILTER = [
  { value: "all", label: "All", count: 128 },
  { value: "birds", label: "Birds", count: 96 },
  { value: "mammals", label: "Mammals", count: 31 },
];
const FIVE = [
  { value: "1", label: "Live" },
  { value: "2", label: "Today" },
  { value: "3", label: "Week" },
  { value: "4", label: "Month" },
  { value: "5", label: "Year" },
];
const FIVE_COUNTS = [
  { value: "all", label: "All", count: 128 },
  { value: "birds", label: "Birds", count: 96, icon: "mdi:bird" },
  { value: "mammals", label: "Mammals", count: 31, icon: "mdi:paw" },
  { value: "insects", label: "Insects", count: 1 },
  { value: "other", label: "Other", count: 0 },
];

export const specimens: Specimen[] = [
  {
    id: "button-kinds",
    title: "Button: kinds and shapes",
    group: "controls",
    render: () => html`<div data-spec="button-kinds">
      ${caption("Pill with text")}
      <div style=${row}>
        <spec-lu-button kind="primary" label="Save"></spec-lu-button>
        <spec-lu-button kind="secondary" label="Cancel"></spec-lu-button>
        <spec-lu-button kind="danger" label="Delete"></spec-lu-button>
        <spec-lu-button kind="quiet" label="Skip"></spec-lu-button>
      </div>
      ${caption("With icon")}
      <div style=${row}>
        <spec-lu-button kind="primary" icon="mdi:content-save" label="Save"></spec-lu-button>
        <spec-lu-button kind="secondary" icon="mdi:refresh" label="Refresh"></spec-lu-button>
        <spec-lu-button kind="danger" icon="mdi:delete" label="Delete"></spec-lu-button>
        <spec-lu-button kind="quiet" icon="mdi:filter-variant" label="Filter"></spec-lu-button>
      </div>
      ${caption("Icon only (round, named)")}
      <div style=${row}>
        <spec-lu-button kind="primary" icon-only icon="mdi:plus" label="Add"></spec-lu-button>
        <spec-lu-button kind="secondary" icon-only icon="mdi:cog" label="Settings"></spec-lu-button>
        <spec-lu-button kind="danger" icon-only icon="mdi:delete" label="Delete"></spec-lu-button>
        <spec-lu-button kind="quiet" icon-only icon="mdi:dots-vertical" label="More"></spec-lu-button>
      </div>
      ${caption("Disabled")}
      <div style=${row}>
        <spec-lu-button kind="primary" label="Save" disabled></spec-lu-button>
        <spec-lu-button kind="secondary" label="Cancel" disabled></spec-lu-button>
        <spec-lu-button kind="danger" label="Delete" disabled></spec-lu-button>
        <spec-lu-button kind="quiet" label="Skip" disabled></spec-lu-button>
        <spec-lu-button kind="secondary" icon-only icon="mdi:cog" label="Settings" disabled></spec-lu-button>
      </div>
      ${caption("Loading (width stays)")}
      <div style=${row}>
        <spec-lu-button kind="primary" label="Saving" loading></spec-lu-button>
        <spec-lu-button kind="primary" icon="mdi:content-save" label="Save" loading></spec-lu-button>
        <spec-lu-button kind="secondary" label="Refresh" loading></spec-lu-button>
        <spec-lu-button kind="secondary" icon-only icon="mdi:refresh" label="Refreshing" loading></spec-lu-button>
      </div>
    </div>`,
  },
  {
    id: "button-edge",
    title: "Button: long label, link, stretched",
    group: "controls",
    render: () => html`<div data-spec="button-edge">
      ${caption("Long label in a narrow box")}
      <div style="max-width:200px"><spec-lu-button kind="primary" icon="mdi:content-save" label="Save all changes to the garden camera schedule"></spec-lu-button></div>
      ${caption("Link (renders an anchor)")}
      <div style=${row}>
        <spec-lu-button kind="secondary" icon="mdi:open-in-new" label="Open docs" href="#docs"></spec-lu-button>
        <spec-lu-button kind="secondary" label="Unavailable link" href="#docs" disabled></spec-lu-button>
      </div>
      ${caption("Stretched by its container")}
      <div style="display:grid"><spec-lu-button kind="primary" label="Continue" style="display:flex"></spec-lu-button></div>
    </div>`,
  },
  {
    id: "chip-passive",
    title: "Chip: passive badges and evidence",
    group: "controls",
    render: () => html`<div data-spec="chip-passive">
      ${caption("Kinds (icon + text)")}
      <div style=${row}>
        <spec-lu-chip label="Idle"></spec-lu-chip>
        <spec-lu-chip kind="positive" label="Online"></spec-lu-chip>
        <spec-lu-chip kind="warning" label="Low battery"></spec-lu-chip>
        <spec-lu-chip kind="danger" label="Offline"></spec-lu-chip>
        <spec-lu-chip kind="info" label="Updating"></spec-lu-chip>
        <spec-lu-chip kind="live" label="Live"></spec-lu-chip>
        <spec-lu-chip kind="positive" label="Visits" count=${12}></spec-lu-chip>
      </div>
      ${caption("Long text truncates in a narrow box")}
      <div style="max-width:160px"><spec-lu-chip kind="warning" label="Camera battery is very low right now"></spec-lu-chip></div>
      ${caption("Evidence badges on a photo (reading surface)")}
      <div style=${`display:flex;gap:var(--lu-space-1);padding:var(--lu-space-3);border-radius:var(--lu-radius-tile);background:${PHOTO}`}>
        <spec-lu-chip kind="evidence" overlay icon="mdi:microphone" label="Audio recorded"></spec-lu-chip>
        <spec-lu-chip kind="evidence" overlay icon="mdi:image-multiple" label="Photos" count=${5}></spec-lu-chip>
        <spec-lu-chip kind="evidence" overlay icon="mdi:video" label="Video clip" count=${2}></spec-lu-chip>
        <spec-lu-chip kind="positive" overlay label="Identified"></spec-lu-chip>
      </div>
    </div>`,
  },
  {
    id: "chip-interactive",
    title: "Chip: filter chips and chip-buttons (48px)",
    group: "controls",
    render: () => html`<div data-spec="chip-interactive">
      ${caption("Filter chips: rest, selected, disabled")}
      <div style=${row}>
        <spec-lu-chip interactive icon="mdi:bird" label="Birds" count=${96}></spec-lu-chip>
        <spec-lu-chip interactive selected icon="mdi:paw" label="Mammals" count=${31}></spec-lu-chip>
        <spec-lu-chip interactive disabled icon="mdi:bug" label="Insects"></spec-lu-chip>
      </div>
      ${caption("Chip-button with two lines")}
      <div style=${row}>
        <spec-lu-chip interactive icon="mdi:cctv"><span>Garden camera</span><span slot="detail">Seen 3 min ago</span></spec-lu-chip>
        <spec-lu-chip interactive selected icon="mdi:cctv"><span>Feeder camera</span><span slot="detail">Seen a very long time ago in the morning</span></spec-lu-chip>
      </div>
      ${caption("Truncates in a narrow box")}
      <div style="max-width:170px"><spec-lu-chip interactive icon="mdi:cctv" label="Back garden camera by the fence"></spec-lu-chip></div>
    </div>`,
  },
  {
    id: "segmented",
    title: "Segmented: 2, 3 and 5 options, counts, disabled",
    group: "controls",
    size: "wide",
    render: () => html`<div data-spec="segmented">
      ${caption("Two options")}
      <spec-lu-segmented label="Time range" value="day" .options=${TIME_RANGES}></spec-lu-segmented>
      ${caption("Three options with counts")}
      <spec-lu-segmented label="Species filter" value="birds" .options=${SPECIES_FILTER}></spec-lu-segmented>
      ${caption("Five options (select under 360px wide)")}
      <spec-lu-segmented label="Period" value="2" .options=${FIVE}></spec-lu-segmented>
      ${caption("Five options with counts and icons")}
      <spec-lu-segmented label="Class" value="birds" .options=${FIVE_COUNTS}></spec-lu-segmented>
      ${caption("Disabled")}
      <spec-lu-segmented label="Time range" value="week" disabled .options=${TIME_RANGES}></spec-lu-segmented>
      ${caption("Narrow container (260px)")}
      <div style="max-width:260px"><spec-lu-segmented label="Period" value="3" .options=${FIVE}></spec-lu-segmented></div>
    </div>`,
  },
  {
    id: "stepper",
    title: "Stepper: integers, decimals, units, error, disabled",
    group: "controls",
    render: () => html`<div data-spec="stepper">
      <spec-lu-stepper label="Clip length" unit="s" value=${10} min=${1} max=${60} step=${1}></spec-lu-stepper>
      <spec-lu-stepper label="Temperature" unit="°C" value=${21.5} min=${16} max=${28} step=${0.5}></spec-lu-stepper>
      <spec-lu-stepper label="Threshold" value=${0.3} min=${0} max=${1} step=${0.1}></spec-lu-stepper>
      <spec-lu-stepper label="Keep recordings for a very long label that wraps" unit="days" value=${30} min=${1} max=${365} step=${1} error="Clips older than this are deleted."></spec-lu-stepper>
      <spec-lu-stepper label="Brightness" unit="%" value=${100} min=${0} max=${100} step=${5}></spec-lu-stepper>
      <spec-lu-stepper label="Locked" unit="min" value=${5} min=${0} max=${20} step=${1} disabled></spec-lu-stepper>
    </div>`,
  },
  {
    id: "slider",
    title: "Slider: percent, unit, decimals, disabled",
    group: "controls",
    size: "wide",
    render: () => html`<div data-spec="slider">
      <spec-lu-slider label="Volume" unit="%" value=${40} min=${0} max=${100} step=${1}></spec-lu-slider>
      <spec-lu-slider label="Temperature" unit="°C" value=${21.5} min=${16} max=${28} step=${0.5}></spec-lu-slider>
      <spec-lu-slider label="Threshold" value=${0.3} min=${0} max=${1} step=${0.1}></spec-lu-slider>
      <spec-lu-slider label="Fade time" unit="min" value=${0} min=${0} max=${30} step=${5}></spec-lu-slider>
      <spec-lu-slider label="Maximum" unit="%" value=${100} min=${0} max=${100} step=${1}></spec-lu-slider>
      <spec-lu-slider label="Locked" unit="%" value=${60} disabled></spec-lu-slider>
    </div>`,
  },
  {
    id: "hold-button",
    title: "Hold button: idle, danger with consequence, busy, disabled",
    group: "controls",
    render: () => html`<div data-spec="hold-button">
      <spec-lu-hold-button label="Hold to confirm" icon="mdi:content-save"></spec-lu-hold-button>
      ${caption("Danger with consequence")}
      <spec-lu-hold-button kind="danger" icon="mdi:delete" label="Hold to delete" confirm-label="Delete" consequence="Deletes 14 clips from Garden camera. This cannot be undone."></spec-lu-hold-button>
      ${caption("Busy")}
      <spec-lu-hold-button label="Hold to switch" busy></spec-lu-hold-button>
      ${caption("Disabled")}
      <spec-lu-hold-button label="Hold to switch" disabled></spec-lu-hold-button>
    </div>`,
  },
];
