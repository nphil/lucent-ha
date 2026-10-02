import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEADLINE_MS, SETTLE_MS, ScrollRestorer } from "../src/view/scroll-restore.ts";
import type { RestoreEnv, RestoreScroller } from "../src/view/scroll-restore.ts";

/** A page, a clock and a frame loop that a test steps by hand. Like a browser, scrolling clamps to what the
 * content allows. The page is its own scroller. */
class Page implements RestoreScroller {
  time = 1000;
  top = 0;
  /** The largest scroll offset the content allows right now. */
  max = 0;
  /** Every offset a restore asked the page to scroll to. */
  scrolls: number[] = [];
  /** Every change of the "holding an offset" signal the host gets. */
  activity: boolean[] = [];
  private _frames: Array<() => void> = [];
  private readonly _inputListeners = new Set<() => void>();

  scrollTo(top: number): void {
    this.scrolls.push(top);
    this.top = Math.min(Math.max(0, top), this.max);
  }

  maxTop(): number {
    return this.max;
  }

  readonly env: RestoreEnv = {
    now: () => this.time,
    frame: (callback) => {
      this._frames.push(callback);
      return () => {
        this._frames = this._frames.filter((queued) => queued !== callback);
      };
    },
    onUserInput: (callback) => {
      this._inputListeners.add(callback);
      return () => this._inputListeners.delete(callback);
    },
  };

  restorer(): ScrollRestorer {
    return new ScrollRestorer({ env: this.env, onActiveChange: (active) => this.activity.push(active) });
  }

  /** Lets `ms` pass in 16 ms frames; `onFrame` runs at the start of each, like the page changing between frames. */
  run(ms: number, onFrame?: () => void): void {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) {
      this.time += 16;
      onFrame?.();
      const due = this._frames;
      this._frames = [];
      for (const frame of due) frame();
    }
  }

  userActs(): void {
    for (const listener of [...this._inputListeners]) listener();
  }

  get pendingFrames(): number {
    return this._frames.length;
  }

  get inputListeners(): number {
    return this._inputListeners.size;
  }
}

describe("ScrollRestorer: landing", () => {
  it("lands on the very first call when the content is tall enough, so the first paint is already in place", () => {
    const page = new Page();
    page.max = 3000;
    page.top = 200;
    page.restorer().begin(page, 1400);
    assert.equal(page.top, 1400);
    assert.deepEqual(page.scrolls, [1400]);
  });

  it("holds the offset until the content height has been unchanged for the settle time, then lets go", () => {
    const page = new Page();
    page.max = 3000;
    const restorer = page.restorer();
    restorer.begin(page, 1400);
    page.run(SETTLE_MS - 32);
    assert.equal(restorer.active, true, "still settling");
    page.run(64);
    assert.equal(restorer.active, false);
    assert.deepEqual(page.activity, [true, false]);
    assert.equal(page.pendingFrames, 0, "no frame left running");
    assert.equal(page.inputListeners, 0, "no input listener left behind");
  });

  it("puts the page back after every nudge while content above the viewport keeps growing", () => {
    const page = new Page();
    page.max = 3000;
    page.restorer().begin(page, 1400);
    // images above the viewport finish loading: the browser shifts the page and the height grows
    page.run(48, () => {
      page.max += 40;
      page.top += 40;
    });
    assert.equal(page.top, 1400);
    assert.ok(page.scrolls.length > 1, "corrected more than once");
  });

  it("waits while the page is too short without moving it, and lands when the content has arrived", () => {
    const page = new Page();
    page.max = 400; // a skeleton
    const restorer = page.restorer();
    restorer.begin(page, 1400);
    page.run(320);
    assert.deepEqual(page.scrolls, [], "does not drag the page to a wrong place meanwhile");
    assert.equal(restorer.active, true);
    page.max = 2600; // the rows arrived
    page.run(16);
    assert.equal(page.top, 1400);
    page.run(SETTLE_MS + 32);
    assert.equal(restorer.active, false);
  });

  it("a target a hair beyond the end (under 1 px) counts as reachable", () => {
    const page = new Page();
    page.max = 1399.5;
    page.restorer().begin(page, 1400);
    assert.equal(page.top, 1399.5);
  });

  it("gives up at the deadline and lands as close as the content allows when the page stays too short", () => {
    const page = new Page();
    page.max = 900;
    const restorer = page.restorer();
    restorer.begin(page, 1400);
    page.run(DEADLINE_MS - 64);
    assert.equal(restorer.active, true);
    assert.equal(page.top, 0);
    page.run(160);
    assert.equal(restorer.active, false);
    assert.equal(page.top, 900, "the bottom of what exists");
  });

  it("the top needs one jump and no holding", () => {
    const page = new Page();
    page.max = 3000;
    page.top = 1400;
    const restorer = page.restorer();
    restorer.begin(page, 0);
    assert.equal(page.top, 0);
    assert.equal(restorer.active, false);
    assert.deepEqual(page.activity, [], "the host is never told to hold anything");
    assert.equal(page.pendingFrames, 0);
    assert.equal(page.inputListeners, 0);
  });

  it("already at the top: the scroller is not touched", () => {
    const page = new Page();
    page.max = 3000;
    page.restorer().begin(page, 0);
    assert.deepEqual(page.scrolls, []);
  });

  it("negative and non-numeric targets mean the top", () => {
    const page = new Page();
    page.max = 3000;
    for (const target of [-50, Number.NaN, Number.POSITIVE_INFINITY]) {
      page.top = 700;
      page.restorer().begin(page, target);
      assert.equal(page.top, 0, String(target));
    }
  });

  it("a scroller that cannot measure itself gets the target as given", () => {
    const page = new Page();
    page.max = Number.POSITIVE_INFINITY;
    const restorer = page.restorer();
    restorer.begin(page, 1400);
    assert.equal(page.top, 1400);
    page.run(SETTLE_MS + 32);
    assert.equal(restorer.active, false);
  });
});

