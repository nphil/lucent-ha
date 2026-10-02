/** Decides whether the app shell needs to render again. Home Assistant hands a panel a brand-new `hass` object on
 * every state change anywhere in the house (several times a second on a busy system); the shell only looks at four
 * things in it, so every other change must cost nothing. Pure (no `lit`, no DOM). */
import type { HomeAssistant } from "../ha/types.js";
/** True when something the shell actually reads from `hass` changed: whether HA's own UI is hidden (`kioskMode`),
 * the sidebar setting (`dockedSidebar`), whether the companion app draws its own sidebar (`hasSidebar`), or the
 * language (the menu and back button labels). `undefined` on either side counts as a change. */
export declare function hassInputsChanged(previous: HomeAssistant | undefined, next: HomeAssistant | undefined): boolean;
/** The shell's `shouldUpdate`: render when any property other than `hass` changed, or when `hass` is the only one
 * and `hassInputsChanged`. `changedKeys` and `previousHass` come from Lit's `changedProperties` map. */
export declare function shouldRender(changedKeys: Iterable<PropertyKey>, previousHass: HomeAssistant | undefined, nextHass: HomeAssistant | undefined): boolean;
