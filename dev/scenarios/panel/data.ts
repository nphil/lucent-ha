/** The sample world and the fake server that answers for it. No network, no `Math.random()`, no real clock: the same page always shows the
 * same cameras, species and visits, and the same "4 min ago" texts, so screenshots can be compared and the perf tool can rely on it.
 *
 * Pure TypeScript (no `lit`, no DOM): the panel talks to it only through `hass.callWS({ type: "sample-panel/..." })`, exactly the way a real
 * panel talks to its integration. `SampleBackend.call()` waits 150 to 500 ms per call (a fixed sequence), fails when the websocket is down
 * and fails once when `failNext(true)` was called. */
import { formatAgo } from "../../../src/state/format-ago.ts";
import type { Camera, CameraState, Group, Health, Insights, Kind, Species, Status, Suggestion, Visit, VisitPage } from "./types.ts";

/** The sample world's "now": 1 October 2026, 16:45 UTC. Every "ago" text counts from here, whatever the real date is. */
export const NOW = Date.UTC(2026, 9, 1, 16, 45, 0);
const MINUTE = 60_000;

/** "4 min ago", "3 h ago", "yesterday", "Sep 24": counted from the sample world's `NOW`. */
export const ago = (then: number): string => formatAgo(then, NOW, "en");

/** Why a request failed, in a sentence. */
export const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const CLOCK = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
/** "Oct 1, 2026, 4:41 PM" (in UTC, so every machine prints the same). */
export const clock = (at: number): string => CLOCK.format(at);

// ---- the random numbers: a fixed seed, so nothing ever changes between runs --------------------------------------------------------

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

// ---- who lives in the sample world -------------------------------------------------------------------------------------------------

const BIRDS = [
  "Robin", "Blackbird", "Blue tit", "Great tit", "Coal tit", "Long-tailed tit", "Wren", "Dunnock", "House sparrow", "Chaffinch",
  "Goldfinch", "Greenfinch", "Bullfinch", "Nuthatch", "Great spotted woodpecker", "Green woodpecker", "Starling", "Magpie", "Jay", "Jackdaw",
  "Carrion crow", "Wood pigeon", "Collared dove", "Song thrush", "Mistle thrush", "Tawny owl", "Barn owl", "Sparrowhawk", "Little owl", "Grey heron",
];
const MAMMALS = ["Fox", "Hedgehog", "Badger", "Grey squirrel", "Red squirrel", "Rabbit", "Roe deer", "Stoat", "Wood mouse", "Bank vole", "Pipistrelle bat", "Domestic cat", "Mole", "Muntjac"];
const OTHERS = ["Common frog", "Common toad", "Slow worm", "Grass snake"];
/** Only a microphone ever catches these. */
const HEARD_ONLY: Record<string, true> = { "Tawny owl": true, "Barn owl": true, "Pipistrelle bat": true, "Song thrush": true, "Common frog": true };

const CAMERAS: readonly { name: string; state: CameraState }[] = [
  { name: "Garden", state: "live" }, { name: "Bird feeder", state: "live" }, { name: "Front door", state: "snapshot" }, { name: "Back fence", state: "live" },
  { name: "Pond", state: "weak" }, { name: "Shed", state: "live" }, { name: "Driveway", state: "live" }, { name: "Woodpile", state: "offline" },
  { name: "Orchard", state: "live" }, { name: "Hedge row", state: "snapshot" }, { name: "Patio", state: "live" }, { name: "Side gate", state: "weak" },
];

/** The 30 visits that exist, as "how many of which species, seen or heard". The first five are placed by hand below. */
const VISIT_POOL: readonly [species: string, kind: Kind, count: number][] = [
  ["Robin", "seen", 5], ["Robin", "heard", 4], ["Blackbird", "seen", 3], ["Blackbird", "heard", 3], ["Blue tit", "seen", 3], ["Blue tit", "heard", 1],
  ["Wren", "heard", 2], ["Fox", "seen", 1], ["Hedgehog", "seen", 2], ["Great tit", "heard", 1],
];

