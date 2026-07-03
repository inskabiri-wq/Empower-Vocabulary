# 2026-06-23 - Roster onboarding, Phase 1: backend (rosterImport Cloud Function)

First slice of the Excel-roster onboarding feature: the server-side account +
class provisioning. STAGED, NOT DEPLOYED (needs Blaze, which the user is
activating). Nothing here runs or affects production until the user restores the
`functions` block in firebase.json and deploys.

## What was built
- `functions/index.js`: new callable **`rosterImport`** (added after the existing
  `sendWritingReminders`; that function untouched).
  - Admin-only (`assertAdmin`: admin email OR users/{uid}.role=='admin').
  - `mode:'validate'` = strict validation + dry-run report, writes NOTHING.
  - `mode:'commit'` = only runs with zero HARD problems; idempotent.
  - Match key is EMAIL (lower/trim). Existing account => reused (never recreated),
    only its module/level/class enrollment is rewritten. New email => account
    created with `emailVerified:true` (bypasses the login verification step) + a
    generated temp password returned to the admin.
  - Validation: missing/invalid/duplicate email (hard), missing name (hard),
    missing class for students (hard), unknown level + odd class code (warnings).
    Cross-sheet duplicate (same email in both sheets) = hard.
  - Header matching is case/whitespace-insensitive; logical->header in `COLUMN_MAP`
    near the top (edit to match the real sheet headers).
  - Writes: modules/{id}, classes/{moduleId__code} (keeps existing joinCode or
    generates one), users/{uid} (merge), enrollments/{uid__moduleId}. Enrollment
    keyed by uid+module => no overlap across 8-week modules. Chunked batches
    (<=400 ops/commit). Audit row in importRuns.
  - One function covers BOTH year-one creation and per-module relocation.
- `firestore.rules`: additive blocks for modules / classes / enrollments /
  importRuns. ALL client writes denied (only the Admin-SDK function writes).
  Reads: modules + classes = any signed-in user (no student PII; classes carry
  the join code for the QR screen); enrollments = owner/teacher/admin only
  (has email + studentNo); importRuns = admin only.
- `functions/HOWTO-DEPLOY.md`: appended a `rosterImport` section (ships in the
  same deploy, needs Blaze + admin only, no SendGrid).

## Verification (what is possible pre-Blaze)
- `node --check functions/index.js` OK.
- firestore.rules brace-balanced (109/109), 39 match blocks (+4), all four new
  collections present.
- Em-dash scan: my additions add none (the hits in the scan are pre-existing
  lines in the reminder function + older rules comments).
- NOT yet run in the Firebase emulator (Auth + Functions) - that is the real
  runtime test and should be done before relying on it. The emulator runs
  WITHOUT Blaze; Blaze is only needed to DEPLOY.

## Open / next
- COLUMN_MAP is set to assumed headers (name/email/studentNo/class/level). Needs
  the user's real sample sheet to lock exactly (zero rework - it is one config
  object; the dry-run flags any mismatch before any write).
- First-login auth mechanism for pre-created accounts: function currently issues
  a temp password + returns it to the admin. The student scan-join flow (Phase 3)
  will consume that; per-class vs per-student QR still open.
- Phase 2: admin Roster Import UI (SheetJS parse -> call validate -> preview ->
  commit). Phase 3: per-class QR + student scan-join + set/change-password popup.
  Phase 4 (parallel): C1 level everywhere.

## Not done
- No deploy. No push. Existing login/registration unchanged (per user: do not
  change it).
