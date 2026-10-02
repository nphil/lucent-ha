import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { clearSwr, createSwrCache, mutateSwr, readSwr, subscribeSwr, swr } from "../src/view/swr.ts";
import type { SwrSnapshot, SwrStorage } from "../src/view/swr.ts";
import type { Scheduler } from "../src/core/throttle.ts";

/** A clock the test moves by hand; timers fire when it passes them. */
class Clock implements Scheduler {
  time = 1_700_000_000_000;
  private _next = 1;
  private readonly _timers = new Map<number, { at: number; callback: () => void }>();

  now(): number {
    return this.time;
  }

  setTimeout(callback: () => void, ms: number): unknown {
    const id = this._next++;
    this._timers.set(id, { at: this.time + ms, callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this._timers.delete(handle as number);
  }

  advance(ms: number): void {
    this.time += ms;
    const due = [...this._timers].filter(([, timer]) => timer.at <= this.time).sort((a, b) => a[1].at - b[1].at);
    for (const [id, timer] of due) {
      this._timers.delete(id);
      timer.callback();
    }
  }
}

class FakeStorage implements SwrStorage {
  writes = 0;
  private readonly _items = new Map<string, string>();

  get length(): number {
    return this._items.size;
  }
  key(index: number): string | null {
    return [...this._items.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this._items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.writes++;
    this._items.set(key, value);
  }
  removeItem(key: string): void {
    this._items.delete(key);
  }
  /** The names of the items whose name contains `part`. */
  names(part: string): string[] {
    return [...this._items.keys()].filter((name) => name.includes(part));
  }
}

/** A fetcher the test answers by hand, one call at a time. */
function controlled<T>() {
  const calls: Array<{ signal: AbortSignal; resolve(value: T): void; reject(error: unknown): void }> = [];
  const fetcher = (signal: AbortSignal): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      calls.push({ signal, resolve, reject });
    });
  const call = (index: number) => {
    const found = calls[index];
    if (!found) throw new Error(`fetch call ${index} never happened (${calls.length} calls)`);
    return found;
  };
  return { fetcher, calls, call };
}

/** Lets promise callbacks that are already queued run (no real time passes). */
const settle = async (): Promise<void> => {
  for (let tick = 0; tick < 10; tick++) await Promise.resolve();
};

async function done<T>(promise: Promise<SwrSnapshot<T>> | undefined): Promise<SwrSnapshot<T>> {
  assert.ok(promise, "expected a request to be running");
  return promise;
}

const MAX_AGE = 30_000;

describe("swr: first load and freshness", () => {
  it("fetches once, shows no data while loading, then the data; fresh data is not fetched again", async () => {
    const clock = new Clock();
    const cache = createSwrCache({ scheduler: clock });
    const { fetcher, calls, call } = controlled<string[]>();

    const first = cache.swr("cams", fetcher);
    assert.equal(first.data, undefined);
    assert.equal(first.loading, true);
    assert.equal(first.stale, false, "no data is not stale data");
    call(0).resolve(["front", "back"]);
    const loaded = await done(first.pending);
    assert.deepEqual(loaded.data, ["front", "back"]);
    assert.equal(loaded.loading, false);
    assert.equal(loaded.updatedAt, clock.time);

    clock.advance(MAX_AGE - 1);
    const again = cache.swr("cams", fetcher);
    assert.deepEqual(again.data, ["front", "back"]);
    assert.equal(again.pending, undefined, "nothing to wait for");
    assert.equal(calls.length, 1);
  });

  it("older than maxAge: shows the last good data at once, marks it stale, and refreshes behind it", async () => {
    const clock = new Clock();
    const cache = createSwrCache({ scheduler: clock });
    const { fetcher, calls, call } = controlled<number>();
    const first = cache.swr("n", fetcher);
    call(0).resolve(1);
    await done(first.pending);
    const savedAt = clock.time;

    clock.advance(MAX_AGE);
    const second = cache.swr("n", fetcher);
    assert.equal(second.data, 1, "the old answer is on screen immediately");
    assert.equal(second.stale, true);
    assert.equal(second.loading, true);
    assert.equal(calls.length, 2);

    clock.advance(500);
    call(1).resolve(2);
    const refreshed = await done(second.pending);
    assert.equal(refreshed.data, 2);
    assert.equal(refreshed.stale, false);
    assert.equal(refreshed.updatedAt, clock.time);
    assert.notEqual(refreshed.updatedAt, savedAt);
  });

  it("a snapshot goes stale with time without anything else changing", async () => {
    const clock = new Clock();
    const cache = createSwrCache({ scheduler: clock });
    const { fetcher, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    call(0).resolve("x");
    await done(first.pending);
    const snapshot = cache.read<string>("k");
    assert.equal(snapshot.stale, false);
    clock.advance(MAX_AGE);
    assert.equal(snapshot.stale, true);
    assert.equal(cache.read<string>("k"), snapshot, "still the same object: nothing was published");
  });

  it("honours a custom maxAgeMs per call", async () => {
    const clock = new Clock();
    const cache = createSwrCache({ scheduler: clock });
    const { fetcher, calls, call } = controlled<string>();
    const first = cache.swr("k", fetcher, { maxAgeMs: 5000 });
    call(0).resolve("x");
    await done(first.pending);
    clock.advance(4999);
    cache.swr("k", fetcher, { maxAgeMs: 5000 });
    assert.equal(calls.length, 1);
    clock.advance(1);
    cache.swr("k", fetcher, { maxAgeMs: 5000 });
    assert.equal(calls.length, 2);
  });

  it("different keys are independent", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const a = controlled<string>();
    const b = controlled<string>();
    const first = cache.swr("a", a.fetcher);
    cache.swr("b", b.fetcher);
    a.call(0).resolve("A");
    await done(first.pending);
    assert.equal(cache.read<string>("a").data, "A");
    assert.equal(cache.read<string>("b").data, undefined);
  });

  it("an unknown key reads as empty and fetches nothing", () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const snapshot = cache.read<string>("nope");
    assert.deepEqual([snapshot.data, snapshot.error, snapshot.loading, snapshot.stale, snapshot.updatedAt], [undefined, undefined, false, false, undefined]);
  });
});

