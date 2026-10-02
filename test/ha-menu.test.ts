import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setKioskMode, showMenuButton, toggleHaMenu } from "../src/ha/menu.ts";
import type { HomeAssistant } from "../src/ha/types.ts";

type Sidebar = HomeAssistant["dockedSidebar"];

function hass(parts: { kiosk?: boolean; nativeSidebar?: boolean; sidebar?: Sidebar }): HomeAssistant {
  return {
    kioskMode: parts.kiosk,
    dockedSidebar: parts.sidebar,
    auth: parts.nativeSidebar === undefined ? undefined : { external: { config: { hasSidebar: parts.nativeSidebar } } },
  };
}

describe("showMenuButton: real situations", () => {
  const rows: Array<[string, HomeAssistant | undefined, boolean, boolean | undefined, boolean]> = [
    // name,                                                    hass,                                     narrow, wall,      button
    ["phone, sidebar docked setting (a drawer on narrow)",       hass({ sidebar: "docked" }),               true,  undefined, true],
    ["tablet portrait, sidebar auto",                            hass({ sidebar: "auto" }),                 true,  undefined, true],
    ["desktop with the sidebar docked: it is already visible",   hass({ sidebar: "docked" }),               false, undefined, false],
    ["desktop with the sidebar on auto",                         hass({ sidebar: "auto" }),                 false, undefined, false],
    ["desktop, user hid the sidebar for good (always_hidden)",   hass({ sidebar: "always_hidden" }),        false, undefined, true],
    ["phone, sidebar always_hidden",                             hass({ sidebar: "always_hidden" }),        true,  undefined, true],
    ["kiosk on a phone: Home Assistant hides its chrome",        hass({ kiosk: true, sidebar: "docked" }),  true,  undefined, false],
    ["kiosk on a wide screen with always_hidden",                hass({ kiosk: true, sidebar: "always_hidden" }), false, undefined, false],
    ["kiosk explicitly off, phone",                              hass({ kiosk: false }),                    true,  undefined, true],
    ["Companion app with its own sidebar, phone",                hass({ nativeSidebar: true }),             true,  undefined, false],
    ["Companion app with its own sidebar and always_hidden",     hass({ nativeSidebar: true, sidebar: "always_hidden" }), true, undefined, false],
    ["Companion app WITHOUT its own sidebar, phone",             hass({ nativeSidebar: false }),            true,  undefined, true],
    ["Companion app without its own sidebar, wide docked",       hass({ nativeSidebar: false, sidebar: "docked" }), false, undefined, false],
    ["a mock hass with no fields, wide",                         {},                                        false, undefined, false],
    ["a mock hass with no fields, narrow",                       {},                                        true,  undefined, true],
    ["hass not handed over yet, wide",                           undefined,                                 false, undefined, false],
    ["hass not handed over yet, narrow",                         undefined,                                 true,  undefined, true],
    ["wall: false behaves like not given",                       hass({ sidebar: "docked" }),               false, false,     false],
    ["Echo Show in wall mode: 960 px is not narrow, kiosk is on", hass({ kiosk: true, sidebar: "docked" }), false, true,      true],
    ["wall mode on a phone",                                     hass({ kiosk: true }),                     true,  true,      true],
    ["wall mode requested, Home Assistant has not reported kiosk yet", hass({ kiosk: false, sidebar: "docked" }), false, true, true],
    ["wall mode before hass arrives",                            undefined,                                 false, true,      true],
    ["wall mode, but the Companion app draws its own sidebar",   hass({ kiosk: true, nativeSidebar: true }), false, true,     false],
  ];
  for (const [name, haState, narrow, wall, expected] of rows) {
    it(name, () => {
      assert.equal(showMenuButton(haState, narrow, wall === undefined ? undefined : { wall }), expected);
    });
  }
});

describe("showMenuButton: rules that hold in every combination", () => {
  const kioskValues = [undefined, false, true];
  const nativeValues = [undefined, false, true];
  const sidebarValues: Sidebar[] = [undefined, "docked", "auto", "always_hidden"];
  const combos: Array<{ state: HomeAssistant; narrow: boolean; label: string }> = [];
  for (const kiosk of kioskValues) {
    for (const nativeSidebar of nativeValues) {
      for (const sidebar of sidebarValues) {
        for (const narrow of [false, true]) {
          combos.push({ state: hass({ kiosk, nativeSidebar, sidebar }), narrow, label: `kiosk=${kiosk} native=${nativeSidebar} sidebar=${sidebar} narrow=${narrow}` });
        }
      }
    }
  }

  it("never shows a button when the Companion app draws its own sidebar", () => {
    for (const { state, narrow, label } of combos) {
      if (state.auth?.external?.config?.hasSidebar !== true) continue;
      for (const wall of [undefined, false, true]) {
        assert.equal(showMenuButton(state, narrow, wall === undefined ? undefined : { wall }), false, `${label} wall=${wall}`);
      }
    }
  });

  it("wall mode always shows the panel's own button (unless the app has a sidebar)", () => {
    for (const { state, narrow, label } of combos) {
      if (state.auth?.external?.config?.hasSidebar === true) continue;
      assert.equal(showMenuButton(state, narrow, { wall: true }), true, label);
    }
  });

  it("without wall mode, kiosk mode always hides the button", () => {
    for (const { state, narrow, label } of combos) {
      if (!state.kioskMode) continue;
      assert.equal(showMenuButton(state, narrow), false, label);
    }
  });
});

describe("toggleHaMenu", () => {
  function listen(target: EventTarget): CustomEvent[] {
    const seen: CustomEvent[] = [];
    target.addEventListener("hass-toggle-menu", (event) => seen.push(event as CustomEvent));
    return seen;
  }

  it("fires one bubbling, composed hass-toggle-menu event from the element", () => {
    const element = new EventTarget();
    const seen = listen(element);
    toggleHaMenu(element);
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.bubbles, true);
    assert.equal(seen[0]?.composed, true);
  });

  it("asks Home Assistant to open, close or toggle", () => {
    const element = new EventTarget();
    const seen = listen(element);
    toggleHaMenu(element, true);
    toggleHaMenu(element, false);
    toggleHaMenu(element);
    assert.deepEqual(
      seen.map((event) => event.detail),
      [{ open: true }, { open: false }, {}],
    );
  });
});

describe("setKioskMode", () => {
  function listen(target: EventTarget): boolean[] {
    const seen: boolean[] = [];
    target.addEventListener("hass-kiosk-mode", (event) => seen.push((event as CustomEvent<{ enable: boolean }>).detail.enable));
    return seen;
  }

  it("switches kiosk mode on, and the returned function switches it off again", () => {
    const target = new EventTarget();
    const seen = listen(target);
    const release = setKioskMode(true, target);
    assert.deepEqual(seen, [true]);
    release();
    assert.deepEqual(seen, [true, false]);
  });

  it("releasing twice switches off only once (safe from disconnectedCallback)", () => {
    const target = new EventTarget();
    const seen = listen(target);
    const release = setKioskMode(true, target);
    release();
    release();
    assert.deepEqual(seen, [true, false]);
  });

  it("each call has its own release", () => {
    const target = new EventTarget();
    const seen = listen(target);
    const first = setKioskMode(true, target);
    const second = setKioskMode(true, target);
    first();
    second();
    assert.deepEqual(seen, [true, true, false, false]);
  });
});
