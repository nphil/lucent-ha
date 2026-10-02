import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hassInputsChanged, shouldRender } from "../src/shell/update-gate.ts";
import type { HomeAssistant } from "../src/ha/types.ts";

const base: HomeAssistant = { kioskMode: false, dockedSidebar: "docked", language: "en", auth: { external: { config: { hasSidebar: false } } } };

describe("hassInputsChanged", () => {
  it("a new hass object with the same menu inputs is not a change, however much else moved (a light switched on)", () => {
    const next: HomeAssistant = { ...base, states: { "light.kitchen": { state: "on", attributes: {} } }, connected: true };
    assert.equal(hassInputsChanged(base, next), false);
  });

  it("kiosk mode, the sidebar setting, the companion app's sidebar and the language each count", () => {
    assert.equal(hassInputsChanged(base, { ...base, kioskMode: true }), true);
    assert.equal(hassInputsChanged(base, { ...base, dockedSidebar: "always_hidden" }), true);
    assert.equal(hassInputsChanged(base, { ...base, auth: { external: { config: { hasSidebar: true } } } }), true);
    assert.equal(hassInputsChanged(base, { ...base, language: "de" }), true);
  });

  it("hass appearing or disappearing is a change; two missing values are not", () => {
    assert.equal(hassInputsChanged(undefined, base), true);
    assert.equal(hassInputsChanged(base, undefined), true);
    assert.equal(hassInputsChanged(undefined, undefined), false);
  });

  it("a hass without auth or external info is read safely", () => {
    assert.equal(hassInputsChanged({}, {}), false);
    assert.equal(hassInputsChanged({ auth: {} }, { auth: { external: {} } }), false);
    assert.equal(hassInputsChanged({}, { auth: { external: { config: { hasSidebar: true } } } }), true);
  });
});

describe("shouldRender", () => {
  it("hass churn alone does not render", () => {
    assert.equal(shouldRender(["hass"], base, { ...base, connected: true }), false);
  });

  it("hass alone renders when an input the shell reads changed", () => {
    assert.equal(shouldRender(["hass"], base, { ...base, kioskMode: true }), true);
  });

  it("any other property renders, even together with irrelevant hass churn", () => {
    assert.equal(shouldRender(["hass", "heading"], base, { ...base }), true);
    assert.equal(shouldRender(["current"], undefined, undefined), true);
    assert.equal(shouldRender(["narrow"], base, base), true);
  });

  it("an explicit requestUpdate with nothing changed renders (the profile changed, for example)", () => {
    assert.equal(shouldRender([], base, base), true);
  });

  it("the first render, when hass goes from nothing to something, renders", () => {
    assert.equal(shouldRender(["hass"], undefined, base), true);
  });
});
