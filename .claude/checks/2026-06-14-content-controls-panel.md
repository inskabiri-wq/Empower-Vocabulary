# 2026-06-14 — Content controls panel (hide-from-practice + grammar count)

Teacher request: a teacher-dashboard panel to mark material as hidden from
practice (so it's assignment-only), extending the skill-activation idea; grammar
gets a "number of questions" control; vocabulary skipped.

Decisions (AskUserQuestion): per-item hide, hidden-from-practice-only, grammar
count set BOTH globally and per-assignment, skip vocabulary.

## What was built
**Settings doc** `settings/contentControls` (admin-write / auth-read via the
existing /settings rule — no new rule):
`{ practiceHidden: { reading:[ids], listening:[ids] }, grammarQuestionCount: N }`

1. **Teacher panel** (Admin tab, below Feature Activation):
   - `teacher-dashboard.html` `#contentControlsPanel` + `#contentControlsBody`.
   - `teacher/js/content-controls.js` (new): grammar question-count select
     (5/8/10/12/15/20) + reading & listening exams grouped by level, each with a
     "Hide from practice / Show in practice" toggle. Saves to settings/contentControls.
2. **Student loader** `student/js/content-controls-student.js` (new): reads the doc
   once after sign-in -> `window.CONTENT_CONTROLS`, exposes `window.isPracticeHidden(skill,id)`
   and `window.grammarQuestionCount(fallback)`, fires `content-controls-ready`.
3. **Practice filtering** (hidden from practice ONLY; assignments unaffected):
   - `skills/reading.js` renderExamList filters READINGS_INDEX by isPracticeHidden('reading',id).
   - `skills/listening.js` filters its activities (tied each card to its registry
     examId 'sample-fsmept'); empty-state message if all hidden. Re-renders on
     `content-controls-ready`.
   - Assignment launch (`openReadingExam`/`startListeningExam` by id) bypasses the
     filter, so an assigned hidden exam still opens.
4. **Grammar question count**:
   - Global: `skills/grammar.js` startGame uses `window.grammarQuestionCount(12)` instead
     of the hard-coded 12. Per-assignment override wins if set.
   - Per-assignment: `grammar-form.js` writes `questionCount` (Default = null = use global);
     new `#grammarQuestionCount` select in the grammar modal; reset on open, prefilled on
     edit. `startGrammarAssignment` carries it into student state.

## Versions
- skills/grammar.js v18 -> **v19**; service-worker v46 -> **v47**.
- New: content-controls.js ?v=1 (teacher), content-controls-student.js ?v=1 (student).
- reading.js / listening.js / grammar-form.js load without ?v= -> busted by the SW bump.

## Verification — sanity + smoke
- **Sanity:** node --check passed on all 6 changed/new JS files; no em dashes in the
  two new files.
- **Smoke** (stubbed-Firebase harness, EXAM_REGISTRY loaded): 0 console errors;
  `isPracticeHidden('reading','b2-r1')`=true, `'b2-r2'`=false; `grammarQuestionCount(12)`=15;
  teacher panel rendered the grammar select (value 15) + 46 exam toggles; the hidden
  b2-r1 showed "Show in practice". Functional: toggling an exam and changing the count
  both fired a save and relabelled correctly, 0 errors.

## v2 (same day) — level tabs + grammar topic hiding
Teacher feedback: add A2/B1/B2-style level tabs; for grammar use topic-hiding
(not a question count); vocabulary still skipped; timer requested separately.
- `teacher/js/content-controls.js` rewritten: a **level-tab bar** (A1/A2/B1/B1+/B2,
  union of what reading/listening/grammar actually have) at the top; selecting a level
  shows that level's reading exams + listening exams + **grammar topics** (grouped by
  unit), each with a Hide/Show-from-practice toggle. The grammar question-count select
  was removed from the panel.
- `practiceHidden` now has a third array: `grammar:[topicId]`.
- **Real bug found by smoke:** `content-controls-student.js` only carried
  reading/listening in practiceHidden (predated grammar), so `isPracticeHidden('grammar',…)`
  always returned false. Fixed: added `grammar` to the loaded shape AND the default. Bumped
  content-controls-student.js v1 -> **v2**.
- `skills/grammar.js` `unitTopics()` now drops hidden grammar topics in FREE PRACTICE
  only (assignment mode still uses its assigned topic list, so a hidden-but-assigned topic
  still appears).
- The per-assignment grammar "questions per drill" field in the grammar assignment form
  was LEFT in place (it's an optional assignment-level setting, separate from the panel);
  the global count just no longer has a panel control (falls back to 12).
- Cache bumps: content-controls.js v1 -> **v2**, skills/grammar.js v19 -> **v20**,
  content-controls-student.js v1 -> **v2**, service-worker v47 -> **v48**.
- **Sanity:** node --check OK on content-controls.js + grammar.js + content-controls-student.js;
  no em dashes. **Smoke** (stubbed harness, registries loaded): 0 errors; 5 level tabs
  (A1–B2); reading + grammar toggles rendered on the A2 tab with correct hidden state;
  `isPracticeHidden('grammar','a2-be')`=true, `'a2-articles'`=false, `'reading','a2-r1'`=true.

## STILL PENDING (separate build): classroom timer widget
Teacher wants a classroom countdown timer (presets, sound, fullscreen project mode) in
BOTH Classroom Mode and the teacher dashboard. NOT built yet — next task.

## Not done / notes
- No deploy (hosting-only; the /settings rule already covers the new doc). No push.
- Vocabulary deliberately excluded (unit-based, randomized). Grammar topics are NOT
  individually hideable (grammar is randomized + the control there is the question
  count) — can add per-topic hiding later if wanted.
