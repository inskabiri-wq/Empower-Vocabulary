# 2026-06-16 (round 4) - Teacher edit lockout + presentation scoped to teachers

## 1. Students table edit button -> admin only
`y/teacher/js/students.js`: the 🖊️ Edit button is now wrapped in
`${isAdmin() ? ... : ''}` (matching the existing Promote/Delete gating).
Non-admin teachers see only 👁️ View. Combined with the Firestore rule
`match /users/{userId} -> allow update: if isAdmin()`, teachers genuinely
cannot change student records (UI hidden + server rejects).

## 2. Presentation scoped to regular teachers
`y/teacher-onboarding.html`:
- Added a "Signing in" slide as slide 2 (open app -> sign in with FSM email or
  Google -> dashboard loads; password reset note; role decides what you see).
- Removed the 4 Admin slides (Teachers / Features / Content / Organizations).
- Removed the Admin row + bullet and the Empower Lab row from the sidebar-map
  mock (admin + student dashboard are not for regular teachers).
- Courses slide reworded: teachers SEE status + completions and can fact-check;
  activation/deactivation is done centrally by an admin.
- Widgets slide reworded (dropped the "above Empower Lab" phrasing).
Deck is now 12 slides.

## Versions
- service worker **v55 -> v56** (busts the unversioned `students.js`).
  `teacher-onboarding.html` + `teacher-dashboard.html` are network-first.

## Verification - sanity + smoke
- `node --check` OK on students.js (nested template literal valid).
- Em-dash scan on the deck: clean.
- Deck render (preview): 12 slides, counter auto-updates "1 / 12"; slide 2 =
  "Signing in"; Next -> 2/12, End -> 12/12; no slide contains "Admin -";
  0 console errors.
- Edit-button gate verified by code (mirrors the proven Promote/Delete gate +
  the users update rule); the authed dashboard can't be rendered in preview
  (login-gated), so not screenshotted.

## Not done
- No deploy. No GitHub push.
