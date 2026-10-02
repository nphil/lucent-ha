/** Reports an error thrown by a callback the toolkit ran on someone else's behalf (an `onClose`, a subscriber, an
 * `onChange`). It is rethrown from a microtask, so it appears in the console like any uncaught error while the loop
 * that called the callback carries on with the next one and the toolkit's own bookkeeping stays intact. */
export function reportAsync(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}