describe("swr: one request at a time", () => {
  it("callers asking for one key at the same time share a single request", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const { fetcher, calls, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    const second = cache.swr("k", fetcher);
    assert.equal(calls.length, 1);
    assert.equal(first.pending, second.pending);
    call(0).resolve("x");
    assert.equal((await done(second.pending)).data, "x");
  });

  it("revalidate() replaces a running request: the old one is aborted and its late answer is dropped", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const { fetcher, calls, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    const second = first.revalidate();
    assert.equal(calls.length, 2);
    assert.equal(call(0).signal.aborted, true);
    assert.equal(call(1).signal.aborted, false);

    call(1).resolve("new");
    assert.equal((await second).data, "new");
    call(0).resolve("old"); // arrives late
    await settle();
    assert.equal(cache.read<string>("k").data, "new");
    assert.equal((await done(first.pending)).data, "new", "whoever waited on the old request gets the newer answer");
  });

  it("the late FAILURE of a replaced request does not mark the key as failed", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const { fetcher, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    const second = first.revalidate();
    call(1).resolve("fine");
    await second;
    call(0).reject(new DOMException("aborted", "AbortError"));
    await settle();
    const snapshot = cache.read<string>("k");
    assert.equal(snapshot.error, undefined);
    assert.equal(snapshot.data, "fine");
  });

  it("revalidate() also fetches when the data is fresh", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const { fetcher, calls, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    call(0).resolve("x");
    await done(first.pending);
    const again = first.revalidate();
    assert.equal(calls.length, 2);
    call(1).resolve("y");
    assert.equal((await again).data, "y");
  });
});