/** The visits placed by hand: the newest one is the model's weak guess ("What was it?" starts there), number 3 is the deep-link example. */
const FIRST_VISITS: readonly { species: string; kind: Kind; camera: string; status: Status; score: number }[] = [
  { species: "Robin", kind: "seen", camera: "Bird feeder", status: "auto", score: 0.62 },
  { species: "Blackbird", kind: "seen", camera: "Garden", status: "auto", score: 0.84 },
  { species: "Robin", kind: "seen", camera: "Bird feeder", status: "auto", score: 0.91 },
  { species: "Robin", kind: "heard", camera: "Garden", status: "auto", score: 0.88 },
  { species: "Fox", kind: "seen", camera: "Back fence", status: "confirmed", score: 0.95 },
];

/** What a species is worth without its concrete visits: the older sightings and the last time it was seen. The numbers on a species come from
 * this plus the visits that exist right now, so correcting, deleting and undoing always land on exactly the same numbers. */
interface Basis {
  seen: number;
  heard: number;
  lastAt: number;
  lastCamera: string;
  lastKind: Kind;
}

interface World {
  cameras: Camera[];
  species: Species[];
  visits: Visit[];
  basis: Record<string, Basis>;
  corrections: number;
  /** The next visit number. */
  nextVisit: number;
}

/** Works out a species' numbers from its basis and the visits that exist. */
function refreshSpecies(world: World, name: string): void {
  const item = world.species.find((candidate) => candidate.name === name);
  const basis = world.basis[name];
  if (!item || !basis) return;
  const own = world.visits.filter((visit) => visit.species === name).sort((a, b) => b.startedAt - a.startedAt);
  item.seenCount = basis.seen + own.filter((visit) => visit.kind === "seen").length;
  item.heardCount = basis.heard + own.filter((visit) => visit.kind === "heard").length;
  item.seen = item.seenCount > 0;
  item.heard = item.heardCount > 0;
  const newest = own[0];
  item.lastAt = newest?.startedAt ?? basis.lastAt;
  item.lastCamera = newest?.cameraName ?? basis.lastCamera;
  item.lastKind = newest?.kind ?? basis.lastKind;
}

function groupOf(name: string): Group {
  return BIRDS.includes(name) ? "bird" : MAMMALS.includes(name) ? "mammal" : "other";
}

/** Species the model tends to mix up, by name: the first two are "the model's other guesses", the third is "common here". */
const LOOKALIKES: Record<string, string[]> = {
  Robin: ["Dunnock", "Wren", "Blackbird"],
  Blackbird: ["Song thrush", "Starling", "Mistle thrush"],
  "Blue tit": ["Great tit", "Coal tit", "Long-tailed tit"],
  "Great tit": ["Blue tit", "Coal tit", "Nuthatch"],
  Wren: ["Dunnock", "Robin", "Coal tit"],
  Fox: ["Badger", "Domestic cat", "Roe deer"],
  Hedgehog: ["Mole", "Rabbit", "Badger"],
};

function suggestionsFor(visit: { species: string; kind: Kind }): Suggestion[] {
  const group = groupOf(visit.species);
  const same = [...BIRDS, ...MAMMALS, ...OTHERS].filter((name) => groupOf(name) === group);
  const at = same.indexOf(visit.species);
  const near = LOOKALIKES[visit.species] ?? [same[at + 1], same[at - 1], same[at + 2]].filter((name): name is string => name !== undefined);
  const list: Suggestion[] = near.slice(0, 3).map((species, index) => ({ species, why: index < 2 ? "model" : "usual" }));
  // A bird that was seen may also have been heard here.
  if (visit.kind === "seen" && group === "bird") list.push({ species: "Song thrush", why: "heard" });
  return list.filter((item, index) => item.species !== visit.species && list.findIndex((other) => other.species === item.species) === index);
}

