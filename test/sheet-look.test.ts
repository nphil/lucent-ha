import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dialogLook, rootsItsBackdrop } from "../src/sheet/sheet-model.ts";

describe("dialogLook: how the theme's dialog filters are drawn", () => {
  it("Home Assistant's brightness(68%) scrim becomes a black layer that is 32 % dark", () => {
    assert.deepEqual(dialogLook("brightness(68%)", "none", true), { dim: 0.32, flatFrost: false });
  });

  it("reads a plain number, spaces and capitals the same way, and the two ends", () => {
    assert.equal(dialogLook(" BRIGHTNESS( 0.5 ) ", "", true).dim, 0.5);
    assert.equal(dialogLook("brightness(100%)", "", true).dim, 0);
    assert.equal(dialogLook("brightness(0%)", "", true).dim, 1);
  });

  it("any scrim filter that is not a plain darkening stays a filter", () => {
    for (const filter of ["blur(4px)", "brightness(120%)", "brightness(68%) blur(2px)", "brightness(-1)", "saturate(50%)", "none", ""]) assert.equal(dialogLook(filter, "", true).dim, null, filter);
  });

  it("a blurred panel in a scrim with a filter only ever blurs the scrim's own colour (where the browser makes the scrim the root of its backdrop)", () => {
    assert.equal(dialogLook("brightness(68%)", "blur(8px)", true).flatFrost, true);
    assert.equal(dialogLook("blur(4px)", "blur(8px)", true).flatFrost, true);
  });

  it("in a browser where that rule was not checked the panel keeps its blur, and the dim is a black layer all the same", () => {
    assert.deepEqual(dialogLook("brightness(68%)", "blur(8px)", false), { dim: 0.32, flatFrost: false });
  });

  it("a blurred panel in a scrim without a filter blurs the page, which shows: it is left alone", () => {
    assert.equal(dialogLook("none", "blur(8px)", true).flatFrost, false);
    assert.equal(dialogLook("", "blur(8px)", true).flatFrost, false);
  });

  it("a panel that does not blur has nothing to redraw", () => {
    assert.equal(dialogLook("brightness(68%)", "none", true).flatFrost, false);
    assert.equal(dialogLook("brightness(68%)", "", true).flatFrost, false);
  });
});

describe("rootsItsBackdrop: which browsers the backdrop-root rule was checked in", () => {
  const checked = [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 9; AEOCH) AppleWebKit/537.36 (KHTML, like Gecko) Silk/120.4 like Chrome/120.0.0.0 Safari/537.36",
  ];
  const notChecked = [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
    "",
  ];
  it("is true for Chrome (headless too), Edge, Android's WebView and Silk", () => {
    for (const agent of checked) assert.equal(rootsItsBackdrop(agent), true, agent);
  });
  it("is false for Safari, every browser on iOS, Firefox and an unknown agent", () => {
    for (const agent of notChecked) assert.equal(rootsItsBackdrop(agent), false, agent);
  });
});
