import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { activeAudio, releaseAudio } from "../src/core/audio-focus.ts";
import { SharedAudio, activeSource, failCurrent, playerSources, progressFraction, retryPlayer, settle, toggleOriginal, withSources, type AudioListRow } from "../src/audio/audio-model.ts";

/** A media element that behaves like the real one where it matters: play/pause flip `paused`, and pausing it
 * raises `pause` on whoever listens (the list forwards that to `handlePause`). */
class FakeAudio {
  src = "";
  preload = "none";
  paused = true;
  currentTime = 0;
  duration = NaN;
  loads = 0;
  onPause: () => void = () => {};
  onPlay: () => void = () => {};
  play(): Promise<void> {
    this.paused = false;
    this.onPlay();
    return Promise.resolve();
  }
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.onPause();
  }
  load(): void { this.loads += 1; }
  removeAttribute(name: string): void { if (name === "src") this.src = ""; }
}

function list(rows: AudioListRow[] = []) {
  const audio = new FakeAudio();
  const log = { changed: 0, progress: [] as number[] };
  const shared = new SharedAudio(audio as unknown as HTMLMediaElement, { changed: () => { log.changed += 1; }, progress: (f) => log.progress.push(f) });
  audio.onPlay = () => shared.handlePlay();
  audio.onPause = () => shared.handlePause();
  shared.setRows(rows);
  return { audio, shared, log };
}

const row = (id: string, extra: Partial<AudioListRow> = {}): AudioListRow => ({ id, src: `/${id}.wav`, title: id, label: id, ...extra });

const cleanup: FakeAudio[] = [];
afterEach(() => {
  for (const audio of cleanup.splice(0)) releaseAudio(audio as unknown as HTMLMediaElement);
});

describe("single recording sources", () => {
  it("plays src until told otherwise", () => {
    assert.equal(activeSource(playerSources("/p.wav", "/o.wav")), "/p.wav");
  });

  it("toggles to the original and back, and does nothing without an original", () => {
    let state = toggleOriginal(playerSources("/p.wav", "/o.wav"));
    assert.equal(activeSource(state), "/o.wav");
    state = toggleOriginal(state);
    assert.equal(activeSource(state), "/p.wav");
    const alone = playerSources("/p.wav", "");
    assert.equal(toggleOriginal(alone), alone);
  });

  it("falls back to the original when the preview cannot load, and fails only when nothing is left", () => {
    let state = failCurrent(playerSources("/p.wav", "/o.wav"));
    assert.equal(state.failed, false);
    assert.equal(activeSource(state), "/o.wav");
    state = failCurrent(state);
    assert.equal(state.failed, true);
    assert.equal(failCurrent(playerSources("/p.wav", "")).failed, true);
  });

  it("try again returns to the preview, with the error gone", () => {
    const state = retryPlayer(failCurrent(failCurrent(playerSources("/p.wav", "/o.wav"))));
    assert.deepEqual([state.failed, activeSource(state)], [false, "/p.wav"]);
  });

  it("holds a new src back while the preview is playing, so the swap is never heard", () => {
    let state = playerSources("/old.wav", "");
    state = withSources(state, "/new.wav", "", true);
    assert.equal(activeSource(state), "/old.wav");
    state = settle(state); // paused or ended
    assert.equal(activeSource(state), "/new.wav");
  });

  it("applies a new src at once when nothing is playing", () => {
    const state = withSources(playerSources("/old.wav", ""), "/new.wav", "", false);
    assert.equal(activeSource(state), "/new.wav");
  });

  it("keeps the FIRST held file when src changes twice during one playback", () => {
    let state = withSources(playerSources("/a.wav", ""), "/b.wav", "", true);
    state = withSources(state, "/c.wav", "", true);
    assert.equal(activeSource(state), "/a.wav");
    assert.equal(activeSource(settle(state)), "/c.wav");
  });

  it("does not hold anything while the original is what plays (the swap cannot be heard)", () => {
    let state = toggleOriginal(playerSources("/a.wav", "/o.wav"));
    state = withSources(state, "/b.wav", "/o.wav", true);
    assert.equal(state.held, null);
    assert.equal(activeSource(state), "/o.wav");
    assert.equal(activeSource(toggleOriginal(state)), "/b.wav");
  });

  it("the first src never counts as a swap", () => {
    assert.equal(withSources(playerSources("", ""), "/a.wav", "", true).held, null);
  });

  it("a new src forgets an earlier error, and dropping the original leaves the original mode", () => {
    const failed = failCurrent(playerSources("/a.wav", ""));
    assert.equal(withSources(failed, "/b.wav", "", false).failed, false);
    const onOriginal = toggleOriginal(playerSources("/a.wav", "/o.wav"));
    assert.equal(activeSource(withSources(onOriginal, "/a.wav", "", false)), "/a.wav");
  });
});