function buildWorld(): World {
  const random = mulberry32(20261001);
  const names = [...BIRDS, ...MAMMALS, ...OTHERS];

  // The visits: five by hand, the rest shuffled from the pool, each a little further back in time.
  const pool: { species: string; kind: Kind }[] = [];
  for (const [species, kind, count] of VISIT_POOL) for (let index = 0; index < count; index += 1) pool.push({ species, kind });
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [pool[index], pool[other]] = [pool[other] as (typeof pool)[number], pool[index] as (typeof pool)[number]];
  }
  const visits: Visit[] = [];
  const cameraCount = CAMERAS.length;
  for (let number = 1; number <= FIRST_VISITS.length + pool.length; number += 1) {
    const fixed = FIRST_VISITS[number - 1];
    const entry = fixed ?? (pool[number - 1 - FIRST_VISITS.length] as (typeof pool)[number]);
    const cameraIndex = fixed ? CAMERAS.findIndex((camera) => camera.name === fixed.camera) : Math.floor(random() * cameraCount);
    const roll = random();
    const status: Status = fixed?.status ?? (roll < 0.6 ? "auto" : roll < 0.85 ? "confirmed" : "corrected");
    const score = fixed?.score ?? Math.round((0.52 + random() * 0.47) * 100) / 100;
    visits.push({
      id: String(number),
      species: entry.species,
      group: groupOf(entry.species),
      kind: entry.kind,
      cameraId: `c${cameraIndex + 1}`,
      cameraName: CAMERAS[cameraIndex]?.name ?? "Camera",
      startedAt: NOW - (4 + (number - 1) * 61 + Math.floor(random() * 20)) * MINUTE,
      score,
      status,
      suggestions: suggestionsFor(entry),
    });
  }

  // The species: invented (but fixed) older sightings, plus whatever the visits say.
  const basis: Record<string, Basis> = {};
  const species: Species[] = names.map((name) => {
    const group = groupOf(name);
    const heardOnly = HEARD_ONLY[name] === true;
    const seen = !heardOnly && (group !== "bird" || random() < 0.9);
    const heard = heardOnly || !seen || (group === "bird" && random() < 0.5);
    basis[name] = {
      seen: seen ? 1 + Math.floor(random() * 40) : 0,
      heard: heard ? 1 + Math.floor(random() * 25) : 0,
      lastAt: NOW - (32 * 60 + Math.floor(random() * 12 * 24 * 60)) * MINUTE,
      lastCamera: CAMERAS[Math.floor(random() * cameraCount)]?.name ?? "Garden",
      lastKind: seen ? "seen" : "heard",
    };
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      group,
      seen,
      heard,
      seenCount: 0,
      heardCount: 0,
      lastAt: 0,
      lastCamera: "",
      lastKind: "seen",
      newThisYear: name === "Muntjac" || name === "Grass snake" || name === "Little owl" || name === "Bullfinch",
    };
  });
  const world: World = { cameras: [], species, visits, basis, corrections: 12, nextVisit: visits.length + 1 };
  for (const name of names) refreshSpecies(world, name);
  species.sort((a, b) => b.lastAt - a.lastAt);

  world.cameras = CAMERAS.map((camera, index) => {
    const newest = visits.find((visit) => visit.cameraId === `c${index + 1}`);
    return {
      id: `c${index + 1}`,
      name: camera.name,
      state: camera.state,
      sighting: newest ? { visit: newest.id, species: newest.species, kind: newest.kind, at: newest.startedAt } : null,
    };
  });
  return world;
}

// ---- pictures and recordings (made in the page, nothing to download) ---------------------------------------------------------------

const pictures = new Map<string, string>();

/** Two letters for a name: "Blue tit" is BT, "Robin" is RO. */
function initials(label: string): string {
  const words = label.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}` : label.slice(0, 2)).toUpperCase();
}

/** A 4:3 picture as a data URL: a coloured gradient with the initials of `label`. The colour comes from `key`, so a thing always looks the same. */
export function picture(key: string, label: string): string {
  let url = pictures.get(key);
  if (!url) {
    const hue = hash(key) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 58% 56%)"/><stop offset="1" stop-color="hsl(${(hue + 48) % 360} 52% 30%)"/></linearGradient></defs>`
      + `<rect width="320" height="240" fill="url(#g)"/><circle cx="${70 + (hash(key) % 180)}" cy="${60 + (hash(`${key}!`) % 40)}" r="${46 + (hash(`${key}?`) % 24)}" fill="#fff" fill-opacity=".16"/>`
      + `<path d="M0 240 L96 150 L168 200 L236 140 L320 240 Z" fill="#000" fill-opacity=".22"/>`
      + `<text x="160" y="150" text-anchor="middle" font-family="sans-serif" font-size="84" font-weight="700" fill="#fff" fill-opacity=".88">${initials(label)}</text></svg>`;
    url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    pictures.set(key, url);
  }
  return url;
}

