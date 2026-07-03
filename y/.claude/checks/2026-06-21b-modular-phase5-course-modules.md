# 2026-06-21 - Modular activation, Phase 5: courses per-module on/off

Admins can now deactivate individual modules of a mini course. A deactivated
module disappears from the student course AND is excluded from completion, so the
certificate is earned on the remaining ACTIVE modules + final exam.

## Student engine - `y/student/js/policy-course.js`
- New `hiddenModules` (read from settings/policyCourse.hiddenModules in boot()) +
  `isModuleHidden(id)` + `activeModules()` (= COURSE.modules minus hidden).
- `activeModules()` applied at ALL completion-counting spots:
  - `moduleUnlocked(idx)` - sequential unlock walks the ACTIVE list.
  - `allModulesPassed()` - every ACTIVE module passed (this gates the final exam
    + certificate).
  - renderOverview total / done / the module-card forEach.
  - The `.find()` / lesson-step usages (navigation to a specific visible module)
    are untouched - correct, they only run for a rendered module.

## Admin - `y/teacher/js/policy-course-admin.js` + teacher-dashboard.html
- New `#pcModulesBox` in the Courses panel. `renderModuleToggles()` (admin only)
  lists each course module with an Activate/Deactivate button; `flipModule()`
  saves `hiddenModules` to settings/policyCourse (merge). loadConfig() now also
  renders the toggles.

## Versions
- `policy-course.js` ?v=7 -> **?v=8**; `policy-course-admin.js` ?v=9 -> **?v=10**.
  teacher-dashboard.html (the #pcModulesBox) is network-first.

## Verification
- `node --check` OK on both. No em dashes.
- Completion-math sim (hide m2, m1+m3 passed): active=[m1,m3], total 2 / done 2,
  m3 unlocked, allModulesPassed=TRUE -> final exam + certificate stay reachable.
  The hidden module does NOT block the certificate. (The admin toggle UI mirrors
  the proven content-controls flip/save pattern; node --check clean.)

## Remaining
2b. Vocabulary WORD LISTS / units - the last one, and the riskiest: needs the
    admin to enumerate units (datasets fetch), a gate in the unit picker, AND to
    drop those words from the "All units" word pool in the vocab game engine.

## Not done
- No deploy. No push.
