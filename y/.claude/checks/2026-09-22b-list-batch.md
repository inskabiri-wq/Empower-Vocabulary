# 2026-09-22b - vocabulary answer reveal, app-wide shake, rejoin score

Three more from the list, after the post-event fixes in
`2026-09-22-post-event-three-fixes.md`.

## 1. Vocabulary MATCHING never showed the right answer

He asked why a wrong vocabulary answer does not show the correct one. Checked
all seven modes rather than assuming:

    checkChoice      reveals - highlights the correct button
    checkReverse     reveals
    checkSpelling    reveals - prints "Correct: <word>"
    checkFill        reveals
    checkOrder       reveals after 3 attempts (a puzzle, deliberate)
    checkUnscramble  reveals after 3 attempts (a puzzle, deliberate)
    MATCHING         NEVER REVEALED  <- this is the one

A wrong pair flashed both tiles red for 600 ms, removed the classes, and
reset. The student learned only that they were wrong, never what the word
meant.

**Fix** (`student/js/games.js`, the else branch of `selectMatchItem`): find the
definition tile sharing `data-id` with whichever tile is the WORD side, and
give it a new `.reveal` class. Found by comparing `dataset.id` rather than with
an attribute selector, because a word could contain quotes. Timeout raised
600 -> **1400 ms**, because 600 is fine for "wrong" but far too short to read a
definition.

`.reveal` is deliberately NOT `.correct`: that one means "you matched this" and
sets `pointer-events: none`, which would stop the student matching it for real
a moment later. Dashed border so the two states differ without relying on
colour. Respects `prefers-reduced-motion`.

**Verified** in a browser with `y/tools/harness/match-reveal.html`, which loads
the REAL `games.js` and `styles.css`: picked "diligent", wrongly matched
"abundant", and "showing careful and persistent effort" was revealed with
`border-style: dashed`, `border-color: rgb(16,185,129)`. Both classes cleared
after the window. Screenshot confirms it reads correctly.

## 2. Wrong-answer shake, app-wide

Surveyed what already animated instead of assuming:

    .choice-btn.incorrect    already shook
    .match-item.incorrect    already shook
    .aiq-answer.is-wrong     did NOT
    .gr-opt.is-wrong         did NOT
    .pc-opt.is-wrong         did NOT
    .option-btn.incorrect    did NOT
    .type-input.incorrect    did NOT
    .spelling-input.incorrect did NOT

So a wrong answer felt different depending on which part of the app you were
in. One rule appended to `y/css/brand.css` (loaded on 27 pages; the four
without it - 404, fsmvu-loaders, join, teacher-onboarding - have no answers).

It is a FLOOR, not an override: a single-class selector, so every existing
two-class rule like `.choice-btn.incorrect` still wins and keeps its own
animation. Named **ll-shake**, not `shake`, because `@keyframes shake` already
exists twice (student/css/styles.css and inline in app.html) and a third
definition of that name would silently replace theirs.

`.error` is NOT included: its only scripted use is a SAVE BUTTON in
`assignments/js/teacher-assignments.js`, and six unrelated CSS rules use it for
messages. Feedback TEXT is excluded too - shaking a sentence reads as a glitch.

**Verified** with `y/tools/harness/shake-check.html`, one sample of every real
wrong-answer selector, reading computed `animationName`:

    aiq-answer / gr-opt / pc-opt / option-btn / type-input / spelling-input -> ll-shake
    choice-btn / match-item                                                 -> shake (their own, kept)
    aiq-feedback / feedback-msg                                             -> none
    save-btn.error                                                          -> none

## 3. Rejoining no longer zeroes a student's score

`aiquiz-student.js` `join()` wrote `score: 0`, and `merge: true` does NOT
protect a field you explicitly write. Anonymous auth restores the same uid on
reload, so it landed on the student's existing document and reset their real
score in Firestore.

Now `score: firebase.firestore.FieldValue.increment(0)` - creates the field as
0 when absent, leaves an existing value untouched. Plus a read-back so the
phone's header shows what they actually have; without it the database would be
right while the screen still said 0.

**Verified** against the emulator with the real rules:

    fresh join, score created as       0
    after answering two questions      265
    after REJOIN with increment(0)     265   <- preserved
    after rejoin the OLD way           0     <- wiped

## Ritual

- `node --check` clean, em-dash scan 0, `inline-css-check` PASS
- `bump.js`: games.js ?v 5, styles.css ?v 54, brand.css ?v 27,
  aiquiz-student.js ?v **10**, CACHE_VERSION **v422**; `--check` no drift
- **28 gates pass, 0 fail**, 1 production skip
- both harnesses live under `y/tools/harness/`, which `firebase.json` excludes
  from the deploy via `tools/**` - verified

## NOT YET DEPLOYED, and the earlier deploy did not land either

Checked the Hosting REST API: the newest release was
**2026-09-21T15:52Z**, nothing from the 22nd. So the morning's three fixes
(listener recovery, auto-close, music) were never live, and these three join
them.

    firebase deploy --only hosting

## Still outstanding from the list

Header university logo, login hero photo, student support messages. All three
specced in project memory with assets already prepared.
