import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAgo } from "../src/state/format-ago.ts";

const S = 1000;
const MIN = 60 * S;
const HOUR = 60 * MIN;
const NOW = new Date(2026, 9, 14, 15, 30, 0).getTime();
const ago = (ms: number) => formatAgo(NOW - ms, NOW, "en-US");

describe("formatAgo", () => {
  it("says 'just now' under a minute", () => {
    assert.equal(ago(0), "just now");
    assert.equal(ago(59 * S), "just now");
    assert.equal(ago(59 * S + 999), "just now");
  });

  it("switches to minutes at exactly 60 s and rounds down", () => {
    assert.equal(ago(60 * S), "1 min ago");
    assert.equal(ago(12 * MIN + 59 * S), "12 min ago");
    assert.equal(ago(59 * MIN), "59 min ago");
    assert.equal(ago(59 * MIN + 59 * S + 999), "59 min ago");
  });

  it("switches to hours at exactly 60 min and stays in hours up to a day", () => {
    assert.equal(ago(60 * MIN), "1 h ago");
    assert.equal(ago(3 * HOUR + 40 * MIN), "3 h ago");
    assert.equal(ago(23 * HOUR), "23 h ago");
    assert.equal(ago(24 * HOUR - 1), "23 h ago");
  });

  it("treats a future timestamp (clock skew) as 'just now'", () => {
    assert.equal(formatAgo(NOW + 5 * S, NOW, "en-US"), "just now");
    assert.equal(formatAgo(NOW + 3 * HOUR, NOW, "en-US"), "just now");
  });

  it("says 'yesterday' once a day has passed and the calendar day changed once", () => {
    assert.equal(ago(24 * HOUR), "yesterday");
    assert.equal(formatAgo(new Date(2026, 9, 13, 0, 5).getTime(), NOW, "en-US"), "yesterday");
  });

  it("goes by calendar days, not by hours: 26 hours ago across two midnights is a date", () => {
    const now = new Date(2026, 9, 14, 1, 0).getTime();
    assert.equal(formatAgo(now - 26 * HOUR, now, "en-US"), "Oct 12");
  });

  it("gives a date for older readings, with the year only when it is not this year", () => {
    assert.equal(ago(5 * 24 * HOUR), "Oct 9");
    assert.equal(formatAgo(new Date(2025, 11, 31, 22, 0).getTime(), NOW, "en-US"), "Dec 31, 2025");
  });

  it("does not mix up the day change shortly after midnight with a day passing", () => {
    const now = new Date(2026, 9, 14, 0, 10).getTime();
    assert.equal(formatAgo(new Date(2026, 9, 13, 23, 30).getTime(), now, "en-US"), "40 min ago");
  });
});
