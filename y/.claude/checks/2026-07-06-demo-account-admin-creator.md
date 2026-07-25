# 2026-07-06 - Admin "Create demo account" (Cloud Function + UI)

## Goal
An admin-dash section to create a ready-to-use login (pre-verified email) with
an admin-chosen ACTIVATION DATE that drives the 1-year expiry. User picked the
secure Cloud-Function approach; Blaze is now active.

## Why a function (not client-only)
firestore.rules deliberately block the client from creating another user's doc
(`allow create: if isOwner(userId)`), and login REQUIRES `emailVerified` (main.js
:271) - which the browser can't set. The Admin SDK does both server-side, so no
rule/gate relaxation. Mirrors the existing rosterImport pattern.

## Changes
- **functions/index.js** - NEW callable `createDemoAccount` (admin-only via
  existing `assertAdmin`). Creates/reuses the auth user with `emailVerified:true`,
  writes users/{uid} with role/active/level/class/module/year/book (students),
  `registeredAt` = the chosen activation date (the account-gate's 1-year anchor),
  `lastVerifiedAt` = now (no re-verify modal), `demoAccount:true` tag,
  `createdByAdmin`. Idempotent by email (reuse + refresh, never duplicate).
  Auto-generates + returns a password if none given.
- **firebase.json** - restored the `functions` block (was
  `_functions_disabled_until_blaze`) so functions can deploy.
- **y/teacher-dashboard.html** - new Admin sub-tab "🎫 Demo accounts" +
  `#demoAccountPanel` form (role, activation date, name, email, password,
  student level/class/module/year); added to the sub-tab IDS array + margin CSS;
  included `teacher/js/demo-account-admin.js?v=1`.
- **NEW y/teacher/js/demo-account-admin.js** - toggles student fields by role,
  shows a live expiry-date hint (activation +1yr), calls the callable, renders
  the resulting email/password/expiry.
- **y/service-worker.js** - CACHE_VERSION v76 -> v77.

## Verification
- `node --check` functions/index.js + demo-account-admin.js: OK.
- firebase.json: valid JSON, functions block present.
- em-dash scan: clean.
- **Deterministic panel-JS test (10/10 PASS)**: activation defaults to today;
  student fields show/hide by role; expiry hint = activation +1yr; Create sends
  the RIGHT payload field names the function reads (studentClass not class,
  level/module/academicYear/book), calls `createDemoAccount`, renders success.
- **Page-load smoke** (static-y): demo-account-admin.js serves 200; sub-tab +
  panel + all fields + script include + IDS update present; dashboard HTML
  parses as one valid document (insertion didn't break structure).

## DEPLOY (user does this - Blaze now active)
1. `cd functions && npm install`  (first time / if deps changed)
2. `firebase deploy --only functions:createDemoAccount`  (just this callable;
   avoids touching sendWritingReminders which needs SendGrid config)
3. `firebase deploy --only hosting`  (the dashboard UI + SW bump)

Note: deploying ALL functions would also push rosterImport (fine) +
sendWritingReminders (a scheduled fn that no-ops without SendGrid config).

## Notes
- Only the real admin (akabiriaslifar@fsm.edu.tr) can call it (assertAdmin);
  panel lives in the admin-only tab.
- Teacher demo accounts start with no assignedClasses (empty dashboard) - fine
  for showing the UI; add classes via roster import if a populated view is wanted.
- Setting an activation date >365 days ago makes the account immediately expired
  (by design - useful for testing the expiry gate).