describe("swr: failures never blank the screen", () => {
  it("a failed refresh keeps the last good data, records the error and marks the data stale", async () => {
    const clock = new Clock();
    const cache = createSwrCache({ scheduler: clock });
    const { fetcher, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    call(0).resolve("good");
    const good = await done(first.pending);

    clock.advance(MAX_AGE);
    const second = cache.swr("k", fetcher);
    const boom = new Error("camera service is down");
    call(1).reject(boom);
    const failed = await done(second.pending);
    assert.equal(failed.data, "good");
    assert.equal(failed.error, boom);
    assert.equal(failed.loading, false);
    assert.equal(failed.stale, true);
    assert.equal(failed.updatedAt, good.updatedAt, "the failure did not change when the data was last confirmed");
  });

  it("data that is only seconds old is still stale when its refresh failed: the screen can say it may be out of date", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const { fetcher, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    call(0).resolve("good");
    assert.equal((await done(first.pending)).stale, false);
    const retry = first.revalidate();
    call(1).reject(new Error("offline"));
    const failed = await retry;
    assert.equal(failed.data, "good");
    assert.equal(failed.stale, true);
  });

  it("a later success clears the error", async () => {
    const clock = new Clock();
    const cache = createSwrCache({ scheduler: clock });
    const { fetcher, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    call(0).reject(new Error("first try"));
    await done(first.pending);
    const retry = first.revalidate();
    call(1).resolve("ok");
    const snapshot = await retry;
    assert.equal(snapshot.error, undefined);
    assert.equal(snapshot.data, "ok");
  });

  it("a key that failed is not hammered: swr() waits maxAge before trying again, revalidate() does not wait", async () => {
    const clock = new Clock();
    const cache = createSwrCache({ scheduler: clock });
    const { fetcher, calls, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    call(0).reject(new Error("down"));
    await done(first.pending);

    cache.swr("k", fetcher);
    cache.swr("k", fetcher);
    assert.equal(calls.length, 1, "called again and again, e.g. on every tab switch");
    clock.advance(MAX_AGE - 1);
    cache.swr("k", fetcher);
    assert.equal(calls.length, 1);
    clock.advance(1);
    cache.swr("k", fetcher);
    assert.equal(calls.length, 2);

    first.revalidate();
    assert.equal(calls.length, 3, "the Retry button always tries");
  });

  it("a fetcher that throws at once, or rejects with nothing, is a failure too", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const throwing = cache.swr<string>("a", () => {
      throw new Error("sync");
    });
    assert.equal(throwing.loading, false);
    assert.equal((throwing.error as Error).message, "sync");

    const nothing = cache.swr<string>("b", () => Promise.reject(undefined));
    const snapshot = await done(nothing.pending);
    assert.ok(snapshot.error instanceof Error, "an error is always something you can show");
  });

  it("a fetcher may return the value directly", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const handle = cache.swr("k", () => 42);
    assert.equal((await done(handle.pending)).data, 42);
  });
});

describe("mutate and clear", () => {
  it("mutate replaces the data now and keeps the time of the last real fetch", async () => {
    const clock = new Clock();
    const cache = createSwrCache({ scheduler: clock });
    const { fetcher, call } = controlled<string[]>();
    const first = cache.swr("list", fetcher);
    call(0).resolve(["a", "b"]);
    const loaded = await done(first.pending);
    clock.advance(5000);
    const after = cache.mutate<string[]>("list", (current) => (current ?? []).filter((item) => item !== "a"));
    assert.deepEqual(after.data, ["b"]);
    assert.equal(after.updatedAt, loaded.updatedAt, "the server has not confirmed this yet");
    assert.deepEqual(cache.read<string[]>("list").data, ["b"]);
  });

  it("mutate while a request is running drops that request: its answer was asked for before the change", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const { fetcher, call } = controlled<string[]>();
    const first = cache.swr("list", fetcher);
    call(0).resolve(["a"]);
    await done(first.pending);
    const refresh = first.revalidate();
    cache.mutate<string[]>("list", () => ["optimistic"]);
    assert.equal(call(1).signal.aborted, true);
    call(1).resolve(["stale server copy"]);
    const snapshot = await refresh;
    assert.deepEqual(snapshot.data, ["optimistic"]);
    assert.equal(snapshot.loading, false);
    assert.deepEqual(cache.read<string[]>("list").data, ["optimistic"]);
  });

  it("mutate on a key nothing was loaded for starts it from nothing", () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const snapshot = cache.mutate<number>("count", (current) => (current ?? 0) + 1);
    assert.equal(snapshot.data, 1);
    assert.equal(typeof snapshot.updatedAt, "number");
  });

  it("an updater that throws changes nothing", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const { fetcher, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    call(0).resolve("kept");
    await done(first.pending);
    assert.throws(() => cache.mutate<string>("k", () => {
      throw new Error("bad updater");
    }), /bad updater/);
    assert.equal(cache.read<string>("k").data, "kept");
  });

  it("clear(key) forgets the data and drops a running request", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const { fetcher, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    call(0).resolve("old");
    await done(first.pending);
    const refresh = first.revalidate();
    cache.clear("k");
    assert.equal(call(1).signal.aborted, true);
    call(1).resolve("arrives after the clear");
    await refresh;
    assert.equal(cache.read<string>("k").data, undefined);
    assert.equal(cache.read<string>("k").loading, false);
  });

  it("clear() without a key forgets everything; subscribers hear about it", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const heard: Array<string | undefined> = [];
    cache.subscribe<string>("a", (snapshot) => heard.push(snapshot.data));
    cache.mutate<string>("a", () => "A");
    cache.mutate<string>("b", () => "B");
    cache.clear();
    assert.equal(cache.read<string>("a").data, undefined);
    assert.equal(cache.read<string>("b").data, undefined);
    assert.deepEqual(heard, ["A", undefined]);
  });
});

