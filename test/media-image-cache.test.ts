import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ImageUrlCache } from "../src/image/image-cache.ts";

/** A cache whose downloads settle when the test says so, and whose object URLs are plain numbered strings. */
function setup(options: { maxIdle?: number } = {}) {
  const requested: string[] = [];
  const pending = new Map<string, Array<(response: Response | Error) => void>>();
  const revoked: string[] = [];
  let counter = 0;
  const cache = new ImageUrlCache({
    maxIdle: options.maxIdle,
    fetcher: (url) => {
      requested.push(url);
      return new Promise<Response>((resolve, reject) => {
        const list = pending.get(url) ?? [];
        list.push((value) => (value instanceof Error ? reject(value) : resolve(value)));
        pending.set(url, list);
      });
    },
    createObjectUrl: () => `blob:${(counter += 1)}`,
    revokeObjectUrl: (url) => revoked.push(url),
  });
  const settle = async (url: string, response: Response | Error = new Response("img")): Promise<void> => {
    for (const resolve of pending.get(url) ?? []) resolve(response);
    pending.delete(url);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
  return { cache, requested, revoked, settle, flush };
}

describe("ImageUrlCache", () => {
  it("downloads once per address however many holders ask, and tells each of them", async () => {
    const t = setup();
    const got: Array<string | null> = [];
    const a = t.cache.acquire("/a", (url) => got.push(url));
    const b = t.cache.acquire("/a", (url) => got.push(url));
    assert.equal(a.url, null);
    assert.equal(t.requested.length, 1);
    await t.settle("/a");
    assert.deepEqual(got, ["blob:1", "blob:1"]);
    assert.equal(a.url, "blob:1");
    assert.equal(b.url, "blob:1");
  });

  it("hands out an already downloaded picture at once, without calling back", async () => {
    const t = setup();
    t.cache.acquire("/a", () => {});
    await t.settle("/a");
    let called = false;
    const again = t.cache.acquire("/a", () => { called = true; });
    assert.equal(again.url, "blob:1");
    assert.equal(called, false);
    assert.equal(t.requested.length, 1);
  });

  it("revokes only after the LAST holder released (idle limit 0)", async () => {
    const t = setup({ maxIdle: 0 });
    const a = t.cache.acquire("/a", () => {});
    const b = t.cache.acquire("/a", () => {});
    await t.settle("/a");
    a.release();
    await t.flush();
    assert.deepEqual(t.revoked, [], "still shown by the second holder");
    b.release();
    await t.flush();
    assert.deepEqual(t.revoked, ["blob:1"]);
    assert.equal(t.cache.size, 0);
  });

  it("a release is counted once, however often it is called", async () => {
    const t = setup({ maxIdle: 0 });
    const a = t.cache.acquire("/a", () => {});
    const b = t.cache.acquire("/a", () => {});
    await t.settle("/a");
    a.release();
    a.release();
    a.release();
    await t.flush();
    assert.deepEqual(t.revoked, [], "b still holds it");
    b.release();
  });

  it("does not revoke a picture that is released and re-acquired in the same turn (a re-render)", async () => {
    const t = setup({ maxIdle: 0 });
    const first = t.cache.acquire("/a", () => {});
    await t.settle("/a");
    first.release();
    const second = t.cache.acquire("/a", () => {});
    await t.flush();
    assert.deepEqual(t.revoked, []);
    assert.equal(second.url, "blob:1");
  });

  it("keeps idle pictures up to the limit (instant revisit) and revokes the longest idle first beyond it", async () => {
    const t = setup({ maxIdle: 2 });
    const leases = [];
    for (const url of ["/1", "/2", "/3"]) {
      leases.push(t.cache.acquire(url, () => {}));
      await t.settle(url);
    }
    leases[0]?.release();
    leases[1]?.release();
    await t.flush();
    assert.deepEqual(t.revoked, [], "two idle pictures fit");
    leases[2]?.release();
    await t.flush();
    assert.deepEqual(t.revoked, ["blob:1"], "the first one let go is the first to go");
    assert.equal(t.cache.size, 2);
  });

  it("never revokes a picture somebody still shows, even far over the limit", async () => {
    const t = setup({ maxIdle: 0 });
    for (const url of ["/1", "/2", "/3"]) {
      t.cache.acquire(url, () => {});
      await t.settle(url);
    }
    const idle = t.cache.acquire("/4", () => {});
    await t.settle("/4");
    idle.release();
    await t.flush();
    assert.deepEqual(t.revoked, ["blob:4"]);
    assert.equal(t.cache.size, 3);
  });

  it("reports a failed download as null and does not cache the failure", async () => {
    const t = setup();
    const results: Array<string | null> = [];
    t.cache.acquire("/a", (url) => results.push(url));
    await t.settle("/a", new Response("nope", { status: 401 }));
    assert.deepEqual(results, [null]);
    const retry = t.cache.acquire("/a", (url) => results.push(url));
    assert.equal(t.requested.length, 2, "asked again");
    await t.settle("/a");
    assert.deepEqual(results, [null, "blob:1"]);
    assert.equal(retry.url, "blob:1");
  });

  it("treats a network error like a failed download", async () => {
    const t = setup();
    const results: Array<string | null> = [];
    t.cache.acquire("/a", (url) => results.push(url));
    await t.settle("/a", new Error("offline"));
    assert.deepEqual(results, [null]);
  });

  it("does not call back a holder that released before the download finished, and drops a picture nobody wants", async () => {
    const t = setup();
    let called = false;
    const lease = t.cache.acquire("/a", () => { called = true; });
    lease.release();
    await t.settle("/a");
    assert.equal(called, false);
    assert.deepEqual(t.revoked, ["blob:1"]);
    assert.equal(t.cache.size, 0);
  });

  it("dispose revokes everything, held or not, and leases out afterwards are harmless", async () => {
    const t = setup();
    const a = t.cache.acquire("/a", () => {});
    t.cache.acquire("/b", () => {});
    await t.settle("/a");
    await t.settle("/b");
    t.cache.dispose();
    assert.deepEqual(t.revoked.sort(), ["blob:1", "blob:2"]);
    assert.doesNotThrow(() => a.release());
    assert.equal(t.cache.size, 0);
  });
});
