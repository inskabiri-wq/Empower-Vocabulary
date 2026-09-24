# 2026-08-31 - I built the essays card into the Overview nobody sees

Reported with a screenshot of the dashboard: "i dont see anything here". He was
right, and the reason is entirely mine.

## The mistake

There are TWO Overviews. The one I edited is the legacy one, and
`dashboard-v2.css` deletes it outright:

```css
body.t2-active #tab-overview > #alertSummaryGrid,
body.t2-active #tab-overview > #alertDetailPanel { display: none; }
```

`overview-v2.js` adds `t2-active` **unconditionally**, at parse time. So the
summary card, the detail card, the colour variants and the grid rule were all
built into containers that are never on screen.

Nothing complained. The JS found its elements, wrote to them, and the page
showed none of it - the same failure shape as the dead `activity-logs-tab.html`
earlier this month.

I had also searched for "Needs Attention" earlier and concluded it existed only
in a mockup. It is in `teacher-dashboard.html` line 1606 and rendered by
`teacher/js/overview-v2.js`. My grep was wrong, and I built on that conclusion
instead of checking it against a screenshot of the running app.

## Fixed: the band lives in the panel that renders

`#t2essaysBand`, inside the **Needs Attention** panel and above the student
rows - which is where he suggested putting it in the first place. It reads:

> ✍️ **12** essays waiting to be graded · oldest 2d       [ Grade now ]

"Grade now" switches to the Assignments tab. It hides itself when there is
nothing to mark.

Green, deliberately not one of the warning hues the rows below use: those say a
student is in trouble, this is the teacher's own to-do list. The band wraps on
narrow screens so the button drops under the text instead of squeezing
the count.

## One definition, two consumers

`window.LLEssaysWaiting()` in `teacher/js/activity.js` is now the single
source. The v2 band calls it; the legacy alert card calls the same thing. Two
implementations of one count is how two screens start disagreeing.

Still **zero Firestore reads**: it counts the `writingSubmissions` snapshot the
dashboard already holds, and treats a submission as waiting unless its status
is `graded` or `returned` - the same test `grading-stats.js` uses.

## New gate assertion, proved against my own mistake

`tools/live-markup-check.js` now fails if the essays cards exist only in the
legacy Overview while `t2-active` is unconditional and the CSS hides it:

> essays cards exist only in the legacy Overview, which body.t2-active hides -
> they render nowhere. Put the band in the v2 Needs Attention panel.

Verified by renaming `#t2essaysBand` and watching it fail, then restoring it
and watching it pass. It also checks that `overview-v2.js` actually renders the
band and that `LLEssaysWaiting` still exists, so removing either is caught.

## Two harness slips on the way, both caught

**The alerts gate went red after the refactor** - correctly. Its sandbox had no
`LLEssaysWaiting`, so it proved the helper was genuinely required rather than
decorative. It now loads the real one out of `activity.js` (via a separate
extractor, since it is an assignment and not a declaration), which makes the
coverage better than before: the gate tests the same function the band uses.

**A Python replace matched nothing and said it had worked.** The first attempt
to patch the gate printed a success line without asserting the match, so the
edit never applied and the failure looked like a code bug. The lesson is the
same one as the regex that silently matched no sheet names: a rewrite that
finds nothing must be loud.

That also exposed a real fragility worth keeping: `checkStrugglingStudents`
called `LLEssaysWaiting()` as a bare identifier, which is a ReferenceError
anywhere `window` is a plain object rather than the global. It calls
`window.LLEssaysWaiting()` now.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan on all six touched files - clean
- `teacher-dashboard.html` div balance 408/408, dashboard-v2.css braces 225/225
- gates: seventeen, all PASS
- bump: overview-v2.js v8, dashboard-v2.css v19, activity.js,
  CACHE_VERSION -> **v387**; `--check` OK

## Not verified in the real app

Measured and executed only. The dashboard is auth-gated, so the band has not
been seen rendering in the signed-in page - which is exactly the gap that let
the first version go to the wrong Overview. Worth one look after deploying.
