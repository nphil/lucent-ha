/* History LAYERS: every modal layer (sheet, picker, focused camera, visit ...) is one history entry, so the system
 * Back button closes the top layer first and only then leaves the page. Tabs never grow history (tab-history.ts).
 *
 * How it works, in five rules:
 *  1. Opening a layer pushes ONE history entry that keeps the URL and the old state, and adds `lu.layer = {id, seq}`.
 *     `seq` only ever grows, so "which layers are still ahead of me" is a comparison, not a count.
 *  2. Whenever history moves (`popstate`), every open layer whose entry is now AHEAD of us (bigger `seq`) closes,
 *     top first, with the reason "back". That covers Back, Back twice, a long-press Back jump and the browser
 *     skipping entries it considers automatic.
 *  3. Closing from the UI (`handle.close`) runs `onClose` right now so the exit animation starts at once, then
 *     pops the layer's entries with ONE `history.go(-n)`. The popstate that causes finds nothing left to close.
 *  4. Entries whose layer is gone (closed by `navigate`, left by a reload, reached by Forward) are "leftovers":
 *     landing on one steps back once more, so they are skipped without anyone seeing them. A manager that starts
 *     while a leftover is the current entry (the page was reloaded with a sheet open) steps over it at once.
 *  5. `go()` is asynchronous. While one of ours is under way, later history writes (the next layer, a navigation)
 *     wait for it (`whenSettled`), otherwise the late traversal would undo them. A lost popstate cannot wedge this:
 *     the wait ends by itself after POP_TIMEOUT_MS. */
