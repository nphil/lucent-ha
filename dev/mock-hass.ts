/** A scripted stand-in for the `hass` object Home Assistant hands every panel.
 *
 * Like the real one it is IMMUTABLE: every change builds a NEW object and tells the subscribers (the frame, the panel), so a
 * panel that compares `hass` by identity sees what it would see in Home Assistant. `connection` can be scripted to drop and
 * return for reconnect demos; `callWS` answers only the message types a specimen registered with `onWS`. */
import type { HassConnection, HomeAssistant } from "../src/ha/types.ts";
import { HA_THEMES, describeTheme, type ThemeName } from "./ha-theme.ts";

type ConnectionEvent = "ready" | "disconnected" | "reconnect-error";
type ConnectionListener = (connection: HassConnection, data?: unknown) => void;

/** `home-assistant-js-websocket`'s connection as far as the toolkit looks at it. */
class MockConnection implements HassConnection {
  connected = true;
  private readonly listeners: Record<ConnectionEvent, Set<ConnectionListener>> = { ready: new Set(), disconnected: new Set(), "reconnect-error": new Set() };

  addEventListener(type: ConnectionEvent, listener: ConnectionListener): void {
    this.listeners[type].add(listener);
  }

  removeEventListener(type: ConnectionEvent, listener: ConnectionListener): void {
    this.listeners[type].delete(listener);
  }

  emit(type: ConnectionEvent): void {
    for (const listener of [...this.listeners[type]]) listener(this);
  }
}

export type WebSocketHandler = (message: Record<string, unknown>) => unknown;

/** The few strings Home Assistant's own UI asks `hass.localize` for; anything else comes back as its key, like an untranslated string. */
const ENGLISH: Record<string, string> = {
  "ui.sidebar.sidebar_toggle": "Sidebar toggle",
  "ui.common.close": "Close",
  "ui.common.back": "Back",
  "ui.common.cancel": "Cancel",
  "ui.common.retry": "Retry",
};

export interface MockHaOptions {
  dockedSidebar: NonNullable<HomeAssistant["dockedSidebar"]>;
  kioskMode: boolean;
  /** The Companion app draws its own sidebar (`auth.external.config.hasSidebar`). */
  externalSidebar: boolean;
  theme: ThemeName;
}

export class MockHa {
  readonly connection = new MockConnection();
  /** Messages the toolkit sent to the Companion app (`fireMessage`), oldest first. */
  readonly externalMessages: unknown[] = [];
  private readonly subscribers = new Set<(hass: HomeAssistant) => void>();
  private readonly handlers = new Map<string, WebSocketHandler>();
  private current: HomeAssistant;

  constructor(options: MockHaOptions) {
    const theme = describeTheme(options.theme);
    this.current = {
      connected: true,
      connection: this.connection,
      kioskMode: options.kioskMode,
      dockedSidebar: options.dockedSidebar,
      auth: { external: options.externalSidebar ? { config: { hasSidebar: true }, fireMessage: (message) => { this.externalMessages.push(message); } } : undefined },
      themes: { darkMode: theme.dark, theme: theme.haTheme, themes: HA_THEMES },
      selectedTheme: { theme: theme.haTheme, dark: theme.dark },
      language: "en",
      localize: (key) => ENGLISH[key] ?? key,
      callWS: <T,>(message: Record<string, unknown>) => this.callWS<T>(message),
      hassUrl: (path = "") => `${location.origin}${path}`,
      states: {
        "light.kitchen": { state: "on", attributes: { friendly_name: "Kitchen light", brightness: 180 } },
        "sensor.outdoor_temperature": { state: "18.4", attributes: { friendly_name: "Outdoor temperature", unit_of_measurement: "°C" } },
        "camera.backyard": { state: "streaming", attributes: { friendly_name: "Backyard camera" } },
      },
      user: { is_admin: true, name: "Nitin" },
      panelUrl: "harness",
    };
  }

  get hass(): HomeAssistant {
    return this.current;
  }

  /** Builds the next `hass` (a new object) and tells every subscriber. */
  update(patch: Partial<HomeAssistant>): void {
    this.current = { ...this.current, ...patch };
    for (const subscriber of [...this.subscribers]) subscriber(this.current);
  }

  /** The emulated theme changed: `hass.themes` and `hass.selectedTheme` follow, as they do in Home Assistant. */
  setTheme(name: ThemeName): void {
    const theme = describeTheme(name);
    this.update({ themes: { darkMode: theme.dark, theme: theme.haTheme, themes: HA_THEMES }, selectedTheme: { theme: theme.haTheme, dark: theme.dark } });
  }

  subscribe(subscriber: (hass: HomeAssistant) => void): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  /** Answers `callWS({ type })` with `handler(message)` (a value or a promise); a rejection becomes the error the caller sees. */
  onWS(type: string, handler: WebSocketHandler): void {
    this.handlers.set(type, handler);
  }

  /** The websocket drops: `hass.connected` turns false and the connection fires `disconnected`. */
  disconnect(): void {
    this.connection.connected = false;
    this.update({ connected: false });
    this.connection.emit("disconnected");
  }

  /** The websocket is back: `hass.connected` turns true and the connection fires `ready`. */
  reconnect(): void {
    this.connection.connected = true;
    this.update({ connected: true });
    this.connection.emit("ready");
  }

  private async callWS<T>(message: Record<string, unknown>): Promise<T> {
    const handler = this.handlers.get(String(message.type));
    if (!handler) throw Object.assign(new Error(`mock hass: no handler for websocket message "${String(message.type)}" (register one with __lu.mock.onWS)`), { code: "unknown_command" });
    return (await handler(message)) as T;
  }
}
