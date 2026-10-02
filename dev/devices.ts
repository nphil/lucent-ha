import devices from "./devices.json";

/** One entry of the nine-size matrix (the sizes from the Music Assistant study, section 6). Touch sizes are emulated
 * as mobile devices with touch events (so `(pointer: coarse)` and `(hover: none)` are true); the others as desktops. */
export interface DeviceSpec {
  /** CSS pixels. */
  width: number;
  height: number;
  touch: boolean;
  label: string;
}

export const DEVICES: Readonly<Record<string, DeviceSpec>> = devices;
export const DEVICE_NAMES: readonly string[] = Object.keys(devices);

/** The matrix entry whose size is exactly `width` x `height` (the viewport of a `shot.mjs` run), if any. */
export function deviceFor(width: number, height: number): string | undefined {
  return DEVICE_NAMES.find((name) => DEVICES[name]?.width === width && DEVICES[name]?.height === height);
}
