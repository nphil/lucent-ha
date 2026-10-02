import type { HistoryNavigator } from "./navigate.js";
export interface TabHistoryEnv {
    history: Pick<History, "state" | "replaceState">;
    addPopstate(handler: (event: {
        state: unknown;
    }) => void): () => void;
    navigator: Pick<HistoryNavigator, "navigateStamped" | "back">;
    onError(error: unknown): void;
}
export interface TabHistoryOptions {
    /** The tab that is home: Back from any other tab returns here. */
    defaultId: string;
    /** The tab the panel opened on, when the address says something other than the default (a deep link). */
    initialId?: string;
    env?: Partial<TabHistoryEnv>;
}
/** Keeps a panel's tab changes tidy in the browser history. Route every tab change through `select`, and show the
 * tab `current` names (listen to `onChange` for changes the user makes with the system Back button). */
export declare class TabHistory {
    private _defaultId;
    private _current;
    private _env;
    private _listeners;
    private _stopListening;
    constructor(options: TabHistoryOptions);
    /** The tab the current history entry shows. */
    get current(): string;
    /** Switches to tab `id`, whose page is `path` (an absolute path such as `/kestrel/wildlife`). `from` is any
     * element inside the panel (it finds Home Assistant's navigate). Selecting the current tab does nothing. */
    select(id: string, path: string, from?: EventTarget | null): void;
    /** Calls `callback` with the tab id when system Back or Forward lands on an entry of another tab. Returns the
     * function that stops it. */
    onChange(callback: (id: string) => void): () => void;
    /** Stops listening to history. Call from `disconnectedCallback`. */
    dispose(): void;
    private _failed;
    private _onPopstate;
}
