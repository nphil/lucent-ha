/* Tabs and history. Switching between a panel's top-level tabs must not fill the Back stack (one entry per tap was
 * what Kestrel did), yet system Back from a tab should still land somewhere sensible. The rule:
 *   - tabs REPLACE the current entry;
 *   - the only exception: leaving the DEFAULT tab pushes exactly ONE marker entry, so Back from any other tab returns
 *     to the default tab, and the Back after that leaves the panel;
 *   - choosing the default tab while that marker is the current entry pops it (`history.back()`) instead of pushing. */
import { addPopstateListener } from "./browser.js";
import { tabOf, withLu } from "./history-state.js";
import { pageHistoryNavigator } from "./navigate.js";
import { reportAsync } from "./report-error.js";
/** Keeps a panel's tab changes tidy in the browser history. Route every tab change through `select`, and show the
 * tab `current` names (listen to `onChange` for changes the user makes with the system Back button). */
export class TabHistory {
    constructor(options) {
        this._listeners = new Set();
        this._env = {
            history: options.env?.history ?? window.history,
            addPopstate: options.env?.addPopstate ?? addPopstateListener,
            navigator: options.env?.navigator ?? pageHistoryNavigator(),
            onError: options.env?.onError ?? reportAsync,
        };
        this._defaultId = options.defaultId;
        // An entry this class wrote remembers its tab, so a reload comes back to the same one.
        this._current = tabOf(this._env.history.state)?.id ?? options.initialId ?? options.defaultId;
        this._stopListening = this._env.addPopstate(() => this._onPopstate());
    }
    /** The tab the current history entry shows. */
    get current() {
        return this._current;
    }
    /** Switches to tab `id`, whose page is `path` (an absolute path such as `/kestrel/wildlife`). `from` is any
     * element inside the panel (it finds Home Assistant's navigate). Selecting the current tab does nothing. */
    select(id, path, from = null) {
        if (id === this._current)
            return;
        const previous = this._current;
        const { history, navigator } = this._env;
        const onMarker = tabOf(history.state)?.marker === true;
        // The app that calls `select` already knows; `onChange` is for changes it did not make.
        this._current = id;
        if (id === this._defaultId && onMarker) {
            // Back from the marker and this choice are the same step.
            navigator.back().catch((error) => this._failed(previous, error));
            return;
        }
        let done;
        if (previous === this._defaultId) {
            // Leaving home: remember which tab the entry we leave belongs to, then push the single marker entry.
            history.replaceState(withLu(history.state, { tab: { id: previous } }), "");
            done = navigator.navigateStamped(from, path, {}, { tab: { id, marker: true } });
        }
        else {
            done = navigator.navigateStamped(from, path, { replace: true }, { tab: onMarker ? { id, marker: true } : { id } });
        }
        done.then((navigated) => {
            if (!navigated)
                this._current = previous;
        }, (error) => this._failed(previous, error));
    }
    /** Calls `callback` with the tab id when system Back or Forward lands on an entry of another tab. Returns the
     * function that stops it. */
    onChange(callback) {
        this._listeners.add(callback);
        return () => {
            this._listeners.delete(callback);
        };
    }
    /** Stops listening to history. Call from `disconnectedCallback`. */
    dispose() {
        this._stopListening();
        this._listeners.clear();
    }
    _failed(previous, error) {
        this._current = previous;
        this._env.onError(error);
    }
    _onPopstate() {
        const landed = tabOf(this._env.history.state);
        if (!landed || landed.id === this._current)
            return;
        this._current = landed.id;
        for (const listener of [...this._listeners]) {
            try {
                listener(landed.id);
            }
            catch (error) {
                this._env.onError(error);
            }
        }
    }
}
