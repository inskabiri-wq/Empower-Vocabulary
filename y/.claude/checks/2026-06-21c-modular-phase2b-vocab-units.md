# 2026-06-21 - Modular activation, Phase 2b: vocabulary WORD LISTS (units)

The last modular phase. Admins can now deactivate individual vocabulary units
(word lists) per level. A hidden unit's words drop out of free practice
EVERYWHERE: the unit disappears from the picker AND its words are removed from
the "All Units" pool that every vocab game runs through. Assignments are
unaffected (this only gates free practice). Nothing is deleted.

## Storage model
- `settings/contentControls.practiceHidden.vocabulary = ["A2::Unit 1", ...]`
  Unit ids are LEVEL-QUALIFIED ("level::unit") because unit names repeat across
  levels. Reuses the existing practiceHidden array + flip/save plumbing.
- Whole-level vocab off (Phase 2) stays separate in `hiddenLevels.vocabulary`.

## Student engine
- `student/js/content-controls-student.js` (?v=4 -> **?v=5**): new
  `window.isVocabUnitHidden(level, unit)` reads practiceHidden.vocabulary for
  `level::unit`. On contentControls load, after applyVocabLevelGating(), it now
  re-runs `populateUnitSelector()` + `updateWordCount()` so hidden units drop
  out once settings arrive.
- `student/js/ui.js` (unversioned -> SW bump): TWO edits.
  - `getFilteredWords()` - THE single pool chokepoint every vocab game uses
    (startActivity -> getFilteredWords -> currentWords). Now filters out
    hidden-unit words before the unit match, so "All Units" and every per-mode
    game are covered in one place. Guarded by `typeof window.isVocabUnitHidden`
    so a missing helper = no filter (safe default).
  - `populateUnitSelector()` - drops hidden units from the native select + pill
    mirror, and resets `selectedUnit` to 'all' if the student was parked on a
    unit that just got deactivated (avoids an empty hidden selection).

## Admin
- `teacher/js/content-controls.js` (?v=5 -> **?v=6**): the Vocabulary tab now
  renders per-unit toggles. New `ensureVocabUnits()` lazily fetches
  `datasets.json` once (same file config.js loads; dashboard is at app root),
  enumerates units per level, numeric-sorts them, then re-renders. `vocabBlock`
  shows the level toggle + a `toggleRow('vocabulary', level+'::'+unit, unit)`
  per unit, with an "N hidden" badge. When the whole level is OFF it shows the
  off banner instead (re-activate the level to manage units). Reuses the proven
  flip/save (writes practiceHidden.vocabulary, merge:true).

## Versions
- content-controls-student.js ?v=4 -> ?v=5 (student-dashboard.html)
- content-controls.js ?v=5 -> ?v=6 (teacher-dashboard.html)
- ui.js is unversioned -> service-worker CACHE_VERSION v64 -> **v65**

## Verification
- `node --check` clean on content-controls.js, content-controls-student.js, ui.js.
- Em-dash scan: my added lines are clean (the 7 hits in ui.js are pre-existing
  comments I did not touch).
- Pool sim vs REAL datasets.json (hide A2 Unit 1 + Unit 3):
  - [All Units] pool 750 = 951 - 76 - 125, hidden leak 0. PASS
  - [Unit 4 active] 104 words, all Unit 4. PASS
  - [Unit 1 forced] empty pool -> engine shows no-words msg (and picker resets
    it to All anyway). PASS
  - [helper absent] returns all 951 (safe no-op default). PASS
- Picker sim: hidden Unit 1 removed from options (12 -> 11); selectedUnit reset
  from hidden -> 'all'. PASS
- Admin/student id round-trip: admin `level::unit` == student key for every
  level/unit. PASS. Numeric sort Unit 1..Unit 12. PASS
- Real-browser smoke (preview static-y): `fetch('datasets.json')` 200 OK from
  app root, units enumerate + sort, patched filter drops hidden unit, leak 0.

## Notes
- Distractor options in MCQ games still draw from the full level pool, so a
  hidden-unit word could appear as a WRONG option. Students cannot PRACTICE a
  hidden unit (not in the pool, not selectable), which satisfies "deactivate the
  word list." Filtering distractors too would be a larger, riskier change to the
  flagship engine and was intentionally left out.

## Not done
- No deploy. No push. (User deploys + pushes on request.)

## Modular activation - now COMPLETE
Phase 1 games + skills, Phase 2 vocab levels, Phase 2b vocab units (this),
Phase 3 reading/listening/grammar levels, Phase 4 practice modes,
Phase 5 course modules. All shipped + verified.
