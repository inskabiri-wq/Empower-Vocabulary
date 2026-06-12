# Sanity-check / regression test plan

Run this **after deploying** the new firestore rules and frontend changes. Each line is a click-through — open the app, do the action, verify the result.

Use two browsers (or one normal + one incognito) so you can hold a teacher session and a student session at the same time.

---

## A. FSM email domain + verification

| # | Action | Expected result |
|---|---|---|
| A1 | Register with `you@gmail.com` | Red error: "Only FSM email addresses…" — no account created |
| A2 | Register with `you@fsm.edu.tr` | Account created. Browser shows the blue **"📧 Verify your email"** panel. You are **NOT** redirected to the dashboard. |
| A3 | Check your email inbox | Verification email from Firebase. Click the link → it opens a "Your email has been verified" page. |
| A4 | Go back to the app login page, sign in | You land on the **Student** dashboard. |
| A5 | Try to register again with the same email | Error: "An account with this email already exists." |
| A6 | Sign up with `@stu.fsm.edu.tr` | Works (this is the student-domain). Verification flow same as A2–A4. |
| A7 | Try to sign in BEFORE clicking the verify link (use a fresh account) | Browser stays on login page; "Verify your email" panel appears. You are signed out. |
| A8 | Click "Resend email" — enter your password | New verification email sent. Message: "Verification email sent." |
| A9 | Click "Resend email" again within 60 seconds | Message: "Please wait Ns before requesting another email." |
| A10 | Try Google sign-in with a non-FSM gmail | Sign-in succeeds at Google's side, then the app signs you out with the FSM error. |
| A11 | Google sign-in with an `@fsm.edu.tr` Google Workspace account | Lands on dashboard. |

---

## B. Demo account

| # | Action | Expected result |
|---|---|---|
| B1 | On login page, click **"👀 Try a Demo"** | Lands on the student dashboard. Orange banner across the top says **"Demo mode — your progress isn't saved. Expires in 7 days."** |
| B2 | Play a Vocabulary round and finish it | Game works. Score shows. **No** session row added in Firestore (verify via Console → `sessions` collection). |
| B3 | Console-check: `window.isDemoUser` | Should be `true` |
| B4 | Try to open Reading exam, listening exam | Content loads (read-only allowed). |
| B5 | In classroom student page, enter any join code | Can read session (rules allow). Try to submit an answer — should fail with a permission-denied error in console (rules block). |
| B6 | Log out | Returns to login page. Demo doc still exists in Firestore until expiry. |
| B7 | Click "Try a Demo" again | A **new** anonymous account is created (different uid). |

---

## C. Role / privilege escalation

| # | Action | Expected result |
|---|---|---|
| C1 | As a student, open browser console on dashboard and run:<br>`firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).update({role:'teacher'})` | Promise rejects with `Missing or insufficient permissions.` (rule `roleUnchanged()` blocks it) |
| C2 | Try to write a doc directly to `users/<some-other-uid>` | Rejected. |
| C3 | Try `firebase.firestore().collection('sessions').add({...})` with `userId` set to someone else's uid | Rejected. |
| C4 | As a demo user (B1), try `firebase.firestore().collection('sessions').add({userId: firebase.auth().currentUser.uid, percentage: 99})` | Rejected — demo cannot write sessions even for themselves. |
| C5 | As a verified student, manually navigate to `teacher-dashboard.html` | Page loads, but the "access denied" panel appears (client-side gate). Even if you bypass that, Firestore rules block reading other users' docs. |

---

## D. Existing flows still work (regression)

| # | Action | Expected result |
|---|---|---|
| D1 | Existing **teacher** account: sign in | Lands on teacher dashboard. Sees all students. CSV export downloads. |
| D2 | Teacher: open the teacher dashboard student table | Names with apostrophes / accented characters render correctly (already escaped via `escapeHtml`) |
| D3 | Existing **student**: sign in | Lands on student dashboard. Streak, level, journey stats load. |
| D4 | Student: complete a vocabulary activity | Session is saved (verify Firestore `sessions` collection has a new doc with their uid). |
| D5 | Student: open a Reading exam, complete it | Completion is saved (`assignmentCompletions/<uid>_...`). |
| D6 | Student: open a Listening exam | Plays audio, completes. Same as D5. |
| D7 | Teacher: create a classroom session, get the code | Works. |
| D8 | Student: join the classroom session by code | Joins. Can submit answers. Teacher sees them in real time. |
| D9 | Student: in classroom, try to read OTHER players' `answers` (via console) | Rejected. (Used to be allowed — now tightened.) |
| D10 | Password reset on login page | Email arrives, reset works. |

---

## E. Cleanup script

| # | Action | Expected result |
|---|---|---|
| E1 | After 7 days, run `node tools/cleanup-demo-accounts.js` | Lists expired demo accounts. Deletes the user docs and the anonymous auth accounts. |
| E2 | Run again immediately | "No expired demo accounts. Nothing to do." |

---

## If any test fails

Open the browser console (F12) and the Firebase Console → Firestore → Rules → Playground. Re-read the error. Common causes:

- **"Missing or insufficient permissions"** on a write you expect to succeed → check `firestore.rules` deployed version matches the repo, and that the user is verified / not in demo mode.
- **Stuck on "Verify your email" panel** even after clicking the link → log out fully, close the tab, reopen the app and sign in again.
- **Demo banner missing** → check `window.isDemoUser` in console; if true but no banner, hard-refresh (Ctrl+F5) to bypass JS cache.
