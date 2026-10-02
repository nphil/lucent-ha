/** Something that scrolls the page: the document (the normal case inside a Home Assistant panel, which scrolls
 * `html`) or an inner scroll area (the app shell's `contained` mode, an iframe, a harness cell). */
export interface LuScroller {
    /** Current scroll offset in px. */
    readonly top: number;
    scrollTo(top: number): void;
    /** Where to listen for `scroll` events. */
    readonly target: EventTarget;
    /** The scrolling element, when there is one (the document scrolling element for the page scroller). */
    readonly element: Element | null;
}
/** The page scroller: `document.scrollingElement`. */
export declare function documentScroller(): LuScroller;
/** The nearest scroller above `from`, looking through shadow roots for an ancestor that exposes a `luScroller`
 * (the app shell does in `contained` mode); the document scroller otherwise. */
export declare function findScroller(from: Node): LuScroller;
