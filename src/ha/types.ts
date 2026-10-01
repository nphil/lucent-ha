/** The slice of Home Assistant's frontend objects the toolkit reads. Hand-rolled and minimal on purpose: the
 * toolkit never imports Home Assistant's own types, and every field is optional so a mock `hass` (the dev
 * harness) or an older Home Assistant satisfies it. */

/** home-assistant-js-websocket `Connection`, as far as reconnect handling needs it. */
export interface HassConnection {
  readonly connected?: boolean;
  addEventListener(type: "ready" | "disconnected" | "reconnect-error", listener: (connection: HassConnection, data?: unknown) => void): void;
  removeEventListener(type: "ready" | "disconnected" | "reconnect-error", listener: (connection: HassConnection, data?: unknown) => void): void;
}

export interface HassExternalApp {
  config?: { hasSidebar?: boolean };
  fireMessage?(message: unknown): void;
}

/** What Home Assistant hands every panel as `hass`. */
export interface HomeAssistant {
  /** Websocket connected right now. */
  connected?: boolean;
  connection?: HassConnection;
  /** Home Assistant's header and sidebar are hidden (set by the `hass-kiosk-mode` window event). */
  kioskMode?: boolean;
  /** The user's sidebar setting. `always_hidden` makes Home Assistant treat the sidebar as a drawer on every width. */
  dockedSidebar?: "docked" | "always_hidden" | "auto";
  /** Companion app: `external.config.hasSidebar` means the app draws its own sidebar. */
  auth?: { external?: HassExternalApp };
  themes?: { darkMode?: boolean; theme?: string; themes?: Record<string, unknown> };
  selectedTheme?: { theme?: string; dark?: boolean } | null;
  language?: string;
  localize?(key: string, ...args: unknown[]): string;
  callWS?<T = unknown>(message: Record<string, unknown>): Promise<T>;
  hassUrl?(path?: string): string;
  states?: Record<string, { state: string; attributes: Record<string, unknown> }>;
  user?: { is_admin?: boolean; name?: string };
  panelUrl?: string;
}

/** The `route` Home Assistant hands a custom panel: `/kestrel/live` is `{ prefix: "/kestrel", path: "/live" }`. */
export interface HaRoute {
  prefix: string;
  path: string;
}
