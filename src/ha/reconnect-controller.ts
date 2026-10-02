import type { ReactiveController, ReactiveControllerHost } from "lit";
import { realScheduler } from "../core/throttle.ts";
import type { Scheduler } from "../core/throttle.ts";
import { ReconnectGrace } from "./reconnect.ts";
import type { ReconnectState } from "./reconnect.ts";
import type { HassConnection, HomeAssistant } from "./types.ts";

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
export class ReconnectController implements ReactiveController {
  private _host: ReactiveControllerHost;
  private _options: ReconnectControllerOptions;
  private _grace: ReconnectGrace | null = null;
  private _connection: HassConnection | undefined = undefined;
  private _onDisconnected = (): void => this._grace?.update(false);
  private _onReady = (): void => this._grace?.update(true);

  constructor(host: ReactiveControllerHost, options: ReconnectControllerOptions) {
    this._host = host;
    this._options = options;
    host.addController(this);
  }

  /** "connected" while the websocket is up (and before anything is known), "grace" for the first `graceMs` after it
   * dropped, "lost" after that. */
  get state(): ReconnectState {
    return this._grace?.state ?? "connected";
  }

  /** When the websocket was last known to be up (ms since the epoch); "now" while connected. */
  get lastConnectedAt(): number {
    return this._grace?.lastConnectedAt ?? (this._options.clock ?? realScheduler).now();
  }

  hostConnected(): void {
    this._grace = new ReconnectGrace({
      graceMs: this._options.graceMs,
      clock: this._options.clock,
      onChange: () => this._host.requestUpdate(),
    });
    this._follow();
  }

  hostUpdate(): void {
    this._follow();
  }

  hostDisconnected(): void {
    this._bind(undefined);
    this._grace?.dispose();
    this._grace = null;
  }

  /** Reads `hass` again: re-attaches to a new connection object and reports the flag Home Assistant keeps. */
  private _follow(): void {
    const hass = this._options.getHass();
    this._bind(hass?.connection);
    const connected = hass?.connected ?? hass?.connection?.connected;
    if (connected !== undefined) this._grace?.update(connected);
  }

  private _bind(connection: HassConnection | undefined): void {
    if (connection === this._connection) return;
    this._connection?.removeEventListener("disconnected", this._onDisconnected);
    this._connection?.removeEventListener("ready", this._onReady);
    this._connection = connection;
    connection?.addEventListener("disconnected", this._onDisconnected);
    connection?.addEventListener("ready", this._onReady);
  }
}
