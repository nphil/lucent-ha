import type { LuHistoryState } from "./history-state.js";
import type { LayerManager } from "./layers.js";
export interface NavigateOptions {
    /** Replace the current history entry instead of adding one. */
    replace?: boolean;
    /** Kept in `history.state` next to the toolkit's own marker. */
    data?: Record<string, unknown>;
}
/** Home Assistant's own `navigate(path, options)` (what `ha-panel-custom` exposes). It returns a promise that resolves
 * to false when it refused to navigate (a dialog would not close). */
export type HaNavigate = (path: string, options: {
    replace?: boolean;
    data?: Record<string, unknown>;
}) => unknown;
export interface NavigateEnv {
    history: Pick<History, "state" | "pushState" | "replaceState" | "back" | "go">;
    /** Tells Home Assistant's router the address changed (`location-changed`). Only used when Home Assistant did not do
     * the navigating itself. */
    announce(replace: boolean): void;
    /** Home Assistant's navigate, found above `from`; null when there is none. */
    findHaNavigate(from: EventTarget | null): HaNavigate | null;
    layers: Pick<LayerManager, "closeTopLayer" | "releaseLayers" | "whenSettled">;
    onError(error: unknown): void;
}
/** Everything that moves history for the panel. One instance per page is enough; tests build their own. */
export interface HistoryNavigator {
    /** Moves to `path` (see the module function `navigate`). */
    navigate(from: EventTarget | null, path: string, options?: NavigateOptions): void;
    /** `navigate` plus extra toolkit fields written onto the new entry. Resolves to false when Home Assistant refused. */
    navigateStamped(from: EventTarget | null, path: string, options: NavigateOptions, stamp: Pick<LuHistoryState, "tab">): Promise<boolean>;
    canGoBack(): boolean;
    goBack(from: EventTarget | null, fallback: string): void;
    /** One page back (what the tab history uses to leave its marker entry): open layers close with it and take their
     * history entries along, after any pending layer change has landed. */
    back(): Promise<boolean>;
}
/** Walks up from `from`, out through shadow roots, to Home Assistant's `ha-panel-custom` and returns its `navigate`.
 * That element sits in the light DOM above every custom panel; Home Assistant's own navigate also closes HA dialogs. */
export declare function findHaNavigate(from: EventTarget | null): HaNavigate | null;
/** A navigator on the given environment (tests). The browser defaults fill in what is left out. */
export declare function createHistoryNavigator(env?: Partial<NavigateEnv>): HistoryNavigator;
/** The navigator the module-level functions below (and the tab history) share. */
export declare function pageHistoryNavigator(): HistoryNavigator;
/** Moves to `path` inside the panel: a new history entry, or with `replace` a swap of the current one.
 *
 * Goes through Home Assistant's own `navigate` (found above `from`, which also closes its dialogs and keeps its own
 * bookkeeping); without one (a card, the dev harness) it uses `pushState`/`replaceState` and fires `location-changed`.
 * Open layers close first (reason "navigate"). The toolkit's marker is kept in `history.state`, so `canGoBack()` stays
 * true across a reload. Pass an absolute path such as `/kestrel/visit?v=12`. */
export declare function navigate(from: EventTarget | null, path: string, options?: NavigateOptions): void;
/** True when an entry of this panel session exists before the current one, so going back stays inside the panel.
 * False on the page the session started at (a deep link from a notification, a fresh tab). */
export declare function canGoBack(): boolean;
/** Back, as an app bar arrow means it: closes the top open layer if there is one, else goes back one step when
 * `canGoBack()`, else replaces the page with `fallback` so a deep link never strands the user or leaves the panel. */
export declare function goBack(from: EventTarget | null, fallback: string): void;
