import { realScheduler } from "../core/throttle.js";
import { ReconnectGrace } from "./reconnect.js";
/** Lit controller around `ReconnectGrace`: follows Home Assistant's websocket and asks the host to re-render when
 * `state` changes. Listens only to the websocket connection's own events (removed when the host disconnects).
 *
 *     private _link = new ReconnectController(this, { getHass: () => this.hass });
 *     // render(): this._link.state === "grace" ? quiet strip : this._link.state === "lost" ? offline state : nothing */
export class ReconnectController {
    constructor(host, options) {
        this._grace = null;
        this._connection = undefined;
        this._onDisconnected = () => this._grace?.update(false);
        this._onReady = () => this._grace?.update(true);
        this._host = host;
        this._options = options;
        host.addController(this);
    }
    /** "connected" while the websocket is up (and before anything is known), "grace" for the first `graceMs` after it
     * dropped, "lost" after that. */
    get state() {
        return this._grace?.state ?? "connected";
    }
    /** When the websocket was last known to be up (ms since the epoch); "now" while connected. */
    get lastConnectedAt() {
        return this._grace?.lastConnectedAt ?? (this._options.clock ?? realScheduler).now();
    }
    hostConnected() {
        this._grace = new ReconnectGrace({
            graceMs: this._options.graceMs,
            clock: this._options.clock,
            onChange: () => this._host.requestUpdate(),
        });
        this._follow();
    }
    hostUpdate() {
        this._follow();
    }
    hostDisconnected() {
        this._bind(undefined);
        this._grace?.dispose();
        this._grace = null;
    }
    /** Reads `hass` again: re-attaches to a new connection object and reports the flag Home Assistant keeps. */
    _follow() {
        const hass = this._options.getHass();
        this._bind(hass?.connection);
        const connected = hass?.connected ?? hass?.connection?.connected;
        if (connected !== undefined)
            this._grace?.update(connected);
    }
    _bind(connection) {
        if (connection === this._connection)
            return;
        this._connection?.removeEventListener("disconnected", this._onDisconnected);
        this._connection?.removeEventListener("ready", this._onReady);
        this._connection = connection;
        connection?.addEventListener("disconnected", this._onDisconnected);
        connection?.addEventListener("ready", this._onReady);
    }
}
