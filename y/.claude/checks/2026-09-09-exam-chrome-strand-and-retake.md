# 2026-09-09 - the app header stayed hidden after the placement reading

Two follow-up fixes to yesterday's work, both found by verifying the deployed
build rather than by trusting it. **v402 shipped with a regression I
introduced.** This is v403.

## 1. REGRESSION: `.ll-header` stayed hidden for the rest of the placement test

Yesterday's fix for the covered Submit button added `body.ll-exam-open` in
`buildAndShow()` and removed it in `closeReadingExam()`.

**`placement.js` never calls `closeReadingExam`.** After the reading step it
hands back through `onReadingExamSubmitted` and takes the screen with
`showScreen('plBetween')`. So the class survived and `.ll-header` stayed
`display: none` for everything after the reading exam: the between screens, the
listening exam, the writing part, the score screen and the done screen.

That header is the only place the settings wheel, the profile chip and the exit
button (`plExitBtn`) live, so a student lost all three for most of the test.

Reproduced before fixing:

    during exam    class true   header none     (correct)
    after submit   class true   header none     (WRONG, should be back)

**Fix:** the class now tracks whether the exam actually owns the screen, not
which function ran last. `showScreen()` toggles `.active` on every `.screen`,
and `#readingExamScreen` is one (`placement.html:172`,
`student-dashboard.html:676`), so a `MutationObserver` on that one attribute
drops the class on every exit path there is: submit, the placement handoff, the
Exit button, and anything added later. `closeReadingExam()` keeps its removal
as well.

## 2. Retake dropped the lockdown flag

`reading-exam.js` line 1411's Retake handler forwarded `mode` but not `opts`.
Since lockdown is no longer implied by `mode === 'timed'`, a placement student
who pressed Retake on the results screen got the same exam with copy,
right-click and find-in-page working again. The Retake button renders
unconditionally on the results screen, so this was reachable, not theoretical.

**Fix:** capture `state.lockdown` before `state` is nulled and forward it.

## Executed, in a real browser against the emulators

| | |
| --- | --- |
| header hidden during the exam | PASS |
| header returns when placement takes the screen back | PASS |
| repeatable across a second open/close cycle | PASS |
| `closeReadingExam()` still clears it | PASS |
| free practice still unlocked and selectable (`user-select: text`) | PASS |
| timed exam still locks implicitly, timer shown | PASS |
| lockdown LIFTS on the results screen so answers can be reviewed | PASS |
| Retake re-locks the exam (`data-lockdown="1"`) | PASS |

## How the regression was found, and how I nearly missed it

I verified the v402 deploy by byte-identity (16/16 sha256 match against the
local tree) plus grepping the live files for every fix marker, and reported it
clean. Every one of those checks was true, and **none of them could have caught
this**, because the bug is in a code path none of them executed: the class is
added and removed by the right code, just never on the route placement takes.

A parallel verification agent found it by reasoning about where the removal is
reachable from, rather than whether the removal exists. That is the lesson:
"the fix is present in the deployed bytes" is not "the fix works on every path".

## Harness failures on the way, worth recording

- My first Retake test reported `RETAKE_KEEPS_LOCKDOWN: true` while
  `retakeButtonPresent: false`. The button was never there, so the value was
  just unchanged prior state, not proof. A pass with a false precondition is
  worse than a failure.
- Two submit attempts silently did nothing because an `rd-confirm-overlay` was
  sitting over the button and `elementFromPoint` was hitting the overlay. The
  fix was to answer all 15 questions first so submit needs no confirmation at
  all, then hit-test the click.

## Ritual

- `node --check` across every `.js` in `y` plus `functions` - **0 failures**
- all ten gates PASS, including `lobby-listener-check`
- em-dash scan - clean
- bump: `reading-exam.js` v8 -> **v9**, CACHE_VERSION v402 -> **v403**;
  `--check` reports no drift

## Verify after deploying

Hard-refresh once. Start the placement test, finish the reading section, and
confirm the top bar with the profile chip and the settings wheel comes back on
the screens after it. During the reading itself the bar should still be hidden
and the lock pill visible.
