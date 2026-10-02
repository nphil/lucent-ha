/* Derived from music-assistant/frontend src/layouts/default/Footer.vue:40-71 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md). Modified: the Vue `useElementSize` + `watchEffect` pair is a plain ResizeObserver; instead of one player-bar height on `<html>` it measures the sticky top block, the rail and the bottom dock and publishes `--lu-top-chrome`, `--lu-rail-w` and `--lu-bottom-bar` on the shell host (rounded up, removed again when the shell disconnects). */
import { chromeSizes, publishSizes } from "./chrome-metrics.js";
const browserFrames = {
    request: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle),
};
/** Measures the shell's chrome with a ResizeObserver and publishes the result as custom properties on the host,
 * so everything inside (the toast, sticky headers in views, focus scrolling) clears the bars by their real size
 * instead of a guessed one.
 *
 * What the shell changes itself (a render, a layout switch) is measured and published at once by `sync()`. What the
 * observer reports later (a strip that grew) is published one frame later, from a frame callback: an observer callback
 * must not change layout, because a panel whose content follows these variables would move an observed element in the
 * middle of the delivery and the browser would log "ResizeObserver loop completed with undelivered notifications". */
export class ChromeMeter {
    constructor(host, read, frames = browserFrames) {
        this._watched = [];
        this._published = null;
        this._frame = null;
        this._host = host;
        this._read = read;
        this._frames = frames;
    }
    /** Call after every render: starts watching the regions that are rendered now, stops watching the ones that went
     * away, and publishes at once when the set of regions or the nav mode changed (the observer only reports size changes). */
    sync() {
        const { mode, regions } = this._read();
        const rendered = [regions.top, regions.rail, regions.dock].filter((element) => element !== null);
        const unchanged = mode === this._mode && rendered.length === this._watched.length && rendered.every((element, index) => element === this._watched[index]);
        if (unchanged)
            return;
        if (typeof ResizeObserver !== "undefined") {
            this._observer ??= new ResizeObserver(() => this._publishNextFrame());
            this._observer.disconnect();
            for (const element of rendered)
                this._observer.observe(element);
        }
        this._watched = rendered;
        this._mode = mode;
        this.measure();
    }
    /** Reads the sizes and publishes them (only the values that changed are written). */
    measure() {
        this._cancelFrame();
        const { mode, regions } = this._read();
        const size = (element, axis) => (element ? element.getBoundingClientRect()[axis] : 0);
        const sizes = chromeSizes(mode, { top: size(regions.top, "height"), rail: size(regions.rail, "width"), dock: size(regions.dock, "height") });
        this._published = publishSizes(this._host.style, sizes, this._published);
    }
    _publishNextFrame() {
        if (this._frame !== null)
            return;
        this._frame = this._frames.request(() => {
            this._frame = null;
            this.measure();
        });
    }
    _cancelFrame() {
        if (this._frame === null)
            return;
        this._frames.cancel(this._frame);
        this._frame = null;
    }
    /** Stops watching and removes the published properties (the token defaults apply again). */
    disconnect() {
        this._cancelFrame();
        this._observer?.disconnect();
        this._watched = [];
        this._mode = undefined;
        this._published = publishSizes(this._host.style, null, this._published);
    }
}
