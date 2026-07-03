# 2026-06-23 - Roster onboarding, Phase 2: admin import UI

The admin-facing screen for the roster import. Parses + validates the two Excel
sheets IN THE BROWSER (instant dry-run, no Blaze needed), then commits via the
rosterImport Cloud Function from Phase 1.

## What was built
- `y/teacher/js/vendor/xlsx.full.min.js` - SheetJS vendored locally (951 KB),
  served from 'self' so the CSP needs no CDN entry; lazy-loaded only when the
  panel runs a parse.
- `y/teacher/js/roster-import.js` (new, ?v=1) - the controller:
  - Lazy-loads SheetJS, parses .xlsx/.csv (first sheet) to row objects.
  - Client-side validation that MIRRORS functions/index.js (same COLUMN_MAP,
    same rules) for an instant dry-run preview: counts + a problems table
    (hard = BLOCKS, warn = warning) + the class chips.
  - "Create / relocate accounts" calls the rosterImport callable (mode:'commit').
    Disabled until: validated, zero hard problems, year + module set.
  - New accounts come back with temp passwords -> downloadable as a UTF-8 CSV
    (BOM) for distribution. If the functions SDK / Blaze is not available, it
    fails gracefully with a clear message (validation still works without it).
- `y/teacher-dashboard.html`:
  - New admin sub-tab "Roster import" + the panel (#rosterImportPanel) with
    year/module inputs, two file pickers, Validate / Commit / Download buttons,
    status line, and report area. Styled with the t2 admin tokens.
  - Added `firebase-functions-compat.js` 10.7.1 (with correct SRI hash) so the
    callable works post-deploy. Only app/auth/firestore were loaded before.
  - Wired `roster-import.js?v=1` after content-controls.js.

## Verification
- `node --check` clean on roster-import.js + functions/index.js. No em dashes in
  my files (vendored SheetJS excluded; the HTML panel block scanned clean).
- Validation logic sim (Node): 2 valid / 4 hard / 2 warn on a mixed sheet; C1
  accepted; case-insensitive headers. PASS.
- REAL-browser smoke (preview static-y, throwaway _ri_harness.html, then
  deleted): generated a 6-row student .xlsx + 1 teacher row via SheetJS, fed it
  through the actual roster-import.js:
  - Preview: students valid 3, teachers valid 1, classes 3, hard 3, warnings 2.
  - Duplicate / invalid email / missing class all flagged as BLOCKING; commit
    button correctly disabled.
  - Fixed a false warning: a teacher listing several classes ("D302,D303") used
    to trip the class-format check on the raw joined string. Now each split
    class is checked; teacher combo no longer warns, while a genuinely odd class
    (ZZ9) and unknown level (X9) still warn. Fixed in BOTH roster-import.js and
    functions/index.js (kept in parity), re-verified in browser (warnings 3->2).

## Not testable here (needs Blaze)
- The commit path (the actual account/class/enrollment writes) only runs once
  the Cloud Function is deployed on Blaze, or in the Firebase emulator. The UI
  wires the call and handles success/failure; the writes themselves are Phase 1
  code, unit-shaped but not yet emulator-run.

## Open / next
- COLUMN_MAP still assumed headers (name/email/studentNo/class/level) in BOTH
  files. Real sample sheet locks it (one-line change, dry-run catches mismatch).
- Phase 3: per-class QR + student scan-join + set/change-password popup.
- Phase 4 (parallel): C1 everywhere (note: C1 is already accepted as a valid
  level by the importer).

## Not done
- No deploy. No push. Existing login/registration untouched.
