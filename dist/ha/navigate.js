/* Derived from music-assistant/frontend src/helpers/navigation.ts:10-24 (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md).
 * Modified: ported from vue-router to the browser history and Home Assistant's own navigate. "Can go back" is a depth
 * counter the toolkit stamps into history.state (it survives reloads) instead of vue-router's `state.back`; going back
 * with nothing to go back to replaces the page with the fallback; open layers are closed first; navigations are queued. */
import { depthOf, tabOf, withLu } from "./history-state.js";
import { sharedLayerManager } from "./layers.js";
import { reportAsync } from "./report-error.js";
/** Walks up from `from`, out through shadow roots, to Home Assistant's `ha-panel-custom` and returns its `navigate`.
 * That element sits in the light DOM above every custom panel; Home Assistant's own navigate also closes HA dialogs. */
export function findHaNavigate(from) {
    let node = from;
    while (node) {
        if (node.localName === "ha-panel-custom" && typeof node.navigate === "function") {
            const panel = node;
            return (path, options) => panel.navigate(path, options);
        }
        node = node.parentNode ?? node.host ?? null;
    }
    return null;
}
function announceLocationChanged(replace) {
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace } }));
}
class Navigation {
    constructor(env) {
        /** Resolves when the last queued navigation finished; never rejects. Null when nothing is in flight. */
        this._tail = null;
        this._env = env;
    }
    navigate(from, path, options = {}) {
        this.navigateStamped(from, path, options, {}).catch(this._env.onError);
    }
    navigateStamped(from, path, options, stamp) {
        return this._enqueue(() => this._navigate(from, path, options, stamp));
    }
    canGoBack() {
        return depthOf(this._env.history.state) > 0;
    }
    goBack(from, fallback) {
        // Back closes the top layer first, whichever control asked for it.
        if (this._env.layers.closeTopLayer("back"))
            return;
        this._enqueue(async () => {
            const settled = this._env.layers.whenSettled();
            if (settled)
                await settled;
            if (this.canGoBack()) {
                this._env.history.back();
                return true;
            }
            return this._navigate(from, fallback, { replace: true }, {});
        }).catch(this._env.onError);
    }
    back() {
        return this._enqueue(async () => {
            const { history, layers } = this._env;
            // Layers open on top of the entry we leave close with it and take their history entries along in the same step.
            const entries = layers.releaseLayers("navigate");
            const settled = layers.whenSettled();
            if (settled)
                await settled;
            history.go(-(1 + entries));
            return true;
        });
    }
    /** Runs `task` now when nothing else is in flight, after the previous one otherwise: each navigation reads the
     * history it is about to change only after the one before it has landed. */
    _enqueue(task) {
        const result = this._tail === null ? task() : this._tail.then(task);
        const tail = result.then(() => undefined, () => undefined);
        this._tail = tail;
        void tail.then(() => {
            if (this._tail === tail)
                this._tail = null;
        });
        return result;
    }
    async _navigate(from, path, options, stamp) {
        const { history, layers } = this._env;
        // Open layers close with the page; their history entries stay behind as leftovers that Back steps over.
        layers.releaseLayers("navigate");
        const settled = layers.whenSettled();
        if (settled)
            await settled;
        const replace = options.replace === true;
        // A replaced entry is the same step in the panel, so it keeps its depth and its tab; a pushed one is one deeper.
        const depth = depthOf(history.state) + (replace ? 0 : 1);
        const tab = stamp.tab ?? (replace ? this._currentTab() : undefined);
        const wanted = tab ? { depth, tab } : { depth };
        const data = { ...options.data, lu: wanted };
        const haNavigate = this._env.findHaNavigate(from);
        if (haNavigate) {
            // Home Assistant stores `data` in the new entry, so the marker is there before `location-changed` fires.
            if ((await haNavigate(path, { replace, data })) === false)
                return false;
            // Older Home Assistant versions (and a replaced first entry) drop `data`: write the marker afterwards.
            this._ensureStamp(wanted);
            return true;
        }
        if (replace)
            history.replaceState(data, "", path);
        else
            history.pushState(data, "", path);
        this._env.announce(replace);
        return true;
    }
    _currentTab() {
        const tab = tabOf(this._env.history.state);
        if (!tab)
            return undefined;
        return tab.marker ? { id: tab.id, marker: true } : { id: tab.id };
    }
    _ensureStamp(wanted) {
        const { history } = this._env;
        const have = tabOf(history.state);
        const sameTab = have?.id === wanted.tab?.id && (have?.marker ?? false) === (wanted.tab?.marker ?? false);
        if (depthOf(history.state) === (wanted.depth ?? 0) && sameTab)
            return;
        history.replaceState(withLu(history.state, wanted), "");
    }
}
/** A navigator on the given environment (tests). The browser defaults fill in what is left out. */
export function createHistoryNavigator(env = {}) {
    return new Navigation({
        history: env.history ?? window.history,
        announce: env.announce ?? announceLocationChanged,
        findHaNavigate: env.findHaNavigate ?? findHaNavigate,
        layers: env.layers ?? sharedLayerManager(),
        onError: env.onError ?? reportAsync,
    });
}
let pageNavigator;
/** The navigator the module-level functions below (and the tab history) share. */
export function pageHistoryNavigator() {
    pageNavigator ??= createHistoryNavigator();
    return pageNavigator;
}
/** Moves to `path` inside the panel: a new history entry, or with `replace` a swap of the current one.
 *
 * Goes through Home Assistant's own `navigate` (found above `from`, which also closes its dialogs and keeps its own
 * bookkeeping); without one (a card, the dev harness) it uses `pushState`/`replaceState` and fires `location-changed`.
 * Open layers close first (reason "navigate"). The toolkit's marker is kept in `history.state`, so `canGoBack()` stays
 * true across a reload. Pass an absolute path such as `/kestrel/visit?v=12`. */
export function navigate(from, path, options) {
    pageHistoryNavigator().navigate(from, path, options);
}
/** True when an entry of this panel session exists before the current one, so going back stays inside the panel.
 * False on the page the session started at (a deep link from a notification, a fresh tab). */
export function canGoBack() {
    return depthOf(window.history.state) > 0;
}
/** Back, as an app bar arrow means it: closes the top open layer if there is one, else goes back one step when
 * `canGoBack()`, else replaces the page with `fallback` so a deep link never strands the user or leaves the panel. */
export function goBack(from, fallback) {
    pageHistoryNavigator().goBack(from, fallback);
}
