/* Derived from music-assistant/frontend src/plugins/touchEvents.ts and src/composables/useHoldToOpenMenu.ts
 * (Apache-2.0, (c) The Music Assistant Authors; see LICENSES/Apache-2.0.txt and THIRD_PARTY_NOTICES.md).
 * Modified: rewritten from a Vue directive to plain pointer events with cancel handling, Lucent's 600 ms
 * `motion.reorder` threshold, and a capture-phase click swallow that is removed with the listeners. */

export interface LongPressOptions {
  /** Hold time before the callback fires (ms). Lucent `motion.reorder`. */
  ms?: number;
  /** Movement that cancels the hold (px). */
  slop?: number;
}

/** Calls `callback` when a finger or mouse button stays down on `element` for `ms` without moving more than
 * `slop`. The click that follows the lift is swallowed so the hold does not also run the tap action.
 *
 * A long press must never be the only route to an action: always keep a visible control that does the same
 * thing (Lucent section 6). Returns a function that removes the listeners. */
export function attachLongPress(element: HTMLElement, callback: (event: PointerEvent) => void, options: LongPressOptions = {}): () => void {
  const ms = options.ms ?? 600;
  const slop = options.slop ?? 10;
  let timer = 0;
  let startX = 0;
  let startY = 0;
  let pointerId = -1;
  let fired = false;

  const cancel = (): void => {
    window.clearTimeout(timer);
    timer = 0;
    pointerId = -1;
  };
  const onDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    fired = false;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = 0;
      fired = true;
      callback(event);
    }, ms);
  };
  const onMove = (event: PointerEvent): void => {
    if (!timer || event.pointerId !== pointerId) return;
    if (Math.abs(event.clientX - startX) > slop || Math.abs(event.clientY - startY) > slop) cancel();
  };
  const onUp = (event: PointerEvent): void => {
    if (event.pointerId === pointerId) cancel();
  };
  const onClick = (event: Event): void => {
    if (!fired) return;
    fired = false;
    event.preventDefault();
    event.stopPropagation();
  };
  const onContextMenu = (event: Event): void => {
    // The browser's own long-press menu must not open on top of ours.
    if (timer || fired) event.preventDefault();
  };

  element.addEventListener("pointerdown", onDown, { passive: true });
  element.addEventListener("pointermove", onMove, { passive: true });
  element.addEventListener("pointerup", onUp, { passive: true });
  element.addEventListener("pointercancel", onUp, { passive: true });
  element.addEventListener("click", onClick, true);
  element.addEventListener("contextmenu", onContextMenu);
  return () => {
    cancel();
    element.removeEventListener("pointerdown", onDown);
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerup", onUp);
    element.removeEventListener("pointercancel", onUp);
    element.removeEventListener("click", onClick, true);
    element.removeEventListener("contextmenu", onContextMenu);
  };
}
