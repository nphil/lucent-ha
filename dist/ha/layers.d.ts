import type { Scheduler } from "../core/throttle.js";
/** Why a layer closed. `"back"`: system Back or Forward moved history. `"navigate"`: `navigate()` replaced the page.
 * `"api"`: code closed it. Anything else is the caller's own word (a sheet passes "scrim", "escape", "swipe" ...). */
export type LayerCloseReason = "back" | "api" | "navigate" | string;
export interface LayerHandle {
    readonly id: string;
    /** True from `pushLayer` until the layer closes, by whatever route. */
    readonly open: boolean;
    /** Closes this layer and every layer above it (default reason "api"). Does nothing when it is already closed. */
    close(reason?: LayerCloseReason): void;
}
/** Everything the manager touches in the outside world, so tests can hand it a fake history. */
export interface LayerEnv {
    history: Pick<History, "state" | "pushState" | "go">;
    /** Calls `handler` for every `popstate`; returns the function that stops listening. */
    addPopstate(handler: (event: {
        state: unknown;
    }) => void): () => void;
    /** Calls `handler` when somebody else navigated (Home Assistant fires `location-changed`); returns the stop function. */
    addLocationChanged(handler: () => void): () => void;
    clock: Scheduler;
    /** Receives errors thrown by `onClose` callbacks and by `pushState` itself. */
    onError(error: unknown): void;
}
export interface LayerManager {
    /** Bumped when the shape of this object changes, so a second bundle on the page can tell if it can share it. */
    readonly apiVersion: 1;
    pushLayer(id: string, onClose: (reason: LayerCloseReason) => void): LayerHandle;
    closeTopLayer(reason?: LayerCloseReason): boolean;
    layerDepth(): number;
    /** For `navigate()`: closes every open layer (top first) and leaves their history entries where they are; the
     * navigation's own push or replace is the history operation. Returns how many history entries those layers
     * occupy, for a caller that wants to go back past them. */
    releaseLayers(reason: LayerCloseReason): number;
    /** Null when no history change of ours is under way; otherwise a promise that resolves once the last one landed. */
    whenSettled(): Promise<void> | null;
    /** Stops listening and forgets everything (tests; the page-wide manager is never disposed). */
    dispose(): void;
}
/** How long we wait for the popstate of a `history.go()` we issued before carrying on without it. */
export declare const POP_TIMEOUT_MS = 1000;
/** A layer manager of its own on the given environment (tests). The browser defaults fill in what is left out. */
export declare function createLayerManager(env?: Partial<LayerEnv>): LayerManager;
/** The ONE manager of this page. The first copy of the toolkit that needs it creates it and parks it on
 * `globalThis`; every later bundle reuses it, so two panels never both react to the same Back press. */
export declare function sharedLayerManager(): LayerManager;
/** Opens a layer: one history entry, so system Back closes it. `onClose` runs once, whoever closes the layer;
 * play the exit animation there. */
export declare function pushLayer(id: string, onClose: (reason: LayerCloseReason) => void): LayerHandle;
/** Closes the top layer (default reason "api"). Returns true when there was one. */
export declare function closeTopLayer(reason?: LayerCloseReason): boolean;
/** How many layers are open right now. */
export declare function layerDepth(): number;
