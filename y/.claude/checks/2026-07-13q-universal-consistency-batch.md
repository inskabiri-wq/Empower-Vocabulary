# 2026-07-13q — Universal consistency batch (8 items) + unified Access panel

## Changes
1. Placement test EXIT: universal "← Exit" button (fixed top-left, all screens)
   with themed AppDialog confirm while in progress; abandoning saves nothing so
   the attempt is not consumed. (placement.html + placement.js ?v=4)
2. Placement tab: "Save settings" REMOVED - everything autosaves on change
   (exam dropdowns, writing mode/prompt, targeting chips). (placement-admin ?v=3)
3. Activity tab: placement now logs through the standard ActivityLogger pipeline
   (PRACTICE_STARTED / PRACTICE_COMPLETED with skill:'placement' +
   recommendedLevel + durationSec). activity-config/logger added to placement.html.
4. Mini course activation MOVED to Admin > Content (courseBlock in
   content-controls ?v=10 writes settings/policyCourse.active); the
   Activate/Deactivate button in the Courses tab is hidden (policy-course-admin
   ?v=12, status pill remains). Module toggles/targeting unchanged.
5. Content tab fonts +1px across labels/status/tabs/pills (11 swaps).
6. Overview header: "+ New Assignment" button removed (assignments have one
   home - the Assignments tab).
7. Corrector: Deep button HIDDEN for teachers without the deep grant
   (gateDeepButton reads aiWritingAccess.deepUids; admin exempt; server still
   enforces). firestore-compat added to lingualab-write/index.html; corrector ?v=6.
8. UNIFIED ACCESS PANEL (ai-writing-admin.js ?v=7 rewritten; admin subtab
   relabeled "🔑 Access", ids kept): ONE home for all teacher grants -
   .ll-select add-teacher dropdown; matrix lists ONLY granted teachers with
   columns Writing AI use / Deep / Deep limit / Deep used (read-only, red at
   cap) / Placement manage / Revoke all (AppDialog confirm). Every tick
   AUTOSAVES to aiWritingAccess + placementAccess. Deep requires Use. Owner
   admin implicitly has everything and is not listed. Modular: new capabilities
   = new columns. Corrector nav reveal + click-gate behavior preserved.
   placement-admin's own grant block removed (points to Access).

## Verification
- node --check x6 files OK; em-dash scan clean (touched files).
- Harness A (real Access script, stubbed db): matrix shows only granted (1 row),
  ungranted in dropdown, Deep tick autosaves deepUids, Placement tick autosaves
  placementAccess. PASS.
- Harness B (real corrector, teacher with use but NO deep): Deep level button
  display:none. PASS.
- SW v104 -> v105; refs: ai-writing-admin v7, placement-admin v3,
  content-controls v10, policy-course-admin v12, placement.js v4, corrector v6.

## Ship
firebase deploy --only hosting (no rules/functions changes).
