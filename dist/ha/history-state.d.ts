/** What the toolkit writes into `history.state`, all under ONE key (`lu`). Every other key in an entry's state belongs
 * to Home Assistant (`root`, `from`, `dialog` ...) or to the app and is always carried over untouched.
 *
 * Three small pieces of bookkeeping live here, one per module that writes them:
 * `depth` (navigate.ts), `layer` (layers.ts) and `tab` (tab-history.ts). Reading is forgiving: anything malformed
 * (an old build, another script) reads as "not there". */
export interface LuHistoryState {
    /** How many entries this panel session pushed before this one; absent or 0 on the entry the panel opened on. */
    depth?: number;
    /** Set on the entry a layer pushed. `seq` grows with every push, so a later entry always has a bigger number. */
    layer?: {
        id: string;
        seq: number;
    };
    /** Set on entries the tab history wrote. `marker` is the ONE entry pushed when the default tab was left. */
    tab?: {
        id: string;
        marker?: boolean;
    };
}
/** How many entries this panel session has pushed before the entry `state` belongs to (0 = the first one). */
export declare function depthOf(state: unknown): number;
/** The sequence number of the layer that pushed this entry, or 0 when the entry is not a layer entry. */
export declare function layerSeqOf(state: unknown): number;
/** The tab stamp of this entry, or undefined when the tab history never wrote one here. */
export declare function tabOf(state: unknown): {
    id: string;
    marker: boolean;
} | undefined;
/** A copy of `state` with `patch` written into its `lu` key. Keys of `patch` set to `undefined` are removed;
 * everything else in `state` (foreign keys, `lu` fields the patch does not mention) is kept. A `state` that is not
 * a plain object (null on a fresh page) starts from an empty one. */
export declare function withLu(state: unknown, patch: Partial<LuHistoryState>): Record<string, unknown>;
