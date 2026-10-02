import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Scheduler } from "../src/core/throttle.ts";
import { TOAST_DURATION, ToastQueue, resolveToastDuration } from "../src/sheet/toast-queue.ts";
import type { ShownToast, ToastOptions } from "../src/sheet/toast-queue.ts";

/** A clock the test moves by hand. `cancels: false` makes clearTimeout do nothing, which is what a timer that was already
 * due when it was cancelled looks like: it fires late. */
class FakeClock implements Scheduler {
  time = 0;
  cancels = true;
  private nextHandle = 1;
  private readonly timers = new Map<number, { at: number; run: () => void }>();

  now(): number {
    return this.time;
  }
  setTimeout(run: () => void, ms: number): unknown {
    const handle = this.nextHandle++;
    this.timers.set(handle, { at: this.time + ms, run });
    return handle;
  }
  clearTimeout(handle: unknown): void {
    if (this.cancels) this.timers.delete(handle as number);
  }
  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      let due: [number, { at: number; run: () => void }] | undefined;
      for (const entry of this.timers) if (entry[1].at <= end && (!due || entry[1].at < due[1].at)) due = entry;
      if (!due) break;
      this.timers.delete(due[0]);
      this.time = due[1].at;
      due[1].run();
    }
    this.time = end;
  }
}

function setup(cancels = true) {
  const clock = new FakeClock();
  clock.cancels = cancels;
  const seen: Array<ShownToast | null> = [];
  const queue = new ToastQueue({ scheduler: clock, onChange: (current) => seen.push(current) });
  return { clock, queue, seen };
}

const info = (message: string, extra: Partial<ToastOptions> = {}): ToastOptions => ({ message, ...extra });
const shownMessage = (queue: ToastQueue) => queue.current?.message ?? null;

describe("ToastQueue: order", () => {
  it("shows the first toast at once and keeps later ones waiting, never two at a time", () => {
    const { queue } = setup();
    queue.show(info("one"));
    queue.show(info("two"));
    queue.show(info("three"));
    assert.equal(shownMessage(queue), "one");
    assert.equal(queue.pending, 2);
  });

  it("shows waiting toasts in the order they came, each for its own time", () => {
    const { clock, queue } = setup();
    queue.show(info("one"));
    queue.show(info("two"));
    queue.show(info("three", { durationMs: 1000 }));
    clock.advance(TOAST_DURATION.standard);
    assert.equal(shownMessage(queue), "two");
    clock.advance(TOAST_DURATION.standard);
    assert.equal(shownMessage(queue), "three");
    clock.advance(999);
    assert.equal(shownMessage(queue), "three");
    clock.advance(1);
    assert.equal(shownMessage(queue), null);
    assert.equal(queue.pending, 0);
  });

  it("reports every change, ending with null", () => {
    const { clock, queue, seen } = setup();
    queue.show(info("one"));
    clock.advance(TOAST_DURATION.standard);
    assert.deepEqual(seen.map((toast) => toast?.message ?? null), ["one", null]);
  });

  it("ignores a toast without a message but still hands back a handle", () => {
    const { queue } = setup();
    const handle = queue.show(info(""));
    assert.equal(queue.current, null);
    assert.doesNotThrow(() => handle.dismiss());
  });
});

