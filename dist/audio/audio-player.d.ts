import { nothing, type PropertyValues } from "lit";
import { LuElement } from "../core/element.js";
import { type PlayerSources } from "./audio-model.js";
/** One recording with the browser's own audio controls (keyboard, screen readers and seeking for free).
 *
 * - `src` is the recording; `original` (optional) is the untouched one behind a cleaned preview, and a small
 *   "Original" toggle plays it instead. Switching keeps playing: it continues from the start of the other file.
 * - A preview that cannot be loaded falls back to the original by itself; when nothing can be played the player
 *   says "Couldn't load this recording." with a "Try again" button.
 * - A new `src` while the preview is playing waits until it pauses or ends, so the swap is never heard.
 * - ONE recording at a time on the whole page: starting this one pauses any other (`claimAudio`).
 * - `mark` (a short passive label such as "Cleaned") and `caption` sit under the player while the preview plays.
 * - The sound survives a re-render of the page around it, but not removal of the element (the browser stops it).
 *
 * `preload` is `none` by default: nothing downloads until the listener presses play. Needs the host's `--lu-*` tokens. */
export declare class LuAudioPlayer extends LuElement {
    static luName: string;
    static properties: {
        src: {
            type: StringConstructor;
        };
        original: {
            type: StringConstructor;
        };
        mark: {
            type: StringConstructor;
        };
        caption: {
            type: StringConstructor;
        };
        label: {
            type: StringConstructor;
        };
        preload: {
            type: StringConstructor;
        };
        _sources: {
            state: boolean;
        };
    };
    src: string;
    original: string;
    mark: string;
    caption: string;
    /** Accessible name of the player ("recording from 4:45 AM at Backyard"). */
    label: string;
    preload: "none" | "metadata";
    _sources: PlayerSources;
    /** The listener pressed play and has not paused since: a fallback to the original carries on playing. */
    private _playRequested;
    constructor();
    disconnectedCallback(): void;
    private get _audio();
    protected willUpdate(changed: PropertyValues<this>): void;
    private _onPlay;
    private _onSettle;
    /** A preview that cannot load switches to the original; if the listener had pressed play, that starts playing. */
    private _onError;
    private _toggleOriginal;
    static styles: import("lit").CSSResult[];
    protected render(): typeof nothing | import("lit-html").TemplateResult<1>;
}
