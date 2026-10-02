import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { ReconnectController } from "../src/ha/reconnect-controller.ts";
import { ReconnectGrace } from "../src/ha/reconnect.ts";
import type { ReconnectState } from "../src/ha/reconnect.ts";
import type { HassConnection, HomeAssistant } from "../src/ha/types.ts";
import { FakeClock } from "./ha-fakes.ts";

function grace(options: { graceMs?: number } = {}) {
  const clock = new FakeClock(5000);
  const seen: ReconnectState[] = [];
  const errors: unknown[] = [];
  const instance = new ReconnectGrace({ ...options, clock, onChange: (state) => seen.push(state), onError: (error) => errors.push(error) });
  return { clock, seen, errors, instance };
}

describe("ReconnectGrace", () => {
  it("starts connected and says nothing about a connection that stays up", () => {
    const { instance, seen, clock } = grace();
    instance.update(true);
    instance.update(true);
    assert.equal(instance.state, "connected");
    assert.deepEqual(seen, []);
    assert.equal(clock.pending, 0);
  });

  it("a blip shorter than 10 s never reaches lost, and stops its timer", () => {
    const { instance, seen, clock } = grace();
    instance.update(false);
    assert.equal(instance.state, "grace");
    clock.advance(9_999);
    assert.equal(instance.state, "grace");
    instance.update(true);
    assert.equal(instance.state, "connected");
    assert.equal(clock.pending, 0);
    clock.advance(60_000);
    assert.equal(instance.state, "connected");
    assert.deepEqual(seen, ["grace", "connected"]);
  });

  it("is lost once the connection has been down for the whole 10 s", () => {
    const { instance, seen, clock } = grace();
    instance.update(false);
    clock.advance(10_000);
    assert.equal(instance.state, "lost");
    assert.deepEqual(seen, ["grace", "lost"]);
    assert.equal(clock.pending, 0);
  });

  it("honours a custom grace window", () => {
    const { instance, clock } = grace({ graceMs: 2_000 });
    instance.update(false);
    clock.advance(1_999);
    assert.equal(instance.state, "grace");
    clock.advance(1);
    assert.equal(instance.state, "lost");
  });

  it("a reconnect after lost resets, and the next drop gets a fresh window", () => {
    const { instance, seen, clock } = grace();
    instance.update(false);
    clock.advance(10_000);
    instance.update(true);
    assert.equal(instance.state, "connected");
    instance.update(false);
    clock.advance(9_000);
    assert.equal(instance.state, "grace");
    clock.advance(1_000);
    assert.equal(instance.state, "lost");
    assert.deepEqual(seen, ["grace", "lost", "connected", "grace", "lost"]);
  });

  it("repeated reports of a connection that is still down do not extend the window", () => {
    const { instance, clock } = grace();
    instance.update(false);
    clock.advance(6_000);
    instance.update(false);
    clock.advance(4_000);
    assert.equal(instance.state, "lost", "10 s after the FIRST report, not after the last");
  });

  it("reports of a lost connection that is still down change nothing", () => {
    const { instance, seen, clock } = grace();
    instance.update(false);
    clock.advance(10_000);
    instance.update(false);
    assert.deepEqual(seen, ["grace", "lost"]);
    assert.equal(clock.pending, 0);
  });

  it("dispose clears the timer and ignores later reports", () => {
    const { instance, seen, clock } = grace();
    instance.update(false);
    assert.equal(clock.pending, 1);
    instance.dispose();
    assert.equal(clock.pending, 0);
    clock.advance(60_000);
    instance.update(true);
    instance.update(false);
    assert.equal(instance.state, "grace");
    assert.deepEqual(seen, ["grace"]);
    assert.equal(clock.pending, 0);
  });

  it("knows when the connection was last up: now while connected, the moment it dropped otherwise", () => {
    const { instance, clock } = grace();
    clock.advance(3_000);
    assert.equal(instance.lastConnectedAt, 8_000);
    instance.update(false);
    clock.advance(4_000);
    assert.equal(instance.lastConnectedAt, 8_000);
    clock.advance(10_000);
    assert.equal(instance.lastConnectedAt, 8_000, "still the moment it dropped after the grace ran out");
    instance.update(true);
    assert.equal(instance.lastConnectedAt, clock.now());
  });

  it("an onChange that reports the connection back up cannot leave a stray timer behind", () => {
    const clock = new FakeClock();
    let instance: ReconnectGrace | undefined;
    instance = new ReconnectGrace({
      clock,
      onChange: (state) => {
        if (state === "grace") instance?.update(true);
      },
    });
    instance.update(false);
    assert.equal(instance.state, "connected");
    assert.equal(clock.pending, 0);
    clock.advance(60_000);
    assert.equal(instance.state, "connected");
  });

  it("a throwing onChange is reported and does not break the countdown", () => {
    const clock = new FakeClock();
    const boom = new Error("listener");
    const errors: unknown[] = [];
    const instance = new ReconnectGrace({
      clock,
      onChange: () => {
        throw boom;
      },
      onError: (error) => errors.push(error),
    });
    instance.update(false);
    clock.advance(10_000);
    assert.equal(instance.state, "lost");
    assert.deepEqual(errors, [boom, boom]);
  });
});

