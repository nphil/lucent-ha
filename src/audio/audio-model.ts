import { claimAudio, releaseAudio } from "../core/audio-focus.ts";

/* ---------------------------------------------------------------- one recording (LuAudioPlayer) */

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

export function playerSources(src: string, original: string): PlayerSources {
  return { src, original, useOriginal: false, held: null, failed: false };
}

/** The address the `<audio>` element should have right now. */
export function activeSource(state: PlayerSources): string {
  if (state.useOriginal && state.original) return state.original;
  return state.held ?? state.src;
}

/** The app handed over new addresses. A new `src` while the preview is PLAYING is held back until the sound
 * stops, so the swap is never heard; otherwise it applies at once. Any error is forgotten (new file, new chance). */
export function withSources(state: PlayerSources, src: string, original: string, playing: boolean): PlayerSources {
  const srcChanged = src !== state.src;
  const swapWhilePlaying = srcChanged && playing && !(state.useOriginal && state.original) && state.src !== "";
  return {
    src,
    original,
    useOriginal: original ? state.useOriginal : false,
    held: swapWhilePlaying ? (state.held ?? state.src) : srcChanged ? null : state.held,
    failed: false,
  };
}

/** The sound paused or ended: a held-back `src` takes over. */
export function settle(state: PlayerSources): PlayerSources {
  return state.held === null ? state : { ...state, held: null };
}

/** The element could not load the current file. A preview that cannot play falls back to the original; a
 * recording that cannot play at all is an error. */
export function failCurrent(state: PlayerSources): PlayerSources {
  if (state.original && !state.useOriginal) return { ...state, useOriginal: true, held: null };
  return { ...state, failed: true };
}

/** The Original toggle. */
export function toggleOriginal(state: PlayerSources): PlayerSources {
  if (!state.original) return state;
  return { ...state, useOriginal: !state.useOriginal, failed: false };
}

/** "Try again" after an error: back to the preferred file. */
export function retryPlayer(state: PlayerSources): PlayerSources {
  return { ...state, useOriginal: false, held: null, failed: false };
}

/* ---------------------------------------------------------------- progress */

/** How far playback is, 0..1; 0 while the length is unknown. */
export function progressFraction(currentTime: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(duration)) return 0;
  return Math.min(1, Math.max(0, currentTime / duration));
}

/* ---------------------------------------------------------------- many recordings, one speaker (LuAudioList) */

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

function signature(row: AudioListRow): string {
  return `${row.src ?? ""}|${row.fallback ?? ""}`;
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
export class SharedAudio {
  active: string | null = null;
  playing = false;

  private readonly _audio: HTMLMediaElement;
  private readonly _host: AudioListHost;
  private _rows: readonly AudioListRow[] = [];
  /** The address assigned to the element and the row it belongs to ("" = nothing assigned). */
  private _loaded = "";
  private _loadedRow = "";
  private _warmedFirst = false;
  /** row id -> its `src` when it failed and the fallback took over. */
  private readonly _primaryBroken = new Map<string, string>();
  /** row id -> signature of the sources when nothing at all could be played. */
  private readonly _unplayable = new Map<string, string>();

  constructor(audio: HTMLMediaElement, host: AudioListHost) {
    this._audio = audio;
    this._host = host;
  }

  isActive(row: AudioListRow): boolean {
    return this.active === row.id;
  }

  isPlaying(row: AudioListRow): boolean {
    return this.active === row.id && this.playing;
  }

  isFailed(row: AudioListRow): boolean {
    return this._unplayable.get(row.id) === signature(row);
  }

  /** The address a row plays from right now. */
  sourceFor(row: AudioListRow): string | null {
    if (row.fallback && row.src && this._primaryBroken.get(row.id) === row.src) return row.fallback;
    return row.src;
  }

  setRows(rows: readonly AudioListRow[]): void {
    this._rows = rows;
    if (this.active !== null && !rows.some((row) => row.id === this.active)) this.stop();
    if (!this._warmedFirst) {
      const first = rows.find((row) => row.src);
      if (first) {
        this._warmedFirst = true;
        this.warm(first);
      }
    }
  }

  /** Starts loading `row` so a tap a moment later plays at once. Does nothing while a row is active (playing or paused
   * part-way: its audio must stay loaded). */
  warm(row: AudioListRow): void {
    const src = this.sourceFor(row);
    if (!src || this.active !== null || !this._audio.paused || (this._loadedRow === row.id && this._loaded === src)) return;
    this._assign(row.id, src);
    this._audio.preload = "auto";
    this._audio.load();
  }

  /** Play, pause or switch to `row`. */
  toggle(row: AudioListRow): void {
    if (!row.src) return;
    if (this.active === row.id) {
      if (this._audio.paused) void this._audio.play().catch(() => undefined);
      else this._audio.pause();
      return;
    }
    // Tapping a row that failed is "try again": forget what failed.
    if (this._unplayable.delete(row.id)) this._primaryBroken.delete(row.id);
    const src = this.sourceFor(row) as string;
    this.active = row.id;
    this.playing = false;
    if (this._loadedRow !== row.id || this._loaded !== src) this._assign(row.id, src);
    this._host.progress(0);
    this._host.changed();
    void this._audio.play().catch(() => undefined); // a failed load raises `error` on the element
  }

  /** Stops whatever plays and forgets what was loaded. */
  stop(): void {
    this._audio.pause();
    this._audio.removeAttribute("src");
    releaseAudio(this._audio);
    this._loaded = "";
    this._loadedRow = "";
    this.active = null;
    this.playing = false;
    this._host.progress(0);
    this._host.changed();
  }

  /** The list went away: let go of the speaker and the download, and start from scratch if it comes back. */
  dispose(): void {
    releaseAudio(this._audio);
    this._audio.pause();
    this._audio.removeAttribute("src");
    this._audio.load();
    this._loaded = "";
    this._loadedRow = "";
    this._warmedFirst = false;
    this.active = null;
    this.playing = false;
    this._host.changed();
  }

  handlePlay(): void {
    claimAudio(this._audio);
    this.playing = true;
    this._host.changed();
  }

  handlePause(): void {
    releaseAudio(this._audio);
    this.playing = false;
    this._host.changed();
  }

  handleEnded(): void {
    releaseAudio(this._audio);
    this.playing = false;
    this.active = null;
    this._host.progress(0);
    this._host.changed();
  }

  handleTime(): void {
    if (this.active !== null) this._host.progress(progressFraction(this._audio.currentTime, this._audio.duration));
  }

  /** The element could not load what it was given: try the row's fallback once, then mark it unplayable. */
  handleError(): void {
    const id = this.active ?? this._loadedRow;
    const row = this._rows.find((candidate) => candidate.id === id);
    if (!row) return;
    if (row.fallback && this._loaded !== row.fallback) {
      this._primaryBroken.set(row.id, row.src ?? "");
      this._assign(row.id, row.fallback);
      if (this.active === row.id) void this._audio.play().catch(() => undefined);
      return;
    }
    this._unplayable.set(row.id, signature(row));
    if (this.active === row.id) this.active = null;
    this.playing = false;
    this._loaded = "";
    this._loadedRow = "";
    this._host.progress(0);
    this._host.changed();
  }

  private _assign(id: string, src: string): void {
    this._loaded = src;
    this._loadedRow = id;
    this._audio.src = src;
  }
}
