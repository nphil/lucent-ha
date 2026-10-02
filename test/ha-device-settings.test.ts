import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDeviceSettings } from "../src/ha/device-settings.ts";

class FakeStorage {
  map = new Map<string, string>();
  failSet = false;
  failGet = false;
  getItem(key: string): string | null {
    if (this.failGet) throw new Error("SecurityError");
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failSet) throw new Error("QuotaExceededError");
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

/** An EventTarget that remembers which listeners are attached right now. */
class ProbeTarget extends EventTarget {
  active = new Set<unknown>();
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
    this.active.add(listener);
    super.addEventListener(type, listener, options);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void {
    this.active.delete(listener);
    super.removeEventListener(type, listener, options);
  }
  /** What the browser does in the OTHER tabs when this storage changes. */
  storageEvent(key: string | null, newValue: string | null): void {
    this.dispatchEvent(Object.assign(new Event("storage"), { key, newValue }));
  }
}

function setup(namespace = "kestrel") {
  const storage = new FakeStorage();
  const events = new ProbeTarget();
  const errors: unknown[] = [];
  const env = { storage: () => storage, events, onError: (error: unknown) => errors.push(error) };
  return { storage, events, errors, env, settings: createDeviceSettings(namespace, env) };
}

describe("get and set", () => {
  it("returns the fallback until something is stored", () => {
    const { settings } = setup();
    assert.equal(settings.get("wall", false), false);
    assert.equal(settings.get("tab", "live"), "live");
  });

  it("stores anything JSON can hold under <namespace>.lu.<key>", () => {
    const { settings, storage } = setup();
    const values: Array<[string, unknown, unknown]> = [
      ["flag", true, false],
      ["count", 7, 0],
      ["name", "wild life", ""],
      ["list", ["a", "b"], []],
      ["obj", { sort: "recent", dir: -1 }, {}],
      ["nothing", null, null],
    ];
    for (const [key, value, fallback] of values) {
      settings.set(key, value);
      assert.deepEqual(settings.get(key, fallback), value, key);
      assert.ok(storage.map.has(`kestrel.lu.${key}`), key);
    }
  });

  it("keeps namespaces apart", () => {
    const { settings, env } = setup("kestrel");
    const other = createDeviceSettings("aquarium", env);
    settings.set("wall", true);
    assert.equal(other.get("wall", false), false);
  });

  it("two settings objects with one namespace see the same values", () => {
    const { settings, env } = setup();
    const again = createDeviceSettings("kestrel", env);
    settings.set("tab", "wildlife");
    assert.equal(again.get("tab", "live"), "wildlife");
  });

  it("ignores a stored value of the wrong kind and corrupt JSON, even when the fallback is null", () => {
    const { settings, storage } = setup();
    storage.map.set("kestrel.lu.count", JSON.stringify("seven"));
    storage.map.set("kestrel.lu.list", JSON.stringify({ not: "a list" }));
    storage.map.set("kestrel.lu.obj", JSON.stringify([1]));
    storage.map.set("kestrel.lu.broken", "{oops");
    assert.equal(settings.get("count", 3), 3);
    assert.deepEqual(settings.get("list", ["x"]), ["x"]);
    assert.deepEqual(settings.get("obj", { a: 1 }), { a: 1 });
    assert.equal(settings.get<string | null>("broken", null), null);
    assert.equal(settings.get("broken", "fallback"), "fallback");
  });

  it("setting undefined removes the key", () => {
    const { settings, storage } = setup();
    settings.set("wall", true);
    settings.set("wall", undefined);
    assert.equal(settings.get("wall", false), false);
    assert.equal(storage.map.has("kestrel.lu.wall"), false);
  });

  it("refuses an empty namespace", () => {
    assert.throws(() => createDeviceSettings(""), /namespace/);
  });
});

describe("subscribe: this tab", () => {
  it("tells the subscriber the new value right after each set, and undefined after a removal", () => {
    const { settings } = setup();
    const seen: unknown[] = [];
    settings.subscribe("wall", (value) => seen.push(value));
    settings.set("wall", true);
    settings.set("wall", false);
    settings.set("wall", undefined);
    assert.deepEqual(seen, [true, false, undefined]);
  });

  it("only tells subscribers of that key", () => {
    const { settings } = setup();
    const seen: string[] = [];
    settings.subscribe("wall", () => seen.push("wall"));
    settings.subscribe("tab", () => seen.push("tab"));
    settings.set("tab", "live");
    assert.deepEqual(seen, ["tab"]);
  });

  it("tells subscribers of another settings object with the same namespace too", () => {
    const { settings, env } = setup();
    const again = createDeviceSettings("kestrel", env);
    const seen: unknown[] = [];
    again.subscribe("tab", (value) => seen.push(value));
    settings.set("tab", "wildlife");
    assert.deepEqual(seen, ["wildlife"]);
  });

  it("stops after unsubscribe, which can safely be called twice, and releases the window listeners with the last one", () => {
    const { settings, events } = setup();
    const seen: unknown[] = [];
    assert.equal(events.active.size, 0);
    const stopFirst = settings.subscribe("wall", (value) => seen.push(`first:${value}`));
    const stopSecond = settings.subscribe("wall", (value) => seen.push(`second:${value}`));
    assert.ok(events.active.size > 0);
    stopFirst();
    stopFirst();
    settings.set("wall", true);
    assert.deepEqual(seen, ["second:true"]);
    stopSecond();
    assert.equal(events.active.size, 0, "nothing left attached to the window");
    settings.set("wall", false);
    assert.deepEqual(seen, ["second:true"]);
  });

  it("one subscriber that throws does not stop the others, and the error is reported", () => {
    const { settings, errors } = setup();
    const boom = new Error("subscriber");
    const seen: unknown[] = [];
    settings.subscribe("wall", () => {
      throw boom;
    });
    settings.subscribe("wall", (value) => seen.push(value));
    settings.set("wall", true);
    assert.deepEqual(seen, [true]);
    assert.deepEqual(errors, [boom]);
  });
});

describe("subscribe: other tabs (the storage event)", () => {
  it("passes on the parsed new value, and undefined when the other tab removed the key", () => {
    const { settings, events } = setup();
    const seen: unknown[] = [];
    settings.subscribe("wall", (value) => seen.push(value));
    events.storageEvent("kestrel.lu.wall", "true");
    events.storageEvent("kestrel.lu.wall", null);
    events.storageEvent("kestrel.lu.wall", "{broken");
    assert.deepEqual(seen, [true, undefined, undefined]);
  });

  it("ignores other keys and other apps' keys", () => {
    const { settings, events } = setup();
    const seen: unknown[] = [];
    settings.subscribe("wall", (value) => seen.push(value));
    events.storageEvent("kestrel.lu.tab", '"live"');
    events.storageEvent("some-other-app.wall", "true");
    assert.deepEqual(seen, []);
  });

  it("when another tab clears everything, subscribers get what is stored now (nothing)", () => {
    const { settings, events, storage } = setup();
    settings.set("wall", true);
    const seen: unknown[] = [];
    settings.subscribe("wall", (value) => seen.push(value));
    storage.map.clear();
    events.storageEvent(null, null);
    assert.deepEqual(seen, [undefined]);
  });
});

describe("when the browser will not store", () => {
  it("blocked storage: values live in memory for this page and subscribers still hear about them", () => {
    const events = new ProbeTarget();
    const settings = createDeviceSettings("kestrel", { storage: () => null, events });
    const seen: unknown[] = [];
    settings.subscribe("wall", (value) => seen.push(value));
    settings.set("wall", true);
    assert.equal(settings.get("wall", false), true);
    settings.set("wall", undefined);
    assert.equal(settings.get("wall", false), false);
    assert.deepEqual(seen, [true, undefined]);
  });

  it("storage that throws on write (full disk): the value is kept in memory, and goes to storage once it works again", () => {
    const { settings, storage } = setup();
    storage.failSet = true;
    settings.set("tab", "wildlife");
    assert.equal(settings.get("tab", "live"), "wildlife");
    assert.equal(storage.map.has("kestrel.lu.tab"), false);
    storage.failSet = false;
    settings.set("tab", "insights");
    assert.equal(storage.map.get("kestrel.lu.tab"), JSON.stringify("insights"));
    storage.map.set("kestrel.lu.tab", JSON.stringify("from-another-tab"));
    assert.equal(settings.get("tab", "live"), "from-another-tab", "the memory copy no longer shadows storage");
  });

  it("storage that throws on read gives the fallback instead of breaking the caller", () => {
    const { settings, storage } = setup();
    settings.set("tab", "wildlife");
    storage.failGet = true;
    assert.equal(settings.get("tab", "live"), "live");
  });

  it("a storage() that throws (the localStorage getter raising SecurityError) also falls back to memory", () => {
    const events = new ProbeTarget();
    const settings = createDeviceSettings("kestrel", {
      events,
      storage: () => {
        throw new Error("SecurityError");
      },
    });
    settings.set("wall", true);
    assert.equal(settings.get("wall", false), true);
  });
});
