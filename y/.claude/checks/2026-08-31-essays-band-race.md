# 2026-08-31 - the essays band was in the right panel and still invisible

Deployed, still nothing. This time the placement was right and the timing was
wrong.

## First: is there anything to show?

Checked production before assuming a bug. Six writing submissions:

| status | count |
| --- | --- |
| graded | 4 |
| returned | 1 |
| **submitted** | **1** |

One is waiting, so the band **should** be visible. Not a data problem.

## The cause: the same race as the grammar Quest Board

`renderOverviewV2()` is documented as "call this AFTER loadDashboard finishes"
and it runs **once**. `renderNeedsAttention()` - and therefore the band - is
part of that single pass.

`allWritingSubs` is filled by a **separate, later** listener
(`_attachWritingSubsListener`), and its callback only did:

```js
renderAssignments();
updateAssignmentStats();
```

Neither touches the Overview. So the band was drawn against an empty map,
counted zero, hid itself, and nothing ever drew it again - however many essays
were waiting.

That is the identical shape to the grammar board bug: a panel rendered once
from data that had not arrived yet, with no path back.

## Fix

`overview-v2.js` exposes `window.LLRefreshEssaysBand`, and the
writingSubmissions listener calls it when its snapshot lands, guarded and
wrapped so a failure there cannot break the assignments render.

## Executed in the real order

The harness drives the exact sequence the dashboard uses, with the REAL
`LLEssaysWaiting` from activity.js and the REAL `renderEssaysBand` from
overview-v2.js:

| step | result |
| --- | --- |
| band hidden before the snapshot arrives | PASS |
| **band VISIBLE after the snapshot** | PASS |
| counts only the ungraded one (graded + returned ignored) | PASS |
| singular wording for one essay | PASS |
| shows how long the oldest has waited | PASS |
| offers a way to act on it | PASS |
| hides again once everything is graded | PASS |
| plural wording for several | PASS |
| overview-v2 exposes the hook | PASS |
| the listener calls it | PASS |

## Gate extended, proved against the failure

`live-markup-check` now fails if the hook is missing on either side:

> the writingSubmissions listener does not call LLRefreshEssaysBand() - the
> band will stay hidden even with essays waiting.

Verified by renaming the call and watching it fail, then restoring it.

The gate now guards all four ways this feature can silently disappear: built
into the hidden legacy Overview, mounted but never rendered, the shared counter
deleted, or rendered but never refreshed.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: seventeen, all PASS
- bump: teacher-assignments.js v6, overview-v2.js, CACHE_VERSION -> **v388**

## What to expect after deploying

With one submission currently ungraded, the Needs Attention panel should show:

> ✍️ **1** essay waiting to be graded · oldest \<age\>   [ Grade now ]

If it is still missing, the next thing to check is whether the
writingSubmissions listener attaches at all for this account - the rules allow
teachers without scope to be denied, and that path logs a warning to the
console rather than failing loudly.
