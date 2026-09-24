# 2026-08-28 - the lag: an unbounded live listener on every dashboard open

The QR panel was ruled out by measurement (21.5ms). The next suspect was the
Admin tab. It was not the Admin tab either.

## What it actually is

`teacher-dashboard.html` wraps `loadDashboard()` so that **every dashboard
open** runs `loadAssignments()`, which on its first snapshot attaches
`loadAssignmentCompletions()`:

```js
db.collection('assignmentCompletions').onSnapshot(...)
```

No `where`. No `limit`. The **entire** collection, live, for every teacher, on
every open, no matter which tab they are looking at.

That collection holds one doc per (student, assignment) attempt. At 400
students it is a few thousand docs. At the 1000-student event with a dozen
tasks it is **~12,000**.

Two separate costs came out of that:

1. **Every open downloads the whole collection.** It does not block first paint
   (the promise resolves off the assignments snapshot, not this one), so it is
   not a white-screen stall - it is bandwidth and read cost on every open.
2. **Worse: every write re-read everything.** The callback did
   `allCompletions = {}` then `snap.forEach(...)` over the FULL result set, then
   `renderAssignments()` - for a single student's submission. During a live
   class, thirty students finishing a task meant thirty full rebuilds and
   thirty full list renders.

## Fix

Deltas instead of rebuilds, and coalesced rendering.

```js
snap.docChanges().forEach(function (chg) {
  if (chg.type === 'removed') delete allCompletions[chg.doc.id];
  else allCompletions[chg.doc.id] = chg.doc.data();
});
```

The first snapshot still seeds the map with `forEach` (it has to). Every later
tick applies only what changed. `_scheduleCompletionsRender()` collapses a
burst of submissions into one render on a 400ms window, and the pending timer
is cleared when the listener is torn down so it cannot fire against a map the
next listener is still seeding.

If a future SDK drops `docChanges()`, the helper falls back to a full rebuild
rather than silently going stale.

## Measured

Modelled at 12,000 docs with a 300-submission burst:

| | map writes | renders | main-thread |
| --- | --- | --- | --- |
| before | **3,600,000** | 300 | 334 ms |
| after | **300** | 15 | ~0 ms |

The map ends **identical in size** to the full rebuild, which is the check that
matters - the whole point is that the cheap path stays correct.

The 334ms is with a *synthetic* render stub. The real `renderAssignments()`
touches the DOM, so the true gap is wider than this table shows. Treat the row
as a model, not a stopwatch on the live app.

### Runtime-executed, not just syntax-checked

`node --check` cannot catch a ReferenceError, so the two new helpers were
pulled out of the real file and **executed**: added / modified / removed all
apply correctly, the no-`docChanges` fallback rebuilds, 50 rapid calls render
zero times immediately and **exactly once** after the window.

Also checked that the three new top-level names collide with nothing - the
teacher scripts share one top-level scope, and this file already carries a
comment about a redeclaration there breaking every script after it.

## What I did NOT change, deliberately

The listener is still **unscoped**: a teacher with three assignments still
downloads completions for everyone's. Scoping it (chunked
`where('assignmentId','in',...)`, 30 per chunk) would cut the per-open read
cost, but it changes what `allCompletions` contains, and three other modules
read that map - `student-detail.js`, `reports-admin.js`,
`assignments-overview.js`. That is not a change to make in the week of a demo.
Logged as a decision, not done.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: sixteen, all PASS
- bump: teacher-assignments.js v5, CACHE_VERSION -> **v372**; `--check` OK
