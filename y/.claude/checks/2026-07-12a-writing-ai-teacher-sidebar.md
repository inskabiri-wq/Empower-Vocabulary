# 2026-07-12a — Writing AI: sidebar entry point for granted teachers

## Why
Granted (non-admin) teachers had no way to reach the writing corrector. The only
link lived inside the admin-only Writing AI panel, so a teacher given access via
`settings/aiWritingAccess.teacherUids` still saw no entry point. Added a sidebar
+ more-menu "Writing AI" link that reveals for the admin OR any teacher whose uid
is in the allowlist. The `analyzeWriting` function still enforces access
server-side; this is purely the entry point.

## Changes
- `y/teacher-dashboard.html`
  - Sidebar nav: `<a id="aiWritingNav" ... style="display:none">✍️ Writing AI</a>`
    after the Classroom item (line ~1164).
  - More-menu: `<a id="aiWritingMore" ... style="display:none">✍️ Writing AI</a>`
    (line ~1221).
  - Bumped `teacher/js/ai-writing-admin.js?v=2` -> `?v=3`.
- `y/teacher/js/ai-writing-admin.js` (?v=3)
  - Added `currentUser()`, `whenAuth(cb,tries)` (polls up to 40x/400ms for auth),
    and `revealNavForAccess(user)`: reads `settings/aiWritingAccess`, reveals both
    links when `email === akabiriaslifar@fsm.edu.tr` (lowercased compare) OR
    `uid ∈ teacherUids`.
  - `init()` now calls `whenAuth(revealNavForAccess)` for every user (in addition
    to the existing admin panel wiring, which is gated by `#aiWritingBody`).
- `y/service-worker.js`: CACHE_VERSION `v90` -> `v91`.

## Verification
- `node --check y/teacher/js/ai-writing-admin.js` — OK.
- em-dash scan (ai-writing-admin.js + teacher-dashboard.html) — clean.
- version-drift check — all consistent.
- Reveal logic, real-browser iframe harness (loads the actual ?v=3 file with a
  stubbed auth + Firestore allowlist):
  - granted teacher (uid in list)      -> nav shown, more shown  ✅
  - non-granted teacher (uid NOT in)   -> nav hidden, more hidden ✅
  - admin by email (mixed case)        -> nav shown, more shown  ✅
  - PASS: true
- Grep confirms both anchors present + script at ?v=3.
- Smoke test: 19 passed, 0 warnings, 1 failure —
  "Submissions reference real assignments". PRE-EXISTING, unrelated: it flags
  live orphaned writing submissions that point at deleted assignments. This change
  is front-end nav only and cannot affect submission/assignment data.

## To ship (user action)
- `firebase deploy --only hosting` (user deploys; I do not).
- Reminder still open: Gemini API billing is depleted ("prepayment credits are
  depleted") — top up prepay OR switch the key's project to pay-as-you-go so live
  analysis returns results. The pipeline itself is verified end to end.
