import type { ReactiveController, ReactiveControllerHost } from "lit";
/** Calls `callback(true|false)` whenever `element` enters or leaves the viewport (plus `rootMargin`). Returns
 * the stop function. Without IntersectionObserver (old WebViews, tests) the element counts as visible once. */
export declare function observeInView(element: Element, callback: (visible: boolean) => void, rootMargin?: string): () => void;
/** Lit controller around `observeInView`: `visible` is true while the host (or `target`) is on screen. Work that
 * should only run for visible elements (cards on a busy dashboard, live previews, timers) checks `visible`. */
export declare class InViewController implements ReactiveController {
    visible: boolean;
    private readonly _host;
    private readonly _rootMargin;
    private readonly _target?;
    private readonly _onChange?;
    private _stop?;
    constructor(host: ReactiveControllerHost & HTMLElement, options?: {
        rootMargin?: string;
        target?: () => Element | null;
        onChange?: (visible: boolean) => void;
    });
    hostConnected(): void;
    hostDisconnected(): void;
    /** (Re)starts observing, for example after the target element was re-rendered. */
    observe(): void;
}
