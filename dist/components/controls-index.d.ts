export { LuButton } from "./button.js";
export type { LuButtonKind } from "./button.js";
export { LuChip } from "./chip.js";
export { CHIP_KINDS, chipIcon, chipKind } from "./chip-model.js";
export type { LuChipKind } from "./chip-model.js";
export { LuSegmented } from "./segmented.js";
export type { LuSegmentOption } from "./segmented.js";
export { LuStepper } from "./stepper.js";
export { LuSlider } from "./slider.js";
export { LuHoldButton } from "./hold-button.js";
export { applyKey, atLimit, clampToStep, decimalsFor, formatNumber, formatValueText, keyAction, nextValue, repeatDelayMs } from "./stepper-model.js";
export type { StepRange } from "./stepper-model.js";
export { sliderExternal, sliderGrabbed, sliderMoved, sliderReleased, valueToFraction } from "./slider-model.js";
export type { SliderShown } from "./slider-model.js";
export { HOLD_DEFAULTS, HOLD_DRAIN_MS, HOLD_DURATION_MS, HOLD_IDLE, TAP_MAX_MS, holdDrainRemainingMs, holdPress, holdProgress, holdRelease, holdRemainingMs, holdSettle } from "./hold-model.js";
export type { HoldConfig, HoldPhase, HoldState } from "./hold-model.js";
declare global {
    interface HTMLElementEventMap {
        /** Segmented: the chosen option's value (string). Stepper and slider: the number. */
        "lu-change": CustomEvent<{
            value: string | number;
        }>;
        /** Slider, while dragging. */
        "lu-input": CustomEvent<{
            value: number;
        }>;
        "lu-confirm": CustomEvent<{
            via: "hold" | "button";
        }>;
    }
}