describe("subscribe", () => {
  it("is told about every change: request started, answer arrived, mutation", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const { fetcher, call } = controlled<string>();
    const seen: Array<[string | undefined, boolean]> = [];
    cache.subscribe<string>("k", (snapshot) => seen.push([snapshot.data, snapshot.loading]));
    const first = cache.swr("k", fetcher);
    call(0).resolve("x");
    await done(first.pending);
    cache.mutate<string>("k", () => "y");
    assert.deepEqual(seen, [[undefined, true], ["x", false], ["y", false]]);
  });

  it("stops after unsubscribe, and unsubscribing twice is harmless", () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    let count = 0;
    const stop = cache.subscribe("k", () => count++);
    cache.mutate("k", () => 1);
    stop();
    stop();
    cache.mutate("k", () => 2);
    assert.equal(count, 1);
  });

  it("a subscriber that throws is reported and does not stop the others or damage the cache", () => {
    const report = mock.method(console, "error", () => {});
    try {
      const cache = createSwrCache({ scheduler: new Clock() });
      const heard: string[] = [];
      cache.subscribe("k", () => {
        throw new Error("render crashed");
      });
      cache.subscribe<string>("k", (snapshot) => heard.push(String(snapshot.data)));
      cache.mutate("k", () => "ok");
      assert.deepEqual(heard, ["ok"]);
      assert.equal(report.mock.callCount(), 1);
      assert.equal(cache.read<string>("k").data, "ok");
    } finally {
      report.mock.restore();
    }
  });

  it("a subscriber removed by an earlier subscriber during the same notification is not called", () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const calls: string[] = [];
    let stopSecond = () => {};
    cache.subscribe("k", () => {
      calls.push("first");
      stopSecond();
    });
    stopSecond = cache.subscribe("k", () => calls.push("second"));
    cache.mutate("k", () => 1);
    assert.deepEqual(calls, ["first"]);
  });

  it("snapshots are a new object after each change and the same object while nothing changes", async () => {
    const cache = createSwrCache({ scheduler: new Clock() });
    const { fetcher, call } = controlled<string>();
    const first = cache.swr("k", fetcher);
    const loading = cache.read<string>("k");
    assert.equal(cache.read<string>("k"), loading);
    call(0).resolve("x");
    await done(first.pending);
    assert.notEqual(cache.read<string>("k"), loading);
  });
});

