const KEY = Symbol.for("lucent-ha:audio-focus");
function holder() {
    const scope = globalThis;
    return (scope[KEY] ??= { active: null });
}
/** Call when `element` starts (or is about to start) playing; pauses the previously active element. */
export function claimAudio(element) {
    const state = holder();
    if (state.active && state.active !== element)
        state.active.pause();
    state.active = element;
}
/** Call when `element` stops, ends or is removed. */
export function releaseAudio(element) {
    const state = holder();
    if (state.active === element)
        state.active = null;
}
/** The element that currently owns audio, if any (for tests and diagnostics). */
export function activeAudio() {
    return holder().active;
}
