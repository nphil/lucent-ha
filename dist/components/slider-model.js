/** Maths and drag bookkeeping behind `LuSlider`. Pure (no DOM, no lit). */
import { cleanRange } from "./stepper-model.js";
/** Where `value` sits between `min` and `max`, as 0..1 (a flat range is 0). */
export function valueToFraction(value, input) {
    const { min, max } = cleanRange(input);
    if (max <= min)
        return 0;
    return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
/** A finger or key moved the thumb. */
export const sliderMoved = (state, value) => ({ value, dragging: state.dragging });
export const sliderGrabbed = (state) => ({ value: state.value, dragging: true });
export const sliderReleased = (state) => ({ value: state.value, dragging: false });
/** The page set a new value from outside (a state echo, a preset). While the thumb is held the echo is ignored,
 * so the thumb never jumps out from under the finger; after release the dragged value stands. */
export function sliderExternal(state, value) {
    return state.dragging ? state : { value, dragging: false };
}
