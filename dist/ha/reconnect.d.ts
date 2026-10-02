import type { Scheduler } from "../core/throttle.js";
/** `connected`: websocket up. `grace`: it dropped less than `graceMs` ago, keep showing the last data and a quiet
 * "reconnecting" strip. `lost`: the grace window ran out, show the offline/stale state with a Retry. */
export type ReconnectState = "connected" | "grace" | "lost";
export interface ReconnectGraceOptions {
    /** How long a dropped connection is tolerated before it counts as lost (default 10 000 ms). */
    graceMs?: number;
    clock?: Scheduler;
    /** Called whenever `state` changes (never for a repeat of the same state). */
    onChange?(state: ReconnectState): void;
    /** Receives an error thrown by `onChange` (default: rethrown from a microtask so the console shows it). */
    onError?(error: unknown): void;
}
/** Turns "the websocket is up / down" reports into a calm state: a blip shorter than the grace window never reaches
 * `lost`, so a camera grid does not blank every time Wi-Fi hiccups. Feed it every report; repeats are harmless. */
export declare class ReconnectGrace {
    private _state;
    private _graceMs;
    private _clock;
    private _onChange;
    private _onError;
    private _timer;
    private _lastConnected;
    private _disposed;
    constructor(options?: ReconnectGraceOptions);
    get state(): ReconnectState;
    /** When the connection was last known to be up (ms since the epoch): "now" while connected, the moment it dropped
     * otherwise. For a "last updated 12 s ago" line. */
    get lastConnectedAt(): number;
    /** Reports whether the websocket is up right now. */
    update(connected: boolean): void;
    /** Stops the timer; later reports are ignored. */
    dispose(): void;
    private _stopTimer;
    private _set;
}
