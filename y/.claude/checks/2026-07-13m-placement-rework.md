# 2026-07-13m — Placement rework: admin-gated + CEFR ladder + config dropdowns

## User feedback implemented (all 5 points)
1. ON/OFF moved to **Admin > Features**: new `placement` toggle in
   feature-activation.js (EXPLICIT OPT-IN: tile/test require
   featureToggles.placement === true, unlike other features that default on).
   The Active button was removed from the Placement tab.
2. **Placement tab is admin-only unless granted**: sidebar tab starts
   display:none; placement-admin.js reveals it for the admin email or uids in
   settings/placementAccess.teacherUids (admin-only grant UI with ll-select
   dropdown + revoke chips; /settings generic rule already makes the doc
   admin-write, any-auth read).
3. **Font fixed**: placement.html now loads Nunito + Outfit (Google Fonts, same
   as the dashboards) and sets the app font stack on body (verified computed
   fontFamily = Nunito...).
4. **Config with unified .ll-select dropdowns** in the Placement tab: Reading
   exam (Auto = match ladder level, or any specific registry exam), Listening
   exam (same), Writing (On-manual / On-AI-assisted / Off) + custom writing
   prompt. And the test is now a **CEFR LADDER**: language questions climb
   A2 (13q) > B1 (13q) > B1+ (10q) > B2 (10q), grammar+vocab mixed per rung;
   provisional band = highest rung >= 60%; then reading + listening (config
   pick or auto by band) adjust +-1 band (>=75% / <35%); then the writing task.
   Per-rung scores saved in result.rungs; stagePath shows the whole ladder.
5. **No assignment linkage** (confirmed; tile-only stands).

## Writing ("both options")
- Essay TEXT is ALWAYS saved into the result (prompt, text<=6000, words, mode).
- Modes: manual review (teacher reads via the results table "Read (Nw)" button,
  AppDialog) or AI-assisted (same save; teacher pastes into the corrector for
  the full AI report - analyzeWriting is teacher-gated server-side, so students
  cannot call the AI directly; a server-side placement path is possible later).
- Min 30 words enforced client-side; 'off' skips the rung.

## Files
- y/teacher/js/feature-activation.js (+placement feature row)
- y/student/js/placement-tile.js (featureToggles gate)
- y/student/js/placement.js ?v=2 (ladder, config picks, writing rung, gate)
- y/placement.html (fonts, writing screen, ?v=2)
- y/teacher/js/placement-admin.js ?v=2 (rewrite: reveal gate, grant UI, config
  dropdowns, results + writing Read button, no Active toggle)
- y/teacher-dashboard.html (tab hidden by default, ?v=2)
- y/service-worker.js v100 -> v101

## Verification
- node --check x4 OK; em-dash scan clean.
- Browser E2E (real page, stubbed firebase, featureToggles.placement=true):
  body font Nunito; rungs A2 -> B1 -> B1+ -> B2 all presented in order (46 Qs);
  real reading exam opened; listening + writing flow; 35-word essay saved;
  result doc: rungs per band, provisional A2 (random clicks < 60%), RL 80% ->
  adj B1, writing.words=35, done screen. PASS.
- Static: tab display:none default; 5 ll-select dropdowns; placementAccess
  grant UI present.

## REMAINING
- Task #144: Reports wiring (placement chart + Excel sheet in reports-admin.js).
- Ship: `firebase deploy --only hosting` + `--only firestore:rules`; then
  Admin > Features > Placement Test ON + configure/target in the Placement tab.
