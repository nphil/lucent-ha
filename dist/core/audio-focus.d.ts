/** Call when `element` starts (or is about to start) playing; pauses the previously active element. */
export declare function claimAudio(element: HTMLMediaElement): void;
/** Call when `element` stops, ends or is removed. */
export declare function releaseAudio(element: HTMLMediaElement): void;
/** The element that currently owns audio, if any (for tests and diagnostics). */
export declare function activeAudio(): HTMLMediaElement | null;
