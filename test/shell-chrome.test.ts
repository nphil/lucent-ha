import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import { ceilPx, chromeSizes, publishSizes } from "../src/shell/chrome-metrics.ts";
import type { ChromeSizes } from "../src/shell/chrome-metrics.ts";
import { ChromeMeter } from "../src/shell/chrome-meter.ts";
import type { ChromeRegions, ChromeState, FrameScheduler } from "../src/shell/chrome-meter.ts";
import type { NavMode } from "../src/tokens/profile-model.ts";

describe("ceilPx", () => {
  it("rounds fractions up so no sliver of content peeks out under the chrome", () => {
    assert.equal(ceilPx(56.4), 57);
    assert.equal(ceilPx(112.5), 113);
  });

  it("ignores float noise from layout maths", () => {
    assert.equal(ceilPx(56.0000001), 56);
    assert.equal(ceilPx(56), 56);
  });

  it("anything that is not a positive number is 0", () => {
    for (const value of [0, -4, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) assert.equal(ceilPx(value), 0, String(value));
  });
});

describe("chromeSizes: what is published for each nav mode", () => {
  it("the top chrome is the measured top block as it is (in pills mode that block already contains the pills row)", () => {
    assert.equal(chromeSizes("tabs", { top: 57, rail: 0, dock: 0 }).topChrome, "57px");
    assert.equal(chromeSizes("pills", { top: 121, rail: 0, dock: 0 }).topChrome, "121px");
  });

  it("only the rail mode publishes a rail width; a stale rail measurement in any other mode is ignored", () => {
    assert.equal(chromeSizes("rail", { top: 49, rail: 72, dock: 0 }).railW, "72px");
    for (const mode of ["tabs", "pills", "bottom"] as NavMode[]) assert.equal(chromeSizes(mode, { top: 57, rail: 72, dock: 0 }).railW, "0px", mode);
  });

  it("the bottom value does not depend on the mode: a strip or the home-indicator padding exists without a bottom bar", () => {
    const modes: NavMode[] = ["tabs", "pills", "bottom", "rail"];
    for (const mode of modes) assert.equal(chromeSizes(mode, { top: 57, rail: 0, dock: 34 }).bottomBar, "34px", mode);
  });

  it("a bottom bar with a strip above it is one value, the whole dock", () => {
    assert.deepEqual(chromeSizes("bottom", { top: 57, rail: 0, dock: 91 }), { topChrome: "57px", bottomBar: "91px", railW: "0px" });
  });

  it("fractional measurements are rounded up", () => {
    assert.deepEqual(chromeSizes("rail", { top: 48.4, rail: 71.2, dock: 33.5 }), { topChrome: "49px", bottomBar: "34px", railW: "72px" });
  });
});

/** A style object that records every write. */
function fakeStyle() {
  const values = new Map<string, string>();
  const writes: string[] = [];
  return {
    values,
    writes,
    setProperty(name: string, value: string) { values.set(name, value); writes.push(`set ${name}`); },
    removeProperty(name: string) { values.delete(name); writes.push(`remove ${name}`); return ""; },
  };
}

describe("publishSizes", () => {
  const sizes: ChromeSizes = { topChrome: "56px", bottomBar: "64px", railW: "0px" };

  it("writes all three properties the first time", () => {
    const style = fakeStyle();
    publishSizes(style, sizes, null);
    assert.deepEqual([...style.values], [["--lu-top-chrome", "56px"], ["--lu-bottom-bar", "64px"], ["--lu-rail-w", "0px"]]);
  });

  it("writes nothing when nothing changed, and only the property that did when one changed", () => {
    const style = fakeStyle();
    let published = publishSizes(style, sizes, null);
    style.writes.length = 0;
    published = publishSizes(style, { ...sizes }, published);
    assert.deepEqual(style.writes, []);
    published = publishSizes(style, { ...sizes, bottomBar: "80px" }, published);
    assert.deepEqual(style.writes, ["set --lu-bottom-bar"]);
    assert.equal(published?.bottomBar, "80px");
  });

  it("null removes all three so the token defaults apply again, and removing twice does nothing more", () => {
    const style = fakeStyle();
    let published = publishSizes(style, sizes, null);
    style.writes.length = 0;
    published = publishSizes(style, null, published);
    assert.equal(published, null);
    assert.deepEqual(style.writes, ["remove --lu-top-chrome", "remove --lu-bottom-bar", "remove --lu-rail-w"]);
    assert.equal(style.values.size, 0);
    style.writes.length = 0;
    publishSizes(style, null, published);
    assert.deepEqual(style.writes, []);
  });
});

/** Stands in for the browser's ResizeObserver: remembers what is watched and lets a test report a resize. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  watched = new Set<Element>();
  private readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(element: Element): void { this.watched.add(element); }
  disconnect(): void { this.watched.clear(); }
  unobserve(element: Element): void { this.watched.delete(element); }
  fire(): void { this.callback(); }
}

/** Animation frames a test runs by hand. */
class FakeFrames implements FrameScheduler {
  private next = 1;
  readonly pending = new Map<number, () => void>();
  request(callback: () => void): number {
    const handle = this.next++;
    this.pending.set(handle, callback);
    return handle;
  }
  cancel(handle: number): void { this.pending.delete(handle); }
  /** Runs every requested frame callback. */
  flush(): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const callback of callbacks) callback();
  }
}

