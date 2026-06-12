# Grammar assignments (Phase 2) — teacher create -> student start -> completion · 2026-06-04

## Decision
Grammar assignment = pick a CEFR level + optional topics (practice, no score).
Done when the student finishes the assigned topics.

## Built (mirrors exam-form.js; additive, existing flows untouched)

### Teacher side
- `y/teacher-dashboard.html`: new `#grammarAssignmentModal` (title, level dropdown,
  topic checkboxes, shared class/level/module/student targeting, deadline,
  Save/Cancel). Inserted after the exam modal. div balance 318/318.
- `y/assignments/js/grammar-form.js` (NEW, mirrors exam-form.js):
  openGrammarAssignmentModal / saveGrammarAssignment / applyGrammarPrefill /
  onGrammarLevelChange / onGrammarTargetTypeChange; reads window.GRAMMAR_PRACTICE
  for levels+topics; reuses shared helpers (validateAll, clearFieldErrors,
  showFieldErrors, _normCls, StudentPicker, populateClassDropdownScoped,
  applyRoleScopeToTargetDropdown, loadAssignments). Chains
  routeToCreationForm + openEditAssignmentModal for skill==='grammar'.
- Saves `/assignments` doc: { title, skill:'grammar', level, topics[], topicTitles[],
  targetType, targetClass/Level/Module/Students, deadline, teacherId, teacherName, createdAt/updatedAt }.
- Loaded grammar-content.js + grammar-form.js in teacher-dashboard.html (after writing-form.js).
- `skill-registry.js`: grammar status 'coming-soon' -> 'active' (now opens the form, not "coming soon").

### Student side
- `y/assignments/js/student-assignments.js` startAssignment(): added `grammar` case ->
  window.startGrammarAssignment(assignment) (was bailing with "runner not built").
- `y/student/js/skills/grammar.js`: added ASSIGNMENT MODE. startGrammarAssignment(a)
  opens the grammar screen showing ONLY the assigned topics (or whole level if none
  chosen) with a progress banner. Finishing a topic marks it done; when ALL assigned
  topics are finished it calls markAssignmentCompleted(a.id, 100) once -> completion
  recorded the same way as vocab/writing. Free practice (entered from the hub) is
  unchanged and clears assignment context on open.
- `grammar.css`: assignment banner + done-topic styles (vocab palette).

### Rules
- No change needed. /assignments create is skill-agnostic (valid target only);
  /assignmentCompletions accepts `{uid}_{id}` with bestScore 0..100. Grammar fits both.

### Cache
- SW CACHE_VERSION v15 -> v16. Cache-busted: grammar.css?v=3, grammar.js?v=3,
  hub.js?v=2 (earlier), skill-registry.js?v=2 (both dashboards),
  student-assignments.js?v=2. grammar-form.js + grammar-content.js are new URLs (fresh).

## Verification
- node --check on grammar-form.js, grammar.js, grammar-content.js,
  student-assignments.js, skill-registry.js, hub.js -> all OK.
- registry: grammar status 'active', in active() = true.
- startAssignment grammar route present; grammar.js has startGrammarAssignment +
  markAssignmentCompleted; teacher modal present + grammar-form.js included; div 318/318.
- Live E2E not run (needs auth on the deployed app). Logic mirrors the verified
  exam-form path exactly.

## Deploy / test
1. firebase deploy --only hosting. Reopen (twice if the PWA service worker needs a
   beat — grammar.js/css are stamped so they load first try).
2. Teacher: New Assignment -> Grammar -> pick level (+ optional topics) -> target +
   deadline -> Save. Confirm it appears in the assignments list under the Grammar pill.
3. Student: see the grammar assignment -> Start -> finish the assigned topics ->
   it flips to completed; teacher sees it completed.

## Notes
- "Whole level" assignment (no topics chosen) = finish ALL topics in that level to
  complete (A2 = 16). Teachers wanting a lighter task should tick specific topics.
- Practice is not scored; completion = topics finished (bestScore stored as 100 to
  fit the shared completion record).
