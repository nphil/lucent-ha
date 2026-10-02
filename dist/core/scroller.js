/** The page scroller: `document.scrollingElement`. */
export function documentScroller() {
    return {
        get top() { return (document.scrollingElement ?? document.documentElement).scrollTop; },
        scrollTo(top) { window.scrollTo({ top, behavior: "instant" }); },
        target: window,
        get element() { return document.scrollingElement ?? document.documentElement; },
    };
}
/** The nearest scroller above `from`, looking through shadow roots for an ancestor that exposes a `luScroller`
 * (the app shell does in `contained` mode); the document scroller otherwise. */
export function findScroller(from) {
    let node = from;
    while (node) {
        const candidate = node.luScroller;
        if (candidate && node !== from)
            return candidate;
        node = node.parentNode ?? node.host ?? null;
    }
    return documentScroller();
}