/** An element with a size a test can change. */
interface Box {
  width: number;
  height: number;
  getBoundingClientRect(): { width: number; height: number };
}

function box(width: number, height: number): Box {
  const element: Box = { width, height, getBoundingClientRect() { return { width: element.width, height: element.height }; } };
  return element;
}

interface FakeShell {
  mode: NavMode;
  regions: Partial<Record<keyof ChromeRegions, Box>>;
}

describe("ChromeMeter", () => {
  const realObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  before(() => { (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver; });
  after(() => { (globalThis as { ResizeObserver?: unknown }).ResizeObserver = realObserver; });
  afterEach(() => { FakeResizeObserver.instances.length = 0; });

  /** A shell stand-in: a host with a recording style and a state the test can change between renders. */
  function setup(state: FakeShell) {
    const style = fakeStyle();
    const host = { style } as unknown as HTMLElement;
    const read = (): ChromeState => ({
      mode: state.mode,
      regions: { top: null, rail: null, dock: null, ...(state.regions as Partial<ChromeRegions>) },
    });
    const frames = new FakeFrames();
    const meter = new ChromeMeter(host, read, frames);
    const observer = () => FakeResizeObserver.instances[0] as FakeResizeObserver;
    return { style, meter, observer, state, frames };
  }

  it("watches the rendered regions and publishes their sizes straight away", () => {
    const { style, meter, observer } = setup({ mode: "bottom", regions: { top: box(390, 57), dock: box(390, 91) } });
    meter.sync();
    assert.equal(observer().watched.size, 2);
    assert.equal(style.values.get("--lu-top-chrome"), "57px");
    assert.equal(style.values.get("--lu-bottom-bar"), "91px");
    assert.equal(style.values.get("--lu-rail-w"), "0px");
  });

  it("publishes what the observer reports one frame later, never inside the observer's own callback, writing only what changed", () => {
    const dock = box(390, 91);
    const { style, meter, observer, frames } = setup({ mode: "bottom", regions: { top: box(390, 57), dock } });
    meter.sync();
    style.writes.length = 0;
    dock.height = 140;
    observer().fire();
    assert.deepEqual(style.writes, [], "nothing is written from inside the observer callback");
    frames.flush();
    assert.deepEqual(style.writes, ["set --lu-bottom-bar"]);
    assert.equal(style.values.get("--lu-bottom-bar"), "140px");
  });

  it("several reports in one frame are one publish", () => {
    const dock = box(390, 91);
    const { style, meter, observer, frames } = setup({ mode: "bottom", regions: { top: box(390, 57), dock } });
    meter.sync();
    style.writes.length = 0;
    dock.height = 100;
    observer().fire();
    dock.height = 120;
    observer().fire();
    dock.height = 140;
    observer().fire();
    assert.equal(frames.pending.size, 1);
    frames.flush();
    assert.deepEqual(style.writes, ["set --lu-bottom-bar"]);
    assert.equal(style.values.get("--lu-bottom-bar"), "140px");
  });

  it("a render that changes the layout publishes at once and makes the waiting frame unnecessary", () => {
    const { style, meter, observer, frames, state } = setup({ mode: "bottom", regions: { top: box(844, 57), dock: box(844, 91) } });
    meter.sync();
    observer().fire();
    assert.equal(frames.pending.size, 1);
    state.mode = "rail";
    state.regions = { top: box(844, 49), rail: box(72, 700), dock: box(844, 0) };
    meter.sync();
    assert.equal(frames.pending.size, 0);
    assert.equal(style.values.get("--lu-rail-w"), "72px");
  });

  it("syncing again with the same regions and mode does not touch style", () => {
    const { style, meter } = setup({ mode: "tabs", regions: { top: box(1280, 57), dock: box(1280, 0) } });
    meter.sync();
    style.writes.length = 0;
    meter.sync();
    assert.deepEqual(style.writes, []);
  });

  it("a mode switch swaps the watched regions and publishes the new set at once, without waiting for a resize", () => {
    const { style, meter, observer, state } = setup({ mode: "bottom", regions: { top: box(844, 57), dock: box(844, 91) } });
    meter.sync();
    assert.equal(style.values.get("--lu-bottom-bar"), "91px");
    state.mode = "rail";
    state.regions = { top: box(844, 49), rail: box(72, 700), dock: box(844, 0) };
    meter.sync();
    assert.equal(observer().watched.size, 3);
    assert.deepEqual([style.values.get("--lu-top-chrome"), style.values.get("--lu-bottom-bar"), style.values.get("--lu-rail-w")], ["49px", "0px", "72px"]);
  });

  it("a mode switch that keeps the same regions still republishes (a rail that is still measured stops counting)", () => {
    const { style, meter, state } = setup({ mode: "rail", regions: { top: box(844, 49), rail: box(72, 700), dock: box(844, 0) } });
    meter.sync();
    assert.equal(style.values.get("--lu-rail-w"), "72px");
    state.mode = "tabs";
    meter.sync();
    assert.equal(style.values.get("--lu-rail-w"), "0px");
  });

  it("disconnect stops watching and removes the published properties; a reconnected shell measures again", () => {
    const { style, meter, observer } = setup({ mode: "bottom", regions: { top: box(390, 57), dock: box(390, 91) } });
    meter.sync();
    meter.disconnect();
    assert.equal(observer().watched.size, 0);
    assert.equal(style.values.size, 0);
    meter.sync();
    assert.equal(style.values.get("--lu-bottom-bar"), "91px");
  });

  it("a frame that was waiting when the shell disconnected never writes into the disconnected shell", () => {
    const { style, meter, observer, frames } = setup({ mode: "bottom", regions: { top: box(390, 57), dock: box(390, 91) } });
    meter.sync();
    observer().fire();
    meter.disconnect();
    frames.flush();
    assert.equal(style.values.size, 0);
  });

  it("works without ResizeObserver (old WebViews): publishes once per sync", () => {
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    try {
      const { style, meter } = setup({ mode: "tabs", regions: { top: box(1000, 57), dock: box(1000, 0) } });
      meter.sync();
      assert.equal(style.values.get("--lu-top-chrome"), "57px");
    } finally {
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
    }
  });
});
