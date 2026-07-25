# 2026-07-06 - Demo accounts: in-panel list + delete

## Goal
Give the admin a place to SEE the demo accounts created via the panel, with
per-account delete. (Follow-up to the createDemoAccount feature.)

## Changes
- **functions/index.js** - two NEW callables (admin-only via `assertAdmin`):
  - `listDemoAccounts`: returns every `users` doc where `demoAccount == true`
    (uid, email, name, role, level, class, active, registeredAt, createdAt),
    newest first. Single-field query - no composite index needed.
  - `deleteDemoAccount`: deletes one account's auth user + users doc. **Guarded**:
    refuses unless the doc is tagged `demoAccount:true`, so a real student/teacher
    can never be deleted through it. Ignores an already-gone auth user.
- **y/teacher-dashboard.html** - list section under the create form in
  `#demoAccountPanel`: header + count + 🔄 Refresh + `#daList`.
- **y/teacher/js/demo-account-admin.js** (?v=1 -> ?v=2) - `loadList` (calls
  listDemoAccounts, auth-guarded), `renderList` (row per account: email, role,
  level/class, activated date, expiry - expired ones flagged red), per-row Delete
  -> AppDialog.confirm -> `deleteDemoAccount` -> reload. Lazy-loads on first
  sub-tab open; reloads after a create; manual Refresh.
- **Backfill**: set `demoAccount:true` on the two pre-existing production demo
  accounts (demo.teacher / demo.student, via owner-token Firestore PATCH with
  updateMask) so they appear in the list.
- **y/service-worker.js** - CACHE_VERSION v77 -> v78.

## Verification
- `node --check` functions/index.js + demo-account-admin.js: OK.
- functions/index.js exports: sendWritingReminders, rosterImport,
  createDemoAccount, **listDemoAccounts, deleteDemoAccount**.
- em-dash scan: clean.
- **Real-browser test** (preview, real demo-account-admin.js loaded against a
  harness DOM + stubbed callables): list renders 2 rows, count "(2)", a 2024
  activation shows **expired**, a 2025-09-01 activation shows **expires
  2026-09-01**, email shown; Delete -> confirm -> `deleteDemoAccount` called with
  the correct row uid. Dashboard HTML still parses (daList/daRefreshBtn/count +
  ?v=2 present).
- Backfill: HTTP 200 on both demo.teacher + demo.student.

## DEPLOY (user; Blaze active)
1. `cd E:\vocab-trainer`  (NOT y\ - that trips up cd functions)
2. `firebase deploy --only functions:listDemoAccounts,functions:deleteDemoAccount`
3. `firebase deploy --only hosting`
(createDemoAccount is already deployed and unchanged.)

## Notes
- Delete is a hard delete (auth + doc). The guard (demoAccount:true only) makes
  it safe against nuking real users.
- Live end-to-end of list/delete can be run after deploy (same temp-admin
  harness used for createDemoAccount).
