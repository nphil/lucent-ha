/** The element that really has focus, looking through open shadow roots. */
export function deepActiveElement(): HTMLElement | null {
  let active: Element | null = document.activeElement;
  while (active instanceof HTMLElement && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active instanceof HTMLElement ? active : null;
}

/** True when the user asked the OS for less motion. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True when the primary input is a finger: `(hover: none) and (pointer: coarse)`. */
export function isTouchPrimary(): boolean {
  return typeof matchMedia === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;
}

/** True for focusable text entry (where the on-screen keyboard appears). */
export function isTextEntry(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) return ["text", "search", "email", "url", "tel", "password", "number", ""].includes(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}
