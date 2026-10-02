/** Marks the control under a pointer as pressed (`data-pressed`) the instant the pointer goes down.
 *
 * CSS `:active` isn't reliable for this: touch browsers hold it back until the gesture is known not to be a
 * scroll (about 150 ms in Chrome), and iOS Safari only applies it when a touch listener is present. Styles
 * written for `:is(:active, [data-pressed])` get feedback within a frame everywhere. The mark is removed
 * when the pointer lifts, the gesture turns into a scroll, or after 1.5 seconds. Returns a stop function.
 *
 * Cards: pass your own card root; the window listeners only run while a press is in flight. */
export declare function trackPresses(root: Node): () => void;
