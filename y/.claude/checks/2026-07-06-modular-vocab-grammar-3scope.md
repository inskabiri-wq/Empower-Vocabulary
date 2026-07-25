# 2026-07-06 - Vocabulary + Grammar made modular across all 3 scopes

## Goal
Extend the three-scope content controls (Practice / Classroom / Assignments)
- already live for reading + listening exams - to **vocabulary word-lists** and
**grammar topics**, so the admin can independently hide any item from each
surface. "Do the same for all data - listening, vocabulary and grammar - make
them modular for classroom, assignment and practice."

Listening was already 3-scope (examBlock is generic). This work adds vocab +
grammar.

## What changed

### 1. Admin UI - `teacher/js/content-controls.js` (v8 -> v9)
- `cfg.classroomHidden` / `cfg.assignmentsHidden` now carry `grammar` +
  `vocabulary` keys (were reading/listening only); `load()` parses them.
- Vocabulary units + grammar topics now render the **3-pill `examScopeRow`**
  (Practice / Classroom / Assignments) instead of the single practice toggle.
  Same generic pill component the exams use; `flipScope` + `save` already
  handle any skill. Counts + copy updated to "N restricted".
- Header comment rewritten to describe the uniform 3-scope model.

### 2. Classroom enforcement (NEW shared loader + filters)
- **NEW `classroom/js/cc-classroom.js`** - reads `settings/contentControls`
  once (live listener), exposes `window.ccClassroomVocabUnitHidden(level,unit)`
  + `window.ccClassroomGrammarHidden(topicId)`. Self-sufficient: grabs its own
  compat Firestore/Auth handle (the student game scripts keep db/auth
  IIFE-scoped), fails open.
- `classroom/js/teacher.js` (Vocab/Grammar/Mixed Race host): `getWordsForSession`
  drops classroom-hidden units; `getGrammarQuestionsForSession` drops
  classroom-hidden topics.
- `classroom/js/heist-student.js` + `classroom/js/trust-student.js`: the
  client-side grammar pull (`GP.byLevel[grammarLevel]`) now drops
  classroom-hidden topics. (Heist/Trust vocab uses curated hint packs, not
  dataset units, so no vocab filtering needed there.)
- Wired `cc-classroom.js` into `classroom-teacher.html`,
  `classroom-heist-student.html`, `classroom-trust-student.html` (before the
  game script).

### 3. Assignments enforcement
- `assignments/js/exam-form.js`: the live `assignmentsHidden` loader now also
  tracks grammar + vocabulary and publishes `window.CC_ASSIGNMENTS_HIDDEN`
  (shared) + dispatches `assignments-hidden-ready`.
- `assignments/js/grammar-form.js`: `populateGrammarTopics` filters out
  `assignmentsHidden.grammar` topic ids.
- **NEW `assignments/js/vocab-assign-gating.js`** - hides/disables Unit dropdown
  options in `assignmentsHidden.vocabulary` (level-qualified) on the Create/Edit
  assignment modal. Create + level-change reset a now-hidden unit to All Units;
  Edit preserves an existing assignment's unit selection. Wired into
  `teacher-dashboard.html`; hooked at the two modal-open points in
  teacher-assignments.js.

### 4. Cache
- `service-worker.js` CACHE_VERSION v75 -> **v76** (busts the unversioned
  classroom + assignment JS for installed users).
- `content-controls.js?v=8 -> ?v=9`; new `vocab-assign-gating.js?v=1`.

## Enforcement matrix (after this change)
| Surface     | Vocabulary                          | Grammar                              |
|-------------|-------------------------------------|--------------------------------------|
| Practice    | isVocabUnitHidden (already)         | isPracticeHidden('grammar') (already)|
| Classroom   | teacher.js getWordsForSession       | teacher.js + heist/trust student pull|
| Assignments | vocab-assign-gating unit dropdown   | grammar-form topic checkboxes        |

## Verification
- `node --check` all 9 touched JS: **OK**.
- **preflight (105 js)**: ALL PASS (syntax, grammar sanity, cache drift, JSON,
  em-dash changed-files).
- **grammar-sanity**: PASS (every unit clean).
- **Deterministic logic test (14/14 PASS)**: cc-classroom vocab/grammar helpers
  (level-qualified match, fail-open, cross-level isolation) + vocab-assign
  gating (hide/disable hidden units, All Units always available, allowReset
  fallback, edit-path preservation).
- **Page-load smoke** (static-y server): cc-classroom.js, vocab-assign-gating.js,
  content-controls.js?v=9 all serve **200** - no path typos. Dashboard correctly
  redirects unauthenticated to index.html.
- em-dash: my changes introduced zero em-dashes. Normalized 75 PRE-EXISTING
  em/en dashes (UTF-8-aware, emoji-safe) in the two touched JS files
  (trust-student.js, teacher-assignments.js) to pass the preflight gate; box
  drawing headers untouched; both re-parse OK.

## Notes / not done
- Full authenticated admin-render verification (3-scope pills for vocab/grammar
  in the Admin tab) needs the Firestore/Auth emulator + seeded admin, same as
  the reading/listening 3-scope was verified. vocab/grammar flow through the
  identical proven `examScopeRow` / `flipScope` / `save` path, so behaviour
  mirrors the already-verified exams.
- Classroom setup unit/topic dropdowns are left intact; the question-source
  filter is the safety net (hidden content never reaches students even if a
  hidden unit is picked - it just yields "no questions").
- Pre-existing em-dashes in body copy of the HTML pages (heist/trust student,
  teacher-dashboard) were left untouched (out of scope, visible pilot UI copy).
- Nothing deployed (deploy still blocked by the Hosting storage-quota 429).
