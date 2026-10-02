export { LuButton } from "./button.ts";
export type { LuButtonKind } from "./button.ts";
export { LuChip } from "./chip.ts";
export { CHIP_KINDS, chipIcon, chipKind } from "./chip-model.ts";
export type { LuChipKind } from "./chip-model.ts";
export { LuSegmented } from "./segmented.ts";
export type { LuSegmentOption } from "./segmented.ts";
export { LuStepper } from "./stepper.ts";
export { LuSlider } from "./slider.ts";
export { LuHoldButton } from "./hold-button.ts";
export { applyKey, atLimit, clampToStep, decimalsFor, formatNumber, formatValueText, keyAction, nextValue, repeatDelayMs } from "./stepper-model.ts";
export type { StepRange } from "./stepper-model.ts";
export { sliderExternal, sliderGrabbed, sliderMoved, sliderReleased, valueToFraction } from "./slider-model.ts";
export type { SliderShown } from "./slider-model.ts";
export { HOLD_DEFAULTS, HOLD_DRAIN_MS, HOLD_DURATION_MS, HOLD_IDLE, TAP_MAX_MS, holdDrainRemainingMs, holdPress, holdProgress, holdRelease, holdRemainingMs, holdSettle } from "./hold-model.ts";
export type { HoldConfig, HoldPhase, HoldState } from "./hold-model.ts";

declare global {
  interface HTMLElementEventMap {
    /** Segmented: the chosen option's value (string). Stepper and slider: the number. */
    "lu-change": CustomEvent<{ value: string | number }>;
    /** Slider, while dragging. */
    "lu-input": CustomEvent<{ value: number }>;
    "lu-confirm": CustomEvent<{ via: "hold" | "button" }>;
  }
}