describe("toast time on screen", () => {
  it("is 4 s for a plain toast, 8 s for an error", () => {
    const plain = setup();
    plain.queue.show(info("plain"));
    plain.clock.advance(TOAST_DURATION.standard - 1);
    assert.equal(shownMessage(plain.queue), "plain");
    plain.clock.advance(1);
    assert.equal(shownMessage(plain.queue), null);

    const error = setup();
    error.queue.show(info("broken", { kind: "error" }));
    error.clock.advance(TOAST_DURATION.error - 1);
    assert.equal(shownMessage(error.queue), "broken");
    error.clock.advance(1);
    assert.equal(shownMessage(error.queue), null);
  });

  it("is at least 5 s when there is an action, whatever was asked for", () => {
    const { clock, queue } = setup();
    queue.show(info("Done", { actionLabel: "Undo", onAction: () => {}, durationMs: 1000 }));
    clock.advance(TOAST_DURATION.action - 1);
    assert.equal(shownMessage(queue), "Done");
    clock.advance(1);
    assert.equal(shownMessage(queue), null);
  });

  it("keeps a longer explicit time, with or without an action", () => {
    assert.equal(resolveToastDuration("info", 9000, true), 9000);
    assert.equal(resolveToastDuration("info", 2500, false), 2500);
    assert.equal(resolveToastDuration("error", undefined, true), TOAST_DURATION.error);
    assert.equal(resolveToastDuration(undefined, undefined, true), TOAST_DURATION.action);
  });

  it("stays until dismissed when the time is 0 or Infinity", () => {
    for (const durationMs of [0, Infinity]) {
      const { clock, queue } = setup();
      queue.show(info("sticky", { durationMs }));
      clock.advance(60 * 60 * 1000);
      assert.equal(shownMessage(queue), "sticky");
      queue.dismiss();
      assert.equal(shownMessage(queue), null);
    }
  });

  it("falls back to the default for a nonsense time", () => {
    assert.equal(resolveToastDuration("info", -5, false), TOAST_DURATION.standard);
    assert.equal(resolveToastDuration("info", NaN, false), TOAST_DURATION.standard);
  });

  it("is still the full 5 s for an action toast that arrives while the first is on screen", () => {
    const { clock, queue } = setup();
    queue.show(info("first"));
    queue.show(info("second", { actionLabel: "Undo", onAction: () => {} }));
    clock.advance(TOAST_DURATION.standard);
    assert.equal(shownMessage(queue), "second");
    clock.advance(TOAST_DURATION.action - 1);
    assert.equal(shownMessage(queue), "second");
    clock.advance(1);
    assert.equal(shownMessage(queue), null);
  });
});

describe("replacing by id", () => {
  it("a toast with the id of the one on screen replaces it and starts the time again", () => {
    const { clock, queue } = setup();
    queue.show(info("Saving...", { id: "save" }));
    const first = queue.current;
    clock.advance(3000);
    queue.show(info("Saved", { id: "save", kind: "success" }));
    assert.equal(queue.pending, 0);
    assert.equal(shownMessage(queue), "Saved");
    assert.equal(queue.current?.kind, "success");
    assert.notEqual(queue.current?.generation, first?.generation, "a new generation lets the view restart its motion");
    clock.advance(TOAST_DURATION.standard - 1);
    assert.equal(shownMessage(queue), "Saved");
    clock.advance(1);
    assert.equal(shownMessage(queue), null);
  });

  it("a toast with the id of a waiting one replaces it in its place", () => {
    const { clock, queue } = setup();
    queue.show(info("one"));
    queue.show(info("two v1", { id: "two" }));
    queue.show(info("three"));
    queue.show(info("two v2", { id: "two" }));
    assert.equal(queue.pending, 2);
    clock.advance(TOAST_DURATION.standard);
    assert.equal(shownMessage(queue), "two v2");
    clock.advance(TOAST_DURATION.standard);
    assert.equal(shownMessage(queue), "three");
  });

  it("different ids queue, no id never collides", () => {
    const { queue } = setup();
    queue.show(info("a", { id: "x" }));
    queue.show(info("b", { id: "y" }));
    queue.show(info("c"));
    queue.show(info("d"));
    assert.equal(queue.pending, 3);
  });
});

