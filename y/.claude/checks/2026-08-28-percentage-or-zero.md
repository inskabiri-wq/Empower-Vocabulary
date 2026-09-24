# 2026-08-28 - `percentage || 0`: what it was actually doing

Asked what the issue was with the twenty `percentage || 0` sites. There is a
real one, and it has a visible symptom.

## `||` cannot tell "scored zero" from "never scored"

`student/js/writing-exam.js` writes a submitted essay's session doc with **no
`percentage` field at all** - deliberately, because the mark does not exist
until a teacher gives it. Pronunciation practice marks nothing either, by
design.

Both then arrived at code shaped like:

```js
sum += (session.percentage || 0);   // ... / list.length
```

`undefined || 0` is `0`. So an un-marked essay became a 0% **and stayed in the
divisor**, dragging the average down twice over.

A student who scored 90 on a reading exam and submitted three essays that
nobody had marked yet averaged **22%**, not 90%.

That number was on their student card, in their profile modal, in the class
average, in the score-distribution band (they landed in **"0-49"**, the band a
teacher reads as failing), and in nine sheets of the Reports workbook.

`score-rollup.js` already got this right - it ignores anything that is not a
number - so the student-side average and the teacher-side average disagreed.

## Fix

The correct logic already existed, written for the pronunciation case, buried
in `teacher/js/activity.js`. It is now **`teacher/js/score-utils.js`**, loaded
first so every card, table, modal and sheet answers the same way:

```js
function isScored(s) {
  if (!s || s.unscored) return false;
  if (s.activity === 'pronunciation') return false;   // marks nothing by design
  return typeof s.percentage === 'number' && Number.isFinite(s.percentage);
}
```

`avg()` returns **null, not 0**, when nothing has been marked - rendering "no
score yet" as 0% is the same bug wearing a different hat. `best()` returns null
rather than `Math.max()`'s `-Infinity`, which has rendered as "-Infinity%"
before.

Applied at every averaging site in `students.js`, `student-detail.js`,
`modals.js` and `reports-admin.js`. Buckets now carry **two** counts: `n` (work
done) and `sn` (work marked). The count column still shows `n`; the average
divides by `sn`. A skill row can now honestly say "8 sessions" and average the
5 that carry a mark, and shows **"not marked"** instead of a fake percentage
when none do.

## New gate: tools/score-honesty-check.js

Because this is the kind of bug that produces a plausible number rather than an
error, and nothing would ever have complained.

It fails if `percentage || 0` reappears inside a sum, if any average divides by
a raw attempt count, if `score-utils.js` stops loading before its consumers -
and it **executes** `LLScore` on the exact cases involved, including the
headline one:

> 90 + three un-marked essays averages **90**, not 22.

A genuine 0% still counts as a 0%. That distinction is the whole point.

**It caught three things on its first run**, which is the only reason to trust
it: two files where the raw pattern was still present (guarded, so correct, but
unreadable as such - now written without the fallback), and a load-order
report. The load-order one was the **gate's own bug**: `indexOf` matched the
filename inside an HTML comment 900 lines above the actual `<script>` tag. The
gate now matches the tag. The code was right; the assertion was wrong.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan on all 8 touched files - clean
- gates: **seventeen**, all PASS (score-honesty-check is new)
- bump: score-utils.js v2, students.js v3, student-detail.js v6, modals.js v5,
  reports-admin.js v16, CACHE_VERSION -> **v373**; `--check` OK
