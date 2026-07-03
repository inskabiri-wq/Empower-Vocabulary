# 2026-06-21 - Modular activation, Phase 4: vocabulary practice modes on/off

Each vocabulary practice mode can now be activated/deactivated, in Admin ▸
Features (alongside the skills + games from Phase 3).

## Admin - `y/teacher/js/feature-activation.js`
- Added 8 mode toggles (`mode_choice`, `mode_match`, `mode_reverse`,
  `mode_spelling`, `mode_fillblank`, `mode_order`, `mode_pronunciation`,
  `mode_unscramble`) using the existing flat featureToggles flip/save path.
- The panel now had 22 toggles, so render() was refactored to GROUP them into
  sections (Skills / Classroom games / Vocabulary modes) via a new `group`
  field + a `card(f)` helper. Group headers span the grid (`grid-column:1/-1`).

## Student - `y/student/js/feature-toggles.js`
- `applyModeGating()` (run after featureToggles load): hides the deactivated
  mode's card on the vocabulary screen. 3 cards have ids
  (#spellingCard/#fillblankCard/#orderCard); the other 5 only have an inline
  `startActivity('X')`, so those are matched by the onclick string. No HTML edits.

## Versions
- `feature-activation.js` ?v=3 -> **?v=4**; `feature-toggles.js` ?v=1 -> **?v=2**.

## Verification
- `node --check` OK both. Em-dash slipped into 2 comments -> fixed (now clean).
- Smoke (harness, mode_match:false + mode_spelling:false, deleted after): the
  Match card (onclick-matched) + Spelling card (id-matched) went HIDDEN, the
  other 6 stayed shown; 0 console errors.

## Remaining
2b. Vocabulary WORD LISTS / units (the careful one - also needs to drop those
    words from "All units" practice).
5.  Courses per-course + per-module.

## Not done
- No deploy. No push.
