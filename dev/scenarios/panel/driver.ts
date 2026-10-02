/** `window.__lu.demo`: what `dev/perf-check.mjs` (and anyone driving the page from a script) uses to operate the sample panel. Installed while a
 * panel is on the page, removed when it leaves. Small and stable on purpose: add to it, do not change what is here. */
import { closeTopLayer, layerDepth } from "../../../src/index.ts";
import { backend } from "./data.ts";

export interface DemoDriver {
  /** Resolves when the first data of the page you are on is painted (or its error is). */
  ready(): Promise<void>;
  /** `["live", "library", "insights"]` */
  destinations(): string[];
  /** The page showing: a destination id, or `"visit"` on the detail page. */
  current(): string;
  /** The navigation control to TAP, real pointer events included. `null` while the navigation is not drawn. */
  navItem(id: string): Element | null;
  /** What a tap on a tile does: opens the species sheet through the address (`?s=`). Without a name, the first tile's species. */
  openSpecies(name?: string): void;
  /** The n-th species tile of the Library (0 = the first one), or `null`. */
  speciesTile(index?: number): Element | null;
  /** Opens "What was it?" (a sheet with a history entry). */
  openPicker(): void;
  /** The app bar button that opens it. */
  pickerButton(): Element | null;
  /** The system Back button's effect on the top sheet that has a history entry. `false` when there was none. */
  closeTopLayer(): boolean;
  /** How many sheets with a history entry are open. The species sheet is not one of them: its entry is the address. */
  layerDepth(): number;
  /** Any sheet is open (species, "What was it?" or the shortcut list). */
  sheetOpen(): boolean;
  /** The page scroller: where it is scrolled to and how tall the whole page is (`scrollTop`, `scrollHeight`). */
  scrollRoot(): { top: number; height: number };
  /** How many species tiles the Library has drawn right now: 24 at first, 48 after "Show more". */
  speciesCount(): number;
  /** The next request to the fake server fails (once). `false` takes it back. */
  failNext(on: boolean): void;
  /** How often the panel rendered, which views are alive, which the view stack pushed out. */
  stats(): { renders: number; viewsMounted: string[]; evicted: string[] };
}

/** What only the panel can answer; the rest of the driver is the toolkit's own functions. */
export type DemoSurface = Omit<DemoDriver, "closeTopLayer" | "layerDepth" | "failNext">;

// The harness object gains one optional member. (Declaration merging into its class; nothing is added to the harness itself.)
declare module "../../harness-api.ts" {
  interface LuHarness {
    demo?: DemoDriver;
  }
}

/** Puts the driver on `window.__lu.demo`. Returns the function that takes it away again (only if it is still this one). */
export function installDriver(surface: DemoSurface): () => void {
  const lu = window.__lu;
  const driver: DemoDriver = {
    ...surface,
    closeTopLayer: () => closeTopLayer("back"),
    layerDepth,
    failNext: (on) => backend.failNext(on),
  };
  lu.demo = driver;
  return () => {
    if (lu.demo === driver) delete lu.demo;
  };
}
