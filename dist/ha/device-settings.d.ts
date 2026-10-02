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
/** Per-device settings kept in `localStorage` under `<namespace>.lu.<key>`: the choices that belong to this screen
 * and not to the Home Assistant account (wall mode, a sort order, the last tab). Create ONE per namespace and share it.
 * When the browser refuses to store (blocked site data, a full disk) values live in memory until the page closes. */
export declare function createDeviceSettings(namespace: string, env?: Partial<DeviceSettingsEnv>): DeviceSettings;
