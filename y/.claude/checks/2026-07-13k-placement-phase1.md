# 2026-07-13k — Placement test, phase 1: rules + teacher tab + student tile

## Spec (user-confirmed)
Full-mock placement test (~60+ min): staged grammar+vocab (start B1, branch
up/down), then a COMPLETE reading exam + COMPLETE listening exam at the branched
level. Targeted activation (classes/levels/modules/years, mini-course style).
Student hub tile. One attempt, teacher reset. Result = RECOMMENDATION ONLY -
never writes the student profile. No assignment form (tile only). Wired into
Reports (phase 2).

## Built in this phase
- `firestore.rules`
  - `settings/placementConfig`: read any auth, write teacher (mirrors policyCourse).
  - `/placementResults/{studentId}`: student CREATES own doc once (update: false
    -> one-attempt enforced by rules), read teacher/owner, delete teacher (reset).
- `y/teacher-dashboard.html`
  - MAIN sidebar tab "Placement" (data-icon="target", between Courses and
    Activity) + `#tab-placement` container with `#placementBody`.
  - Loads `teacher/js/placement-admin.js?v=1`.
- `y/teacher/js/placement-admin.js` (NEW): activation toggle + targeting chip
  groups (classes from allStudents, levels A2/B1/B1+/B2, modules 1-4, years;
  empty group = no filter; student must match every restricted group), results
  table (per-section %s, recommended level), per-student Reset (AppDialog
  confirm -> delete doc). Blue brand palette (non-admin tab), lazy render.
- `y/student/js/placement-tile.js` (NEW): hub card (🎯 Placement, purple accent,
  TEST/DONE pill) shown only when placementConfig.active AND
  courseActiveFor(cfg, userDoc) AND role=student; shows "Completed - recommended
  X" when a result exists; MutationObserver re-appends after hub re-renders;
  links to placement.html.
- `y/student-dashboard.html`: loads course-target.js (shared scope check) +
  placement-tile.js?v=1 after hub.js.
- `y/service-worker.js`: v99 -> v100.

## Verification
- node --check placement-admin.js + placement-tile.js - OK.
- em-dash: new files clean (firestore.rules/student-dashboard dashes are
  pre-existing).
- Full E2E of the panel/tile comes with phase 2 (runner) since the tile links
  to placement.html which does not exist yet.

## REMAINING (tasks #143, #144) - phase 2
1. `placement.html` + runner JS: Stage A G+V at B1 (~15 grammar from
   GRAMMAR_PRACTICE bank + ~10 vocab MC from datasets), branch >=60% up to
   B1+/B2 else A2/B1; Stage B at branched level; then one full reading exam +
   one full listening exam at branched level from EXAM_REGISTRY - REUSE the
   real exam runners (y/student/js/reading-exam.js + listening) rather than
   re-implementing task types (gaps/headings/sentence-insert/...). Study their
   container/API expectations first. Score -> recommended A2/B1/B1+/B2
   (weighted sections), save ONE placementResults doc {userId, name,
   studentClass, at, stagePath, sectionScores{grammar,vocab,reading,listening:
   {correct,total}}, recommendedLevel, durationSec}. Refresh-guard, timer,
   one-attempt refusal if doc exists.
2. Reports: KPI + "Placement recommendations by level" chart + Excel sheet in
   reports-admin.js (respect filters; bump ?v).
3. Verify (harness: targeting gate, one-attempt, branch thresholds), smoke,
   version bumps, dated log.

## IMPORTANT for the user
- Do NOT activate the Placement toggle for students until phase 2 ships
  (the tile would link to a missing page). Building phase 2 next.
- Ship needs BOTH: `firebase deploy --only hosting` AND
  `firebase deploy --only firestore:rules`.
