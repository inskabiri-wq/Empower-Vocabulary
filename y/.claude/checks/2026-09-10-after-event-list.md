# 2026-09-10 - the after-event list, worked through

Standing constraint for the whole session: **do not break AI Quiz.** Honoured by
building a safety net first and re-running it after every change that could
reach the game.

## The safety net

`y/tools/aiquiz-e2e-rules-check.js` (new) drives every rule-gated operation the
game performs against the emulator with REAL ID tokens, so firestore.rules is
enforced exactly as it is for a real phone and a real teacher: create the room,
write the bank, join, read, answer, advance, close, list the ladder, kick,
delete. Plus six negatives, which are the point: a second teacher must not
control the room, a student must not write another student's document, a
signed-out caller must not read or write.

Baselined green (19/19) BEFORE any change, and re-run after each one.

## Done

**Service-account key.** `.serviceAccount.json.json` renamed to
`.serviceAccount.json`. The double extension was why the admin tools in
`y/tools` could never find it. Still gitignored, verified with
`git check-ignore`.

**Fonts.** Six rules raised to the 12px floor, worst first:
`.t2-sidebar-section-lbl` 9px -> 12px (uppercase with 1px tracking, the hardest
to read in the app), `.t2-badge` 10 -> 12, `.t2-panel-sub` 11 -> 12,
`.t2-brand-text .bottom` 11 -> 12, `.t2-profile-meta .role` 10 -> 12,
`.hub-live-pill` 10 -> 12, `.hub-section-lbl` 11 -> 12. Plus the inline
`font-size: 0.78em` on the "View all" button in `teacher-dashboard.html:1631`,
which computed to 10.14px because `em` there meant 0.78 of the panel title.

Measured: teacher dashboard sub-12px elements **9 -> 2** at desktop and tablet,
with **no overflow introduced** at 375, 820 or 1440.

Neither `dashboard-v2.css` nor `hub.css` is loaded by an AI Quiz page, checked
before editing, so this had zero blast radius on the game.

**Tap targets.** `#joinBtn`, `#nameInput` and `#joinScreen .btn-primary` get
`min-height: 44px`. Deliberately NOT `.btn` or `.btn-large`: both are also host
controls, and `.btn-large` is on `classroom-aiquiz-teacher.html`. Measured on
`classroom-aiquiz-student.html`: join button **285x38 -> 285x44**, sub-44px tap
targets **1 -> 0**.

**All seven ownership grandfathers, closed.** `_ownsClassroomSession`,
`_ownsHeistSession`, `_ownsTrustSession`, `_ownsMiniSession` (which covers
aiquiz), `_ownsReadingSession`, `_ownsListeningSession`, and the inline
player-kick rule. Each granted access when the ownership field was MISSING.

Verified safe first: all nine host files stamp their ownership field on create,
so no session made by current code is affected.

`y/tools/grandfather-closed-check.js` (new) re-runs the original exploit and
asserts it now fails, AND that a real owner still controls their own room, for
all nine collections. **48/48.** The old rules turn it red; the closed rules
turn it green.

The player-kick rule was the widest: its permissive branch fired when the parent
session was **missing**, and an orphaned roster is the normal end of every game.
Now admin-only, matching how assignment child deletes work.

**Teacher dashboard weight.** `xlsx.full.min.js` (861 KB raw / 308 KB gz) is no
longer loaded on every visit; `reports-admin.js` loads it on demand when Export
is clicked, the way `roster-import.js` always has. `datasets.json` (689 KB /
106 KB gz) now waits until the Content Controls panel is actually opened.

Measured: **2,954 KB / 83 requests -> 1,409 KB / 72 requests.** Opening Content
Controls pulls `datasets.json` on demand (verified), and the Export path loads
XLSX successfully (verified).

**Batch commit ceiling.** `reading-teacher.js` and `listening-teacher.js` built
one batch with a write per player plus the session doc, so a room of 500+ failed
as a single INVALID_ARGUMENT and NOT ONE score was saved. Now chunked at 400,
with the session doc last so the room is only marked finished after every score
has landed.

## Not done, on purpose

