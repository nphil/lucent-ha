import { LuElement } from "../core/element.js";
import { LuGrid } from "../grid/grid.js";
import type { GridKind } from "../grid/grid.js";
export type StateKind = "loading" | "empty" | "error" | "stale";
export type StateVariant = "rows" | "thumbs" | "tiles" | "text";
/** One element for the four honest states of a list, grid or card that is not simply "showing its data".
 *
 * - `loading`: a STATIC skeleton (no pulse, no shimmer) with the geometry of the content it stands for. Show it
 *   only while there is no data yet. `variant` picks the shape: `rows` (row-high bars with a leading icon and two
 *   lines), `thumbs` (16:10 rail tiles), `tiles` (a real `lu-grid` of image-plus-caption tiles; `tile` picks the
 *   grid kind and `ratio` the image shape), `text` (lines). `count` is how many (0 = a sensible default).
 * - `empty`: icon, `heading`, `message` and a next step in the `action` slot. Say WHY it is empty.
 * - `error`: `heading`/`message` and a Retry button (`retryLabel`, event `lu-retry`). With last-good content in the
 *   default slot the content stays and a one-line "couldn't refresh" strip follows it: an error never replaces data.
 * - `stale`: a slim strip "Showing data from 12 min ago" (`since` = ms epoch; `message` adds the reason) above the
 *   slotted content.
 *
 * `compact` renders empty/error as a single line instead of a centred block. */
export declare class LuState extends LuElement {
    static luName: string;
    static luDeps: readonly [typeof LuGrid];
    static properties: {
        kind: {
            type: StringConstructor;
            reflect: boolean;
        };
        variant: {
            type: StringConstructor;
            reflect: boolean;
        };
        count: {
            type: NumberConstructor;
        };
        heading: {
            type: StringConstructor;
        };
        message: {
            type: StringConstructor;
        };
        icon: {
            type: StringConstructor;
        };
        since: {
            type: NumberConstructor;
        };
        retryLabel: {
            type: StringConstructor;
            attribute: string;
        };
        tile: {
            type: StringConstructor;
        };
        ratio: {
            type: StringConstructor;
        };
        compact: {
            type: BooleanConstructor;
            reflect: boolean;
        };
        _hasContent: {
            state: boolean;
        };
    };
    kind: StateKind;
    variant: StateVariant;
    count: number;
    heading: string;
    message: string;
    icon: string;
    since: number;
    retryLabel: string;
    tile: GridKind;
    ratio: string;
    compact: boolean;
    _hasContent: boolean;
    private readonly _inView;
    private _timer;
    constructor();
    static styles: import("lit").CSSResult[];
    connectedCallback(): void;
    disconnectedCallback(): void;
    protected updated(): void;
    /** The "ago" text only changes while it can be seen: one slow timer, on while a stale strip is on screen. */
    private _syncTimer;
    private _contentChanged;
    private _retry;
    private _renderSkeleton;
    private _renderMessage;
    private _renderStale;
    protected render(): import("lit-html").TemplateResult;
}
declare global {
    interface HTMLElementEventMap {
        "lu-retry": CustomEvent<undefined>;
    }
}
