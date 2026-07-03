# 2026-06-18 - Real email-verification flow (email/password registration)

## The problem
The student app (`student/js/auth.js:33`) signs out + bounces any account whose
`emailVerified` is false. Google sign-in passes (Google verifies the email), but
email/password registration created the account with `emailVerified:false` AND
**never sent a verification email** -> those accounts were permanently kicked.
That's why a legit teacher who registered via the form logged in and got kicked.

## What was built (`y/index/js/main.js`)
User-confirmed flow: Google skips the redundant email; email/password sends a
link, verifies, then logs in.

- `register()` now: create account -> save profile doc -> **send verification
  email** -> sign out -> styled "📧 Check your email" popup. (No redirect; their
  profile is already saved. A `registrationInProgress` flag suppresses the
  auth-state handler so it doesn't fight this flow.)
- `onAuthStateChanged` (the login redirect handler): after the FSM-domain check,
  added an **email-verified gate** - if `!user.emailVerified`, block + show a
  "📧 Verify your email" popup, then sign out. Google accounts are verified so
  they pass straight through. (`pendingGoogleUser` still short-circuits the
  Google profile-completion path before this check.)
  CORRECTION (per user): the email is sent ONCE at registration, NOT on every
  login. The login gate does NOT auto-resend; it offers a user-initiated
  "Resend link" button (AppDialog.confirm) so a lost/expired link is still
  recoverable, but no email goes out unless the user clicks Resend. (Also avoids
  Firebase "too many requests" from auto-sending each login.)
  Also: everyone registers as a student and is promoted to teacher in the admin
  panel AFTER verifying as a student - so promoted teachers are already verified,
  and the gate needs no teacher exemption.
- Helpers added: `verifyActionSettings()` (continue URL -> /index.html, so the
  email link returns to login), `sendVerification(user)` (tries the nice
  continue link, falls back to a plain verification email if the continue URL is
  rejected), `showCheckEmailPopup()`, `showVerifyEmailPopup()`. All use the
  themed `AppDialog`.
- `checkUserRoleAndRedirect()` is now unused (dead code) - the only redirect path
  is the `onAuthStateChanged` handler, which carries the gate. Left in place.

## Behaviour notes / implications
- This is plain Firebase Auth email verification - it does NOT need the pending
  Anthropic API key/funding.
- The email-verified gate now runs at the LOGIN page for EVERY role. Existing
  accounts (incl. teachers) whose email was never verified will be asked to
  verify ONCE on next login (they get a fresh link). Most teachers sign in with
  Google (auto-verified), so unaffected. If any existing teacher must skip this,
  the admin can pre-verify them in the Firebase Console, or we can exempt
  role=teacher (awaiting the user's call).
- Verification email uses Firebase's default template + sender
  (noreply@<project>.firebaseapp.com). The continue URL uses the app origin,
  which is an authorized domain on Firebase Hosting, so it works after deploy.

## Versions
- service worker **v62 -> v63** (busts the unversioned main.js).

## Verification
- `node --check` OK on main.js. No em dashes in the added code.
- Confirmed no caller bypasses the gate (`checkUserRoleAndRedirect` has no
  callers; Google path short-circuits via `pendingGoogleUser` then is verified).
- Could not run a live signup/verification in preview (needs real Firebase
  auth + a real inbox); verified by code review + syntax.

## Not done
- No deploy. No push. Dead `index/js/auth.js` (login-page legacy, not loaded)
  still present.
