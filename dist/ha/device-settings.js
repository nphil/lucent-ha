/* Derived from music-assistant/frontend src/helpers/device_settings.ts:1-77 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md).
 * Modified: one small store per namespace instead of fixed setting names; values are JSON; blocked storage falls back to
 * memory; subscribers can be removed (MA never removed its `storage` listeners) and are told the new value; same-tab
 * changes travel as a toolkit event, so two settings objects with one namespace stay in step. */
import { isRecord } from "./guards.js";
import { reportAsync } from "./report-error.js";
const CHANGED_EVENT = "lucent-ha:device-setting";
function browserStorage() {
    try {
        return window.localStorage;
    }
    catch {
        return null;
    }
}
/** The stored JSON, or undefined when it is not valid JSON. */
function parseStored(raw) {
    try {
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
}
/** A stored value only counts when it has the kind of the fallback (a string where a number is expected is ignored). */
function sameKind(value, fallback) {
    if (fallback === null || fallback === undefined)
        return true;
    if (Array.isArray(fallback))
        return Array.isArray(value);
    if (isRecord(fallback))
        return isRecord(value);
    return typeof value === typeof fallback;
}
/** Per-device settings kept in `localStorage` under `<namespace>.lu.<key>`: the choices that belong to this screen
 * and not to the Home Assistant account (wall mode, a sort order, the last tab). Create ONE per namespace and share it.
 * When the browser refuses to store (blocked site data, a full disk) values live in memory until the page closes. */
export function createDeviceSettings(namespace, env = {}) {
    if (namespace === "")
        throw new Error("lucent-ha: a settings namespace must not be empty");
    const onError = env.onError ?? reportAsync;
    const storage = env.storage ?? browserStorage;
    const memory = new Map();
    const subscribers = new Map();
    let stopListening = null;
    const fullKey = (key) => `${namespace}.lu.${key}`;
    const readRaw = (full) => {
        const remembered = memory.get(full);
        if (remembered !== undefined)
            return remembered;
        try {
            return storage()?.getItem(full) ?? null;
        }
        catch {
            return null;
        }
    };
    const writeRaw = (full, raw) => {
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
        }
        catch {
            // Quota or blocked: the value is kept below for this page life.
        }
        if (raw !== null)
            memory.set(full, raw);
    };
    const notify = (full, value) => {
        for (const entry of [...(subscribers.get(full) ?? [])]) {
            try {
                entry.callback(value);
            }
            catch (error) {
                onError(error);
            }
        }
    };
    const startListening = () => {
        if (stopListening)
            return;
        const target = env.events ?? window;
        const onChanged = (event) => {
            const detail = event.detail;
            notify(detail.key, detail.value);
        };
        const onStorage = (event) => {
            const { key, newValue } = event;
            if (key === null) {
                // Another tab cleared everything.
                for (const full of subscribers.keys()) {
                    const raw = readRaw(full);
                    notify(full, raw === null ? undefined : parseStored(raw));
                }
                return;
            }
            if (subscribers.has(key))
                notify(key, newValue === null ? undefined : parseStored(newValue));
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
        get(key, fallback) {
            const raw = readRaw(fullKey(key));
            if (raw === null)
                return fallback;
            const value = parseStored(raw);
            if (value === undefined)
                return fallback;
            return sameKind(value, fallback) ? value : fallback;
        },
        set(key, value) {
            const full = fullKey(key);
            writeRaw(full, value === undefined ? null : (JSON.stringify(value) ?? null));
            (env.events ?? window).dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { key: full, value } }));
        },
        subscribe(key, callback) {
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
                if (!current?.delete(entry))
                    return;
                if (current.size === 0)
                    subscribers.delete(full);
                if (subscribers.size === 0)
                    stopListening?.();
            };
        },
    };
}
