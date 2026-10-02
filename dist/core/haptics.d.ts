/** Home Assistant's haptic bridge: a plain `window` `CustomEvent` the stock frontend listens for and, inside the
 * companion app, turns into a real tactile tick. Everywhere else it is a harmless, listener-less event. */
export type HapticKind = "light" | "success" | "warning";
export declare function fireHaptic(kind: HapticKind): void;
