import type { HomeAssistant } from "./types.js";
export interface ShowMenuButtonOptions {
    /** The panel is in wall mode: it switched Home Assistant's kiosk mode on itself and draws its own menu button. */
    wall?: boolean;
}
/** Whether the panel's app bar should show a button that opens Home Assistant's sidebar.
 *
 * This is Home Assistant's own rule for its `ha-menu-button`: the sidebar is a drawer (so it needs a button) when the
 * screen is narrow or the user set the sidebar to "always hidden", and no button when Home Assistant is in kiosk
 * mode or the Companion app draws its own sidebar. On a wide screen with a docked sidebar the sidebar is already
 * on screen, so there is no button.
 *
 * Wall mode is the one exception to the width rule: kiosk mode turns the sidebar into a closed drawer at EVERY
 * width (an Echo Show at 960 px is not "narrow"), so the panel's own button is the only way to open it. */
export declare function showMenuButton(hass: HomeAssistant | undefined, narrow: boolean, options?: ShowMenuButtonOptions): boolean;
/** Asks Home Assistant to open (`open: true`), close (`false`) or toggle (omitted) its sidebar drawer. Fires the
 * bubbling, composed `hass-toggle-menu` event Home Assistant's own menu button fires; call it from an element
 * inside the panel so the event reaches `home-assistant-main`. */
export declare function toggleHaMenu(from: EventTarget, open?: boolean): void;
/** Switches Home Assistant's kiosk mode (its header and sidebar hidden) on or off with the `hass-kiosk-mode` window
 * event. Returns a function that switches it off again; calling it twice does nothing the second time, so an element
 * can safely call it from `disconnectedCallback`. `target` is the window; it is a parameter so tests can listen. */
export declare function setKioskMode(enable: boolean, target?: EventTarget): () => void;
