# Performance budgets (`dev/perf-check.mjs`)

A script that taps, presses and scrolls the sample panel of the dev harness the way a finger or a mouse does, at nine screen sizes, in a flat and a glass theme, at normal speed and with the CPU slowed 4x, and fails when a budget is missed. It is the release gate for "does it feel fast".

## Run it

The dev harness server must be running (`http://127.0.0.1:4180`, see [harness.md](harness.md)) and the panel built (`scripts/lu-run node dev/build.mjs`). Always go through the browser wrapper: it runs one browser tab at a time, at the lowest priority, with a memory cap.

```sh
# quick look: one size, one theme, normal speed, one repeat (about a minute)
scripts/lu-browser node dev/perf-check.mjs --sizes phone --themes flat-light --cpu 1 --runs 1 --out dev/out/perf-try

# the real run (every size, flat-light + glass-dark, 1x and 4x CPU, 3 repeats), judged at the host's normal load
scripts/lu-browser node dev/perf-check.mjs --cell-timeout 900
```

| option | meaning (default) |
|---|---|
| `--sizes a,b` or `all` | sizes of `dev/devices.json` (all nine) |
| `--themes a,b` or `all` | `flat-light`, `flat-dark`, `glass-light`, `glass-dark` (`flat-light,glass-dark`) |
| `--cpu 1,4` | CPU slowing rates; 1 = none (`1,4`) |
| `--only a,b` | `tabs`, `press`, `sheet`, `back`, `scroll`, `cls` (all). `back` runs the sheet measurement; `cls` runs tabs + sheet + scroll and reports only the layout shift |
| `--runs 3` | repeats of every press, tab switch, sheet opening and Back (3) |
| `--passes 6` | scroll passes of about 2500 px, down and up in turn (6) |
| `--sheet-gate shown\|done` | which sheet number the 220 ms budget judges, see below (`shown`) |
| `--out docs/perf` | where `latest.json` and `latest.md` are written; only `docs/perf` and `dev/out/...` are allowed |
| `--require-quiet` | refuse to run (exit 3) while the host load is at or above the load limit (below), and throw away a cell during which it rose to it |
| `--force` | ignore results already in `--out` |
| `--cell-timeout 600` | seconds before the watchdog closes a stuck tab |

Results are saved after every cell. Running the same command again carries on with the cells that are missing (same options required; otherwise use `--force`). One cell is one size x theme x CPU rate; nothing else is ever open: one tab, closed at the end, the shared browser's other tabs are not touched.

## What is measured, in plain words

