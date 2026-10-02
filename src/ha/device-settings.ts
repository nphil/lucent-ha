/* Derived from music-assistant/frontend src/helpers/device_settings.ts:1-77 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md).
 * Modified: one small store per namespace instead of fixed setting names; values are JSON; blocked storage falls back to
 * memory; subscribers can be removed (MA never removed its `storage` listeners) and are told the new value; same-tab
 * changes travel as a toolkit event, so two settings objects with one namespace stay in step. */
import { isRecord } from "./guards.ts";
import { reportAsync } from "./report-error.ts";

export interface DeviceSettings {
  /** The stored value of `key`, or `fallback` when nothing (or something of the wrong kind) is stored. */
  get<T>(key: string, fallback: T): T;
  /** Stores `value` (anything JSON can hold) and tells subscribers in this tab and in other tabs. `undefined` removes the key. */
  set(key: string, value: unknown): void;
  /** Calls `callback` with the new value (undefined when removed) after every change. Returns the function that stops it. */
  subscribe(key: string, callback: (value: unknown) => void): () => void;
}

export interface DeviceSettingsEnv {
  /** `localStorage`, or null when the browser blocks it. Asked on every call: it can stop working later. */
  storage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  /** Where change events travel: the window. The browser fires `storage` there for changes made in OTHER tabs. */
  events: EventTarget;
  onError(error: unknown): void;
}

const CHANGED_EVENT = "lucent-ha:device-setting";

function browserStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The stored JSON, or undefined when it is not valid JSON. */
function parseStored(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** A stored value only counts when it has the kind of the fallback (a string where a number is expected is ignored). */
function sameKind(value: unknown, fallback: unknown): boolean {
  if (fallback === null || fallback === undefined) return true;
  if (Array.isArray(fallback)) return Array.isArray(value);
  if (isRecord(fallback)) return isRecord(value);
  return typeof value === typeof fallback;
}

/** Per-device settings kept in `localStorage` under `<namespace>.lu.<key>`: the choices that belong to this screen
 * and not to the Home Assistant account (wall mode, a sort order, the last tab). Create ONE per namespace and share it.
 * When the browser refuses to store (blocked site data, a full disk) values live in memory until the page closes. */
export function createDeviceSettings(namespace: string, env: Partial<DeviceSettingsEnv> = {}): DeviceSettings {
  if (namespace === "") throw new Error("lucent-ha: a settings namespace must not be empty");
  const onError = env.onError ?? reportAsync;
  const storage = env.storage ?? browserStorage;
  const memory = new Map<string, string>();
  const subscribers = new Map<string, Set<{ callback: (value: unknown) => void }>>();
  let stopListening: (() => void) | null = null;

  const fullKey = (key: string): string => `${namespace}.lu.${key}`;

  const readRaw = (full: string): string | null => {
    const remembered = memory.get(full);
    if (remembered !== undefined) return remembered;
    try {
      return storage()?.getItem(full) ?? null;
    } catch {
      return null;
    }
  };

  const writeRaw = (full: string, raw: string | null): void => {
    memory.delete(full);
    try {
      const area = storage();
      if (raw === null) {
        area?.removeItem(full);
        return;
      }
      if (area) {
        area.setItem(full, raw);
        return;
      }
    } catch {
      // Quota or blocked: the value is kept below for this page life.
    }
    if (raw !== null) memory.set(full, raw);
  };

  const notify = (full: string, value: unknown): void => {
    for (const entry of [...(subscribers.get(full) ?? [])]) {
      try {
        entry.callback(value);
      } catch (error) {
        onError(error);
      }
    }
  };

  const startListening = (): void => {
    if (stopListening) return;
    const target = env.events ?? window;
    const onChanged = (event: Event): void => {
      const detail = (event as CustomEvent<{ key: string; value: unknown }>).detail;
      notify(detail.key, detail.value);
    };
    const onStorage = (event: Event): void => {
      const { key, newValue } = event as unknown as { key: string | null; newValue: string | null };
      if (key === null) {
        // Another tab cleared everything.
        for (const full of subscribers.keys()) {
          const raw = readRaw(full);
          notify(full, raw === null ? undefined : parseStored(raw));
        }
        return;
      }
      if (subscribers.has(key)) notify(key, newValue === null ? undefined : parseStored(newValue));
    };
    target.addEventListener(CHANGED_EVENT, onChanged);
    target.addEventListener("storage", onStorage);
    stopListening = () => {
      target.removeEventListener(CHANGED_EVENT, onChanged);
      target.removeEventListener("storage", onStorage);
      stopListening = null;
    };
  };

  return {
    get<T>(key: string, fallback: T): T {
      const raw = readRaw(fullKey(key));
      if (raw === null) return fallback;
      const value = parseStored(raw);
      if (value === undefined) return fallback;
      return sameKind(value, fallback) ? (value as T) : fallback;
    },

    set(key: string, value: unknown): void {
      const full = fullKey(key);
      writeRaw(full, value === undefined ? null : (JSON.stringify(value) ?? null));
      (env.events ?? window).dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { key: full, value } }));
    },

    subscribe(key: string, callback: (value: unknown) => void): () => void {
      const full = fullKey(key);
      const entry = { callback };
      let entries = subscribers.get(full);
      if (!entries) {
        entries = new Set();
        subscribers.set(full, entries);
      }
      entries.add(entry);
      startListening();
      return () => {
        const current = subscribers.get(full);
        if (!current?.delete(entry)) return;
        if (current.size === 0) subscribers.delete(full);
        if (subscribers.size === 0) stopListening?.();
      };
    },
  };
}
