import type { ReactiveController, ReactiveControllerHost } from "lit";

/** One shared IntersectionObserver per `rootMargin`, however many elements watch: tiles, images, players. */
const observers = new Map<string, IntersectionObserver>();
const callbacks = new WeakMap<Element, Set<(visible: boolean) => void>>();

function observerFor(rootMargin: string): IntersectionObserver {
  let observer = observers.get(rootMargin);
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) for (const callback of callbacks.get(entry.target) ?? []) callback(entry.isIntersecting);
    }, { rootMargin });
    observers.set(rootMargin, observer);
  }
  return observer;
}

/** Calls `callback(true|false)` whenever `element` enters or leaves the viewport (plus `rootMargin`). Returns
 * the stop function. Without IntersectionObserver (old WebViews, tests) the element counts as visible once. */
export function observeInView(element: Element, callback: (visible: boolean) => void, rootMargin = "0px"): () => void {
  if (typeof IntersectionObserver === "undefined") {
    callback(true);
    return () => {};
  }
  let set = callbacks.get(element);
  if (!set) callbacks.set(element, (set = new Set()));
  set.add(callback);
  const observer = observerFor(rootMargin);
  observer.observe(element);
  return () => {
    const current = callbacks.get(element);
    current?.delete(callback);
    if (!current || current.size === 0) {
      callbacks.delete(element);
      observer.unobserve(element);
    }
  };
}

/** Lit controller around `observeInView`: `visible` is true while the host (or `target`) is on screen. Work that
 * should only run for visible elements (cards on a busy dashboard, live previews, timers) checks `visible`. */
export class InViewController implements ReactiveController {
  visible = false;
  private readonly _host: ReactiveControllerHost & HTMLElement;
  private readonly _rootMargin: string;
  private readonly _target?: () => Element | null;
  private readonly _onChange?: (visible: boolean) => void;
  private _stop?: () => void;

  constructor(host: ReactiveControllerHost & HTMLElement, options: { rootMargin?: string; target?: () => Element | null; onChange?: (visible: boolean) => void } = {}) {
    this._host = host;
    this._rootMargin = options.rootMargin ?? "0px";
    this._target = options.target;
    this._onChange = options.onChange;
    host.addController(this);
  }

  hostConnected(): void {
    this.observe();
  }

  hostDisconnected(): void {
    this._stop?.();
    this._stop = undefined;
    this.visible = false;
  }

  /** (Re)starts observing, for example after the target element was re-rendered. */
  observe(): void {
    this._stop?.();
    const element = this._target ? this._target() : this._host;
    if (!element) return;
    this._stop = observeInView(element, (visible) => {
      if (visible === this.visible) return;
      this.visible = visible;
      this._onChange?.(visible);
      this._host.requestUpdate();
    }, this._rootMargin);
  }
}