| budget | limit | what it is |
|---|---|---|
| **press feedback** | 50 ms | From the finger going down on a control to the frame that shows it pressed (the wash). Two numbers: the *wall clock* (what the clock says) and the *thread time* (how much work the page's main thread did for that frame, read from a browser trace). Each control is pressed right after an inert one (a heading) in the same state, so the table also shows what any press costs on that page right now ("floor"). A control that shows no change at all fails. |
| **cached tab switch, first paint** | 100 ms (200 ms at 4x CPU) | Tap on a tab that was visited before to the first frame in which something on the page has reacted. |
| **cached tab switch, stable** | 300 ms (600 ms at 4x CPU) | Tap to the last frame that still changed (the cross-fade is over, pictures arrived, nothing moves for 100 ms). The first visit of a tab is also recorded, but not judged: it has to wait for data. |
| **sheet open** | 220 ms | Tap on a tile (species sheet) and on the app bar button ("What was it?"). See "The sheet number" below. |
| **Back closes the top layer** | 100 ms | `history.back()` to the first frame in which the open sheet has begun to close, for the URL-backed species sheet and for the sheet with a history layer. The same through the browser's own history command (CDP) is recorded, not judged. |
| **long task while scrolling** | none over 50 ms | Six passes of about 2500 px over the Library grid with real finger drags (touch sizes) or mouse-wheel gestures. The browser reports every stretch over 50 ms during which the page could not react; the table shows how much of it was the toolkit's own script and how much someone else's. |
| **CLS** | 0.02 | Layout shift over the whole cell: how much the page jumped around without being asked. Shifts that follow a tap are excused by the browser's own rule; they are listed under "Note" because a page that jumps when tapped is still worth fixing. |

Also recorded (not judged): time until the panel's first data is painted, first contentful paint, script size, DOM nodes, pictures loaded, how many times the panel rendered during each tab switch, the speed of a fixed calculation on this host ("calibration loop", to compare runs).

### The sheet number

The sheet's enter motion takes `motion.layer` = 220 ms by design, so "tap until the sheet is fully open and finished moving" can never be under 220 ms. By default the budget therefore judges **from the tap to the first frame in which the sheet is on screen and entering**; that is the part the page's code can make slow (rendering the sheet, opening the dialog). The finished-motion time is in the table too. `--sheet-gate done` judges that one instead (it cannot pass: the motion alone is 220 ms).

## Reading the result

Every cell prints a table, `docs/perf/latest.md` has them all (with the per-control, per-tab, per-pass detail), `docs/perf/latest.json` has the raw samples.

| status | meaning |
|---|---|
| `PASS` | within the budget |
| `FAIL` | over the budget and it counts: always for thread time, layout shift and a control without feedback; for every wall-clock number when the host load was under the limit |
| `PROVISIONAL` | over the budget, but the host load was at or above the limit (or unknown) while it was measured, so the toolkit is not blamed. Measure again when the load is lower. |
| `ERROR` | the measurement itself failed after two retries (the message says why). Counts as a failure only when the host load was under the limit. |

**Host load.** This machine is shared and never idle: its normal one-minute load is 15 to 25 on 16 threads, so a "quiet window" is not something to wait for. `scripts/lu-load` (the one-minute load average) is read before and after every cell and printed with it. The limit is `PERF_MAX_LOAD` and defaults to **64**: wall-clock numbers are judged at normal load. Only a cell at or above the limit is tagged `PROVISIONAL` in its title and in every row; the same when the load could not be read. A busy host makes wall-clock times longer, never shorter, so a number that passes on a busy host is a real pass; the thread time and the layout shift do not depend on load and are always enforced. `PERF_MAX_LOAD=8` brings back the old "truly quiet host only" rule. Nothing is ever "fixed" by running again until it is green: a number is evidence only with the load printed next to it.

`Flaky` lists the steps that needed a retry (a step is retried on a fresh page up to twice). A step that stops answering is abandoned by a watchdog: the tab is closed and the run stops with exit code 3, the cells finished so far stay in the results.

Exit code: `0` nothing failed, `1` a budget failed (or, within the load limit, could not be measured), `2` it could not run (bad option, server down, the sample panel is not built: the message says what to do), `3` refused by `--require-quiet` or stopped by the watchdog.

## How it is built

| file | job |
|---|---|
| `dev/perf-check.mjs` | the command: options, load readings, one cell after the other, results and exit code |
| `dev/lib/perf-steps.mjs` | the measurements (tabs, press, sheet and Back, scroll), retries and watchdog |
| `dev/lib/perf-page.mjs` | what is installed inside the page: records DOM changes, animations, long tasks and layout shifts; finds the controls through `window.__lu.demo` |
| `dev/lib/perf-settle.ts` | turns the recorded moments into "first" and "stable" |
| `dev/lib/perf-trace.ts` | adds up the main thread's work for a press from a browser trace |
| `dev/lib/perf-budgets.ts`, `perf-load.ts`, `perf-stats.ts`, `perf-args.ts`, `perf-report.ts` | the budgets and PASS/FAIL/PROVISIONAL rule, the load rule, statistics, the command line, the tables |

The pure parts have tests (`scripts/lu-run node --test test/perf-*.test.ts`). Only the sample panel (`?scenario=panel`) can be measured: the gate has no mode for the real Home Assistant, because the panel it needs (`window.__lu.demo`) exists only in the harness.

Scenario hooks the tool relies on (do not rename): `window.__lu.demo` (`ready`, `navItem`, `speciesTile`, `pickerButton`, `sheetOpen`, `layerDepth`, `current`, `stats`), the `data-demo="camera-tile|species-tile|species-more|picker-open"` attributes, `spec-demo-panel`, `spec-lu-sheet`'s `.panel`/`.close`, `spec-lu-app-shell`'s `h1`.

## Results

Nothing is committed here: each run writes `latest.json` and `latest.md` to `--out` (`docs/perf` or `dev/out/...`). The numbers behind a release are in `CHANGELOG.md` and the GitHub Release notes.
