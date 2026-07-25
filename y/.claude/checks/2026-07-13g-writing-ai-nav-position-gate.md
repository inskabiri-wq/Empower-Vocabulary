# 2026-07-13g — Writing AI nav: moved between Assignments and Courses + click gate

Part 2 of the two-tier permission feature (part 1 = 2026-07-13f).

## Why
User: the ✍️ Writing AI sidebar item must sit in the MAIN group BETWEEN
Assignments and Courses (it was down in ACCOUNT after Classroom), stay visible
for ALL teachers, and clicking without permission must show a popup
("you can't use it - ask your admin") instead of hiding the icon.

## Changes
- `y/teacher-dashboard.html`
  - Moved the `#aiWritingNav` anchor into the MAIN nav group, directly between
    the Assignments and Courses buttons; removed the old ACCOUNT-section copy
    (exactly one anchor remains).
  - Removed `display:none` from both `#aiWritingNav` and `#aiWritingMore`
    (always visible now).
  - Bumped `ai-writing-admin.js?v=5 -> ?v=6`.
- `y/teacher/js/ai-writing-admin.js` (?v=6)
  - Replaced `revealNavForAccess` with a click gate: `gateNavClicks()` binds both
    links, `preventDefault`s, waits for auth, then `hasAccess(user)` (admin email
    OR uid in settings/aiWritingAccess.teacherUids) -> allowed: `window.open`
    the corrector in a new tab; denied: themed `AppDialog.alert` popup
    ("You don't have permission to use Writing AI yet. Ask your admin...").
  - `whenAuth` now calls back with `null` when tries run out (previously it went
    silent, which would have made the click do nothing for signed-out users).
- `y/service-worker.js`: v95 -> v96.

## Verification
- `node --check ai-writing-admin.js` — OK; em-dash scan (3 files) — clean.
- Static HTML checks: exactly 1 `aiWritingNav` anchor; document order
  Assignments < WritingAI < Courses; no display:none on nav or more-menu link.
- Browser harness (real ?v=6, stubbed auth/db/AppDialog/window.open; clicked BOTH
  links per scenario):
  - granted teacher  -> opened 2, popup 0 ✅
  - non-granted      -> opened 0, popup 2 ✅
  - admin (mixed-case email) -> opened 2, popup 0 ✅
  - PASS: true

## Notes
- Deep-tier + cap popups surface inside the corrector via the server's
  HttpsError messages (permission-denied / resource-exhausted) from 2026-07-13f.
- "Under assignment, above activities" is settled as: sidebar MAIN group,
  between Assignments and Courses.

## To ship (user action)
- `firebase deploy --only hosting` (functions unchanged in this part; deploy
  functions:analyzeWriting too if 2026-07-13f is not yet live).
