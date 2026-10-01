import type { TemplateResult } from "lit";
import type { HomeAssistant } from "../src/ha/types.ts";
import type { ProfileState } from "../src/tokens/profile-model.ts";

/** Handed to every specimen: the harness registers the toolkit with prefix `spec`, so tags are `spec-lu-<name>`. */
export interface SpecimenContext {
  prefix: "spec";
  /** The harness's mock `hass` (narrow/docked sidebar/kiosk state follow the emulated Home Assistant). */
  hass: HomeAssistant;
  /** Home Assistant's `narrow` for the current emulated size. */
  narrow: boolean;
  /** The profile the specimen root resolved (phone / tablet / desktop / smart, short, touch, nav). */
  profile: ProfileState;
}

/** One entry of the specimen page. Each slice adds `dev/specimens/<area>.ts` exporting `specimens: Specimen[]`; the
 * harness build discovers every file in that folder. Write the tags directly (`<spec-lu-button>`). */
export interface Specimen {
  /** kebab-case, unique across all specimen files: "button", "sheet-open". */
  id: string;
  title: string;
  /** Section of the specimen page. */
  group: "ha" | "shell" | "view" | "sheet" | "grid" | "image" | "state" | "controls" | "audio" | "content";
  /** Rendered inside a `spec-lu-root` cell: tokens, profile and container queries are live. Use real content,
   * every variant/state of the element that exists (rest, selected, disabled, loading, error, long text, RTL-safe). */
  render(ctx: SpecimenContext): TemplateResult;
  /** Runs once after the first render, for states that need an interaction (open a sheet, focus a control, start a
   * toast). May return a cleanup function. */
  setup?(cell: HTMLElement, ctx: SpecimenContext): void | (() => void) | Promise<void | (() => void)>;
  /** "cell" (default): one grid cell; "wide": spans two cells; "full": the whole page width (shell-like). */
  size?: "cell" | "wide" | "full";
}
