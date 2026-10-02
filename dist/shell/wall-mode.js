/** Wall mode: the opt-in "full screen" state for a display that hangs on a wall (the Echo Show). While it is on, the
 * shell asks Home Assistant to hide its own header and sidebar (kiosk mode). The one thing this must never do is
 * leave kiosk mode switched on after the panel is gone, so all the bookkeeping lives here, away from the element.
 * Pure (no `lit`, no DOM): the real `setKioskMode` from `src/ha/menu.ts` is passed in. */
/** Keeps kiosk mode on exactly while wall mode is wanted and the shell is connected. */
export class WallMode {
    constructor(setKiosk) {
        this._release = null;
        this._setKiosk = setKiosk;
    }
    /** True while kiosk mode is held on by this instance. */
    get active() {
        return this._release !== null;
    }
    /** Switches wall mode on or off. Asking for the state it is already in does nothing, so it is safe to call from
     * every update. */
    set(wanted) {
        if (wanted === this.active)
            return;
        if (wanted) {
            this._release = this._setKiosk(true);
            return;
        }
        const release = this._release;
        this._release = null;
        release?.();
    }
    /** Leaves kiosk mode (the shell was disconnected). `set(true)` turns it on again if the shell comes back. */
    dispose() {
        this.set(false);
    }
}
/** The wall state to start with: an explicit `wall` wins, otherwise what this device remembered under the
 * shell's `wall-key`. Only a stored `true` counts (anything else, including a missing or corrupt value, is off). */
export function initialWall(explicit, stored) {
    return explicit || stored === true;
}
