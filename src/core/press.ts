/** Anything a finger or pointer can press. */
const TAPPABLE = 'button, a[href], [role="radio"], [role="option"], [role="tab"], summary, [data-press]';

/** Marks the control under a pointer as pressed (`data-pressed`) the instant the pointer goes down.
 *
 * CSS `:active` isn't reliable for this: touch browsers hold it back until the gesture is known not to be a
 * scroll (about 150 ms in Chrome), and iOS Safari only applies it when a touch listener is present. Styles
 * written for `:is(:active, [data-pressed])` get feedback within a frame everywhere. The mark is removed
 * when the pointer lifts, the gesture turns into a scroll, or after 1.5 seconds. Returns a stop function.
 *
 * Cards: pass your own card root; the window listeners only run while a press is in flight. */
export function trackPresses(root: Node): () => void {
  let pressed: HTMLElement | null = null;
  let timer = 0;
  const ends = ["pointerup", "pointercancel", "dragstart", "contextmenu"];
  const listen = (on: boolean): void => {
    const fn = on ? window.addEventListener.bind(window) : window.removeEventListener.bind(window);
    for (const name of ends) fn(name, clear, true);
    fn("scroll", clear, { capture: true, passive: true } as AddEventListenerOptions);
  };
  function clear(): void {
    window.clearTimeout(timer);
    const element = pressed;
    pressed = null;
    listen(false);
    // Keep the mark for at least one painted frame, so even a very quick tap shows its feedback.
    if (element) window.requestAnimationFrame(() => window.requestAnimationFrame(() => element.removeAttribute("data-pressed")));
  }
  const onDown = (event: Event): void => {
    const down = event as PointerEvent;
    if (down.pointerType === "mouse" && down.button !== 0) return;
    for (const node of down.composedPath()) {
      if (!(node instanceof HTMLElement) || !node.matches(TAPPABLE)) continue;
      if ((node as HTMLButtonElement).disabled || node.getAttribute("aria-disabled") === "true") return;
      clear();
      pressed = node;
      node.setAttribute("data-pressed", "");
      timer = window.setTimeout(clear, 1500);
      listen(true);
      return;
    }
  };
  root.addEventListener("pointerdown", onDown, { capture: true, passive: true });
  return () => {
    root.removeEventListener("pointerdown", onDown, true);
    clear();
  };
}
