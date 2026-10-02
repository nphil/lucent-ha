import { defineElements } from "./define.js";
import { LuAudioList, LuAudioPlayer } from "./audio/index.js";
import { LuButton, LuChip, LuHoldButton, LuRow, LuSegmented, LuSlider, LuStepper } from "./components/index.js";
import { LuGrid } from "./grid/index.js";
import { LuImage, LuMediaRail } from "./image/index.js";
import { LuAppShell, LuNav, LuRoot } from "./shell/index.js";
import { LuSheet, LuToast } from "./sheet/index.js";
import { LuSection, LuState } from "./state/index.js";
import { LuViewStack } from "./view/index.js";
/** Every element of the toolkit, in no particular order (dependencies are registered automatically). */
export const ALL_ELEMENTS = [
    LuRoot, LuAppShell, LuNav, LuViewStack, LuSheet, LuToast,
    LuGrid, LuState, LuSection, LuRow, LuImage, LuMediaRail, LuAudioPlayer, LuAudioList,
    LuButton, LuChip, LuSegmented, LuStepper, LuSlider, LuHoldButton,
];
/** Registers the whole toolkit as `<prefix>-lu-<name>` and returns the registry (`lu.tag("sheet")`). Safe to call
 * twice (existing tags are left alone). Never registers a bare `lu-*` or any `ha-*` tag. */
export function defineLucent(options) {
    const only = options.only;
    const elements = only ? ALL_ELEMENTS.filter((element) => only.includes(element.luName)) : ALL_ELEMENTS;
    if (only) {
        const known = new Set(ALL_ELEMENTS.map((element) => element.luName));
        const unknown = only.filter((name) => !known.has(name));
        if (unknown.length)
            throw new Error(`lucent-ha: unknown element name(s) in "only": ${unknown.join(", ")}.`);
    }
    return defineElements(options.prefix, elements);
}
