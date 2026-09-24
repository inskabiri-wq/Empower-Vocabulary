# 2026-09-10 - the gates now run themselves

## The note this closes

The benchmark update scored security 9 rather than 10 with this reason: "the
gate I wrote is not wired into anything automatic - someone has to run it."
That was true of almost every gate in the folder.

Confirmed before building anything: `ship-ready.js` chains a backfill and the
data smoke test. `preflight.js` did syntax, grammar, version drift, JSON parse
and em-dash. **Nothing ran the two dozen `*-check.js` / `*-sanity.js` files
together.** Each only ran when somebody remembered it, one command at a time.

That is exactly how a gate rots: it guards something, the something changes,
and nobody finds out because nobody ran it. The AI Quiz safety net and the
security-rule check were both in that category the day they were written.

## What was added

`y/tools/gates.js` discovers every gate in the folder, classifies it by what it
needs, and runs each in its own Node process so no two share a firebase-admin
singleton.

    static    21   no dependencies, always run
    emulator   2   aiquiz-e2e-rules-check, grandfather-closed-check
    prod       1   rules-live-check, only with --prod

Classification is by reading each file, not a hand-maintained list, so a gate
added next month is picked up without editing this one.

Skips are loud, never silent: if the emulator is down the two that need it are
reported as SKIP with the command to start it, rather than quietly not running
and leaving a green summary that means less than it looks like.

    node y/tools/gates.js           static + emulator
    node y/tools/gates.js --prod    also the live read-only checks
    node y/tools/gates.js --list    show the classification

Exit code is non-zero on any failure, so it can be wired to a hook or CI later
without changing anything here.

## Wired into preflight

`preflight.js` already described itself as "the end-of-change safety checklist,
one command", so the gate suite is now section 6 of it. Running preflight now
runs everything.

`grammar-sanity` runs in both section 2 and the suite. The duplication is cheap
and keeps section 2's own reporting intact, so it was left alone deliberately.

## Executed

    node y/tools/gates.js          23 passed, 0 failed, 1 skipped (production)
    node y/tools/gates.js --prod   24 passed, 0 failed, 0 skipped

Every gate in the project is green, including the live production rules check.

**Proved both layers actually fail.** A temporary `zz-temp-fail-check.js` that
exits 1 was dropped into the folder:

    gates.js     -> 23 passed, 1 failed, 1 skipped   exit 1
    preflight.js -> FAIL  gate suite                 exit 1
                    "FAIL zz-temp-fail-check.js | 23 passed, 1 failed, 1 skipped"

Removed, and both went back to green. A runner that cannot go red is not a
runner, and discovery is proven at the same time: it found a gate it had never
been told about.

## Six gates that had never been run this session

`alerts-runtime-check`, `anim-cost-check`, `recent-activity-runtime-check`,
`student-detail-expand-check`, `tile-art-check`, `ui-text-check`. All pass.
Worth noting because until now nothing would have told anyone if they did not.

## Ritual

- `node --check` on both changed files - clean
- em-dash scan - 0
- no version bump: `tools/` is in the hosting ignore list, so nothing here
  ships to the browser and no cache version is involved
- `preflight.js` end to end: **ALL PASS**
