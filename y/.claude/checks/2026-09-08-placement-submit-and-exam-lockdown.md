# 2026-09-08 - the missing Submit in placement reading, and exam lockdown

Two reported problems, two different causes.

## 1. Submit was invisible in the placement reading exam

**Not a missing button.** `#rd-submit-btn` was always rendered and correctly
placed. It was covered.

Measured on `placement.html` at 1440x900, signed in as a real seeded student:

    submit box            [1341, 14, 1422, 48]   fits the viewport
    elementFromPoint()    .ph-badge-name         <- the profile chip, on top

The stack:

    .ll-header          position: sticky   z-index: 99964   css/app-settings.css:661
    #readingExamScreen  position: fixed    z-index: 5       student/css/reading-exam.css:118

So on any page that mounts the shared app header, the header paints over the
full-screen exam. `student-dashboard.html` has no `.ll-header` (verified live:
the selector returns null there), which is why the real timed exam was fine and
only placement showed it.

**Fix:** hide the app chrome while an exam owns the screen. `buildAndShow()`
adds `body.ll-exam-open`, `closeReadingExam()` removes it (before its early
return, so a half-opened exam cannot strand the header hidden), and
`reading-exam.css` hides `.ll-header` for that class.

Deliberately NOT a z-index bump: AppDialog sits at 100000 and is used by the
exam's own "Submit with unanswered questions?" prompt, and the placement
Continue button is at 99999. Raising the exam above 99964 risks going above
those too.

## 2. Lockdown was tied to the timer, and listening had none at all

`isLockdownActive()` was `state.mode === 'timed'`. Placement opens the reading
exam untimed (`placement.js:337`), so the whole placement reading ran with copy,
right-click, drag and Ctrl+F/P/S/U/G all working, on real exam-bank content.

**Fix:** lockdown is now its own flag, not a side effect of the countdown.
`openReadingExam(level, examId, mode, opts)` takes `{lockdown:true}`; a timed
exam still sets it implicitly; free practice still leaves it off so students can
select and copy while studying.

The listening exam had no lockdown in any mode. Added a self-contained one
mirroring reading's rules (`listening-exam.js`, `extra.css`), off by default,
opted into by placement. It lifts on submit so results and the transcript stay
readable.

## Executed, in a real browser, signed in against the emulators

| | |
| --- | --- |
| placement reading: Submit hit-testable | PASS (`elementFromPoint` -> `rd-submit-btn`) |
| placement reading: `.ll-header` hidden during exam | PASS (`display: none`) |
| header restored after close, class dropped | PASS |
| placement reading: lockdown active + 🔒 pill shown | PASS (`data-lockdown="1"`) |
| free practice reading still selectable | PASS (`user-select: text`, no lockdown) |
| timed reading still locks implicitly | PASS |
| listening lockdown: Ctrl+F / P / S blocked | PASS |
| listening lockdown: copy, contextmenu, selectstart blocked | PASS |
| listening lockdown: Ctrl+C and typing in answer fields still work | PASS |
| free listening practice unchanged | PASS (`user-select: auto`, nothing blocked) |
| listening lockdown lifts on submit | PASS |

## The probe was wrong before the code was

The first Ctrl+F test reported "not blocked". The handler is registered with
`capture: true` and calls `stopPropagation()`, so the bubble-phase listener I
used to observe it never ran at all. Re-tested using the return value of
`dispatchEvent` (false means `preventDefault` was called), which is what
actually answers the question. Suspect the harness first, again.

## Ritual

- `node --check` across every `.js` in `y` plus `functions` - **0 failures**
- gates: ui-sanity, live-markup-check, inline-css-check, theme-sanity,
  smoke-test, profile-hub-check - all PASS
- em-dash scan of all five edited files - 0
- bump: reading-exam.js v8, reading-exam.css v19, listening-exam.js v16,
  extra.css v38, placement.js v12; CACHE_VERSION **v399 -> v401**;
  `bump.js --check` reports no drift

## 3. The writing exam was checked and needs nothing

I flagged the writing exam as a likely third case because
`student/css/writing-exam.css:373` also sets `z-index: 5`. **That was a
misread**: the rule is on `.wr-loading`, the loading spinner, not the exam
screen. Checked properly, writing is clean on both paths.

`writing-exam.html` is a standalone page and does not mount `.ll-header` at
all, so nothing can cover it. Opened in its real working state (a writing
assignment seeded into the emulator, timer running, prompt and editor
rendered): **0 of 3 visible controls covered**, no horizontal overflow. The
seeded assignment was deleted afterwards, confirmed 404.

Placement's writing part is not the writing exam at all. It is its own inline
screen, `#plWriting` in `placement.html`, which is `position: static` and so is
pushed down by the sticky header rather than covered. Submit and the textarea
both hit-test correctly.

Writing lockdown was already complete, and stricter than reading's was.
Verified by execution:

| | |
| --- | --- |
| Ctrl+F, Ctrl+P blocked | PASS |
| Ctrl+V and paste blocked inside the editor | PASS |
| copy on the prompt blocked, prompt `user-select: none` | PASS |
| right-click and drop blocked | PASS |
| the student's own editor stays editable (`user-select: text`) | PASS |

So the lockdown gap was reading-in-placement and listening-everywhere. Writing
never had one.

### The first writing measurement was worthless

The initial sweep of `writing-exam.html` reported "0 controls covered", which
looked like a pass. It was not: the page had no assignment, so only **1 of 36**
controls was visible and the other 35 were in the gated empty state. A count of
zero problems across one element proves nothing. The real check needed a seeded
assignment so the exam actually rendered. Always confirm the sample size before
believing a zero.

## Also noticed, not changed

`writing-exam.html` still has `<title>Writing Exam - Empower</title>`. The
Empower coursebook name is protected by CLAUDE.md, but in the browser tab this
reads as the old app name rather than the coursebook. Flagging only.

## Verify after deploying

Hard-refresh once so the new service worker activates. Then start the placement
test: in the reading section the **Submit** button should be visible top-right,
a **🔒 Locked** pill should sit in the header, and Ctrl+F should do nothing.
Free practice reading from the dashboard should still allow selecting text.