describe("pausing (pointer, focus, hidden tab)", () => {
  it("keeps the time left instead of starting again", () => {
    const { clock, queue } = setup();
    queue.show(info("hello"));
    clock.advance(1500);
    queue.pause("pointer");
    clock.advance(60_000);
    assert.equal(shownMessage(queue), "hello", "does not expire while held");
    queue.resume("pointer");
    clock.advance(TOAST_DURATION.standard - 1500 - 1);
    assert.equal(shownMessage(queue), "hello");
    clock.advance(1);
    assert.equal(shownMessage(queue), null);
  });

  it("waits for every holder to let go", () => {
    const { clock, queue } = setup();
    queue.show(info("hello"));
    queue.pause("pointer");
    queue.pause("focus");
    queue.resume("pointer");
    clock.advance(60_000);
    assert.equal(shownMessage(queue), "hello");
    queue.resume("focus");
    clock.advance(TOAST_DURATION.standard);
    assert.equal(shownMessage(queue), null);
  });

  it("pausing twice from one source, or resuming one that never paused, changes nothing", () => {
    const { clock, queue } = setup();
    queue.show(info("hello"));
    queue.resume("focus");
    queue.pause("pointer");
    queue.pause("pointer");
    queue.resume("pointer");
    clock.advance(TOAST_DURATION.standard);
    assert.equal(shownMessage(queue), null);
  });

  it("a toast that arrives while held waits for the release and then gets its full time", () => {
    const { clock, queue } = setup();
    queue.show(info("first", { durationMs: 1000 }));
    queue.show(info("second"));
    queue.pause("pointer");
    clock.advance(60_000);
    assert.equal(shownMessage(queue), "first");
    queue.resume("pointer");
    clock.advance(1000);
    assert.equal(shownMessage(queue), "second");
    queue.pause("pointer");
    clock.advance(60_000);
    queue.resume("pointer");
    clock.advance(TOAST_DURATION.standard - 1);
    assert.equal(shownMessage(queue), "second");
    clock.advance(1);
    assert.equal(shownMessage(queue), null);
  });

  it("a hold set before any toast exists stops the next one from expiring", () => {
    const { clock, queue } = setup();
    queue.pause("hidden");
    queue.show(info("hello"));
    clock.advance(60_000);
    assert.equal(shownMessage(queue), "hello");
    queue.resume("hidden");
    clock.advance(TOAST_DURATION.standard);
    assert.equal(shownMessage(queue), null);
  });

  it("does not make a persistent toast expire on release", () => {
    const { clock, queue } = setup();
    queue.show(info("sticky", { durationMs: 0 }));
    queue.pause("pointer");
    queue.resume("pointer");
    clock.advance(60 * 60 * 1000);
    assert.equal(shownMessage(queue), "sticky");
  });
});

describe("dismissing", () => {
  it("closing the one on screen brings up the next", () => {
    const { queue } = setup();
    queue.show(info("one"));
    queue.show(info("two"));
    queue.dismiss();
    assert.equal(shownMessage(queue), "two");
  });

  it("the handle closes its own toast only: shown, waiting, or already gone", () => {
    const { queue } = setup();
    const one = queue.show(info("one"));
    const two = queue.show(info("two"));
    const three = queue.show(info("three"));
    two.dismiss();
    assert.equal(queue.pending, 1, "a waiting toast is dropped without ever showing");
    one.dismiss();
    assert.equal(shownMessage(queue), "three");
    one.dismiss();
    two.dismiss();
    assert.equal(shownMessage(queue), "three", "stale handles do nothing");
    three.dismiss();
    assert.equal(shownMessage(queue), null);
  });

  it("dismissing with nothing on screen is harmless", () => {
    const { queue, seen } = setup();
    queue.dismiss();
    queue.dismiss("nope");
    assert.deepEqual(seen, []);
  });

  it("clear drops everything and stops the clock", () => {
    const { clock, queue, seen } = setup();
    queue.show(info("one"));
    queue.show(info("two"));
    queue.clear();
    clock.advance(60_000);
    assert.equal(queue.current, null);
    assert.equal(queue.pending, 0);
    assert.equal(seen[seen.length - 1], null);
  });
});

describe("a timer that fires late", () => {
  it("never closes the toast that replaced its own", () => {
    const { clock, queue } = setup(false);
    queue.show(info("old", { id: "x" }));
    clock.advance(1000);
    queue.show(info("new", { id: "x" }));
    clock.advance(TOAST_DURATION.standard - 1000);
    assert.equal(shownMessage(queue), "new", "the old timer fired at 4000 but the new toast has until 5000");
    clock.advance(1000);
    assert.equal(shownMessage(queue), null);
  });

  it("never closes the toast that took over after a dismiss", () => {
    const { clock, queue } = setup(false);
    queue.show(info("one"));
    queue.show(info("two"));
    clock.advance(1000);
    queue.dismiss();
    clock.advance(TOAST_DURATION.standard - 1000);
    assert.equal(shownMessage(queue), "two");
  });
});

