/** "When did the screen react, and when did it stop changing?" for a tap on a tab. The page only records raw timestamps
 * (DOM changes, frames with a running animation, layout shifts, images arriving, every animation frame); this module turns them into the two
 * numbers of the budget. Pure, so the rules can be tested without a browser. All times are milliseconds on the page clock. */

export interface Timeline {
  /** The tap: the `click` event's time stamp. */
  t0: number;
  /** Moments the DOM changed (anything inside the panel, shadow roots included). */
  mutations: readonly number[];
  /** Frames in which a finite animation or transition was running (a fade). */
  animationFrames: readonly number[];
  /** Layout-shift entries (already painted moments). */
  shifts: readonly number[];
  /** `lu-image-load` moments: a picture arrived. */
  images: readonly number[];
  /** Every animation-frame callback during the recording, ascending. */
  frames: readonly number[];
  /** Where the recording stopped. */
  until: number;
}

export interface Settle {
  /** Tap to the first frame that shows any reaction; `null` when nothing changed. */
  firstMs: number | null;
  /** Tap to the last frame that still changed something; `null` when nothing changed. */
  stableMs: number | null;
  /** The recording ran at least `quietMs` past the last change, so "stable" is real and not just where the recording ended. */
  settled: boolean;
}

/** The moment a change made at `time` reaches the screen: the second animation-frame callback after it (the frame that shows it is produced
 * between the first and the second, the same convention the press measurement uses). When the recording ended before that, the end of it. */
export function paintedAt(time: number, frames: readonly number[], until: number): number {
  let seen = 0;
  for (const frame of frames) {
    if (frame <= time) continue;
    seen += 1;
    if (seen === 2) return frame;
  }
  return until;
}

/** `quietMs` of nothing changing after the last change counts as stable (the plan's 100 ms). */
export function analyseTimeline(timeline: Timeline, { quietMs = 100 }: { quietMs?: number } = {}): Settle {
  const { t0, frames, until } = timeline;
  const moments: number[] = [];
  for (const time of timeline.mutations) if (time >= t0) moments.push(paintedAt(time, frames, until));
  for (const time of timeline.images) if (time >= t0) moments.push(paintedAt(time, frames, until));
  for (const time of timeline.animationFrames) if (time >= t0) moments.push(time);
  for (const time of timeline.shifts) if (time >= t0) moments.push(time);
  if (!moments.length) return { firstMs: null, stableMs: null, settled: false };
  const first = Math.min(...moments);
  const last = Math.max(...moments);
  return { firstMs: first - t0, stableMs: last - t0, settled: until - last >= quietMs };
}
