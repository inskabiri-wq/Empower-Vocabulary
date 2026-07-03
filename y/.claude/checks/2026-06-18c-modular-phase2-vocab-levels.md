# 2026-06-18 - Modular activation, Phase 2: Vocabulary LEVEL on/off

Adds a Vocabulary branch to the Admin ▸ Content panel with whole-level
activate/deactivate (A2/B1/B1+/B2). Per-word-list/unit toggles are deferred to
Phase 2b (needs an admin datasets fetch + the unit picker gate).

## Admin - `y/teacher/js/content-controls.js`
- New `📚 Vocabulary` skill tab; `cfg.{practiceHidden,hiddenLevels}.vocabulary`.
- `vocabBlock(level)` renders the level master toggle (reuses the Phase 1
  `levelToggle('vocabulary', level)` + off-banner). Only renders for A2/B1/B1+/B2
  (vocab's only levels). save()/load() already persist hiddenLevels, now incl.
  vocabulary.

## Student - `y/student/js/content-controls-student.js`
- Loads `hiddenLevels.vocabulary` + `practiceHidden.vocabulary`.
- `applyVocabLevelGating()`: vocab's level picker is STATIC HTML (`#levelPills`
  + `#levelSelect`) with no re-render hook, so the loader gates it directly -
  hides the pill + native option for each deactivated level, and if the student
  is on a now-hidden level, calls `changeLevel(firstActiveLevel)`. This keeps the
  flagship vocab UI (ui.js) UNTOUCHED (low risk). Runs once after the controls
  load. Assignments still override.

## Versions
- `content-controls.js` ?v=4 -> **?v=5**; `content-controls-student.js`
  ?v=3 -> **?v=4**. Query-versioned, no service-worker bump needed.

## Verification
- `node --check` OK on both. No em dashes.
- Smoke (harness, stubbed Firestore `hiddenLevels.vocabulary=['B2']`, deleted
  after): B2 pill + native option HIDDEN, A2/B1/B1+ shown; student sitting on B2
  was auto-switched to A2 via changeLevel; content-controls-ready fired; 0 errors.

## Remaining phases
2b. Vocabulary WORD LISTS / units (per-unit toggles; needs admin datasets fetch +
    a gate in `populateUnitSelector`).
3.  Individual classroom games on/off.
4.  Practice modes per skill.
5.  Courses per-course + per-module.

## Not done
- No deploy. No push.
