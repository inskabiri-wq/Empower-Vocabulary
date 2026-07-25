# 2026-07-13r — Mini courses tab + dropdown targeting + audit/presets + Node 22

## 1+2+3. Mini courses tab in Admin > Content (content-controls ?v=11)
- New skill tab "🎓 Mini courses" NEXT TO Grammar (verified order). Holds the
  course on/off AND the four per-module activate/deactivate rows (moved from
  the Courses tab; policy-course-admin ?v=13 renders its module box empty with
  a pointer comment, main toggle stays hidden). Level tabs hidden on this tab.
  Future courses = more blocks here. Both toggles write settings/policyCourse
  (active / hiddenModules) - harness-verified writes.

## 4. Placement targeting = unified dropdowns (placement-admin ?v=4)
- Chip-button groups replaced: each group (Classes/Levels/Modules/Years) is an
  .ll-select "Add ..." dropdown; selected values render beside it with an x to
  remove. Autosaves on add AND remove (harness-verified writes). None = all.

## 6. Access panel cleanup (ai-writing-admin ?v=8)
- "Open the writing corrector" opener REMOVED (entry point = sidebar icon);
  column explanation folded into the intro line.

## Audit trail (#2 of the approved suggestions)
- Every change in Access writes /accessAudit {action, targetUid, targetName,
  by, at}: add/grant/revoke Writing AI, grant/revoke Deep, set Deep limit,
  grant/revoke Placement, preset applied, revoke ALL. "Recent access changes"
  (last 15) shown at the panel bottom. firestore.rules: /accessAudit create+read
  teacher, update never, delete admin.

## Presets that TICK the boxes (#3)
- Per-row .ll-select preset (Custom / Writing only / Writing + Deep /
  Semi-admin (all)) - applying a preset visibly ticks/unticks that person's
  checkboxes (harness: deep checkbox visibly checked after preset) and
  autosaves both docs + audits. Boxes stay individually editable.

## Node 22 + firebase-functions upgrade (#4)
- functions/package.json: engines.node 20 -> 22, firebase-functions ^4.6.0 ->
  ^6.1.0, firebase-admin ^12 -> ^13. index.js now imports
  'firebase-functions/v1' explicitly (root export moves to v2 in v6; all four
  callables + scheduler use the v1 API - zero behavior change).
- npm install OK; module-load check: ALL exports register (sendWritingReminders,
  rosterImport, createDemoAccount, listDemoAccounts, deleteDemoAccount,
  analyzeWriting). Deploy warning about Node 20 decommission (2026-10-30) is
  now resolved once deployed.

## Verification
- node --check x4 admin files OK; em-dash clean; SW v105 -> v106.
- Harness A (Content): Mini courses tab exists next to Grammar, level tabs
  hidden there, course toggle + 2 module rows render, module flip + main toggle
  write correct fields. PASS.
- Harness B (Placement): scope dropdown adds 9A -> saved; x removes -> saved. PASS.
- Harness C (Access): opener gone, audit section shown, preset dropdown applies
  semi-admin -> deepUids + placementAccess saved, deep checkbox VISIBLY ticked,
  audit entry written. PASS.

## Ship (all three)
- firebase deploy --only hosting
- firebase deploy --only firestore:rules     (accessAudit)
- firebase deploy --only functions           (Node 22 runtime upgrade - full
  functions deploy so every function moves off Node 20)
