/** Number maths behind `LuStepper` and `LuSlider`. Pure (no DOM, no lit), so it can be tested on its own.
 *
 * Values live on a grid that starts at `min` and moves in `step` (the same rule a native `<input type="range">`
 * follows): min 1, step 5 allows 1, 6, 11 ... The last grid point at or below `max` is the largest value. All
 * results are rounded to the decimals the grid needs, so 0.1 + 0.2 never shows up as 0.30000000000000004. */
export interface StepRange {
    min: number;
    max: number;
    step: number;
}
/** How long a held stepper button waits before it starts repeating, and the pause between repeats (ms). */
export declare const REPEAT_START_MS = 400;
export declare const REPEAT_INTERVAL_MS = 100;
/** PageUp / PageDown move this many steps at once. */
export declare const PAGE_STEPS = 10;
/** Number of decimals needed to write `value` exactly: 0.1 -> 1, 0.25 -> 2, 5 -> 0. */
export declare function decimalsOf(value: number): number;
/** Decimals a value on this range's grid can have (the step's and the minimum's). Use it to format the number. */
export declare function decimalsFor(range: StepRange): number;
/** Rounds to `decimals` places (floating-point safe). */
export declare function roundTo(value: number, decimals: number): number;
/** A usable range: a step that is not a positive number becomes 1, and `max` never sits below `min`. */
export declare function cleanRange(range: StepRange): StepRange;
/** The nearest grid value to `value`, kept inside `min..max`. Not a number -> `min`. */
export declare function clampToStep(value: number, input: StepRange): number;
/** The value `steps` grid points away from `value` (negative = down). A value between grid points first moves to
 * the grid point in that direction (4.2 up one step with step 1 = 5), like a native input's `stepUp`. */
export declare function nextValue(value: number, steps: number, input: StepRange): number;
/** True when the value cannot go further in that direction (the button should be disabled). */
export declare function atLimit(value: number, direction: 1 | -1, input: StepRange): boolean;
/** A number with exactly `decimals` places in the reader's locale (or `locale`): 1.5 with 1 decimal -> "1.5", 2 -> "2.0". */
export declare function formatNumber(value: number, decimals: number, locale?: string): string;
/** Text with its unit, for screen readers and the value label: "40%", "21°C", "3 min": `%` and degree units sit against the number, other units after a space. */
export declare function formatValueText(text: string, unit: string): string;
/** Pause before the next repeat while a stepper button is held: `repeats` is how many repeats already happened. */
export declare function repeatDelayMs(repeats: number): number;
/** What a stepper key does: a number of steps, "min" or "max", or null for keys it ignores. */
export declare function keyAction(key: string): number | "min" | "max" | null;
/** Applies a `keyAction` to a value. */
export declare function applyKey(value: number, action: number | "min" | "max", input: StepRange): number;
