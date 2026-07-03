# 2026-06-18 - Modular activation, Phase 1: whole-level on/off (Reading/Listening/Grammar)

First phase of the "make everything tick-to-activate" effort. Built inside the
existing Admin ▸ Content panel (user chose "extend the Content panel").

## Admin - `y/teacher/js/content-controls.js`
- New `cfg.hiddenLevels = { reading:[], listening:[], grammar:[] }`.
- Each level section (Reading / Listening / Grammar, per the level tab) gets a
  master **"Deactivate level" / "Level OFF · activate"** button (`levelToggle`).
  When a level is off, the section shows a red "Whole level deactivated for free
  practice (assignments still work)" banner.
- `flipLevel(skill, level)` toggles + saves; `save()`/`load()` now persist/read
  `hiddenLevels` alongside `practiceHidden` (settings/contentControls,
  admin-only write rule already covers the new field - no rules change).

## Student - `y/student/js/content-controls-student.js`
- Loads `hiddenLevels` and EXPANDS each deactivated level into the per-item
  `practiceHidden` list at load time, using `EXAM_REGISTRY.examsForLevel`
  (reading/listening) + `GRAMMAR_PRACTICE.byLevel` (grammar) - both already
  loaded before this script on student-dashboard.html. So the EXISTING
  `isPracticeHidden()` checks in reading.js / listening.js / grammar.js hide
  every item of a deactivated level with ZERO renderer changes (low risk).
- Also exposes `window.isLevelHidden(skill, level)` for future use.
- Assignments still override (deactivated content works when assigned), same as
  individual hides.

## Versions
- `content-controls.js` ?v=3 -> **?v=4**; `content-controls-student.js`
  ?v=2 -> **?v=3**. Both query-versioned, so no service-worker bump needed.

## Verification
- `node --check` OK on both files. No em dashes.
- Expansion logic sim: hiding reading A2 folded in both A2 exams (no dup with an
  already-hidden item); hiding grammar B2 folded in both B2 topics. Correct.

## Known minor (polish, not done)
- A deactivated level still appears in the student's level picker but with no
  practice items (empty). Effectively deactivated, but to make the level pill
  vanish entirely needs small edits in each skill's level picker (reading.js /
  listening.js / grammar.js) - can add via `isLevelHidden` later.

## Remaining phases (not started)
2. Vocabulary levels + word lists (new branch).
3. Individual classroom games on/off.
4. Practice modes per skill.
5. Courses per-course + per-module.

## Not done
- No deploy. No push.