import { realScheduler } from "../core/throttle.js";
import { addLocationChangedListener, addPopstateListener } from "./browser.js";
import { layerSeqOf, withLu } from "./history-state.js";
import { reportAsync } from "./report-error.js";
/** How long we wait for the popstate of a `history.go()` we issued before carrying on without it. */
export const POP_TIMEOUT_MS = 1000;
const API_VERSION = 1;
const SHARED_KEY = Symbol.for("lucent-ha:layers");
class Layers {
    constructor(env) {
        this.apiVersion = API_VERSION;
        this._stack = [];
        this._queue = [];
        this._waiting = false;
        this._timer = null;
        this._pumping = false;
        this._settled = [];
        this._callbacks = [];
        this._draining = false;
        this._env = env;
        // Sequence numbers start at the clock, so a page loaded later always numbers above entries an earlier
        // page life left in the same history (they survive reloads).
        this._nextSeq = Math.max(1, Math.floor(env.clock.now()));
        this._stopListening = env.addPopstate((event) => this._onPopstate(event.state));
        this._stopLocation = env.addLocationChanged(() => this._onLocationChanged());
        // No layer can be open yet, so a layer entry that is current right now was left by an earlier page life (a reload,
        // a restored or duplicated tab). The page looks like its base page; step over the entry so one Back press leaves.
        const current = layerSeqOf(env.history.state);
        if (current > 0) {
            this._queue.push({ kind: "pop", count: 1, top: current });
            this._pump();
        }
    }
    pushLayer(id, onClose) {
        const layer = { id, onClose, seq: 0, open: true, pushed: false };
        this._stack.push(layer);
        this._queue.push({ kind: "push", layer });
        this._pump();
        return {
            id,
            get open() {
                return layer.open;
            },
            close: (reason = "api") => this._close(layer, reason),
        };
    }
    closeTopLayer(reason = "api") {
        const top = this._stack[this._stack.length - 1];
        if (top === undefined)
            return false;
        this._close(top, reason);
        return true;
    }
    layerDepth() {
        return this._stack.length;
    }
    releaseLayers(reason) {
        const released = this._stack.splice(0);
        let entries = 0;
        for (const layer of released) {
            layer.open = false;
            if (layer.pushed)
                entries++;
        }
        this._notifyClosed(released.reverse(), reason);
        this._pump();
        return entries;
    }
    whenSettled() {
        if (!this._waiting && this._queue.length === 0)
            return null;
        return new Promise((resolve) => {
            this._settled.push(resolve);
        });
    }
    dispose() {
        this._stopListening();
        this._stopLocation();
        this._endWait();
        this._stack = [];
        this._queue = [];
        this._resolveSettled();
    }
    /** UI close: the layer and everything above it go now; their entries are popped with one `go(-n)`. */
    _close(layer, reason) {
        const at = this._stack.indexOf(layer);
        if (at < 0)
            return;
        const removed = this._stack.splice(at);
        let entries = 0;
        let top = 0;
        for (const gone of removed) {
            gone.open = false;
            if (gone.pushed) {
                entries++;
                top = Math.max(top, gone.seq);
            }
        }
        if (entries > 0) {
            const last = this._queue[this._queue.length - 1];
            if (last?.kind === "pop")
                last.count += entries;
            else
                this._queue.push({ kind: "pop", count: entries, top });
        }
        this._notifyClosed(removed.reverse(), reason);
        this._pump();
    }
    /** History moved (by the user, by us, or by other code): bring the open layers in line with where it landed. */
    _onPopstate(state) {
        this._endWait();
        const landed = layerSeqOf(state);
        const ahead = this._stack.filter((layer) => layer.pushed && layer.seq > landed);
        if (ahead.length > 0) {
            this._stack = this._stack.filter((layer) => !ahead.includes(layer));
            for (const layer of ahead)
                layer.open = false;
        }
        // An entry whose layer is gone is a leftover: step over it. Unless a pop we already queued is about to leave it
        // (closing several layers one after another lands on each of their entries on the way down).
        const leftover = landed > 0 && !this._stack.some((layer) => layer.pushed && layer.seq === landed) && !this._queue.some((operation) => operation.kind === "pop");
        if (leftover)
            this._queue.unshift({ kind: "pop", count: 1, top: landed });
        this._notifyClosed(ahead.reverse(), "back");
        this._pump();
    }
    /** Somebody else navigated (a sidebar tap, a link Home Assistant handled): layers cannot outlive that. When the
     * current entry is no longer the highest layer's own, close them all without touching history. */
    _onLocationChanged() {
        let top;
        for (const layer of this._stack)
            if (layer.pushed)
                top = layer;
        if (top === undefined || layerSeqOf(this._env.history.state) === top.seq)
            return;
        this.releaseLayers("navigate");
    }
    /** Runs queued history writes one at a time; a pop holds the queue until its popstate (or the timeout). */
    _pump() {
        if (this._pumping)
            return;
        this._pumping = true;
        try {
            while (!this._waiting && this._queue.length > 0) {
                const operation = this._queue.shift();
                if (operation?.kind === "push")
                    this._writeEntry(operation.layer);
                else if (operation?.kind === "pop")
                    this._startPop(operation.count, operation.top);
            }
        }
        finally {
            this._pumping = false;
        }
        if (!this._waiting && this._queue.length === 0)
            this._resolveSettled();
    }
    _writeEntry(layer) {
        if (!layer.open)
            return;
        const { history } = this._env;
        const seq = Math.max(this._nextSeq, layerSeqOf(history.state) + 1);
        try {
            history.pushState(withLu(history.state, { layer: { id: layer.id, seq } }), "");
        }
        catch (error) {
            // The layer still works; it just has no entry for Back to close.
            this._env.onError(error);
            return;
        }
        layer.seq = seq;
        layer.pushed = true;
        this._nextSeq = seq + 1;
    }
    _startPop(count, top) {
        if (layerSeqOf(this._env.history.state) !== top)
            return;
        this._waiting = true;
        this._timer = this._env.clock.setTimeout(() => {
            this._timer = null;
            this._waiting = false;
            this._pump();
        }, POP_TIMEOUT_MS);
        this._env.history.go(-count);
    }
    _endWait() {
        if (this._timer !== null)
            this._env.clock.clearTimeout(this._timer);
        this._timer = null;
        this._waiting = false;
    }
    _resolveSettled() {
        for (const resolve of this._settled.splice(0))
            resolve();
    }
    /** Calls `onClose` once per layer, top first, one callback at a time: a callback that closes or opens layers
     * only queues more work for this loop, it never runs another callback inside itself. */
    _notifyClosed(layers, reason) {
        for (const layer of layers)
            this._callbacks.push({ layer, reason });
        if (this._draining)
            return;
        this._draining = true;
        try {
            for (let next = this._callbacks.shift(); next !== undefined; next = this._callbacks.shift()) {
                try {
                    next.layer.onClose(next.reason);
                }
                catch (error) {
                    this._env.onError(error);
                }
            }
        }
        finally {
            this._draining = false;
        }
    }
}
/** A layer manager of its own on the given environment (tests). The browser defaults fill in what is left out. */
export function createLayerManager(env = {}) {
    return new Layers({
        history: env.history ?? window.history,
        addPopstate: env.addPopstate ?? addPopstateListener,
        addLocationChanged: env.addLocationChanged ?? addLocationChangedListener,
        clock: env.clock ?? realScheduler,
        onError: env.onError ?? reportAsync,
    });
}
/** The ONE manager of this page. The first copy of the toolkit that needs it creates it and parks it on
 * `globalThis`; every later bundle reuses it, so two panels never both react to the same Back press. */
export function sharedLayerManager() {
    const scope = globalThis;
    const existing = scope[SHARED_KEY];
    if (existing === undefined) {
        const created = createLayerManager();
        scope[SHARED_KEY] = created;
        return created;
    }
    if (existing.apiVersion !== API_VERSION) {
        throw new Error(`lucent-ha: the page already has a layer manager with apiVersion ${String(existing.apiVersion)}, this copy needs ${API_VERSION}`);
    }
    return existing;
}
/** Opens a layer: one history entry, so system Back closes it. `onClose` runs once, whoever closes the layer;
 * play the exit animation there. */
export function pushLayer(id, onClose) {
    return sharedLayerManager().pushLayer(id, onClose);
}
/** Closes the top layer (default reason "api"). Returns true when there was one. */
export function closeTopLayer(reason) {
    return sharedLayerManager().closeTopLayer(reason);
}
/** How many layers are open right now. */
export function layerDepth() {
    return sharedLayerManager().layerDepth();
}
