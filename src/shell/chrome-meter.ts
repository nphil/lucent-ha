/* Derived from music-assistant/frontend src/layouts/default/Footer.vue:40-71 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md). Modified: the Vue `useElementSize` + `watchEffect` pair is a plain ResizeObserver; instead of one player-bar height on `<html>` it measures the sticky top block, the rail and the bottom dock and publishes `--lu-top-chrome`, `--lu-rail-w` and `--lu-bottom-bar` on the shell host (rounded up, removed again when the shell disconnects). */
import { chromeSizes, publishSizes } from "./chrome-metrics.ts";
import type { ChromeSizes } from "./chrome-metrics.ts";
import type { NavMode } from "../tokens/profile-model.ts";

/** The elements the shell renders right now for each piece of chrome (`null` = not rendered). */
export interface ChromeRegions {
  /** The sticky top block (app bar, and the pills row when there is one). */
  top: Element | null;
  rail: Element | null;
  /** The sticky block at the bottom (the `bottom` strip and the bottom bar). */
  dock: Element | null;
}

/** What the meter asks the shell for: the nav mode in force and the regions it renders. */
export interface ChromeState {
  mode: NavMode;
  regions: ChromeRegions;
}

/** Measures the shell's chrome with a ResizeObserver and publishes the result as custom properties on the host,
 * so everything inside (the toast, sticky headers in views, focus scrolling) clears the bars by their real size
 * instead of a guessed one. */
export class ChromeMeter {
  private readonly _host: HTMLElement;
  private readonly _read: () => ChromeState;
  private _observer: ResizeObserver | undefined;
  private _watched: Element[] = [];
  private _mode: NavMode | undefined;
  private _published: ChromeSizes | null = null;

  constructor(host: HTMLElement, read: () => ChromeState) {
    this._host = host;
    this._read = read;
  }

  /** Call after every render: starts watching the regions that are rendered now, stops watching the ones that went
   * away, and publishes at once when the set of regions or the nav mode changed (the observer only reports size changes). */
  sync(): void {
    const { mode, regions } = this._read();
    const rendered = [regions.top, regions.rail, regions.dock].filter((element): element is Element => element !== null);
    const unchanged = mode === this._mode && rendered.length === this._watched.length && rendered.every((element, index) => element === this._watched[index]);
    if (unchanged) return;
    if (typeof ResizeObserver !== "undefined") {
      this._observer ??= new ResizeObserver(() => this.measure());
      this._observer.disconnect();
      for (const element of rendered) this._observer.observe(element);
    }
    this._watched = rendered;
    this._mode = mode;
    this.measure();
  }

  /** Reads the sizes and publishes them (only the values that changed are written). */
  measure(): void {
    const { mode, regions } = this._read();
    const size = (element: Element | null, axis: "height" | "width"): number => (element ? element.getBoundingClientRect()[axis] : 0);
    const sizes = chromeSizes(mode, { top: size(regions.top, "height"), rail: size(regions.rail, "width"), dock: size(regions.dock, "height") });
    this._published = publishSizes(this._host.style, sizes, this._published);
  }

  /** Stops watching and removes the published properties (the token defaults apply again). */
  disconnect(): void {
    this._observer?.disconnect();
    this._watched = [];
    this._mode = undefined;
    this._published = publishSizes(this._host.style, null, this._published);
  }
}