describe("Undo (the action)", () => {
  it("runs once, after the toast has closed", () => {
    const { queue } = setup();
    const order: string[] = [];
    queue.show(info("Deleted", { actionLabel: "Undo", onAction: () => order.push(`undo while showing: ${queue.current?.message ?? "nothing"}`) }));
    assert.equal(queue.current?.actionLabel, "Undo");
    assert.equal(queue.runAction(), true);
    assert.deepEqual(order, ["undo while showing: nothing"]);
    assert.equal(queue.current, null);
    assert.equal(queue.runAction(), false);
    assert.equal(order.length, 1);
  });

  it("lets the next waiting toast take over before the action runs, and a toast raised by the action goes to the back", () => {
    const { queue } = setup();
    queue.show(info("Deleted", { actionLabel: "Undo", onAction: () => queue.show(info("Restored")) }));
    queue.show(info("Other"));
    queue.runAction();
    assert.equal(shownMessage(queue), "Other");
    assert.equal(queue.pending, 1);
  });

  it("does nothing for a toast without an action", () => {
    const { queue } = setup();
    queue.show(info("Hello"));
    assert.equal(queue.runAction(), false);
    assert.equal(shownMessage(queue), "Hello");
  });

  it("offers no action when the label or the callback is missing", () => {
    const { queue } = setup();
    queue.show(info("label only", { actionLabel: "Undo" }));
    assert.equal(queue.current?.actionLabel, "");
    assert.equal(queue.runAction(), false);
    queue.dismiss();
    queue.show(info("callback only", { onAction: () => {} }));
    assert.equal(queue.current?.actionLabel, "");
    assert.equal(queue.runAction(), false);
  });

  it("a replaced toast's action cannot be run any more, the new one's can", () => {
    const { queue } = setup();
    const ran: string[] = [];
    queue.show(info("A", { id: "x", actionLabel: "Undo", onAction: () => ran.push("A") }));
    queue.show(info("B", { id: "x", actionLabel: "Undo", onAction: () => ran.push("B") }));
    queue.runAction();
    assert.deepEqual(ran, ["B"]);
  });

  it("a callback that throws still leaves the toast closed", () => {
    const { queue } = setup();
    queue.show(info("Oops", { actionLabel: "Retry", onAction: () => { throw new Error("nope"); } }));
    assert.throws(() => queue.runAction(), /nope/);
    assert.equal(queue.current, null);
  });
});

describe("takeAll (a sheet hands its toasts to the page)", () => {
  it("returns the toast on screen and the waiting ones in order, and leaves the queue empty", () => {
    const { clock, queue, seen } = setup();
    queue.show(info("one", { kind: "success" }));
    queue.show(info("two", { id: "t2" }));
    queue.show(info("three", { kind: "error" }));
    const taken = queue.takeAll();
    assert.deepEqual(taken.map((toast) => toast.message), ["one", "two", "three"]);
    assert.equal(taken[1]?.id, "t2");
    assert.equal(taken[2]?.kind, "error");
    assert.equal(queue.current, null);
    assert.equal(queue.pending, 0);
    assert.equal(seen[seen.length - 1], null);
    clock.advance(60_000);
    assert.equal(queue.current, null, "nothing comes back by itself");
  });

  it("what it returns can be shown again, with its action and its time", () => {
    const first = setup();
    const undone: string[] = [];
    first.queue.show(info("Deleted", { actionLabel: "Undo", onAction: () => undone.push("undo") }));
    first.queue.show(info("Sticky", { durationMs: 0 }));
    const taken = first.queue.takeAll();

    const second = setup();
    for (const toast of taken) second.queue.show(toast);
    assert.equal(second.queue.current?.actionLabel, "Undo");
    second.queue.runAction();
    assert.deepEqual(undone, ["undo"]);
    assert.equal(second.queue.current?.message, "Sticky");
    second.clock.advance(60 * 60 * 1000);
    assert.equal(second.queue.current?.message, "Sticky", "a toast that stays until dismissed still does");
  });

  it("is empty when there is nothing to take", () => {
    assert.deepEqual(setup().queue.takeAll(), []);
  });
});
