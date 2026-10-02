/** Decides whether the app shell needs to render again. Home Assistant hands a panel a brand-new `hass` object on
 * every state change anywhere in the house (several times a second on a busy system); the shell only looks at four
 * things in it, so every other change must cost nothing. Pure (no `lit`, no DOM). */
import type { HomeAssistant } from "../ha/types.ts";

/** True when something the shell actually reads from `hass` changed: whether HA's own UI is hidden (`kioskMode`),
 * the sidebar setting (`dockedSidebar`), whether the companion app draws its own sidebar (`hasSidebar`), or the
 * language (the menu and back button labels). `undefined` on either side counts as a change. */
export function hassInputsChanged(previous: HomeAssistant | undefined, next: HomeAssistant | undefined): boolean {
  if (!previous || !next) return previous !== next;
  return previous.kioskMode !== next.kioskMode
    || previous.dockedSidebar !== next.dockedSidebar
    || previous.auth?.external?.config?.hasSidebar !== next.auth?.external?.config?.hasSidebar
    || previous.language !== next.language;
}

/** The shell's `shouldUpdate`: render when any property other than `hass` changed, or when `hass` is the only one
 * and `hassInputsChanged`. `changedKeys` and `previousHass` come from Lit's `changedProperties` map. */
export function shouldRender(changedKeys: Iterable<PropertyKey>, previousHass: HomeAssistant | undefined, nextHass: HomeAssistant | undefined): boolean {
  let hassChanged = false;
  for (const key of changedKeys) {
    if (key !== "hass") return true;
    hassChanged = true;
  }
  return hassChanged ? hassInputsChanged(previousHass, nextHass) : true;
}
