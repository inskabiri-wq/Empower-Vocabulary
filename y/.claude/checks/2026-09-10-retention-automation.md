# 2026-09-10 - retention automation for activityLogs and sessions

## It ships OFF. Nothing happens until you turn it on.

This is the only part of the project that deletes student data on a schedule,
so the default is inert: **no `settings/retention` document means it does
nothing at all**, and even once enabled it only counts and reports until you
explicitly set `dryRun: false`.

## The policy already existed

`activity-tracker/js/activity-config.js` has carried `retentionMonths: 6` since
the KVKK conversation, next to the note "Nothing enforces this on its own". The
Activity Logs tab has a prune button; somebody has to remember to press it.

So I did not invent a window. This is that policy on a timer, and it reuses the
same shape as the manual tool in `activity-admin.js` (400 per batch, 2000 per
run).

## Measured against production first, read only

    activityLogs  4394 docs  oldest 2026-02-28   185 older than 6 months  (4%)
    sessions      3049 docs  oldest 2025-12-22  1397 older than 6 months  (46%)

Both fields are `Timestamp` on every sampled document (`timestamp` for
activityLogs, `createdAt` for sessions).

**That 46% is why `sessions` ships disabled with no window.** Pruning it at six
months would delete nearly half the practice history, and sessions are what the
Reports tab draws on. That is a policy decision AND a reporting decision, and
neither is mine to make.

## Safety properties, in the order they matter

1. **Off unless asked.** No config document, no action.
2. **Dry run unless told otherwise.** `dryRun: false` is required to delete.
   You read a real count before anything goes.
3. **A floor on the window.** Under 3 months is refused. `months: 0` would mean
   "everything", and that is far more likely to be a typo than an instruction.
4. **A hardcoded allowlist.** The config chooses settings *for* a collection,
   never the collection. Nothing stored in Firestore can aim this at `users`.
5. **Documents without the field are invisible.** A range query only matches
   documents that HAVE the field with a comparable type, so anything missing or
   oddly typed can never be selected. That is a Firestore guarantee rather than
   something this code has to earn, and the test proves it holds.
6. **Capped per run**, with an audit row written for every run, dry included.

## Where the code lives, and why

The logic is in `functions/retention.js`, not `index.js`. Everything exported
from `index.js` is inspected by the Firebase CLI as a deployable function, and
more importantly this is the piece that most needs a test able to call it
directly. `db` is passed in, so the test drives the REAL function against the
emulator rather than a copy that could drift.

## Executed: 27 checks, real code, seeded ages

`y/tools/retention-check.js`. Emulator only, and it refuses to start if the
emulator is not reachable.

| | |
| --- | --- |
| no config deletes nothing | ok |
| `enabled:false` deletes nothing | ok |
| windows 0, 1, 2, -12, "six", null all refused by the floor | ok (6 cases) |
| cannot be aimed at `users` | ok |
| dry run is the default, and still reports the true count | ok |
| live run deletes only the documents older than the window | ok |
| **a document with NO timestamp survives** | ok |
| **a document with a STRING timestamp survives** | ok |
| the recent documents survive | ok |
| the other collection is untouched | ok |
| a second run is a no-op | ok |
| `sessions` prunes only when explicitly asked | ok |
| the per-run cap is honoured | ok |
| test data cleaned up afterwards | ok |

**Deliberate-break proof:** lowering `MIN_MONTHS` from 3 to 0 turns the test red
with "window 0 was NOT refused" and eight other failures, and it prints
"DO NOT DEPLOY. This function deletes student data." Restoring it returns green.

It was also picked up by `gates.js` automatically and classified as an emulator
gate, without that file being edited. 25 gates now, 24 pass, 1 production skip.

## To turn it on

**It is not deployed.** Deploy it yourself:

    firebase deploy --only functions:pruneRetention

Then create `settings/retention` in Firestore. Start in dry run:

    { activityLogs: { enabled: true, months: 6 } }

It runs Sundays at 03:00 Europe/Istanbul. Read the log line or the audit row at
`settings/retentionRuns`, confirm the number matches what you expect (about 185
today), and only then add `dryRun: false`.

Leave `sessions` out entirely until you have decided what losing that history
does to Reports. If you do want it, a longer window is the safer starting point:

    { sessions: { enabled: true, months: 24 } }

To stop it at any moment, set `enabled: false`. No deploy needed.

## Correction

I previously read 79 user documents against 128 auth accounts as a roster
import that had not finished. You have said that is test data and no roster was
added. So the production database is test data plus pilot history, and the ~400
real students are still ahead of you, not behind. That means the cost
projections in the benchmark are forecasts, not descriptions of today.

## Ritual

- `node --check` on `functions/index.js`, `functions/retention.js` and both new
  tools - clean
- em-dash scan on all four - 0
- `gates.js`: 24 passed, 0 failed, 1 skipped
- no cache bump: nothing here is served to a browser