const recordings = new Map<number, string>();

/** A short two-note "call" as a WAV data URL (16-bit mono, quiet, soft edges). One per pitch, made when first asked for. */
function recording(pitch: number): string {
  let url = recordings.get(pitch);
  if (!url) {
    const rate = 6000;
    const count = Math.floor(rate * 1.2);
    const bytes = new Uint8Array(44 + count * 2);
    const view = new DataView(bytes.buffer);
    const text = (offset: number, value: string): void => {
      for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
    };
    text(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); text(8, "WAVE"); text(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, "data"); view.setUint32(40, count * 2, true);
    for (let index = 0; index < count; index += 1) {
      const frequency = Math.floor(index / (rate * 0.2)) % 2 === 0 ? pitch : pitch * 1.25;
      const edge = Math.min(1, index / 300, (count - index) / 300);
      view.setInt16(44 + index * 2, Math.round(Math.sin((2 * Math.PI * frequency * index) / rate) * 0.16 * 32767 * edge), true);
    }
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index] as number);
    url = `data:audio/wav;base64,${btoa(binary)}`;
    recordings.set(pitch, url);
  }
  return url;
}

/** The cleaned preview and the untouched original of a visit's recording (the original is a little lower, so the Original toggle is audible). */
export function recordingsOf(visit: Visit): { preview: string; original: string } {
  const pitch = 380 + (hash(visit.species) % 8) * 70;
  return { preview: recording(pitch), original: recording(Math.round(pitch * 0.88)) };
}

/** How long a recording lasts, as the list shows it. */
export const RECORDING_LENGTH = "0:01";

// ---- the fake server ---------------------------------------------------------------------------------------------------------------

type Message = Record<string, unknown> & { type: string };

/** How many visits of one species a page holds (small on purpose, so "Show more" has something to do). */
const PAGE_SIZE = { seen: 4, heard: 3 } as const;

/** Rotates through these when "simulate a new sighting" is pressed. */
const SIMULATED = ["Wren", "Robin", "Fox", "Blue tit", "Hedgehog"];

export class SampleBackend {
  /** Whether the websocket is up. While it is not, every call fails. The scenario points this at the harness's mock connection. */
  online: () => boolean = () => true;
  private world = buildWorld();
  private calls = 0;
  private simulated = 0;
  private failing = false;
  private readonly listeners = new Set<() => void>();

  /** The next call fails once (and only that one). */
  failNext(on: boolean): void {
    if (this.failing === on) return;
    this.failing = on;
    for (const listener of [...this.listeners]) listener();
  }

  get failArmed(): boolean {
    return this.failing;
  }

  /** Called when `failArmed` changes (the panel shows it). Returns the function that stops it. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Brings back the original world (deleted visits, corrections, simulated sightings). */
  reset(): void {
    this.world = buildWorld();
    this.simulated = 0;
  }

  /** The delay of call number `n`: 150 to 500 ms, the same sequence every run. */
  private delay(): number {
    this.calls += 1;
    return 150 + ((Math.imul(this.calls, 2654435761) >>> 0) % 351);
  }

  async call(message: Message): Promise<unknown> {
    await new Promise<void>((resolve) => setTimeout(resolve, this.delay()));
    if (!this.online()) throw new Error("Not connected to Home Assistant.");
    if (this.failing) {
      this.failNext(false);
      throw new Error("The sample server did not answer (you asked it to fail).");
    }
    const handler = this.handlers[message.type];
    if (!handler) throw new Error(`The sample server does not know "${message.type}".`);
    return structuredClone(handler(message));
  }

  /** Every message type the panel may send. */
  get types(): string[] {
    return Object.keys(this.handlers);
  }

  /** A visit by number; `"latest"` is the newest one (what the app bar's "What was it?" corrects). */
  private visitById(id: unknown): Visit | undefined {
    if (id === "latest") return [...this.world.visits].sort((a, b) => b.startedAt - a.startedAt || Number(b.id) - Number(a.id))[0];
    return this.world.visits.find((visit) => visit.id === String(id));
  }

