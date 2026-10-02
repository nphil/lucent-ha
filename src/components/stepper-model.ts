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
export const REPEAT_START_MS = 400;
export const REPEAT_INTERVAL_MS = 100;

/** PageUp / PageDown move this many steps at once. */
export const PAGE_STEPS = 10;

/** Largest number of decimals we ever round to (also protects against exponent notation like 1e-7). */
const MAX_DECIMALS = 10;
/** Distance from a grid point (in steps) that still counts as "on the grid". */
const GRID_EPSILON = 1e-9;

/** Number of decimals needed to write `value` exactly: 0.1 -> 1, 0.25 -> 2, 5 -> 0. */
export function decimalsOf(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(Math.abs(value));
  const exponent = /e-(\d+)$/.exec(text);
  if (exponent) return Math.min(MAX_DECIMALS, Number(exponent[1]) + (text.split("e")[0]!.split(".")[1]?.length ?? 0));
  return Math.min(MAX_DECIMALS, text.split(".")[1]?.length ?? 0);
}

/** Decimals a value on this range's grid can have (the step's and the minimum's). Use it to format the number. */
export function decimalsFor(range: StepRange): number {
  const { min, step } = cleanRange(range);
  return Math.max(decimalsOf(step), decimalsOf(min));
}

/** Rounds to `decimals` places (floating-point safe). */
export function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(Math.min(MAX_DECIMALS, Math.max(0, decimals))));
}

/** A usable range: a step that is not a positive number becomes 1, and `max` never sits below `min`. */
export function cleanRange(range: StepRange): StepRange {
  const min = Number.isFinite(range.min) ? range.min : 0;
  const max = Number.isFinite(range.max) ? Math.max(range.max, min) : min;
  const step = Number.isFinite(range.step) && range.step > 0 ? range.step : 1;
  return { min, max, step };
}

/** Index of the last grid point that fits inside the range. */
function lastIndex(range: StepRange): number {
  return Math.floor((range.max - range.min) / range.step + GRID_EPSILON);
}

function valueAt(index: number, range: StepRange): number {
  const clamped = Math.min(lastIndex(range), Math.max(0, index));
  return roundTo(range.min + clamped * range.step, decimalsFor(range));
}

/** The nearest grid value to `value`, kept inside `min..max`. Not a number -> `min`. */
export function clampToStep(value: number, input: StepRange): number {
  const range = cleanRange(input);
  if (!Number.isFinite(value)) return range.min;
  return valueAt(Math.round((value - range.min) / range.step), range);
}

/** The value `steps` grid points away from `value` (negative = down). A value between grid points first moves to
 * the grid point in that direction (4.2 up one step with step 1 = 5), like a native input's `stepUp`. */
export function nextValue(value: number, steps: number, input: StepRange): number {
  const range = cleanRange(input);
  if (!Number.isFinite(value) || steps === 0) return clampToStep(value, range);
  const index = (value - range.min) / range.step;
  const nearest = Math.round(index);
  if (Math.abs(index - nearest) < GRID_EPSILON) return valueAt(nearest + steps, range);
  return valueAt(steps > 0 ? Math.ceil(index) + steps - 1 : Math.floor(index) + steps + 1, range);
}

/** True when the value cannot go further in that direction (the button should be disabled). */
export function atLimit(value: number, direction: 1 | -1, input: StepRange): boolean {
  const range = cleanRange(input);
  return direction > 0 ? value >= valueAt(lastIndex(range), range) : value <= range.min;
}

/** A number with exactly `decimals` places in the reader's locale (or `locale`): 1.5 with 1 decimal -> "1.5", 2 -> "2.0". */
export function formatNumber(value: number, decimals: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}

/** Text with its unit, for screen readers and the value label: "40%", "21°C", "3 min": `%` and degree units sit against the number, other units after a space. */
export function formatValueText(text: string, unit: string): string {
  if (unit === "") return text;
  return /^[%°]/.test(unit) ? `${text}${unit}` : `${text} ${unit}`;
}

/** Pause before the next repeat while a stepper button is held: `repeats` is how many repeats already happened. */
export function repeatDelayMs(repeats: number): number {
  return repeats <= 0 ? REPEAT_START_MS : REPEAT_INTERVAL_MS;
}

/** What a stepper key does: a number of steps, "min" or "max", or null for keys it ignores. */
export function keyAction(key: string): number | "min" | "max" | null {
  switch (key) {
    case "ArrowUp":
    case "ArrowRight":
      return 1;
    case "ArrowDown":
    case "ArrowLeft":
      return -1;
    case "PageUp":
      return PAGE_STEPS;
    case "PageDown":
      return -PAGE_STEPS;
    case "Home":
      return "min";
    case "End":
      return "max";
    default:
      return null;
  }
}

/** Applies a `keyAction` to a value. */
export function applyKey(value: number, action: number | "min" | "max", input: StepRange): number {
  const range = cleanRange(input);
  if (action === "min") return range.min;
  if (action === "max") return valueAt(lastIndex(range), range);
  return nextValue(value, action, range);
}
