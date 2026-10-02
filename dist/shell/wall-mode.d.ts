/** Wall mode: the opt-in "full screen" state for a display that hangs on a wall (the Echo Show). While it is on, the
 * shell asks Home Assistant to hide its own header and sidebar (kiosk mode). The one thing this must never do is
 * leave kiosk mode switched on after the panel is gone, so all the bookkeeping lives here, away from the element.
 * Pure (no `lit`, no DOM): the real `setKioskMode` from `src/ha/menu.ts` is passed in. */
/** `setKioskMode` from `src/ha/menu.ts`: switches kiosk on and returns the function that switches it off again. */
export type SetKioskMode = (enable: boolean) => () => void;
/** Keeps kiosk mode on exactly while wall mode is wanted and the shell is connected. */
export declare class WallMode {
    private readonly _setKiosk;
    private _release;
    constructor(setKiosk: SetKioskMode);
    /** True while kiosk mode is held on by this instance. */
    get active(): boolean;
    /** Switches wall mode on or off. Asking for the state it is already in does nothing, so it is safe to call from
     * every update. */
    set(wanted: boolean): void;
    /** Leaves kiosk mode (the shell was disconnected). `set(true)` turns it on again if the shell comes back. */
    dispose(): void;
}
/** The wall state to start with: an explicit `wall` wins, otherwise what this device remembered under the
 * shell's `wall-key`. Only a stored `true` counts (anything else, including a missing or corrupt value, is off). */
export declare function initialWall(explicit: boolean, stored: unknown): boolean;
