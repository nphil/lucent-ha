/** The press cost that does not depend on how busy the host is: the CPU time the page's main thread spent producing the pressed frame, read
 * from a Chromium trace. Wall-clock time to the next frame grows when the machine is loaded; the thread's own CPU time (`tdur`) does not.
 * Method of the Kestrel/FrontendAgent trace study. Pure: it only reads the parsed trace. */

/** The trace events that are the work of producing a frame (style, layout, paint, compositing hand-over). */
export const FRAME_WORK = ["UpdateLayoutTree", "Layout", "PrePaint", "Paint", "Layerize", "Commit", "UpdateLayer"] as const;

/** How long after the pointerdown the frame work still belongs to it. */
export const PRESS_WINDOW_MS = 160;

export interface TraceEvent {
  name: string;
  ph?: string;
  pid: number;
  tid: number;
  /** Start, microseconds. */
  ts: number;
  /** Wall duration, microseconds. */
  dur?: number;
  /** Thread (CPU) duration, microseconds. */
  tdur?: number;
  args?: { data?: { type?: string } };
}

export interface PressThread {
  /** The trace contained the pointerdown. */
  found: boolean;
  /** CPU milliseconds of frame work on the main thread within the window after the pointerdown. */
  ms: number;
  /** How many frame-work events were counted. */
  events: number;
}

/** Sums the thread time of the frame work within `windowMs` after the first `pointerdown` on the thread that handled it. An event that happens
 * entirely inside another counted one (a nested slice) is not added twice. */
export function pressThreadMs(events: readonly TraceEvent[], windowMs = PRESS_WINDOW_MS): PressThread {
  const down = events.find((event) => event.name === "EventDispatch" && event.args?.data?.type === "pointerdown");
  if (!down) return { found: false, ms: 0, events: 0 };
  const end = down.ts + windowMs * 1000;
  const work = events
    .filter((event) => event.pid === down.pid && event.tid === down.tid && event.ph === "X" && (FRAME_WORK as readonly string[]).includes(event.name) && event.ts >= down.ts && event.ts <= end)
    .sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
  let micro = 0;
  let counted = 0;
  let outerEnd = -Infinity;
  for (const event of work) {
    const span = event.dur ?? 0;
    if (event.ts + span <= outerEnd) continue;
    outerEnd = Math.max(outerEnd, event.ts + span);
    micro += event.tdur ?? event.dur ?? 0;
    counted += 1;
  }
  return { found: true, ms: micro / 1000, events: counted };
}
