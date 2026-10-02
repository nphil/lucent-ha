/** Maths and drag bookkeeping behind `LuSlider`. Pure (no DOM, no lit). */
import { type StepRange } from "./stepper-model.js";
/** Where `value` sits between `min` and `max`, as 0..1 (a flat range is 0). */
export declare function valueToFraction(value: number, input: StepRange): number;
/** What the slider shows while it is, or is not, being dragged. */
export interface SliderShown {
    readonly value: number;
    readonly dragging: boolean;
}
/** A finger or key moved the thumb. */
export declare const sliderMoved: (state: SliderShown, value: number) => SliderShown;
export declare const sliderGrabbed: (state: SliderShown) => SliderShown;
export declare const sliderReleased: (state: SliderShown) => SliderShown;
/** The page set a new value from outside (a state echo, a preset). While the thumb is held the echo is ignored,
 * so the thumb never jumps out from under the finger; after release the dragged value stands. */
export declare function sliderExternal(state: SliderShown, value: number): SliderShown;
