/** A plain object (not null, not an array): the shape `history.state` and stored settings have when they carry
 * anything. Its fields stay `unknown`; callers check the ones they use. */
export function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
