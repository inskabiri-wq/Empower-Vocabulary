# 2026-08-31 - the other half of the alert card: the detail list

The summary card shipped in the previous change, but the panel it opens had
nothing in it for essays. Clicking "Essays Waiting" expanded the detail panel
and showed the three student cards only.

## Added

An **Essays Waiting to be Graded** card inside `#alertDetailPanel`, built to
the same shape as the three above it, with rows showing who is waiting, for
which assignment, and how long:

> **Ada Y.**  A1 · Essay 1                            5h waiting
> **Bo K.**   B2 · Argument essay                     2d waiting

Sorted **oldest first**, because the one that has been waiting longest is the
one to do next. A submission with no timestamp sorts last and reads "waiting"
rather than pretending to be zero hours old.

Counted from `allWritingSubs`, the live snapshot the dashboard already holds,
so this still adds **no Firestore reads**. A submission is waiting unless its
status is `graded` or `returned`, matching `grading-stats.js` exactly.

## Green, not red

The three existing cards use red, amber and blue for students in trouble. This
one is green. It is a to-do list, not a warning about anybody, and dressing a
teacher's own workload in red would say the wrong thing.

## "All Clear!" no longer contradicts itself

`#noAlertsMessage` was shown whenever `totalAlerts === 0`. Since essays are
deliberately kept out of that total, a teacher with no struggling students and
twelve essays to mark would have seen **"No struggling students detected"
printed directly above a card saying twelve essays are waiting**. It now
requires both to be zero.

## A real bug the extended gate caught

`tools/alerts-runtime-check.js` had no `allWritingSubs` in its sandbox, so it
never executed the new code at all. Extended with five cases, and the third one
failed immediately:

> FAIL  no submissions at all shows zero, not a crash
>       essaysCount=undefined

The count was being written **inside** the "is the alert row visible" branch.
So a teacher whose last essay was marked left a stale number sitting in a
hidden card, ready to be shown again the next time any unrelated alert made the
row appear. The count is written unconditionally now; only the row's
visibility is conditional.

That is the second time this gate has earned itself.

### The five cases now covered

| case | result |
| --- | --- |
| three ungraded essays are counted and listed | PASS |
| graded and returned work does NOT count | PASS |
| no submissions at all shows zero, not a crash | PASS |
| a submission with no timestamp does not throw | PASS |
| a null entry in the map is skipped | PASS |

All run the real `checkStrugglingStudents()`, so a ReferenceError anywhere in
the new block fails the gate rather than the dashboard.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- `teacher-dashboard.html` div balance 407/407
- gates: seventeen, all PASS (alerts-runtime-check now covers essays)
- bump: activity.js, CACHE_VERSION -> **v386**; `--check` OK
