# 2026-09-08 - five reported items, plus the pre-event listener fix

## 1. Placement refresh showed the browser's grey box, not the app warning

`placement.js` had only a native `beforeunload`. It never loaded
`classroom/js/refresh-guard.js` (only the 8 classroom student pages do) and has
no `classroom/css/styles.css`, so that module's modal would have been unstyled
there anyway.

**Fix:** intercept F5 / Ctrl+R / Cmd+R in `placement.js` and show the same
`AppDialog.confirm` the Exit button already uses. No new dependency, no new CSS.
`state.inProgress` is cleared before reloading so the native prompt does not
then fire on top of it.

**The limit, stated in the code and here:** this is the KEYBOARD path only. No
page can intercept the browser's own reload button, the address bar, or a tab
close; browsers forbid it. Those still fall through to the native prompt. This
is the same boundary `refresh-guard.js` documents for the games.

## 2. "Back to dashboard" was not the universal button

Three places in the writing exam used local styles: `writing-exam.html:104`
(`wr-btn wr-btn-secondary`, the Submitted splash in the screenshot),
`writing-exam.js:359` (`wr-btn`) and `writing-exam.js:143` (a bare underlined
link). All three now use `.ll-navbtn`, the app-wide nav button documented at
`css/app-settings.css:512`. `writing-exam.html` already loads that stylesheet,
so nothing new had to be added.

I had said "the writing exam page is fine". That was accurate about what I
checked, coverage and lockdown, and it did not cover button styling. Fair catch.

## 3. Teacher annotations were unreadable on the feedback modal

`writing-annotations.js` emits `<mark class="wa-hl">` with a `background` and a
`border-bottom` but **no `color`**. `<mark>` is a real element with a
user-agent default of black text, so on the dark student feedback modal every
annotated word rendered black on a 15%-opacity blue.

Measured before: container `rgb(226,232,240)`, mark `rgb(0,0,0)`.
Measured after: both `rgb(226,232,240)`.

**Fix:** `color:inherit` in the emitted style. Chosen over a fixed colour
because the same marks render on the light teacher grading view, where a
hard-coded light colour would break instead.

## 4. Old app name

- `writing-exam.html:11` `<title>` now reads "Writing Exam - Lingualab"
- `reset-password.html:649` footer now reads "Lingualab Preparatory Program"

**Left alone on purpose:** `index.html:64` "Empower Your English". The comment
at line 508 shows it is a deliberate tagline, not the app name, and the
CLAUDE.md rule protects the Empower coursebook name and the
`empower-vocabulary-practice` / `empower-shell-*` / `'empower'` identifiers.

## 5. Before-the-event fix: one players listener per host, not two

Five hosts attached a second `players` listener over the same variable without
releasing the first, so both stayed live for the whole game: every player write
delivered and billed twice, and the roster callback ran twice per change.
`classroom/js/teacher.js` was worse, its second attach never captured the
handle at all.

Fixed in `teacher.js`, `bingo-`, `scramble-`, `tug-` and `heist-teacher.js`,
copying the pattern `trust-teacher.js` already used.

Verified first that this was safe: in all four `*-teacher.js` files
`sessionCode = code` is assigned *before* `enterLobby(code)` runs, so both
listeners target the same session and the same `players` subcollection.
Releasing the first is correct, not a behaviour change.

### The gate found a second case I had missed

`y/tools/lobby-listener-check.js` (new) asserts that every players-listener
assignment releases the previous handle first. On its first run it failed on
**five more sites**: the LOBBY attach in bingo, scramble, tug, heist and trust,
including the trust file I had just called correct. `createSession` is bound to
a click, so a double-click or a retry after a failed create re-enters
`enterLobby` and strands the previous listener. The guard is null-checked and a
no-op on first run, so it was added to all five.

Proved the gate is not vacuous: removing one guard on purpose turns it red
(`FAIL - 1 of 12`), restoring it turns it green (`PASS - all 12`).

**What the gate does NOT do:** it is structural, on the source. It cannot count
listeners at runtime; that needs a driven game with real students. Read it as
"the guard is present and has not regressed".

## Executed, in a real browser against the emulators

| | |
| --- | --- |
| placement: F5 intercepted, themed dialog shown | PASS |
| placement: Ctrl+R intercepted, themed dialog shown | PASS |
| placement: "Stay" dismisses, test still on `plStage` | PASS |
| placement: Ctrl+K passes through untouched | PASS |
| placement: F5 left alone when the test is NOT running | PASS |
| `#wrDoneBackBtn` matches the universal spec (36px, 10px radius, 700, inline-flex, no underline) | PASS |
| writing exam title reads "Writing Exam - Lingualab" | PASS |
| annotation mark inherits container colour, built from the shipped source string | PASS |
| lobby-listener gate, and its deliberate-break proof | PASS |

## Where I wasted effort, for next time

I tried to prove the listener fix by driving a real Bingo game in the browser.
The create never completed (the host page needs `?auto=1` plus settings params,
and ActivityLogger threw permission-denied), so no session was written and the
measurement was worthless. The structural gate plus the same-session proof was
the right tool and took a fraction of the time. Reach for the gate first when
the runtime path needs a whole game stood up.

Also: an early sweep of `writing-exam.html` reported "0 controls covered" and
looked like a pass, when only **1 of 36** controls was visible because no
assignment was loaded. Check the sample size before believing a zero.

## Ritual

- `node --check` across every `.js` in `y` plus `functions` - **0 failures**
- gates: lobby-listener-check (new), ui-sanity, live-markup-check,
  inline-css-check, theme-sanity, profile-hub-check, sound-wiring-check,
  score-honesty-check, game-registry-check, classroom-lobby-check - all PASS
- em-dash scan of all 12 touched files - clean
- bump: writing-annotations v2, writing-exam.js v8, placement v13, teacher v8,
  bingo v6, scramble v6, tug v6, heist v4, trust v4;
  CACHE_VERSION **v401 -> v402**; `--check` reports no drift
- emulator test data removed (seeded writing assignment deleted, confirmed 404)

## Verify after deploying

Hard-refresh once. Then: start the placement test and press F5, you should get
the app's own "Reload the placement test?" box, not the grey browser one.
Finish a writing assignment and check the Submitted screen's button matches the
other Back buttons. Open a graded essay with teacher annotations and confirm
the highlighted words are readable.
