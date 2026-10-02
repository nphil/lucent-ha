/** The element that really has focus, looking through open shadow roots. */
export declare function deepActiveElement(): HTMLElement | null;
/** True when the user asked the OS for less motion. */
export declare function prefersReducedMotion(): boolean;
/** True when the primary input is a finger: `(hover: none) and (pointer: coarse)`. */
export declare function isTouchPrimary(): boolean;
/** True for focusable text entry (where the on-screen keyboard appears). */
export declare function isTextEntry(element: Element | null): boolean;