class FakeHost implements ReactiveControllerHost {
  controllers: ReactiveController[] = [];
  updates = 0;
  readonly updateComplete = Promise.resolve(true);
  addController(controller: ReactiveController): void {
    this.controllers.push(controller);
  }
  removeController(controller: ReactiveController): void {
    this.controllers = this.controllers.filter((existing) => existing !== controller);
  }
  requestUpdate(): void {
    this.updates++;
  }
}

type Listener = (connection: HassConnection) => void;

class FakeConnection implements HassConnection {
  connected = true;
  private _listeners: Record<string, Set<Listener>> = { ready: new Set(), disconnected: new Set(), "reconnect-error": new Set() };
  addEventListener(type: "ready" | "disconnected" | "reconnect-error", listener: Listener): void {
    this._listeners[type]?.add(listener);
  }
  removeEventListener(type: "ready" | "disconnected" | "reconnect-error", listener: Listener): void {
    this._listeners[type]?.delete(listener);
  }
  emit(type: "ready" | "disconnected"): void {
    this.connected = type === "ready";
    for (const listener of [...(this._listeners[type] ?? [])]) listener(this);
  }
  get listenerCount(): number {
    return Object.values(this._listeners).reduce((total, set) => total + set.size, 0);
  }
}

/** `flag` is what `hass.connected` says; "none" leaves it out, like a mock hass does. */
function controllerSetup(connection = new FakeConnection(), flag: boolean | "none" = true) {
  const host = new FakeHost();
  const clock = new FakeClock(9000);
  const hassRef: { current: HomeAssistant | undefined } = { current: { connected: flag === "none" ? undefined : flag, connection } };
  const controller = new ReconnectController(host, { getHass: () => hassRef.current, clock });
  controller.hostConnected();
  return { host, clock, connection, hassRef, controller };
}

describe("ReconnectController", () => {
  it("registers itself with the host", () => {
    const { host, controller } = controllerSetup();
    assert.deepEqual(host.controllers, [controller]);
  });

  it("follows the websocket's own disconnected and ready events and asks the host to re-render each time", () => {
    const { host, controller, connection } = controllerSetup();
    assert.equal(controller.state, "connected");
    connection.emit("disconnected");
    assert.equal(controller.state, "grace");
    assert.equal(host.updates, 1);
    connection.emit("ready");
    assert.equal(controller.state, "connected");
    assert.equal(host.updates, 2);
  });

  it("a blip under 10 s never shows lost; staying down for 10 s does, with the moment it dropped", () => {
    const { controller, connection, clock } = controllerSetup();
    connection.emit("disconnected");
    clock.advance(9_000);
    connection.emit("ready");
    clock.advance(30_000);
    assert.equal(controller.state, "connected");
    connection.emit("disconnected");
    const droppedAt = clock.now();
    clock.advance(10_000);
    assert.equal(controller.state, "lost");
    assert.equal(controller.lastConnectedAt, droppedAt);
  });

  it("reads the connected flag Home Assistant keeps in hass on every host update", () => {
    const { controller, hassRef, connection, host } = controllerSetup();
    hassRef.current = { connected: false, connection };
    controller.hostUpdate();
    assert.equal(controller.state, "grace");
    assert.equal(host.updates, 1);
    hassRef.current = { connected: true, connection };
    controller.hostUpdate();
    assert.equal(controller.state, "connected");
  });

  it("falls back to the connection's own flag when hass has none (a mock)", () => {
    const connection = new FakeConnection();
    connection.connected = false;
    const { controller } = controllerSetup(connection, "none");
    assert.equal(controller.state, "grace");
  });

  it("stays connected until hass arrives, then follows it", () => {
    const { controller, hassRef } = controllerSetup();
    hassRef.current = undefined;
    controller.hostUpdate();
    assert.equal(controller.state, "connected");
    hassRef.current = { connected: false };
    controller.hostUpdate();
    assert.equal(controller.state, "grace");
  });

  it("moves its listeners to a new connection object and leaves none on the old one", () => {
    const { controller, hassRef, connection } = controllerSetup();
    assert.equal(connection.listenerCount, 2);
    const next = new FakeConnection();
    hassRef.current = { connected: true, connection: next };
    controller.hostUpdate();
    assert.equal(connection.listenerCount, 0);
    assert.equal(next.listenerCount, 2);
    connection.emit("disconnected");
    assert.equal(controller.state, "connected", "the old connection no longer counts");
    next.emit("disconnected");
    assert.equal(controller.state, "grace");
  });

  it("removes its listeners and its timer when the host disconnects, and ignores events afterwards", () => {
    const { controller, connection, clock, host } = controllerSetup();
    connection.emit("disconnected");
    assert.equal(clock.pending, 1);
    controller.hostDisconnected();
    assert.equal(connection.listenerCount, 0);
    assert.equal(clock.pending, 0);
    const updates = host.updates;
    connection.emit("ready");
    connection.emit("disconnected");
    assert.equal(host.updates, updates);
    assert.equal(controller.state, "connected");
  });

  it("starts fresh when the host connects again and picks up what hass says now", () => {
    const { controller, connection, hassRef } = controllerSetup();
    controller.hostDisconnected();
    hassRef.current = { connected: false, connection };
    controller.hostConnected();
    assert.equal(controller.state, "grace");
    assert.equal(connection.listenerCount, 2);
  });
});
