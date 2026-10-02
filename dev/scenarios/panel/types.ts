/** The shapes the sample panel and its fake server agree on. Plain data only (it travels through `hass.callWS` and `swr`). */

export type Tab = "live" | "library" | "insights";
/** `visit` is the detail page: it belongs to no tab. */
export type Page = Tab | "visit";

/** What the address says: the page, the species whose sheet is open (`?s=`, Library only) and the visit (`?v=`). */
export interface Route {
  page: Page;
  species: string;
  visit: string;
}

/** `seen` = a camera caught it, `heard` = a microphone did. */
export type Kind = "seen" | "heard";
export type Group = "bird" | "mammal" | "other";
export type CameraState = "live" | "snapshot" | "weak" | "offline";
/** `auto` = the model's guess, `confirmed` = someone said "that's right", `corrected` = someone picked another species. */
export type Status = "auto" | "confirmed" | "corrected";

export interface Camera {
  id: string;
  name: string;
  state: CameraState;
  /** The newest visit seen by this camera, if any. */
  sighting: { visit: string; species: string; kind: Kind; at: number } | null;
}

export interface Species {
  id: string;
  name: string;
  group: Group;
  seen: boolean;
  heard: boolean;
  seenCount: number;
  heardCount: number;
  lastAt: number;
  lastCamera: string;
  lastKind: Kind;
  newThisYear: boolean;
}

export interface Suggestion {
  species: string;
  why: "usual" | "model" | "heard";
}

export interface Visit {
  id: string;
  species: string;
  group: Group;
  kind: Kind;
  cameraId: string;
  cameraName: string;
  startedAt: number;
  /** 0 to 1. */
  score: number;
  status: Status;
  suggestions: Suggestion[];
}

/** One page of a species' visits (`next` is the cursor of the following page, or null at the end). */
export interface VisitPage {
  items: Visit[];
  next: string | null;
}

export interface Health {
  detector: string;
  checksToday: number;
  averageMs: number;
  storageMB: number;
  budgetMB: number;
  corrections: number;
}

export interface Insights {
  /** Visits that may need a correction. */
  review: Visit[];
  health: Health;
}

/** The key each piece of data has in the `swr` cache. Keys are shared by every app on the Home Assistant address: start with the app's name. */
export const KEY = {
  cameras: "sample-panel/cameras",
  species: "sample-panel/species",
  insights: "sample-panel/insights",
  visit: (id: string): string => `sample-panel/visit/${id}`,
  visits: (species: string, kind: Kind): string => `sample-panel/visits/${kind}/${species}`,
} as const;
