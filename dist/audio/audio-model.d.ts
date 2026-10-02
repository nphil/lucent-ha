/** Which file a single-recording player plays, and why. `src` is the preferred one (often a cleaned preview),
 * `original` the untouched recording behind it. */
export interface PlayerSources {
    src: string;
    original: string;
    /** The listener (or a failed preview) chose the original. Only meaningful while `original` is set. */
    useOriginal: boolean;
    /** The file still loaded while a newer `src` waits for the sound to stop. */
    held: string | null;
    /** Nothing playable is left. */
    failed: boolean;
}
export declare function playerSources(src: string, original: string): PlayerSources;
/** The address the `<audio>` element should have right now. */
export declare function activeSource(state: PlayerSources): string;
/** The app handed over new addresses. A new `src` while the preview is PLAYING is held back until the sound
 * stops, so the swap is never heard; otherwise it applies at once. Any error is forgotten (new file, new chance). */
export declare function withSources(state: PlayerSources, src: string, original: string, playing: boolean): PlayerSources;
/** The sound paused or ended: a held-back `src` takes over. */
export declare function settle(state: PlayerSources): PlayerSources;
/** The element could not load the current file. A preview that cannot play falls back to the original; a
 * recording that cannot play at all is an error. */
export declare function failCurrent(state: PlayerSources): PlayerSources;
/** The Original toggle. */
export declare function toggleOriginal(state: PlayerSources): PlayerSources;
/** "Try again" after an error: back to the preferred file. */
export declare function retryPlayer(state: PlayerSources): PlayerSources;
/** How far playback is, 0..1; 0 while the length is unknown. */
export declare function progressFraction(currentTime: number, duration: number): number;
/** One recording in a list. */
export interface AudioListRow {
    id: string;
    /** Where it plays from; null means there is nothing to play. */
    src: string | null;
    title: string;
    caption?: string;
    /** Short value at the end of the row, e.g. a confidence. */
    meta?: string;
    /** Small passive label after the title, e.g. "Cleaned". */
    mark?: string;
    /** Played instead when `src` cannot be loaded, e.g. the untouched recording behind a cleaned preview. */
    fallback?: string | null;
    /** The recording as a phrase for screen readers: "recording from 4:45 AM at Backyard". */
    label: string;
}
/** What the list element does when the shared audio changes. */
export interface AudioListHost {
    /** Something visible changed: re-render. */
    changed(): void;
    /** Playback moved: update the progress hairline directly (no re-render). 0..1. */
    progress(fraction: number): void;
}
/** The behaviour of an audio list: ONE shared `<audio>` for all its rows. The element forwards the media
 * element's events (`play`, `pause`, `ended`, `error`, `timeupdate`) to `handle*` and renders from the state.
 *
 * - Only one recording plays at a time: starting one pauses the previous (here by reusing the element, page-wide
 *   through `claimAudio`, so a player elsewhere on the page pauses too).
 * - `warm(row)` starts loading a row (on press, a moment before the tap completes); the newest row is warmed
 *   when the list first gets rows.
 * - A row plays its CURRENT source: when `src` changed while listed (a preview became ready) the new one plays.
 * - Source chain per row: `src` -> `fallback` -> "couldn't load". The outcome is remembered per row and forgotten
 *   when the row's sources change or when the listener taps the row again.
 * - A row that disappears while it is active stops the audio. */
export declare class SharedAudio {
    active: string | null;
    playing: boolean;
    private readonly _audio;
    private readonly _host;
    private _rows;
    /** The address assigned to the element and the row it belongs to ("" = nothing assigned). */
    private _loaded;
    private _loadedRow;
    private _warmedFirst;
    /** row id -> its `src` when it failed and the fallback took over. */
    private readonly _primaryBroken;
    /** row id -> signature of the sources when nothing at all could be played. */
    private readonly _unplayable;
    constructor(audio: HTMLMediaElement, host: AudioListHost);
    isActive(row: AudioListRow): boolean;
    isPlaying(row: AudioListRow): boolean;
    isFailed(row: AudioListRow): boolean;
    /** The address a row plays from right now. */
    sourceFor(row: AudioListRow): string | null;
    setRows(rows: readonly AudioListRow[]): void;
    /** Starts loading `row` so a tap a moment later plays at once. Does nothing while a row is active (playing or paused
     * part-way: its audio must stay loaded). */
    warm(row: AudioListRow): void;
    /** Play, pause or switch to `row`. */
    toggle(row: AudioListRow): void;
    /** Stops whatever plays and forgets what was loaded. */
    stop(): void;
    /** The list went away: let go of the speaker and the download, and start from scratch if it comes back. */
    dispose(): void;
    handlePlay(): void;
    handlePause(): void;
    handleEnded(): void;
    handleTime(): void;
    /** The element could not load what it was given: try the row's fallback once, then mark it unplayable. */
    handleError(): void;
    private _assign;
}