**Scoping the two dashboard listeners.** There is no safe one-line filter. A
completion doc's `completedAt` is **null until the work is finished**, so a date
filter would silently drop every in-progress completion; an `in` filter on
assignmentId caps at 30. The real fix is to query per assignment on demand,
which is a redesign of the dashboard's data flow, not a filter.

The production profile then settled it: see below, this currently costs **one
cent a month**. Not worth risking the main teacher screen for.

**The truncated "Classroom Mode" heading.** Withdrawn as a defect.
`.ll-brand-sub` (app-settings.css:717) sets `min-width:0; overflow:hidden;
text-overflow:ellipsis` deliberately, with a comment explaining the lockup was
tuned so both lines align. It is designed graceful degradation across 13 pages,
two of them AI Quiz. Fighting it would be the regression.

**Trust's launch batch.** Left as one atomic commit. It assigns roles, and the
comment says atomic on purpose. Chunking would trade a guarantee that matters at
every size for a 500-player scenario that cannot happen, since Trust is unusable
far below that.

**`.tms-lbl` at 11px.** The mobile tab-bar labels currently fit exactly
(scrollWidth == width, none ellipsised). Raising them would push "Assignments"
toward truncation in the primary navigation. Worse outcome for a marginal gain.

**The systemic `0.78em` inline pattern.** About 17 sites across the app,
including a game file. Its own piece of work, not something to fold into this
pass under an AI-Quiz-must-not-break constraint.

## The production profile, which had never run

`y/tools/prod-profile.js` (new). Strictly read-only, and the guard greps the
file's own source for mutation calls and refuses to run if any are present.

    users                       79      auth accounts 128
    sessions                  3049
    activityLogs              4392
    assignments                  6
    assignmentCompletions        3
    writingSubmissions           3
    TOTAL                     7716 documents

**This corrects the benchmark.** The cost section was a formula with an unknown,
and the unknown turns out to be tiny: the two whole-collection listeners deliver
**6 documents** per dashboard open, which is 16,200 reads and **0.01 USD** a
month. Not the 3 to 32 USD the formula's example figures suggested.

It will not stay that way. At 400 students against 6 assignments that is up to
2,400 completions, which becomes about 6.5M reads and roughly 3.89 USD a month,
growing every term as assignments accumulate. So the listener scoping is real
work, just not urgent, and now it has a number attached instead of a guess.

Also worth noting: 79 user documents against 128 auth accounts and a stated
roster of about 400. The roster does not appear to be fully imported yet.

## Mistakes made and caught

**A count() design that would have silently done nothing.** The first version of
the AI Quiz early-close polled two `count()` aggregations. Running it returned
`players.count is not a function`: count() is modular-SDK only and the compat
build never exposes it, which `teacher/js/config.js:238` already documents.

**An IntersectionObserver that cannot be verified here.** The first lazy-load
gate for `datasets.json` used IO. It never fired in the preview pane, which
never composites, the same reason `requestAnimationFrame` does not fire. Rather
than ship a mechanism that could not be tested before reaching a classroom, it
is a 500ms `setTimeout` poll that stops the moment the panel opens.

**A lazy gate armed from the wrong place.** That gate was first armed inside
`ensureVocabUnits()`, which is only reached from one branch of the vocabulary
section. When that branch did not run, nothing armed it and the unit toggles
would never have loaded. Caught in the browser, not by reading. Now armed from
`render()` itself.

**A rules upload that silently did not happen.** `curl --data-binary` against
the emulator's securityRules endpoint returns 400; the endpoint wants JSON. The
first "AI Quiz still passes" run was therefore against the OLD rules and proved
nothing. `push-rules.js` now uploads and reads the ruleset back, comparing byte
counts, so "the emulator is running the file on disk" is proven rather than
assumed.

## Ritual

- `node --check` across every `.js` in `y` (excluding vendor) plus `functions`
  - **0 failures**
- **15 gates PASS**, including three new ones
- em-dash scan of all 12 touched files - **0**
- `bump.js --check` - no drift. CACHE_VERSION v404 -> **v412**
- emulator test data removed by each check as it finishes

## Deploying this

Two separate deploys, and the rules one is easy to forget:

    firebase deploy --only hosting
    firebase deploy --only firestore:rules      <-- the seven closed loopholes

`firestore.rules` is the only tracked file outside `y/` that changed.
Hard-refresh once afterwards so the new service worker activates.
