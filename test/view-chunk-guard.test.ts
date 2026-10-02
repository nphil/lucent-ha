import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { importWithReload } from "../src/view/chunk-guard.ts";

/** sessionStorage stand-in. */
function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> & { size: number } {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    get size() {
      return items.size;
    },
  };
}

/** Silences the console notes the guard writes while a test provokes failures. */
function quietConsole<T>(run: () => Promise<T>): Promise<T> {
  const warn = mock.method(console, "warn", () => {});
  return run().finally(() => warn.mock.restore());
}

describe("importWithReload", () => {
  it("returns the loaded module", async () => {
    const loaded = await importWithReload(async () => ({ answer: 42 }), { storage: memoryStorage(), reload: () => assert.fail("no reload") });
    assert.deepEqual(loaded, { answer: 42 });
  });

  for (const message of [
    "Failed to fetch dynamically imported module: https://ha.local/kestrel/insights-3f2a.js",
    "error loading dynamically imported module: https://ha.local/kestrel/insights-3f2a.js",
    "Importing a module script failed.",
  ]) {
    it(`reloads the page once when the file is gone from the server (${message.slice(0, 30)}...) and still throws`, () =>
      quietConsole(async () => {
        let reloads = 0;
        const failure = new TypeError(message);
        await assert.rejects(importWithReload(() => Promise.reject(failure), { storage: memoryStorage(), reload: () => reloads++ }), (error) => error === failure);
        assert.equal(reloads, 1);
      }));
  }

  it("does not reload twice in a row: when the reload did not help, the error is just thrown", () =>
    quietConsole(async () => {
      let reloads = 0;
      const storage = memoryStorage();
      const failing = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module: x.js"));
      await assert.rejects(importWithReload(failing, { storage, reload: () => reloads++ }));
      await assert.rejects(importWithReload(failing, { storage, reload: () => reloads++ }));
      await assert.rejects(importWithReload(failing, { storage, reload: () => reloads++ }));
      assert.equal(reloads, 1, "a server that stays down must not trap the page in a reload loop");
    }));

  it("a successful import after the reload re-arms the guard for the next update", () =>
    quietConsole(async () => {
      let reloads = 0;
      const storage = memoryStorage();
      const failing = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module: x.js"));
      await assert.rejects(importWithReload(failing, { storage, reload: () => reloads++ }));
      await importWithReload(async () => "back up", { storage, reload: () => reloads++ });
      assert.equal(storage.size, 0);
      await assert.rejects(importWithReload(failing, { storage, reload: () => reloads++ }));
      assert.equal(reloads, 2);
    }));

  it("errors thrown by the loaded file's own code are not a stale file: no reload", async () => {
    let reloads = 0;
    const storage = memoryStorage();
    const broken = new ReferenceError("insightsChart is not defined");
    await assert.rejects(importWithReload(() => Promise.reject(broken), { storage, reload: () => reloads++ }), (error) => error === broken);
    assert.equal(reloads, 0);
    assert.equal(storage.size, 0, "and nothing was flagged");
  });

  it("without a working flag there is no way to stop a loop, so it never reloads", async () => {
    let reloads = 0;
    const blocked = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      removeItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    };
    await assert.rejects(importWithReload(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module: x.js")), { storage: blocked, reload: () => reloads++ }));
    assert.equal(reloads, 0);
    assert.equal(await importWithReload(async () => "still loads", { storage: blocked }), "still loads");
  });
});