describe("persistence", () => {
  const SIX_HOURS = 6 * 3_600_000;

  it("a page reload paints from the saved copy, shows it as stale and refreshes it", async () => {
    const clock = new Clock();
    const storage = new FakeStorage();
    const before = createSwrCache({ scheduler: clock, storage });
    const run = controlled<{ cameras: string[] }>();
    const first = before.swr("kestrel/cameras", run.fetcher, { persist: { maxAgeMs: SIX_HOURS } });
    run.call(0).resolve({ cameras: ["front"] });
    const saved = await done(first.pending);
    clock.advance(1000); // the write is delayed a little

    clock.advance(60_000); // the page is reloaded a minute later: all memory is gone
    const after = createSwrCache({ scheduler: clock, storage });
    const next = controlled<{ cameras: string[] }>();
    const restored = after.swr("kestrel/cameras", next.fetcher, { persist: { maxAgeMs: SIX_HOURS } });
    assert.deepEqual(restored.data, { cameras: ["front"] });
    assert.equal(restored.updatedAt, saved.updatedAt, "the saved time, not now");
    assert.equal(restored.stale, true);
    assert.equal(restored.loading, true);
    assert.equal(next.calls.length, 1);
  });

  it("a saved copy that is too old is ignored and removed", async () => {
    const clock = new Clock();
    const storage = new FakeStorage();
    const before = createSwrCache({ scheduler: clock, storage });
    const run = controlled<string>();
    const first = before.swr("k", run.fetcher, { persist: { maxAgeMs: SIX_HOURS } });
    run.call(0).resolve("old news");
    await done(first.pending);
    clock.advance(500);

    clock.advance(SIX_HOURS);
    const after = createSwrCache({ scheduler: clock, storage });
    const restored = after.swr("k", controlled<string>().fetcher, { persist: { maxAgeMs: SIX_HOURS } });
    assert.equal(restored.data, undefined);
    assert.deepEqual(storage.names("k"), []);
  });

  it("nothing is saved unless the call asked for persist", async () => {
    const clock = new Clock();
    const storage = new FakeStorage();
    const cache = createSwrCache({ scheduler: clock, storage });
    const run = controlled<string>();
    const first = cache.swr("k", run.fetcher);
    run.call(0).resolve("x");
    await done(first.pending);
    clock.advance(1000);
    assert.equal(storage.writes, 0);
  });

  it("a burst of changes is written once, after things went quiet", async () => {
    const clock = new Clock();
    const storage = new FakeStorage();
    const cache = createSwrCache({ scheduler: clock, storage });
    const run = controlled<number>();
    const first = cache.swr("k", run.fetcher, { persist: { maxAgeMs: SIX_HOURS } });
    run.call(0).resolve(1);
    await done(first.pending);
    cache.mutate<number>("k", () => 2);
    cache.mutate<number>("k", () => 3);
    assert.equal(storage.writes, 0, "not yet");
    clock.advance(1000);
    assert.equal(storage.writes, 1);
    const reloaded = createSwrCache({ scheduler: clock, storage }).swr("k", () => 99, { persist: { maxAgeMs: SIX_HOURS } });
    assert.equal(reloaded.data, 3, "the latest value is what was written");
  });

  it("a corrupt or unreadable saved copy is treated as no copy", async () => {
    const clock = new Clock();
    const storage = new FakeStorage();
    const before = createSwrCache({ scheduler: clock, storage });
    const run = controlled<string>();
    const first = before.swr("corrupt-me", run.fetcher, { persist: { maxAgeMs: SIX_HOURS } });
    run.call(0).resolve("x");
    await done(first.pending);
    clock.advance(1000);
    const [name] = storage.names("corrupt-me");
    assert.ok(name);
    storage.setItem(name, "{not json");
    const after = createSwrCache({ scheduler: clock, storage }).swr("corrupt-me", () => "fresh", { persist: { maxAgeMs: SIX_HOURS } });
    assert.equal(after.data, undefined);
  });

  it("a storage that refuses writes does not break the screen", async () => {
    const clock = new Clock();
    const full = new FakeStorage();
    full.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
    const cache = createSwrCache({ scheduler: clock, storage: full });
    const run = controlled<string>();
    const first = cache.swr("k", run.fetcher, { persist: { maxAgeMs: SIX_HOURS } });
    run.call(0).resolve("x");
    await done(first.pending);
    assert.doesNotThrow(() => clock.advance(1000));
    assert.equal(cache.read<string>("k").data, "x");
  });

  it("clear() removes every saved copy of the cache but leaves other things in storage alone", async () => {
    const clock = new Clock();
    const storage = new FakeStorage();
    storage.setItem("somebody-else", "keep me");
    const cache = createSwrCache({ scheduler: clock, storage });
    for (const key of ["a", "b"]) {
      const run = controlled<string>();
      const handle = cache.swr(key, run.fetcher, { persist: { maxAgeMs: SIX_HOURS } });
      run.call(0).resolve(key);
      await done(handle.pending);
    }
    clock.advance(1000);
    assert.equal(storage.length, 3);
    // a signed-out user must not leave data behind for the next one, not even for keys this page never loaded
    const reloaded = createSwrCache({ scheduler: clock, storage });
    reloaded.clear();
    assert.equal(storage.length, 1);
    assert.equal(storage.getItem("somebody-else"), "keep me");
    assert.equal(createSwrCache({ scheduler: clock, storage }).swr("a", () => "new", { persist: { maxAgeMs: SIX_HOURS } }).data, undefined);
  });

  it("clear(key) removes that key's saved copy and a write still waiting for it", async () => {
    const clock = new Clock();
    const storage = new FakeStorage();
    const cache = createSwrCache({ scheduler: clock, storage });
    const run = controlled<string>();
    const handle = cache.swr("k", run.fetcher, { persist: { maxAgeMs: SIX_HOURS } });
    run.call(0).resolve("x");
    await done(handle.pending);
    cache.clear("k");
    clock.advance(1000);
    assert.equal(storage.length, 0);
  });
});