describe("progressFraction", () => {
  it("is 0..1 and 0 while the length is unknown", () => {
    assert.equal(progressFraction(5, 10), 0.5);
    assert.equal(progressFraction(15, 10), 1);
    assert.equal(progressFraction(-1, 10), 0);
    for (const duration of [NaN, 0, Infinity]) assert.equal(progressFraction(5, duration), 0, String(duration));
  });
});

describe("audio list: one recording at a time", () => {
  it("starting a row in one list pauses what plays in another list (and the page-wide owner follows)", () => {
    const a = list([row("a1")]);
    const b = list([row("b1")]);
    cleanup.push(a.audio, b.audio);
    a.shared.toggle(row("a1"));
    assert.equal(a.audio.paused, false);
    assert.equal(activeAudio(), a.audio as unknown);
    b.shared.toggle(row("b1"));
    assert.equal(a.audio.paused, true, "A was paused by B starting");
    assert.equal(b.audio.paused, false);
    assert.equal(activeAudio(), b.audio as unknown);
    assert.equal(a.shared.playing, false);
    assert.equal(a.shared.isPlaying(row("a1")), false);
  });

  it("pausing or ending releases the page-wide claim", () => {
    const a = list([row("a1")]);
    cleanup.push(a.audio);
    a.shared.toggle(row("a1"));
    a.shared.toggle(row("a1")); // pause
    assert.equal(activeAudio(), null);
    a.shared.toggle(row("a1")); // play again
    assert.equal(activeAudio(), a.audio as unknown);
    a.audio.paused = true;
    a.shared.handleEnded();
    assert.equal(activeAudio(), null);
    assert.equal(a.shared.active, null);
  });

  it("switching rows inside a list reuses the one element and plays the new row", () => {
    const rows = [row("r1"), row("r2")];
    const a = list(rows);
    cleanup.push(a.audio);
    a.shared.toggle(rows[0] as AudioListRow);
    a.shared.toggle(rows[1] as AudioListRow);
    assert.equal(a.audio.src, "/r2.wav");
    assert.equal(a.shared.active, "r2");
    assert.equal(a.shared.isActive(rows[0] as AudioListRow), false);
  });

  it("stop silences and releases, and forgets the active row", () => {
    const a = list([row("a1")]);
    cleanup.push(a.audio);
    a.shared.toggle(row("a1"));
    a.shared.stop();
    assert.deepEqual([a.audio.paused, a.audio.src, a.shared.active, activeAudio()], [true, "", null, null]);
  });

  it("a row that disappears while active stops the sound", () => {
    const a = list([row("a1"), row("a2")]);
    cleanup.push(a.audio);
    a.shared.toggle(row("a1"));
    a.shared.setRows([row("a2")]);
    assert.equal(a.audio.paused, true);
    assert.equal(a.shared.active, null);
  });
});

