# 2026-08-31 - the essays band grows an assignment, overdue and done

The band showed a count and the age of the oldest. It now answers the three
questions that were actually being asked: which assignment, what is late, and
what has been cleared.

## What it shows

```
✍️ 7 essays waiting · 2 overdue · 12 done in 7d · oldest 5d      [Grade now]
   Argument essay (4) · Opinion piece (2) · Discursive writing (1)
   ─────────────────────────────────────────────────────────────
   Ayşe Nur Kılıç      B2 · Argument essay          overdue · 5d
   Mehmet Emin Toksöz  B1+ · Opinion piece          overdue · 3d
   Zeynep Sude Kestane B1 · Argument essay                    2d
```

The summary is a **button**: clicking it expands the per-submission list.
Collapsed by default so the panel stays short.

**Zero extra Firestore reads.** Everything comes from snapshots the dashboard
already holds: `allWritingSubs` for the work, `allAssignments` for the
deadlines.

## The four decisions worth recording

**Overdue needs a join.** The deadline lives on the assignment, not the
submission, so `assignmentId` is matched against `allAssignments`. If
assignments have not loaded yet, nothing is overdue rather than everything
throwing.

**"Done" is windowed by the period selector**, not all time. All time only ever
grows and stops meaning anything; "12 done in 7d" is a number you can act on.
`t2SetPeriod` re-renders the band, so switching to 30 days updates it.

**Order is overdue first, then oldest first.** That is the order a teacher
actually works through a pile.

**Overdue is the only red thing in a green band.** The band is a to-do list,
not a warning about a student, but a missed deadline genuinely is late, so it
alone takes the warning colour.

There is also a small win state: when nothing is waiting but work was marked
recently, the band says "Nothing waiting. 12 marked in the last 7 days" instead
of vanishing.

## A ReferenceError caught before it shipped

The first version called `esc()` for escaping, copied from grammar.js habit.
**`esc` does not exist in overview-v2.js** - that file uses `escapeHtml`. It
would have thrown on every render of the band, in the panel a teacher looks at
first. `node --check` passes it happily; only running it, or reading the file
for the helper it actually has, finds it.

## Executed: 20 checks against the real functions

The real `LLEssaysWaiting` and `renderEssaysBand` were pulled out and run:

| | |
| --- | --- |
| counts only ungraded | PASS |
| overdue uses the ASSIGNMENT deadline | PASS |
| done counts only inside the window | PASS |
| a 30-day window picks up the older one | PASS |
| overdue sorts first | PASS |
| groups by assignment, biggest pile first | PASS |
| rows collapsed by default, expand reveals | PASS |
| a row shows student, class and assignment | PASS |
| empty state reports recent wins | PASS |
| hides completely when there is nothing to say | PASS |
| no assignments loaded means nothing overdue, not a crash | PASS |
| a submission with no dates does not throw | PASS |

(and eight more on wording and markup)

## Measured at three widths, as promised

`tools/demos/essays-band-align.html`, all stylesheets awaited, five rows and a
deliberately over-long assignment title:

| viewport | band | inset L/R | head wraps | row height | rows scroll | overflow | page scrolls sideways |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1280 | 1206px | 12 / 12 | no | 18px | no | none | no |
| 834 | 760px | 12 / 12 | no | 18px | no | none | no |
| 390 | 316px | 12 / 12 | **yes** | 58px | **yes** | none | no |

On a phone the head wraps so "Grade now" drops under the text instead of
crushing the count, and each row stacks to name / class+assignment / age. The
list is capped at 220px and scrolls, so sixty ungraded essays cannot push
Recent Activity off the screen.

The long title truncates with an ellipsis on desktop rather than widening the
band - nothing overflows at any width.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- dashboard-v2.css braces 241/241
- gates: seventeen, all PASS
- bump: dashboard-v2.css v20, activity.js, overview-v2.js,
  CACHE_VERSION -> **v389**; `--check` OK
