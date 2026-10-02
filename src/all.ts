import type { LuElementClass } from "./core/element.ts";
import { defineElements } from "./define.ts";
import type { LucentRegistry } from "./define.ts";
import { LuAudioList, LuAudioPlayer } from "./audio/index.ts";
import { LuButton, LuChip, LuHoldButton, LuRow, LuSegmented, LuSlider, LuStepper } from "./components/index.ts";
import { LuGrid } from "./grid/index.ts";
import { LuImage, LuMediaRail } from "./image/index.ts";
import { LuAppShell, LuNav, LuRoot } from "./shell/index.ts";
import { LuSheet, LuToast } from "./sheet/index.ts";
import { LuSection, LuState } from "./state/index.ts";
import { LuViewStack } from "./view/index.ts";

/** Every element of the toolkit, in no particular order (dependencies are registered automatically). */
export const ALL_ELEMENTS: readonly LuElementClass[] = [
  LuRoot, LuAppShell, LuNav, LuViewStack, LuSheet, LuToast,
  LuGrid, LuState, LuSection, LuRow, LuImage, LuMediaRail, LuAudioPlayer, LuAudioList,
  LuButton, LuChip, LuSegmented, LuStepper, LuSlider, LuHoldButton,
] as unknown as readonly LuElementClass[];

export interface DefineLucentOptions {
  /** Your app's name in lowercase (letters, digits, dashes): `kestrel` registers `<kestrel-lu-sheet>` and friends. */
  prefix: string;
  /** Register only these elements (short names such as `"sheet"`, `"button"`) plus what they render. Default: all.
   * To also keep the bundle small, pass classes to `defineElements` instead (see the README: "Lean bundles"). */
  only?: readonly string[];
}

/** Registers the whole toolkit as `<prefix>-lu-<name>` and returns the registry (`lu.tag("sheet")`). Safe to call
 * twice (existing tags are left alone). Never registers a bare `lu-*` or any `ha-*` tag. */
export function defineLucent(options: DefineLucentOptions): LucentRegistry {
  const only = options.only;
  const elements = only ? ALL_ELEMENTS.filter((element) => only.includes(element.luName)) : ALL_ELEMENTS;
  if (only) {
    const known = new Set(ALL_ELEMENTS.map((element) => element.luName));
    const unknown = only.filter((name) => !known.has(name));
    if (unknown.length) throw new Error(`lucent-ha: unknown element name(s) in "only": ${unknown.join(", ")}.`);
  }
  return defineElements(options.prefix, elements);
}
