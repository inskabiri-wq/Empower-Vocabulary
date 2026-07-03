# 2026-06-23 - Roster onboarding, Phase 3b + 3c: join page + password popup

Completes the student side of the QR onboarding flow.

## Phase 3b - `y/join.html` (the QR scan target)
Self-contained page (own Firebase init from the shared config, own dark theme).
- Parses `?c=<classKey>&k=<joinCode>` from the QR URL.
- onAuthStateChanged:
  - missing c/k -> "Code not recognized".
  - not signed in -> "Sign in first" + button to index.html.
  - signed in -> reads classes/{c}; if joinCode != k -> "Code not recognized";
    else reads enrollments/{uid}__{moduleId}:
      - matches class.code -> "You are in!" (+ level) + go to dashboard.
      - different class -> "Different class" warning + go to dashboard.
      - no enrollment -> "Not on this roster yet" + go to dashboard.
- READ-ONLY: no writes, so no Firestore rules change. Reads are allowed by the
  Phase 1 rules (classes = any signed-in user; enrollments = owner).

## Phase 3c - `y/student/js/set-password.js` (set / change password)
- Themed modal (self-contained, not dependent on AppDialog).
- Auto-prompts (forced) on the student dashboard when users/{uid}.mustSetPassword
  === true (set by the rosterImport function for new accounts).
- `window.openChangePassword()` exposed for a voluntary "change password" button
  any time (cancelable).
- Validates: >= 6 chars, both fields match. Calls
  firebase.auth().currentUser.updatePassword (pure client-side, no backend),
  then clears mustSetPassword on the user doc (owner write to a non-identity
  field, already allowed by the users rules). Handles auth/requires-recent-login
  with a clear message.
- Wired into student-dashboard.html after content-controls-student.js (?v=1).

## Verification
- `node --check` OK on set-password.js and on join.html's inline script. No em
  dashes in my files.
- REAL-browser smoke (preview static-y):
  - join.html (no params) -> "Code not recognized". With ?c&k and no signed-in
    user -> "Sign in first" + the sign-in button. Firebase initialized, no
    errors. (The signed-in confirm/mismatch/not-enrolled branches need a real
    user + committed data, so they run live only.)
  - set-password modal (throwaway _sp_harness.html, deleted): opens via
    openChangePassword(); short password -> "at least 6 characters"; mismatch ->
    "do not match"; cancel present in voluntary mode. The updatePassword save
    needs a real user, so runs live only.

## INTEGRATION ITEM (flagged, not changed this turn)
The rosterImport function writes the student's placement as
`currentClass / currentModule / currentYear` on users/{uid}, but the app's
identity fields (and the rules' identity-lock) use
`studentClass / level / module / academicYear`. Before go-live these must be
reconciled so imported students actually show their class/level in the app
(likely: have the function write the app's field names). Needs a quick check of
exactly which fields the student dashboard reads. The join page reads from the
`enrollments` doc (its own fields), so it is unaffected.

## Not done
- No deploy. No push. Existing login/registration untouched.
- The commit/account-creation + the live signed-in join + the live password save
  all require Blaze (or the emulator) to exercise end to end.
