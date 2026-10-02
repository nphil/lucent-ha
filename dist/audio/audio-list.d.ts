import { type PropertyValues } from "lit";
import { LuElement } from "../core/element.js";
import { type AudioListRow } from "./audio-model.js";
/** A list of recordings, each with a play button that plays right in the row.
 *
 * - ONE shared `<audio>` for the whole list and `claimAudio` for the page: only one recording plays at a time,
 *   in the list or anywhere else (another `lu-audio-player`, another list).
 * - Pressing play starts the download a moment before the tap completes; the newest row is loaded when the list
 *   appears, so its first play is instant. A row plays its CURRENT `src`, also when it changed while listed.
 * - `src` fails -> the row's `fallback` plays (e.g. the untouched recording behind a cleaned preview); when that
 *   fails too the row says "Couldn't load this recording." and tapping its play button tries again.
 * - The progress hairline of the playing row moves by direct style: the list does not re-render four times a second.
 * - Tapping the rest of a row fires `lu-select {id}`; the trailing "Show more" button fires `lu-more`.
 * - `stop()` stops whatever plays. A row that disappears while playing stops the sound.
 *
 * Rows are a fixed `--lu-row` high with `content-visibility: auto`, so long lists stay cheap. Needs the host's `--lu-*` tokens. */
export declare class LuAudioList extends LuElement {
    static luName: string;
    static properties: {
        rows: {
            attribute: boolean;
        };
        more: {
            type: BooleanConstructor;
        };
        loading: {
            type: BooleanConstructor;
        };
        moreLabel: {
            type: StringConstructor;
            attribute: string;
        };
    };
    rows: readonly AudioListRow[];
    more: boolean;
    loading: boolean;
    moreLabel: string;
    private _shared;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    protected firstUpdated(): void;
    protected updated(changed: PropertyValues<this>): void;
    /** Stops whatever is playing. */
    stop(): void;
    static styles: import("lit").CSSResult[];
    protected render(): import("lit-html").TemplateResult<1>;
}
