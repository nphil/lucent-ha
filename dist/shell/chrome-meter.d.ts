import type { NavMode } from "../tokens/profile-model.js";
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
/** Where the observer's reports are published from: the next animation frame (the browser's own by default). */
export interface FrameScheduler {
    request(callback: () => void): number;
    cancel(handle: number): void;
}
/** Measures the shell's chrome with a ResizeObserver and publishes the result as custom properties on the host,
 * so everything inside (the toast, sticky headers in views, focus scrolling) clears the bars by their real size
 * instead of a guessed one.
 *
 * What the shell changes itself (a render, a layout switch) is measured and published at once by `sync()`. What the
 * observer reports later (a strip that grew) is published one frame later, from a frame callback: an observer callback
 * must not change layout, because a panel whose content follows these variables would move an observed element in the
 * middle of the delivery and the browser would log "ResizeObserver loop completed with undelivered notifications". */
export declare class ChromeMeter {
    private readonly _host;
    private readonly _read;
    private readonly _frames;
    private _observer;
    private _watched;
    private _mode;
    private _published;
    private _frame;
    constructor(host: HTMLElement, read: () => ChromeState, frames?: FrameScheduler);
    /** Call after every render: starts watching the regions that are rendered now, stops watching the ones that went
     * away, and publishes at once when the set of regions or the nav mode changed (the observer only reports size changes). */
    sync(): void;
    /** Reads the sizes and publishes them (only the values that changed are written). */
    measure(): void;
    private _publishNextFrame;
    private _cancelFrame;
    /** Stops watching and removes the published properties (the token defaults apply again). */
    disconnect(): void;
}