describe("ScrollRestorer: never fights the user", () => {
  it("stops at once when the user acts and never scrolls the page again, even when the content arrives later", () => {
    const page = new Page();
    page.max = 400;
    const restorer = page.restorer();
    restorer.begin(page, 1400);
    page.userActs();
    assert.equal(restorer.active, false);
    page.max = 3000;
    page.run(160);
    assert.deepEqual(page.scrolls, []);
    assert.equal(page.pendingFrames, 0);
    assert.equal(page.inputListeners, 0);
    assert.deepEqual(page.activity, [true, false]);
  });

  it("after the user took over there is no pending offset to remember: the scroller's own position is the truth", () => {
    const page = new Page();
    page.max = 400;
    const restorer = page.restorer();
    restorer.begin(page, 1400);
    page.userActs();
    assert.equal(restorer.cancel(), null);
  });
});

describe("ScrollRestorer: cancel and restart", () => {
  it("cancel() during a restore returns the offset still wanted, so a quick tab flip does not lose it", () => {
    const page = new Page();
    page.max = 400;
    const restorer = page.restorer();
    restorer.begin(page, 1400);
    page.run(48);
    assert.equal(page.top, 0, "the page never got there");
    assert.equal(restorer.cancel(), 1400);
    assert.equal(restorer.active, false);
    assert.equal(page.pendingFrames, 0);
    assert.equal(page.inputListeners, 0);
  });

  it("cancel() with nothing running returns null and tells nobody", () => {
    const page = new Page();
    assert.equal(page.restorer().cancel(), null);
    assert.deepEqual(page.activity, []);
  });

  it("begin() while another restore runs replaces it cleanly: one listener, one frame loop, only the new target", () => {
    const page = new Page();
    page.max = 400;
    const restorer = page.restorer();
    restorer.begin(page, 1400);
    restorer.begin(page, 900);
    assert.equal(page.inputListeners, 1);
    assert.equal(page.pendingFrames, 1);
    page.max = 3000;
    page.run(16);
    assert.equal(page.top, 900);
  });

  it("a restore for a new target gets its own full deadline", () => {
    const page = new Page();
    page.max = 400;
    const restorer = page.restorer();
    restorer.begin(page, 1400);
    page.run(DEADLINE_MS - 100);
    restorer.begin(page, 1300);
    page.run(DEADLINE_MS - 100);
    assert.equal(restorer.active, true);
  });
});
