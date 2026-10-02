/** A plain object (not null, not an array): the shape `history.state` and stored settings have when they carry
 * anything. Its fields stay `unknown`; callers check the ones they use. */
export declare function isRecord(value: unknown): value is Record<string, unknown>;
