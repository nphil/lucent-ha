/** Maths and drag bookkeeping behind `LuSlider`. Pure (no DOM, no lit). */

import { cleanRange, type StepRange } from "./stepper-model.ts";

/** Where `value` sits between `min` and `max`, as 0..1 (a flat range is 0). */
export function valueToFraction(value: number, input: StepRange): number {
  const { min, max } = cleanRange(input);
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** What the slider shows while it is, or is not, being dragged. */
export interface SliderShown {
  readonly value: number;
  readonly dragging: boolean;
}

/** A finger or key moved the thumb. */
export const sliderMoved = (state: SliderShown, value: number): SliderShown => ({ value, dragging: state.dragging });

export const sliderGrabbed = (state: SliderShown): SliderShown => ({ value: state.value, dragging: true });

export const sliderReleased = (state: SliderShown): SliderShown => ({ value: state.value, dragging: false });

/** The page set a new value from outside (a state echo, a preset). While the thumb is held the echo is ignored,
 * so the thumb never jumps out from under the finger; after release the dragged value stands. */
export function sliderExternal(state: SliderShown, value: number): SliderShown {
  return state.dragging ? state : { value, dragging: false };
}
