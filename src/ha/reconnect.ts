/* Derived from music-assistant/frontend src/composables/useReconnectGrace.ts:20-77 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md).
 * Modified: Vue refs and `watch` replaced by a plain class with an `onChange` callback; MA's four connection states
 * became one boolean ("is the websocket up"); the result is three states (connected, grace, lost) instead of a
 * boolean; the clock is injectable; repeated "still down" reports no longer extend the window. */
import { realScheduler } from "../core/throttle.ts";
import type { Scheduler } from "../core/throttle.ts";
import { RECONNECT_GRACE_MS } from "../tokens/constants.ts";
import { reportAsync } from "./report-error.ts";

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
export class ReconnectGrace {
  private _state: ReconnectState = "connected";
  private _graceMs: number;
  private _clock: Scheduler;
  private _onChange: ((state: ReconnectState) => void) | undefined;
  private _onError: (error: unknown) => void;
  private _timer: unknown = null;
  private _lastConnected: number;
  private _disposed = false;

  constructor(options: ReconnectGraceOptions = {}) {
    this._graceMs = Math.max(0, options.graceMs ?? RECONNECT_GRACE_MS);
    this._clock = options.clock ?? realScheduler;
    this._onChange = options.onChange;
    this._onError = options.onError ?? reportAsync;
    this._lastConnected = this._clock.now();
  }

  get state(): ReconnectState {
    return this._state;
  }

  /** When the connection was last known to be up (ms since the epoch): "now" while connected, the moment it dropped
   * otherwise. For a "last updated 12 s ago" line. */
  get lastConnectedAt(): number {
    return this._state === "connected" ? this._clock.now() : this._lastConnected;
  }

  /** Reports whether the websocket is up right now. */
  update(connected: boolean): void {
    if (this._disposed) return;
    if (connected) {
      this._stopTimer();
      this._set("connected");
      return;
    }
    // Already counting down (or already lost): a repeated "still down" must not restart the window.
    if (this._state !== "connected") return;
    this._lastConnected = this._clock.now();
    // Armed before `onChange` runs: if that callback reports "connected" again it must find the timer to stop.
    this._timer = this._clock.setTimeout(() => {
      this._timer = null;
      this._set("lost");
    }, this._graceMs);
    this._set("grace");
  }

  /** Stops the timer; later reports are ignored. */
  dispose(): void {
    this._disposed = true;
    this._stopTimer();
  }

  private _stopTimer(): void {
    if (this._timer !== null) this._clock.clearTimeout(this._timer);
    this._timer = null;
  }

  private _set(state: ReconnectState): void {
    if (state === this._state) return;
    this._state = state;
    try {
      this._onChange?.(state);
    } catch (error) {
      this._onError(error);
    }
  }
}
