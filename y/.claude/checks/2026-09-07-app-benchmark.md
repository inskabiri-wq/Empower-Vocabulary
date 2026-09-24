# 2026-09-07 - six-track benchmark of the whole app

Read-only measurement across Firestore reads, concurrency load, page weight,
responsive layout, security rules and production data. Deliverables:

    scratchpad/bench/REPORT.md       full technical report
    scratchpad/bench/SIMPLE.md       plain-language version
    scratchpad/bench/live-layout.md  the 25 live layout measurements
    scratchpad/bench/inv-*.json      the underlying maps

## Nothing in the app changed

`find y -newermt '12 hours ago'` returns nothing outside `y/.claude/`. 0 app
`.js` files touched, so `node --check` had an empty scope and no cache bump was
needed. The only repo change is two added server entries in
`.claude/launch.json` (`firebase-authfs`, `static-ycopy`). Em-dash scan of every
file written: 0.

## What was measured, and how

- **Rules (measured).** Confirmed the emulator ruleset was byte-identical to
  `firestore.rules` (53693 bytes both sides) BEFORE probing, so every verdict
  came from the ruleset being mapped and not a stale copy.
- **Layout (measured, live).** The gated pages redirect to login, so a static
  server shows only the login screen. Seeded the emulator, served a throwaway
  copy of `y/` from the scratchpad with a localhost-guarded emulator hook added
  to *its* `firebase-init.js`, and drove the real signed-in pages. 25
  page/viewport combinations. The real tree was never modified.
- **Load (partly measured).** Real emulator run at N=200, 0 failures. The
  per-game 30/500/1000 sweep did not run.
- **Weight (partly measured).** Teacher dashboard measured live via resource
  timing: 2,954 KB over 83 requests.
- **Production data: NOT RUN.**

## Headline results

    3 unbounded reads of project-wide collections in the entire app
    0 of 25 page/viewport combinations overflow horizontally
    7 open ownership grandfathers, all 7 proven exploitable by execution
    aiquiz 30k ops at N=1000; heist/tug/trust 19M-29M, O(N^2)

## Why `js/firebase-init.js` blocked the work

`student/js/config.js` and `teacher/js/config.js` both carry the
localhost-guarded `useEmulators` hook. `js/firebase-init.js` does not, so the 22
pages that load only it (app.html, courses, placement, writing-exam,
teacher-onboarding and most classroom pages) cannot be driven against the
emulator at all. That is why a copy was needed. Worth considering as a real
addition later: it would make the documented E2E flow cover the whole app
instead of 10 of 32 pages.

## Two agent runs died at the usage limit

106 agents, 4 completed. The 4 that survived were the inventory pass, which is
the expensive part, and their output is on disk. Everything after that was done
directly with scripts. **The adversarial verification pass never ran**, so the
findings are single-source; the report says so in its own section rather than
burying it.

Lesson for next time: a 100-agent workflow does not fit in one usage window on
this account. Stage it, and read results between stages.

## Corrections made during the work

Four plausible findings were killed by checking rather than assuming:
`tools/**` is in the hosting ignore list so the 97 MB ffmpeg does not deploy;
the second SheetJS copy is lazy-loaded on purpose by `roster-import.js:25`; the
classroom `div.shape` bleed is decorative; and the service-account key is
present as `.serviceAccount.json.json`, a double extension, which is why the
admin tools in `y/tools` cannot find it.
