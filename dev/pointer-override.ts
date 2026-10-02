/** `?pointer=fine|touch` for the harness: forces the answers `matchMedia` gives for the `hover` and `pointer` media features.
 *
 * Why: headless Chrome has no pointing device, so desktop sizes report `(hover: none)` and no `(pointer: ...)` at all
 * (touch sizes report coarse/none correctly, because the device emulation switches touch on). The toolkit reads these two
 * features with `matchMedia` to pick its pointer class (`classifyPointer`, `isTouchPrimary`), so the harness lets a run say
 * "this is a mouse" or "this is a finger".
 *
 * What it cannot do: CSS `@media (hover: hover)` rules inside stylesheets are evaluated by the browser itself and stay
 * as the browser reports them. Hover styling is therefore NOT visible in harness screenshots.
 *
 * This file must be imported before any toolkit code runs (the first import of harness.ts). */
export type PointerMode = "auto" | "touch" | "fine";

/** `(hover)`, `(hover: none)`, `(any-pointer: coarse)` ...: feature name, optional value. */
const FEATURE = /\(\s*(any-)?(hover|pointer)\s*(?::\s*([a-z-]+))?\s*\)/gi;
const ALWAYS = "(min-width: 0px)";
const NEVER = "(min-width: 100000px)";

const realMatchMedia = window.matchMedia.bind(window);
let mode: PointerMode = "auto";

/** What a media feature answers for the forced pointer: a mouse hovers and is fine; a finger does not hover and is coarse. */
function answer(feature: string, value: string | undefined): boolean {
  const state = mode === "fine" ? { hover: "hover", pointer: "fine" } : { hover: "none", pointer: "coarse" };
  const actual = feature === "hover" ? state.hover : state.pointer;
  return value === undefined ? actual !== "none" : value === actual;
}

/** The query with every hover/pointer feature replaced by a constant that is true or false, so the browser evaluates the rest itself. */
function rewrite(query: string): string {
  if (mode === "auto") return query;
  return query.replace(FEATURE, (_all, _any, feature: string, value: string | undefined) => (answer(feature.toLowerCase(), value?.toLowerCase()) ? ALWAYS : NEVER));
}

/** A `MediaQueryList` for a query that mentions hover or pointer: delegates to a real list for the rewritten query and
 * re-opens it when the mode changes, firing `change` when the answer flipped. */
class ForcedMediaQueryList extends EventTarget {
  onchange: ((event: MediaQueryListEvent) => unknown) | null = null;
  private inner: MediaQueryList;

  constructor(readonly media: string) {
    super();
    this.inner = this.open();
  }

  get matches(): boolean {
    return this.inner.matches;
  }

  addListener(listener: EventListener): void {
    this.addEventListener("change", listener);
  }

  removeListener(listener: EventListener): void {
    this.removeEventListener("change", listener);
  }

  /** The mode changed: look at the rewritten query again. */
  reopen(): void {
    const before = this.matches;
    this.inner.removeEventListener("change", this.relay);
    this.inner = this.open();
    if (this.matches !== before) this.relay();
  }

  private open(): MediaQueryList {
    const inner = realMatchMedia(rewrite(this.media));
    inner.addEventListener("change", this.relay);
    return inner;
  }

  private relay = (): void => {
    const event = new MediaQueryListEvent("change", { media: this.media, matches: this.matches });
    this.dispatchEvent(event);
    this.onchange?.(event);
  };
}

const lists = new Set<WeakRef<ForcedMediaQueryList>>();

window.matchMedia = (query: string): MediaQueryList => {
  FEATURE.lastIndex = 0;
  if (!FEATURE.test(query)) return realMatchMedia(query);
  const list = new ForcedMediaQueryList(query);
  lists.add(new WeakRef(list));
  return list as unknown as MediaQueryList;
};

export function getPointerMode(): PointerMode {
  return mode;
}

/** Switches the forced pointer; every list the toolkit already holds re-evaluates and fires `change` if its answer flipped. */
export function setPointerMode(next: PointerMode): void {
  mode = next;
  for (const reference of lists) {
    const list = reference.deref();
    if (list) list.reopen();
    else lists.delete(reference);
  }
}