describe("audio list: warming and current source", () => {
  it("warms the newest playable row once, when rows first arrive", () => {
    const a = list([row("none", { src: null }), row("new"), row("old")]);
    assert.equal(a.audio.src, "/new.wav");
    assert.equal(a.audio.loads, 1);
    a.shared.setRows([row("other"), row("new")]);
    assert.equal(a.audio.src, "/new.wav", "not warmed again");
  });

  it("press warms a row while idle, but never while another row is active (its audio must stay loaded)", () => {
    const a = list([row("r1"), row("r2")]);
    a.shared.warm(row("r2"));
    assert.equal(a.audio.src, "/r2.wav");
    a.shared.toggle(row("r1"));
    a.shared.toggle(row("r1")); // paused part-way, still active
    a.shared.warm(row("r2"));
    assert.equal(a.audio.src, "/r1.wav");
    a.shared.toggle(row("r1"));
    assert.equal(a.audio.paused, false);
    assert.equal(a.audio.src, "/r1.wav", "resumes its own recording");
  });

  it("tapping a warmed row does not reload it", () => {
    const a = list([row("r1")]);
    const loads = a.audio.loads;
    a.shared.toggle(row("r1"));
    assert.equal(a.audio.loads, loads);
    assert.equal(a.audio.paused, false);
  });

  it("plays the row's CURRENT src when it changed while listed", () => {
    const a = list([row("r1", { src: "/preview-pending.wav" })]);
    assert.equal(a.audio.src, "/preview-pending.wav");
    const updated = row("r1", { src: "/preview-ready.wav" });
    a.shared.setRows([updated]);
    a.shared.toggle(updated);
    assert.equal(a.audio.src, "/preview-ready.wav");
  });

  it("does nothing for a row without a recording", () => {
    const empty = row("e", { src: null });
    const a = list([empty]);
    a.shared.toggle(empty);
    assert.equal(a.audio.paused, true);
    assert.equal(a.shared.active, null);
  });

  it("reports progress without a re-render", () => {
    const a = list([row("r1")]);
    a.shared.toggle(row("r1"));
    a.audio.currentTime = 2;
    a.audio.duration = 8;
    const changedBefore = a.log.changed;
    a.shared.handleTime();
    assert.equal(a.log.progress.at(-1), 0.25);
    assert.equal(a.log.changed, changedBefore);
  });
});

describe("audio list: fallback chain", () => {
  it("src fails -> the fallback plays; the row is not failed", () => {
    const r = row("r1", { src: "/preview.wav", fallback: "/original.wav" });
    const a = list([r]);
    a.shared.toggle(r);
    a.shared.handleError();
    assert.equal(a.audio.src, "/original.wav");
    assert.equal(a.audio.paused, false, "keeps playing");
    assert.equal(a.shared.isFailed(r), false);
    assert.equal(a.shared.active, "r1");
  });

  it("the fallback failing too marks the row failed and frees the player", () => {
    const r = row("r1", { src: "/preview.wav", fallback: "/original.wav" });
    const a = list([r]);
    a.shared.toggle(r);
    a.shared.handleError();
    a.shared.handleError();
    assert.equal(a.shared.isFailed(r), true);
    assert.equal(a.shared.active, null);
    assert.equal(a.shared.playing, false);
  });

  it("a row without a fallback fails at the first error", () => {
    const r = row("r1");
    const a = list([r]);
    a.shared.toggle(r);
    a.shared.handleError();
    assert.equal(a.shared.isFailed(r), true);
  });

  it("goes straight to the fallback next time instead of failing the preview again", () => {
    const r = row("r1", { src: "/preview.wav", fallback: "/original.wav" });
    const a = list([r]);
    a.shared.toggle(r);
    a.shared.handleError();
    a.shared.toggle(r); // pause
    a.shared.stop();
    a.shared.toggle(r);
    assert.equal(a.audio.src, "/original.wav");
  });

  it("tapping a failed row tries again from the preview; a changed src heals it by itself", () => {
    const r = row("r1", { src: "/preview.wav" });
    const a = list([r]);
    a.shared.toggle(r);
    a.shared.handleError();
    assert.equal(a.shared.isFailed(r), true);
    assert.equal(a.shared.isFailed(row("r1", { src: "/preview-v2.wav" })), false);
    a.shared.toggle(r);
    assert.equal(a.audio.src, "/preview.wav");
    assert.equal(a.shared.isFailed(r), false);
  });

  it("an error from a warmed (not yet tapped) row is remembered for that row only", () => {
    const first = row("first", { src: "/missing.wav" });
    const second = row("second");
    const a = list([first, second]);
    a.shared.handleError();
    assert.equal(a.shared.isFailed(first), true);
    assert.equal(a.shared.isFailed(second), false);
  });

  it("dispose lets go of the speaker and forgets the active row", () => {
    const a = list([row("r1")]);
    cleanup.push(a.audio);
    a.shared.toggle(row("r1"));
    a.shared.dispose();
    assert.deepEqual([a.audio.paused, a.shared.active, activeAudio()], [true, null, null]);
  });
});