describe("bounded memory", () => {
  it("forgets the keys used longest ago once there are too many, but never ones somebody subscribed to", () => {
    const cache = createSwrCache({ scheduler: new Clock(), maxEntries: 3 });
    cache.subscribe("watched", () => {});
    cache.mutate("watched", () => "w");
    cache.mutate("a", () => 1);
    cache.mutate("b", () => 2);
    cache.mutate("c", () => 3);
    assert.equal(cache.read("watched").data, "w");
    assert.equal(cache.read("a").data, undefined, "oldest unwatched key went");
    assert.equal(cache.read("b").data, 2);
    assert.equal(cache.read("c").data, 3);
  });

  it("using a key again keeps it", () => {
    const cache = createSwrCache({ scheduler: new Clock(), maxEntries: 2 });
    cache.mutate("a", () => 1);
    cache.mutate("b", () => 2);
    cache.mutate<number>("a", (current) => (current ?? 0) + 10); // a is now newer than b
    cache.mutate("c", () => 3);
    assert.equal(cache.read("a").data, 11);
    assert.equal(cache.read("b").data, undefined);
  });
});

describe("the shared cache behind swr(), readSwr() and friends", () => {
  afterEach(() => clearSwr());

  it("one cache serves all of them", async () => {
    const heard: Array<number | undefined> = [];
    const stop = subscribeSwr<number>("shared-test/count", (snapshot) => heard.push(snapshot.data));
    const handle = swr("shared-test/count", () => 1);
    await done(handle.pending);
    mutateSwr<number>("shared-test/count", (current) => (current ?? 0) + 1);
    assert.equal(readSwr<number>("shared-test/count").data, 2);
    clearSwr("shared-test/count");
    stop();
    assert.deepEqual(heard, [undefined, 1, 2, undefined]);
  });
});
