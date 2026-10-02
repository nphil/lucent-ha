import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { dismissToast, registerToastHost, showToast } from "../src/sheet/toast-event.ts";
import type { ToastEventDetail } from "../src/sheet/toast-event.ts";

function listen(target: EventTarget): ToastEventDetail[] {
  const seen: ToastEventDetail[] = [];
  target.addEventListener("lu-toast", (event) => seen.push((event as CustomEvent<ToastEventDetail>).detail));
  return seen;
}

describe("showToast", () => {
  it("with no host nothing throws, and the console is told once", () => {
    const warn = mock.method(console, "warn", () => {});
    const from = new EventTarget();
    assert.doesNotThrow(() => showToast(from, { message: "nobody home" }));
    assert.doesNotThrow(() => showToast(from, { message: "still nobody" }));
    assert.equal(warn.mock.callCount(), 1);
    warn.mock.restore();
  });

  it("raises a bubbling, composed lu-toast carrying the options and an id", () => {
    const from = new EventTarget();
    const events: CustomEvent[] = [];
    from.addEventListener("lu-toast", (event) => events.push(event as CustomEvent));
    const onAction = () => {};
    const handle = showToast(from, { message: "Now showing Robin", kind: "success", actionLabel: "Undo", onAction });
    assert.equal(events.length, 1);
    const event = events[0] as CustomEvent<ToastEventDetail>;
    assert.equal(event.bubbles, true);
    assert.equal(event.composed, true);
    assert.equal(event.detail.message, "Now showing Robin");
    assert.equal(event.detail.kind, "success");
    assert.equal(event.detail.actionLabel, "Undo");
    assert.equal(event.detail.onAction, onAction);
    assert.ok(event.detail.id, "the host receives an id");
    assert.equal(handle.id, event.detail.id, "the handle is for the toast the host was given");
  });

  it("keeps the id you choose, and hands out different ids otherwise", () => {
    const from = new EventTarget();
    const seen = listen(from);
    const chosen = showToast(from, { message: "a", id: "save-status" });
    const first = showToast(from, { message: "b" });
    const second = showToast(from, { message: "c" });
    assert.equal(chosen.id, "save-status");
    assert.deepEqual(seen.map((detail) => detail.id), ["save-status", first.id, second.id]);
    assert.notEqual(first.id, second.id);
  });

  it("does not change the options object it was given", () => {
    const options = { message: "x" };
    showToast(new EventTarget(), options);
    assert.deepEqual(options, { message: "x" });
  });

  it("the handle closes the toast on every registered host, and stops reaching a host that has gone", () => {
    const closed: string[] = [];
    const offA = registerToastHost({ dismiss: (id) => closed.push(`A:${id}`), show: () => undefined });
    const offB = registerToastHost({ dismiss: (id) => closed.push(`B:${id}`), show: () => undefined });
    const handle = showToast(new EventTarget(), { message: "x", id: "t1" });
    handle.dismiss();
    assert.deepEqual(closed.sort(), ["A:t1", "B:t1"]);
    offA();
    closed.length = 0;
    dismissToast("t2");
    assert.deepEqual(closed, ["B:t2"]);
    offB();
    closed.length = 0;
    handle.dismiss();
    assert.deepEqual(closed, []);
  });

  it("a caller that CONTAINS the host (events only travel up) still gets its toast shown, by the nearest host inside it", () => {
    // from -> shellRoot(host: shell) ... fake composed tree: toast hosts hang below the caller through parentNode / host links
    const caller = new EventTarget() as EventTarget & { parentNode?: unknown; host?: unknown };
    const shell = { parentNode: null, host: caller } as { parentNode: unknown; host: unknown };
    const sheet = { parentNode: shell, host: undefined } as { parentNode: unknown; host: unknown };
    const shown: string[] = [];
    const nearHost = Object.assign(Object.create(null), { parentNode: shell, dismiss: () => undefined, show: (toast: { message: string }) => shown.push(`near:${toast.message}`) });
    const deepHost = Object.assign(Object.create(null), { parentNode: sheet, dismiss: () => undefined, show: (toast: { message: string }) => shown.push(`deep:${toast.message}`) });
    const offDeep = registerToastHost(deepHost);
    const offNear = registerToastHost(nearHost);
    showToast(caller, { message: "hello" });
    assert.deepEqual(shown, ["near:hello"]);
    offDeep();
    offNear();
  });

  it("a toast that a host handled (preventDefault) is not shown a second time by the fallback", () => {
    const caller = new EventTarget();
    const shown: string[] = [];
    caller.addEventListener("lu-toast", (event) => { event.preventDefault(); shown.push("handled"); });
    const host = Object.assign(Object.create(null), { parentNode: caller, dismiss: () => undefined, show: () => shown.push("fallback") });
    const off = registerToastHost(host);
    showToast(caller, { message: "once" });
    assert.deepEqual(shown, ["handled"]);
    off();
  });
});
