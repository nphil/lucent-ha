import { html, type TemplateResult } from "lit";
import { ImageUrlCache } from "../../src/image/image-cache.ts";
import type { RailItem } from "../../src/image/media-rail.ts";
import type { AudioListRow } from "../../src/audio/audio-model.ts";
import type { Specimen } from "../specimen-types.ts";

/* Everything here is generated in the page: SVG pictures, canvas PNGs and WAV tones. No network. */

/** A picture as a data URL: a two-colour gradient with a label, so ratio and cropping are visible. */
function art(hue: number, label: string, width = 320, height = 200): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 62% 64%)"/><stop offset="1" stop-color="hsl(${(hue + 55) % 360} 55% 36%)"/></linearGradient></defs>`
    + `<rect width="100%" height="100%" fill="url(#g)"/>`
    + `<circle cx="${width * 0.7}" cy="${height * 0.35}" r="${height * 0.22}" fill="rgba(255,255,255,.35)"/>`
    + `<path d="M0 ${height} L${width * 0.35} ${height * 0.55} L${width * 0.6} ${height * 0.8} L${width * 0.8} ${height * 0.6} L${width} ${height} Z" fill="rgba(0,0,0,.28)"/>`
    + `<rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="6"/>`
    + `<text x="${width / 2}" y="${height * 0.9}" text-anchor="middle" font-family="sans-serif" font-size="${height * 0.12}" fill="white">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const tones = new Map<number, string>();

/** A short sine tone as a WAV data URL (16-bit mono, soft edges, quiet). Made once per pitch. */
function tone(frequency: number): string {
  let url = tones.get(frequency);
  if (!url) tones.set(frequency, (url = makeTone(frequency, 2)));
  return url;
}

function makeTone(frequency: number, seconds: number): string {
  const rate = 8000;
  const count = Math.floor(rate * seconds);
  const bytes = new Uint8Array(44 + count * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string): void => { for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); };
  text(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i += 1) {
    const edge = Math.min(1, i / 400, (count - i) / 400);
    view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * 0.18 * 32767 * edge), true);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] as number);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** What a media route with `?w=` does: a picture exactly as wide as asked. Used through `authed` + a cache. */
async function resizingFetcher(url: string): Promise<Response> {
  const width = Number(new URL(url, location.href).searchParams.get("w")) || 320;
  const height = Math.round(width * 0.75);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d") as CanvasRenderingContext2D;
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#5a9bd5");
  gradient.addColorStop(1, "#d57a5a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(255,255,255,.7)";
  context.lineWidth = Math.max(2, width / 80);
  context.strokeRect(0, 0, width, height);
  context.fillStyle = "white";
  context.font = `${Math.round(width / 6)}px sans-serif`;
  context.textAlign = "center";
  context.fillText(`${width}w`, width / 2, height / 2 + width / 20);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((made) => resolve(made as Blob), "image/png"));
  return new Response(blob);
}

const sizedCache = new ImageUrlCache({ fetcher: resizingFetcher });
/** Never answers: a picture that stays "loading". */
const pendingCache = new ImageUrlCache({ fetcher: () => new Promise<Response>(() => {}) });

const grid = "display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:var(--lu-space-3)";
const note = "margin:var(--lu-space-1) 0 0;color:var(--lu-ink-2);font-size:var(--lu-type-caption)";

const caption = (text: string): TemplateResult => html`<p style=${note}>${text}</p>`;

/** After a sized picture loaded, write how big it is next to how big its box is. */
function reportSize(event: Event): void {
  const image = event.target as HTMLElement;
  const img = image.shadowRoot?.querySelector("img");
  const out = image.parentElement?.querySelector<HTMLElement>("[data-size]");
  if (!img || !out) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const need = Math.round(image.getBoundingClientRect().width * dpr);
  out.textContent = `box ${Math.round(image.getBoundingClientRect().width)} px x ${dpr} = ${need}; got ${img.naturalWidth}`;
}

const image: Specimen[] = [
  {
    id: "image-states",
    title: "Image: loaded, loading, error with fallback, custom fallback",
    group: "image",
    size: "wide",
    render: () => html`<div style=${grid}>
      <div><spec-lu-image src=${art(210, "loaded")} alt="A generated landscape"></spec-lu-image>${caption("Loaded")}</div>
      <div><spec-lu-image src="/pending.jpg" authed .cache=${pendingCache} alt=""></spec-lu-image>${caption("Loading (placeholder only)")}</div>
      <div><spec-lu-image src="data:image/png;base64,AAAA" alt="Broken on purpose"></spec-lu-image>${caption("Error: retried once, then the default fallback")}</div>
      <div><spec-lu-image src="data:image/png;base64,AAAA" alt="Kestrel (no photo)"><span slot="fallback" style="font-size:var(--lu-type-title);font-weight:600;color:var(--lu-ink-2)">KE</span></spec-lu-image>${caption("Error with its own fallback slot")}</div>
      <div><spec-lu-image alt=""></spec-lu-image>${caption("No src (placeholder)")}</div>
    </div>`,
  },
  {
    id: "image-ratios",
    title: "Image: ratios and fit",
    group: "image",
    size: "wide",
    render: () => html`<div style=${grid}>
      <div><spec-lu-image src=${art(20, "1/1", 300, 300)} ratio="1/1" alt=""></spec-lu-image>${caption("1/1")}</div>
      <div><spec-lu-image src=${art(90, "4/3")} alt=""></spec-lu-image>${caption("4/3 (default)")}</div>
      <div><spec-lu-image src=${art(150, "16/10")} ratio="16/10" alt=""></spec-lu-image>${caption("16/10")}</div>
      <div><spec-lu-image src=${art(280, "3/4", 300, 400)} ratio="3/4" alt=""></spec-lu-image>${caption("3/4 portrait")}</div>
      <div><spec-lu-image src=${art(330, "wide picture in a 1/1 box", 640, 200)} ratio="1/1" fit="contain" alt=""></spec-lu-image>${caption("fit=contain")}</div>
      <div><spec-lu-image src=${art(330, "wide picture in a 1/1 box", 640, 200)} ratio="1/1" alt=""></spec-lu-image>${caption("fit=cover")}</div>
    </div>`,
  },
  {
    id: "image-sized",
    title: "Image: sized URLs (widths 160/320/640), first row high priority",
    group: "image",
    size: "wide",
    render: () => html`<div data-sized-grid style=${grid}>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((index) => html`<div>
        <spec-lu-image src=${`/media/species-${index}.jpg`} .widths=${[160, 320, 640]} authed .cache=${sizedCache} priority=${index < 2 ? "high" : "auto"} alt="" @lu-image-load=${reportSize}></spec-lu-image>
        <p style=${note} data-size>waiting</p>
      </div>`)}
    </div>`,
  },
];

const palette = [210, 20, 150, 280, 330, 60, 180, 250, 100, 0];
const railItems = (kind: "play" | "badge"): RailItem[] => palette.map((hue, index) => ({
  id: `visit-${index}`,
  image: art(hue, `Visit ${index + 1}`, 320, 200),
  title: ["Just now", "12 min ago", "Today, 6:40", "Today, 5:15", "Yesterday", "Mon", "Sun", "Sat", "Fri", "Thu"][index] ?? "",
  caption: index % 3 === 2 ? undefined : ["Backyard feeder", "Front door", "Garden"][index % 3],
  label: `Visit ${index + 1}`,
  ...(kind === "play" ? { play: index % 2 === 0, badge: index % 2 ? "Heard" : undefined, badgeIcon: index % 2 ? "mdi:waveform" : undefined } : { badge: ["Robin", "Wren", "Blue tit", "Unknown"][index % 4], badgeIcon: index % 4 === 3 ? undefined : "mdi:bird" }),
}));

const rails: Specimen[] = [
  {
    id: "media-rail",
    title: "Media rail: play glyphs and badges, N.5 tiles peek",
    group: "image",
    size: "wide",
    render: () => html`<spec-lu-media-rail .items=${railItems("play")} data-rail></spec-lu-media-rail>
      <spec-lu-media-rail style="margin-top:var(--lu-space-4)" .items=${railItems("badge")}></spec-lu-media-rail>`,
  },
  {
    id: "media-rail-more",
    title: "Media rail: Show more tile, loading more",
    group: "image",
    size: "wide",
    render: () => html`<spec-lu-media-rail .items=${railItems("play").slice(0, 5)} more></spec-lu-media-rail>
      <spec-lu-media-rail style="margin-top:var(--lu-space-4)" .items=${railItems("play").slice(0, 5)} more loading></spec-lu-media-rail>`,
  },
  {
    id: "media-rail-loading",
    title: "Media rail: loading (static placeholders)",
    group: "image",
    size: "wide",
    render: () => html`<spec-lu-media-rail loading></spec-lu-media-rail>`,
  },
];

const audioRows = (): AudioListRow[] => [
  { id: "a1", src: tone(440), title: "Today, 6:40 AM", caption: "Backyard", meta: "92%", label: "recording from 6:40 AM at Backyard" },
  { id: "a2", src: tone(520), fallback: tone(330), title: "Today, 5:15 AM", caption: "Front door", mark: "Cleaned", meta: "81%", label: "cleaned recording from 5:15 AM at Front door" },
  { id: "a3", src: "data:audio/wav;base64,AAAA", fallback: tone(392), title: "Yesterday, 7:02 PM", caption: "Preview broken, plays the original", mark: "Cleaned", label: "recording from yesterday 7:02 PM" },
  { id: "a4", src: "data:audio/wav;base64,AAAA", title: "Yesterday, 4:30 PM", caption: "Garden", label: "recording from yesterday 4:30 PM" },
  { id: "a5", src: null, title: "Mon, 9:12 AM", label: "recording from Monday 9:12 AM" },
];

const audio: Specimen[] = [
  {
    id: "audio-player",
    title: "Audio player: ready, Original toggle, error",
    group: "audio",
    size: "wide",
    render: () => html`<div style="display:grid;gap:var(--lu-space-5)">
      <div><spec-lu-audio-player src=${tone(440)} label="recording from 6:40 AM at Backyard"></spec-lu-audio-player>${caption("Ready (nothing downloads before play)")}</div>
      <div><spec-lu-audio-player src=${tone(520)} original=${tone(330)} mark="Cleaned" caption="Noise removed" label="recording from 5:15 AM at Front door"></spec-lu-audio-player>${caption("Cleaned preview with an Original toggle")}</div>
      <div><spec-lu-audio-player src="data:audio/wav;base64,AAAA" original=${tone(392)} mark="Cleaned" label="recording from yesterday"></spec-lu-audio-player>${caption("Preview broken: falls back to the original by itself")}</div>
      <div><spec-lu-audio-player src="data:audio/wav;base64,AAAA" label="recording that is gone"></spec-lu-audio-player>${caption("Error: honest message with Try again")}</div>
    </div>`,
  },
  {
    id: "audio-list",
    title: "Audio list: one shared audio, fallback, error, no recording",
    group: "audio",
    size: "wide",
    render: () => html`<spec-lu-audio-list .rows=${audioRows()} more></spec-lu-audio-list>`,
  },
];

export const specimens: Specimen[] = [...image, ...rails, ...audio];
