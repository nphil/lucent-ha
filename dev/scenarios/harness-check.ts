import type { Scenario } from "../scenario-types.ts";

/** TEMPORARY: proves the scenario hook while dev/screenshots.mjs is tested. Deleted right after. */
export const scenario: Scenario = {
  id: "harness-check",
  title: "Harness self-check",
  create(): HTMLElement {
    const panel = document.createElement("div");
    panel.innerHTML = '<spec-lu-root mode="panel"><h1 style="margin:16px;font:600 var(--lu-type-title) var(--lu-font)">Scenario hook works</h1></spec-lu-root>';
    return panel;
  },
};
