import { isRecord } from "./guards.js";
function luOf(state) {
    return isRecord(state) && isRecord(state.lu) ? state.lu : {};
}
/** How many entries this panel session has pushed before the entry `state` belongs to (0 = the first one). */
export function depthOf(state) {
    const depth = luOf(state).depth;
    return typeof depth === "number" && Number.isInteger(depth) && depth > 0 ? depth : 0;
}
/** The sequence number of the layer that pushed this entry, or 0 when the entry is not a layer entry. */
export function layerSeqOf(state) {
    const layer = luOf(state).layer;
    if (!isRecord(layer))
        return 0;
    const seq = layer.seq;
    return typeof seq === "number" && Number.isFinite(seq) && seq > 0 ? seq : 0;
}
/** The tab stamp of this entry, or undefined when the tab history never wrote one here. */
export function tabOf(state) {
    const tab = luOf(state).tab;
    if (!isRecord(tab) || typeof tab.id !== "string" || tab.id === "")
        return undefined;
    return { id: tab.id, marker: tab.marker === true };
}
/** A copy of `state` with `patch` written into its `lu` key. Keys of `patch` set to `undefined` are removed;
 * everything else in `state` (foreign keys, `lu` fields the patch does not mention) is kept. A `state` that is not
 * a plain object (null on a fresh page) starts from an empty one. */
export function withLu(state, patch) {
    const base = isRecord(state) ? state : {};
    const lu = { ...luOf(base) };
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined)
            delete lu[key];
        else
            lu[key] = value;
    }
    return { ...base, lu };
}
