/** What the guard looks at. The browser defaults are used when it is not given (tests pass fakes). */
export interface EscapeEnv {
    /** The element that really has focus, looking through shadow roots. */
    activeElement(): Element | null;
    /** True when Escape belongs to the focused element: a text field, an editable area, a native select. */
    ownsEscape(element: Element | null): boolean;
    /** True when an open dialog, menu or popover is in the key event's path, or Home Assistant has a dialog open. */
    insideOverlay(event: KeyboardEvent): boolean;
    /** How many toolkit layers (sheets, pickers ...) are open. */
    layerDepth(): number;
}
/** True when this keydown should act as Back: a plain Escape (no modifier, not a key repeat, not an IME cancel)
 * that nothing else wants. Something else wants it when a toolkit layer is open, when focus is in a field the user
 * types or picks in, or when an open dialog, menu or popover (including Home Assistant's own) contains the key.
 * Call `goBack(...)` when it returns true, and `event.preventDefault()` yourself. */
export declare function shouldEscapeNavigateBack(event: KeyboardEvent, env?: EscapeEnv): boolean;
