import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { Scheduler } from "../core/throttle.js";
import type { ReconnectState } from "./reconnect.js";
import type { HomeAssistant } from "./types.js";
export interface ReconnectControllerOptions {
    /** The panel's current `hass`. A function, because `hass` is replaced on every Home Assistant update. */
    getHass(): HomeAssistant | undefined;
    /** How long a dropped connection is tolerated before it counts as lost (default 10 000 ms). */
    graceMs?: number;
    clock?: Scheduler;
}
/** Lit controller around `ReconnectGrace`: follows Home Assistant's websocket and asks the host to re-render when
 * `state` changes. Listens only to the websocket connection's own events (removed when the host disconnects).
 *
 *     private _link = new ReconnectController(this, { getHass: () => this.hass });
 *     // render(): this._link.state === "grace" ? quiet strip : this._link.state === "lost" ? offline state : nothing */
export declare class ReconnectController implements ReactiveController {
    private _host;
    private _options;
    private _grace;
    private _connection;
    private _onDisconnected;
    private _onReady;
    constructor(host: ReactiveControllerHost, options: ReconnectControllerOptions);
    /** "connected" while the websocket is up (and before anything is known), "grace" for the first `graceMs` after it
     * dropped, "lost" after that. */
    get state(): ReconnectState;
    /** When the websocket was last known to be up (ms since the epoch); "now" while connected. */
    get lastConnectedAt(): number;
    hostConnected(): void;
    hostUpdate(): void;
    hostDisconnected(): void;
    /** Reads `hass` again: re-attaches to a new connection object and reports the flag Home Assistant keeps. */
    private _follow;
    private _bind;
}
