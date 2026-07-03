# 2026-06-17 - Registration redirect fix + styled FSM-email popup

`y/index/js/main.js` (login page controller). Two things:

## 1. Email registration showed "Redirecting..." but never redirected
After `createUserWithEmailAndPassword` + writing the profile doc, `register()`
showed "Account created! Redirecting..." but had NO redirect - it relied on the
`onAuthStateChanged` handler, which fires the instant the account is created
(BEFORE the profile doc exists), so it saw no doc and hit the do-nothing `else`.
Fix: after the doc `.set()`, explicitly call `checkUserRoleAndRedirect(user)`
(re-reads the doc, runs the domain + account gate, redirects). (Done previous
turn; bundled here.)

## 2. Non-FSM email now shows a styled popup instead of a silent sign-out
Per user: "give a popup with the app style saying fsm.edu.tr." The domain logic
was correct but the rejection was a quiet inline message + sign-out ("kicked
out" with no clear reason).
- Added `isFsmEmailAllowed(email)` (uses `OrgRegistry.checkEmail` if loaded, else
  endsWith `@fsm.edu.tr` / `@stu.fsm.edu.tr`) and `showFsmEmailPopup()` which uses
  the themed `AppDialog.alert(msg, { title: '🎓 FSM email required' })` (already
  loaded on index.html), falling back to the inline message box.
- `login()` and `register()` now check the domain UP FRONT and show the popup +
  return BEFORE creating any account / signing in - no more orphan auth accounts
  or silent sign-outs.
- The two post-auth "Access denied" sign-outs (the `onAuthStateChanged` handler
  and `checkUserRoleAndRedirect`, the Google path) now call `showFsmEmailPopup()`
  too, so Google sign-in with a non-FSM account also gets the styled popup.

## Versions
- service worker **v60 -> v62** (busts the unversioned main.js across both turns).

## Verification
- `node --check` OK on main.js. No em dashes added.
- Gate-logic unit check (fallback path): ALLOW `@fsm.edu.tr`, `@stu.fsm.edu.tr`
  (case-insensitive); BLOCK `@fsm`, `@fsm.com`, `@gmail.com`, and the spoof
  `@fsm.edu.tr.evil.com`.
- Could not run a live signup in preview (needs real Firebase auth); verified by
  code + syntax + logic test.

## Not done
- No deploy. No push. (Dead `index/js/auth.js` still present, not loaded.)