  private refreshCameras(): void {
    for (const camera of this.world.cameras) {
      const newest = this.world.visits.filter((visit) => visit.cameraId === camera.id).sort((a, b) => b.startedAt - a.startedAt)[0];
      camera.sighting = newest ? { visit: newest.id, species: newest.species, kind: newest.kind, at: newest.startedAt } : null;
    }
  }

  private health(): Health {
    return { detector: "Wildlife detector 3.2", checksToday: 1840 + this.world.visits.length, averageMs: 38, storageMB: 412, budgetMB: 800, corrections: this.world.corrections };
  }

  /** Visits that may need a correction: the model's own guesses it was not sure of, newest first. */
  private review(): Visit[] {
    return this.world.visits.filter((visit) => visit.status === "auto" && visit.score < 0.75).sort((a, b) => b.startedAt - a.startedAt).slice(0, 12);
  }

  private readonly handlers: Record<string, (message: Message) => unknown> = {
    "sample-panel/cameras": (): Camera[] => this.world.cameras,

    "sample-panel/species": (): Species[] => [...this.world.species].sort((a, b) => b.lastAt - a.lastAt),

    "sample-panel/insights": (): Insights => ({ review: this.review(), health: this.health() }),

    "sample-panel/visits": (message): VisitPage => {
      const kind = message.kind === "heard" ? "heard" : "seen";
      const all = this.world.visits.filter((visit) => visit.species === message.species && visit.kind === kind).sort((a, b) => b.startedAt - a.startedAt);
      const start = Math.max(0, Number(message.before) || 0);
      const size = PAGE_SIZE[kind];
      return { items: all.slice(start, start + size), next: start + size < all.length ? String(start + size) : null };
    },

    "sample-panel/visit": (message): Visit | null => this.visitById(message.id) ?? null,

    /** Sets a visit's species and status: a correction, a confirmation and their Undo are all this one call. */
    "sample-panel/visit/set": (message): Visit => {
      const visit = this.visitById(message.id);
      if (!visit) throw new Error("This visit no longer exists.");
      const species = typeof message.species === "string" ? message.species : visit.species;
      const status = message.status === "confirmed" || message.status === "corrected" || message.status === "auto" ? message.status : visit.status;
      if (species !== visit.species) {
        const before = visit.species;
        visit.species = species;
        visit.group = groupOf(species);
        visit.suggestions = suggestionsFor(visit);
        refreshSpecies(this.world, before);
        refreshSpecies(this.world, species);
        this.world.corrections += 1;
      }
      visit.status = status;
      this.refreshCameras();
      return visit;
    },

    "sample-panel/visit/delete": (message): { id: string } => {
      const visit = this.visitById(message.id);
      if (!visit) throw new Error("This visit no longer exists.");
      this.world.visits = this.world.visits.filter((item) => item !== visit);
      refreshSpecies(this.world, visit.species);
      this.refreshCameras();
      return { id: visit.id };
    },

    "sample-panel/review/confirm": (): { confirmed: number } => {
      const review = this.review();
      for (const visit of review) visit.status = "confirmed";
      return { confirmed: review.length };
    },

    /** A new animal shows up "just now": the same five species in turn. */
    "sample-panel/simulate": (): Visit => {
      const name = SIMULATED[this.simulated % SIMULATED.length] ?? "Wren";
      this.simulated += 1;
      const camera = this.world.cameras[this.simulated % 7] ?? this.world.cameras[0];
      const kind: Kind = HEARD_ONLY[name] === true ? "heard" : "seen";
      const visit: Visit = {
        id: String(this.world.nextVisit),
        species: name,
        group: groupOf(name),
        kind,
        cameraId: camera?.id ?? "c1",
        cameraName: camera?.name ?? "Garden",
        startedAt: NOW,
        score: 0.9,
        status: "auto",
        suggestions: suggestionsFor({ species: name, kind }),
      };
      this.world.nextVisit += 1;
      this.world.visits.push(visit);
      refreshSpecies(this.world, name);
      this.refreshCameras();
      return visit;
    },

    "sample-panel/reset": (): { ok: true } => {
      this.reset();
      return { ok: true };
    },
  };
}

/** The one fake server of the page. It keeps its state when the panel element is re-created, like a real server would. */
export const backend = new SampleBackend();
