# 2026-07-19b - Placement round 2 (3 items, manual target CONFIRMED by user)

## 1. Definition questions too hard below B1
A2 rung vocabulary is now FILL-IN-THE-BLANK (vocabGapQs): the dataset example
sentence with the word gapped out, options = 4 same-level words (same POS +
word count preferred). Definition/"find the meaning" questions only appear
from B1 upward. 918 of 951 A2 words are gappable (word appears verbatim in
its example sentence); non-gappable words are simply excluded from picks.

## 2. Writing review: REDIRECT ONLY (user confirmed the targets)
The in-modal comment/score UI from round 1 is DELETED. The Details popup only
shows scores + the essay, plus ONE button:
- AI mode     -> Writing AI corrector page (llwPrefill handoff, unchanged).
- manual mode -> the EXISTING assignment grading screen: placement.js now
  also files a /writingSubmissions doc ({uid}_placement, assignmentId
  'placement', source 'placement', grading fields explicitly null per the
  create rule) when a real student submits manual-mode writing; the button
  calls window.openWritingEssay(uid + '_placement', 'placement'). Grading
  (TA/CC/GR/VO + comment + annotations) uses the normal teacher update rule.
  Old attempts without a bridge doc get a themed explanation (reset to redo).
- Reset also deletes the {uid}_placement doc (catch-guarded; delete is
  admin-gated in rules, harmless if it stays).
- firestore.rules: placementResults update REVERTED to `allow update: if
  false` (round 1's writingReview branch removed - review lives in
  writingSubmissions now). NOTE: rules deploy still needed for the REVERT.

## 3. Teachers see ONLY their classes, never all
- visibleResults: only the ADMIN sees all results; granted (manage) teachers
  AND plain teachers are filtered to their assignedClasses.
- Plain teachers WITHOUT assignedClasses never see the Placement tab at all
  (revealTab now checks the user doc).
- Manage head note says "Results below show only your classes."

## Files
student/js/placement.js ?v=6, teacher/js/placement-admin.js ?v=6,
firestore.rules (revert), SW v107 -> v108.

## Verification (browser, static-y, stubbed auth/db; harness deleted after)
- Student run as role=student: A2 rung stems all "Choose the word that
  completes the sentence" with real dataset sentences; B1 stems "find the
  meaning". Finish wrote BOTH placementResults/stu1 AND
  writingSubmissions/stu1_placement with the exact rule-pinned shape
  (status submitted, four null grading fields, wordCount 40). PASS
- Teacher harness: plain teacher (11-A) -> only Student A, 0 reset, modal has
  0 textareas/0 inputs, manual button -> openWritingEssay('stuA_placement',
  'placement') + modal closed. Granted -> config shown, results STILL only
  11-A, "only your classes" note. No-class teacher -> tab stays hidden. PASS
- node --check x2 OK; em-dash scan clean; bump --check consistent.

## Ship
firebase deploy --only hosting AND --only firestore:rules (to remove the
now-unused writingReview update branch). Hard refresh for SW v108.
