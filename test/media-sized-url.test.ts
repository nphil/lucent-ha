import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_WIDTHS, pickWidth, sizedUrl, withQueryParam } from "../src/image/sized-url.ts";
import { parseRatio, retryUrl } from "../src/image/image-model.ts";

const KESTREL = { widths: [160, 320, 640] };

describe("pickWidth", () => {
  it("rounds UP to the smallest whitelisted width that is big enough", () => {
    assert.equal(pickWidth(1), 80);
    assert.equal(pickWidth(80), 80);
    assert.equal(pickWidth(81), 160);
    assert.equal(pickWidth(257), 512);
    assert.equal(pickWidth(1024), 1024);
  });
  it("clamps to the largest width when nothing is big enough", () => {
    assert.equal(pickWidth(5000), 1024);
    assert.equal(pickWidth(5000, [160, 320]), 320);
  });
  it("does not need the whitelist sorted, and ignores junk entries", () => {
    assert.equal(pickWidth(200, [640, 160, 0, -5, NaN, 320]), 320);
  });
  it("treats a fractional layout width just under a whitelist entry as that entry (no double-size download)", () => {
    assert.equal(pickWidth(160.015625, DEFAULT_WIDTHS), 160);
    assert.equal(pickWidth(160.5, DEFAULT_WIDTHS), 256);
  });
  it("has no answer for an empty whitelist", () => {
    assert.equal(pickWidth(100, []), null);
  });
});

describe("sizedUrl", () => {
  it("asks for cssWidth x dpr rounded up (Kestrel tile: 175 px)", () => {
    assert.equal(sizedUrl("/api/photo.jpg", 175, 1, KESTREL), "/api/photo.jpg?w=320");
    assert.equal(sizedUrl("/api/photo.jpg", 175, 2, KESTREL), "/api/photo.jpg?w=640");
    assert.equal(sizedUrl("/api/photo.jpg", 100, 1, KESTREL), "/api/photo.jpg?w=160");
  });
  it("caps the pixel density at 3 (and lets it be lowered)", () => {
    assert.equal(sizedUrl("/p.jpg", 100, 5), "/p.jpg?w=512"); // 100 x min(5,3) = 300 -> 512
    assert.equal(sizedUrl("/p.jpg", 100, 5, { maxDpr: 1 }), "/p.jpg?w=160");
  });
  it("treats a nonsense density as 1", () => {
    assert.equal(sizedUrl("/p.jpg", 100, 0), "/p.jpg?w=160");
    assert.equal(sizedUrl("/p.jpg", 100, NaN), "/p.jpg?w=160");
  });
  it("clamps to the largest width", () => {
    assert.equal(sizedUrl("/p.jpg", 2000, 3, KESTREL), "/p.jpg?w=640");
  });
  it("keeps an existing query and fragment, and replaces an existing width", () => {
    assert.equal(sizedUrl("/p.jpg?sig=abc&x=1#top", 100, 1), "/p.jpg?sig=abc&x=1&w=160#top");
    assert.equal(sizedUrl("/p.jpg?w=999&sig=abc", 100, 1), "/p.jpg?sig=abc&w=160");
    assert.equal(sizedUrl("https://host.example/m/p.jpg?sig=a%20b", 300, 1), "https://host.example/m/p.jpg?sig=a%20b&w=512");
  });
  it("only replaces the whole parameter name, not parameters that merely end in it", () => {
    assert.equal(sizedUrl("/p.jpg?raw=1&w2=5", 100, 1), "/p.jpg?raw=1&w2=5&w=160");
  });
  it("uses a configurable parameter name", () => {
    assert.equal(sizedUrl("/p.jpg", 100, 1, { param: "width" }), "/p.jpg?width=160");
    assert.equal(sizedUrl("/p.jpg?width=5", 100, 1, { param: "width" }), "/p.jpg?width=160");
  });
  it("leaves data:, blob: and other schemes untouched", () => {
    for (const url of ["data:image/svg+xml;utf8,<svg/>", "blob:https://x/abc", "file:///a.png", "about:blank"]) {
      assert.equal(sizedUrl(url, 100, 2), url);
    }
  });
  it("sizes absolute http(s) and protocol-relative addresses", () => {
    assert.equal(sizedUrl("http://h/p.jpg", 100, 1), "http://h/p.jpg?w=160");
    assert.equal(sizedUrl("HTTPS://h/p.jpg", 100, 1), "HTTPS://h/p.jpg?w=160");
    assert.equal(sizedUrl("//h/p.jpg", 100, 1), "//h/p.jpg?w=160");
  });
  it("returns the address unchanged when the width is unknown or the whitelist is empty", () => {
    assert.equal(sizedUrl("/p.jpg", 0, 2), "/p.jpg");
    assert.equal(sizedUrl("/p.jpg", NaN, 2), "/p.jpg");
    assert.equal(sizedUrl("/p.jpg", 100, 2, { widths: [] }), "/p.jpg");
    assert.equal(sizedUrl("", 100, 2), "");
  });
});

describe("withQueryParam / retryUrl", () => {
  it("sets one parameter without disturbing the rest", () => {
    assert.equal(withQueryParam("/a?x=1#f", "y", "2"), "/a?x=1&y=2#f");
    assert.equal(withQueryParam("/a?", "y", "2"), "/a?y=2");
  });
  it("makes a retry address that differs from the original, also when it is retried on a sized address", () => {
    assert.equal(retryUrl("/p.jpg?w=320"), "/p.jpg?w=320&lu_retry=1");
    assert.notEqual(retryUrl("/p.jpg"), "/p.jpg");
  });
  it("retries data: and blob: addresses as they are (they cannot take a query)", () => {
    assert.equal(retryUrl("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
    assert.equal(retryUrl("blob:https://x/abc"), "blob:https://x/abc");
  });
});

describe("parseRatio", () => {
  it("accepts a/b and a decimal", () => {
    assert.equal(parseRatio("16/10"), "16 / 10");
    assert.equal(parseRatio(" 4 / 3 "), "4 / 3");
    assert.equal(parseRatio("1.5"), "1.5");
    assert.equal(parseRatio("1"), "1");
  });
  it("falls back to 4 / 3 for anything else, including zero and injection attempts", () => {
    for (const bad of ["", "wide", "0", "4/0", "0/3", "4/3; background:red", "-1"]) assert.equal(parseRatio(bad), "4 / 3", bad);
    assert.equal(parseRatio(undefined), "4 / 3");
  });
});
