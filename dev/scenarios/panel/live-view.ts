/** Live: a grid of camera tiles. Each tile is a plain button around a `lu-image` poster with status chips on top of the picture. */
import { html } from "lit";
import type { TemplateResult } from "lit";
import { repeat } from "lit/directives/repeat.js";
import type { SwrSnapshot } from "../../../src/index.ts";
import { ago, errorText, picture } from "./data.ts";
import type { Camera, CameraState } from "./types.ts";

/** What a camera's state is called, and which chip kind draws it (every chip kind except neutral also carries an icon). */
const STATUS: Record<CameraState, { kind: string; label: string }> = {
  live: { kind: "live", label: "Live" },
  snapshot: { kind: "info", label: "Snapshot" },
  weak: { kind: "warning", label: "Weak signal" },
  offline: { kind: "danger", label: "Offline" },
};

/** The widest layout puts four cameras in a row: those pictures load at once, the rest when they come near the screen. */
const FIRST_ROW = 4;

export interface LiveProps {
  cameras: SwrSnapshot<Camera[]>;
  onOpen(camera: Camera): void;
  onRetry(): void;
}

function cameraTile(camera: Camera, index: number, onOpen: (camera: Camera) => void): TemplateResult {
  const status = STATUS[camera.state];
  const last = camera.sighting ? `${camera.sighting.species} · ${ago(camera.sighting.at)}` : "No sightings today";
  return html`<button class="tile" type="button" data-demo="camera-tile" aria-label=${`${camera.name}, ${status.label.toLowerCase()}. ${last}`} @click=${() => onOpen(camera)}>
    <span class="picture">
      <spec-lu-image .src=${picture(`camera:${camera.id}`, camera.name)} ratio="16/9" priority=${index < FIRST_ROW ? "high" : "auto"} alt=""></spec-lu-image>
      <span class="badges"><spec-lu-chip overlay kind=${status.kind} label=${status.label}></spec-lu-chip></span>
    </span>
    <span class="name">${camera.name}</span>
    <span class="sub">${last}</span>
  </button>`;
}

export function liveView({ cameras, onOpen, onRetry }: LiveProps): TemplateResult {
  const list = cameras.data;
  if (!list) {
    // Nothing to show yet: a skeleton with the geometry of the tiles, or the honest reason there are none.
    return html`<div class="page"><h2 class="sr-only">Live cameras</h2>${cameras.error
      ? html`<spec-lu-state kind="error" icon="mdi:cctv-off" heading="Couldn't load the cameras" .message=${errorText(cameras.error)} @lu-retry=${onRetry}></spec-lu-state>`
      : html`<spec-lu-state kind="loading" variant="tiles" tile="camera" ratio="16/9" count="4" heading="Loading cameras"></spec-lu-state>`}</div>`;
  }
  const online = list.filter((camera) => camera.state !== "offline").length;
  return html`<div class="page">
    <h2 class="sr-only">Live cameras</h2>
    <spec-lu-section class="flush" icon="mdi:cctv" heading="Cameras" .summary=${`${online} of ${list.length} online`} .state=${cameras.error ? "error" : "ready"} .count=${list.length} noun="cameras" empty="No cameras yet" @lu-retry=${onRetry}>
      <spec-lu-grid kind="camera" data-demo="live-grid">${repeat(list, (camera) => camera.id, (camera, index) => cameraTile(camera, index, onOpen))}</spec-lu-grid>
    </spec-lu-section>
  </div>`;
}
