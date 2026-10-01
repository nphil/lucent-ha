/** Only one recording plays at a time across the whole page: starting one pauses whichever was playing.
 * The holder lives on `globalThis` under a symbol, so two bundles of the toolkit on one page share it. */
interface AudioHolder { active: HTMLMediaElement | null }

const KEY = Symbol.for("lucent-ha:audio-focus");

function holder(): AudioHolder {
  const scope = globalThis as unknown as Record<symbol, AudioHolder | undefined>;
  return (scope[KEY] ??= { active: null });
}

/** Call when `element` starts (or is about to start) playing; pauses the previously active element. */
export function claimAudio(element: HTMLMediaElement): void {
  const state = holder();
  if (state.active && state.active !== element) state.active.pause();
  state.active = element;
}

/** Call when `element` stops, ends or is removed. */
export function releaseAudio(element: HTMLMediaElement): void {
  const state = holder();
  if (state.active === element) state.active = null;
}

/** The element that currently owns audio, if any (for tests and diagnostics). */
export function activeAudio(): HTMLMediaElement | null {
  return holder().active;
}
