# 2026-06-27 - Roster importer: tabs, teachers, remove-file, QR clarity (v3 -> v4)

Addressing the colleague-testing feedback:

## Tabs (bigger) - "problems are at the end, make them tabs and bigger"
- renderPreview rebuilt into 4 real TABS with big buttons (14px, 11x22 padding):
  By class | Teachers | Excluded | Problems (each shows its count).
- Problems are no longer stacked at the bottom - they are their own tab.
- Empty tabs show a friendly message instead of vanishing.

## Teachers - "what happens to the teacher when I upload?"
- New TEACHERS tab lists every teacher read from the teacher sheet, with their
  class(es), click-to-edit/remove like students. (They were only shown inside the
  per-class list before, so it looked like nothing happened.) On commit each gets a
  pre-verified account linked to their class(es).

## Remove / replace the Excel - "the Excels are not editable, I wanna delete it"
- A "Remove student sheet" / "Remove teacher sheet" button appears under each file
  input once a file is chosen; it clears the input + resets the preview so another
  file can be picked. (Re-picking the same input also still works.)

## QR clarity - "why can I see the sample if it is Blaze? it wouldn't work"
- Added a one-line explainer + a "Preview from this sheet" button that builds the
  QR cards client-side from the validated roster (placeholder join codes, no Blaze)
  so the teacher can see how they will look. "Show class QR codes" still loads the
  REAL codes, which only exist after commit (Blaze).

## Error popup - "I don't see the popup style, it is so weak"
- app-dialog.js IS loaded in teacher-dashboard.html (line 18) and showError() uses
  AppDialog.alert. The weak popup is the OLD deploy (roster v1/v2, before showError
  in v3). v4 + redeploy fixes it.

## Sanity
- node --check OK, stubbed-load OK, em-dash 0.
- roster-import.js ?v=3 -> ?v=4. service-worker CACHE_VERSION already v67 this round.
- No deploy/push. REDEPLOY hosting to ship; SW v67 + ?v=4 force the refresh.
- Could not browser-drive the admin roster flow headlessly - verify by clicking
  through after deploy.
