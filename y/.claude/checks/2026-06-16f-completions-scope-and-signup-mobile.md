# 2026-06-16 (round 6) - Completions class-scoped + post-signup form mobile fix

## 1. "View completions" scoped to the teacher's own class
`y/teacher/js/policy-course-admin.js` `loadCompletions()`: each courseProgress
row now carries `_uid = d.id` (the doc id IS the student uid). For non-admins,
rows are filtered to `studentList()` (the dashboard roster, which is already
class-scoped for teachers). Admins still see everyone. Summary counts + table
both reflect the scoped set.
Note: this is the UI/read scope. The Firestore `courseProgress` read rule still
allows `teacherHasScope()` broadly; tightening the rule is a separate change.

## 2. Two activation places (NOT changed - awaiting decision)
The mini course is gated in two different admin spots:
- Courses tab "Activate" (`#pcAdminToggleBtn` -> settings/policyCourse active + scope).
- Admin > Features > "🎓 Courses" toggle (settings/featureToggles.courses -> shows/
  hides the whole Courses tile).
They do different things (course activation+scope vs. tile visibility), so neither
is safe to remove blindly. Left intact; user to decide which to keep/relabel.

## 3. Post-signup (Google) profile form unusable bottom on mobile
The Google "complete your profile" form is built in `index/js/main.js`
(`showGoogleCompleteForm`) using the same classes as #registerForm. The form is
~1044px tall; the base `body { overflow:hidden; align-items:center }` meant the
bottom fields + the Complete Registration button could be unreachable on a phone
(and worse with the keyboard open).
Fix: `y/index/css/styles.css` @media (max-width:480px) `body` now uses
`align-items:flex-start; overflow-y:auto;` (overflow-x stays hidden) so the page
scrolls and the whole form is reachable. Scoped to mobile only - desktop centering
untouched. Helps the email Register form too (same height issue).

## Versions
- `policy-course-admin.js` ?v=8 -> **?v=9** (its own query buster).
- service worker **v57 -> v58** (busts the unversioned `index/css/styles.css`).
  `index.html` / `teacher-dashboard.html` are network-first.

## Verification - sanity + smoke
- `node --check` OK on policy-course-admin.js. No em dashes in edits.
- Mobile fix verified in preview (index.html is public): after the CSS applied
  (flex-start / overflow-y:auto), the page scrolls and the Complete Registration
  button is reachable; screenshot at 375px shows the form properly margined.
- Completions scope: verified by code (filter by roster uid set; admin bypass).
  Not render-verified - the teacher dashboard is login-gated in preview.

## Not done
- No deploy. No GitHub push. Activation-duplication left for user decision.
