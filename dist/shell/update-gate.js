/** True when something the shell actually reads from `hass` changed: whether HA's own UI is hidden (`kioskMode`),
 * the sidebar setting (`dockedSidebar`), whether the companion app draws its own sidebar (`hasSidebar`), or the
 * language (the menu and back button labels). `undefined` on either side counts as a change. */
export function hassInputsChanged(previous, next) {
    if (!previous || !next)
        return previous !== next;
    return previous.kioskMode !== next.kioskMode
        || previous.dockedSidebar !== next.dockedSidebar
        || previous.auth?.external?.config?.hasSidebar !== next.auth?.external?.config?.hasSidebar
        || previous.language !== next.language;
}
/** The shell's `shouldUpdate`: render when any property other than `hass` changed, or when `hass` is the only one
 * and `hassInputsChanged`. `changedKeys` and `previousHass` come from Lit's `changedProperties` map. */
export function shouldRender(changedKeys, previousHass, nextHass) {
    let hassChanged = false;
    for (const key of changedKeys) {
        if (key !== "hass")
            return true;
        hassChanged = true;
    }
    return hassChanged ? hassInputsChanged(previousHass, nextHass) : true;
}
