# Deploy Walkthrough — Today's Changes

Single document covering everything we changed today, the order to deploy, and how to verify after. Read top-to-bottom the first time, then bookmark the **Quick Deploy** section for next time.

---

## 1. What was changed (summary)

### Security & auth (server-side)

- **`firestore.rules` rewritten:**
  - Added helpers: `isAuth`, `isAdmin`, `isTeacher`, `isOwner`, `roleUnchanged`, `isAnonymous`, `isDemo`, `emailIsFsm`, `isVerifiedFsm`, `canWriteAsRealUser`, `isTeacherEligibleEmail`.
  - `users/{userId}` create: forces `role: 'student'` for `@fsm.edu.tr` / `@stu.fsm.edu.tr` emails, or `role: 'demo'` for anonymous (demo) users. No other roles allowed at creation.
  - `users/{userId}` update: only admin can change role; admin can only set role to `'student' | 'teacher' | 'demo'`; promotion to `'teacher'` requires the target email to be `@fsm.edu.tr` (and NOT `@stu.fsm.edu.tr`). `@stu.fsm.edu.tr` is permanently locked.
  - `sessions`, `assignmentCompletions`, `activityLogs`, classroom `answers` writes now require `canWriteAsRealUser()` (verified FSM email OR teacher OR admin). Demo users blocked.
  - `classroom_sessions/.../players/.../answers/{id}` read tightened — only the writer or a teacher (was: any authenticated user).
  - Demo users can read `assignments` and `classroom_sessions` (to "see but not interact"), but cannot submit anything.

### Auth flow (client-side)

- **`y/index/js/auth.js`:**
  - Added `emailIsFsm()` helper.
  - `register()` always writes `role: 'student'` (no more whitelist-based teacher write at creation), then calls `sendEmailVerification()` and signs the user out — they must verify before they can sign in.
  - `login()` blocks unverified accounts: shows verification panel, signs them out.
  - `checkUserRoleAndRedirect()`:
    - Anonymous (demo) users skip FSM + verification gates and go to student dashboard.
    - Real users: domain check + verification check, then read role from user doc (no longer recomputed from whitelist on every login).
  - `signInWithGoogle()`: same domain + verification gates.
  - New `resendVerification()`: re-auth + resend, with 60s client throttle.
  - New `showVerificationPrompt()` / `hideVerificationPrompt()`.
  - New `signInAsDemo()`: anonymous auth + creates user doc with `role: 'demo'`, `expiresAt = now + 7d`.
  - Password minimum: 6 → 8 chars.

- **`y/index.html`:**
  - Added `#verifyPanel` (hidden by default) — shown when a user must verify their email; has Resend and Dismiss buttons.
  - Added `#demoBtn` "Try a Demo (no FSM email required)" button below the Google sign-in button.
  - Removed the old REDIRECT FIX inline script (it forced a post-register redirect; now we go through verification instead).

- **`y/student/js/auth.js`:**
  - `window.isDemoUser` flag, set after the user doc loads.
  - Verification gate: signs out and redirects to login if a non-anonymous user has `emailVerified === false` (defense-in-depth for bookmarked URLs).
  - Skips `ActivityLogger.logLogin()` for demo users.
  - `logSessionToFirestore()` short-circuits for demo users (matches what the rules already enforce).
  - New `showDemoBanner()`: injects the orange "Demo mode — your progress isn't saved" banner on the page.

### Teacher dashboard (admin-only promote button)

- **`y/teacher/js/students.js`:**
  - New `isTeacherEligibleStudent()` helper — mirrors `isTeacherEligibleEmail()` in the rules.
  - Added 👑 promote button in the Students table actions column. Admin-only, and only renders for rows whose email is `@fsm.edu.tr` and NOT `@stu.fsm.edu.tr`.
  - New `promoteStudentToTeacher()` handler: confirm dialog → adds email to `settings/teacherEmails` (for tidy bookkeeping) → updates user doc `role: 'teacher'` → logs activity → success toast → reloads both lists.
  - Rejects ineligible emails fast with a clear error.

- **Demote** is unchanged — already exists in [y/teacher/js/admin.js:514](y/teacher/js/admin.js:514) (admin tab → expand teacher row → "👤 Demote to Student").

### New files

- **`y/tools/cleanup-demo-accounts.js`** — Node script using `firebase-admin` to purge expired demo accounts (user doc + auth account). One-time setup needed; instructions inside the file.
- **`TESTING.md`** — regression test checklist (A1–E2).
- **`WALKTHROUGH.md`** — three-audience guide (admin, teachers, students).
- **`DEMO-ACCOUNT.pdf`** + **`WALKTHROUGH.pdf`** — generated from `build_pdfs.py` (kept on disk; not updated after the role architecture changes).
- **`build_pdfs.py`** — reportlab script. Re-run with `python build_pdfs.py` if you ever want fresh PDFs.

### .gitignore

- Excluded `y/tools/.serviceAccount.json` (the Firebase admin key for the cleanup script).

---

## 2. Pre-flight — do these BEFORE you deploy

### 2.1 (No Anonymous auth needed)

The platform no longer uses anonymous sign-in. Demo accounts are real
Firebase Auth accounts (`demo1@stu.fsm.edu.tr`, etc.) pre-created by an
admin script and distributed via DEMO-CREDENTIALS.pdf. **You do not need
to enable Anonymous auth in the Firebase Console.** Leave it disabled.

### 2.2 (Optional but recommended) Confirm the email verification template

1. Firebase Console → **Authentication → Templates → Email address verification**.
2. Check the sender, subject, and message look right. The default works; you can customize if you want.
3. The "from" address will be `noreply@<project-id>.firebaseapp.com` unless you've set a custom domain.

### 2.3 Snapshot insurance (zero risk, one tag)

Optional, but cheap insurance — tag the current state so you can reset to it instantly if a deploy goes sideways:

```
git -C E:\vocab-trainer tag pre-deploy-2026-05-11
```

The tag stays local. Doesn't push. Doesn't change any files.

### 2.4 Verify what's about to deploy

```
cd E:\vocab-trainer
git status
git diff y/index/js/auth.js
git diff y/student/js/auth.js
git diff y/teacher/js/students.js
git diff firestore.rules
```

You don't need to commit. You just want to eyeball the diffs and make sure they match what's described in section 1.

---

## 3. Quick Deploy — the actual commands

### IMPORTANT — order matters for Phase B security tightening

Firestore rules now require every session doc to carry denormalized
`studentClass`, `studentLevel`, `studentModule` fields for non-admin
teachers to read it. New sessions get them automatically; existing
sessions need a ONE-TIME backfill **BEFORE** deploying the new rules,
otherwise those legacy sessions become invisible to non-admin teachers.

If you've never had non-admin teachers yet, you can skip the backfill
and just deploy — only admin sees the dashboard.

**Backfill first (one-time):**

```
cd E:\vocab-trainer\y
node tools/backfill-session-scope.js
```

(Same `.serviceAccount.json` setup as the demo-accounts script.)

**Then deploy:**

Run from `E:\vocab-trainer` (the project root, not the worktree).

```
firebase deploy --only firestore:rules,hosting
```

### First non-admin teacher login may prompt for an index

The teacher dashboard now uses scoped Firestore queries like
`.where('studentClass', 'in', [...]).where('studentLevel', '==', 'B1').orderBy('createdAt', 'desc')`.

Firestore requires composite indexes for these combinations. The first
time a teacher with that exact assignment loads the dashboard, Firebase
logs a permission-style error in the browser console containing a
clickable link — open it, click "Create index", wait 1–5 minutes for
the index to build, refresh the page. Subsequent loads are instant.

You only need to do this once per distinct combination of teacher
assignment fields. After a few real teachers have logged in, all the
common indexes will exist.

Expected output (truncated):

```
=== Deploying to 'empower-vocabulary-practice'...
i  deploying firestore, hosting
✔  firestore: released rules to cloud.firestore
i  hosting[empower-vocabulary-practice]: beginning deploy...
i  hosting[empower-vocabulary-practice]: found N files in y
✔  hosting[empower-vocabulary-practice]: file upload complete
✔  Deploy complete!

Hosting URL: https://empower-vocabulary-practice.web.app
```

If `firebase` is not recognized:

```
npm install -g firebase-tools
firebase login
```

…then re-run the deploy.

---

## 4a. Migrate existing accounts (CRITICAL — before users notice)

⚠️ This step is mandatory if you have any users (students or teachers)
who registered before today's deploy. Without it, those users will be
ping-ponged back to the login page because the new email-verification
gate finds their `emailVerified` flag is `false` (their old registrations
never went through verification).

Same service-account setup as the demo-accounts script (step 4b below).
Once set up, run:

```
cd E:\vocab-trainer\y
node tools/migrate-verify-existing-users.js
```

Output will list every account it marked verified. Re-running is safe.

Brand-new accounts that register AFTER today's deploy are NOT auto-verified —
they go through the normal verification email flow as designed. The cutoff
date inside the script controls this; edit it if you need to push the cutoff
later.

## 4b. Create the demo accounts (one-time after first deploy)

Demo accounts are pre-created via the admin SDK script. Do this once after
the first deploy.

1. **Firebase Console** → Project settings → Service accounts → click
   **Generate new private key**.
2. Save the downloaded JSON as `E:\vocab-trainer\y\tools\.serviceAccount.json`.
   **Never share or commit it.** Already in `.gitignore`.
3. In a terminal:
   ```
   cd E:\vocab-trainer\y
   npm install firebase-admin
   node tools/create-demo-accounts.js
   ```
4. The script creates three Firebase Auth accounts (`demo1@stu.fsm.edu.tr`,
   `demo2`, `demo3`) with email pre-verified, and three matching Firestore
   user docs with `role: 'demo'`.

Re-running the script is safe — existing accounts are skipped.

The credentials to share with visitors are in **DEMO-CREDENTIALS.pdf** in
the project root.

## 5. Smoke test (5 minutes, after deploy + demo creation)

Open the hosting URL in an **incognito / private window** so you don't have cached auth. Run these in order:

| # | Action | Expected |
|---|---|---|
| 1 | Sign in with `demo1@stu.fsm.edu.tr` + `EmpowerDemo2025!` | Orange banner appears. You land on student dashboard. |
| 2 | F5 to refresh | Banner stays, still signed in. |
| 3 | Try to complete a Reading or Listening exam and submit | Submit either short-circuits or fails — confirm in console there are no save-related errors. |
| 4 | Logout | Back to login page. |
| 5 | Click **Register**, fill the form with `yourname+test1@fsm.edu.tr`, password ≥8 chars | Blue "📧 Verify your email" panel shows. You are NOT taken to the dashboard. |
| 6 | Check email inbox → click verify link | "Email verified" page from Firebase opens. |
| 7 | Return to the app, click **Sign In**, enter `yourname+test1@fsm.edu.tr` + password | Lands on student dashboard (NOT teacher dashboard — every new account starts as student). |
| 8 | Logout. Sign in as admin (`akabiriaslifar@fsm.edu.tr`) | Lands on teacher dashboard. |
| 9 | Teacher dashboard → **Students tab** → find `yourname+test1@fsm.edu.tr` row | Row has ✏️, 👑, 🗑️ buttons (because email is `@fsm.edu.tr`, eligible). |
| 10 | Click 👑 → confirm | "Promoted to Teacher" success toast. Row disappears from Students. |
| 11 | Click **Admin** tab → find that email in the Teachers list | Yes, they're there. |
| 12 | Click the row → click **"👤 Demote to Student"** | They go back. Cleans up your test. |

If all 11 steps pass, the deploy is good.

### Negative test — proves the security works

| # | Action | Expected |
|---|---|---|
| 12 | Register a test student with `yourname+test2@stu.fsm.edu.tr`. Verify and sign in once. Sign out. | Account exists as student. |
| 13 | Sign in as admin. Open Students tab. Find that `+test2` row. | Row has ONLY ✏️ and 🗑️ buttons — **no 👑** (student domain, not eligible). |
| 14 | Open browser console as admin and run `firebase.firestore().collection('users').doc('<the-test2-uid>').update({role:'teacher'})` | Promise rejects with `Missing or insufficient permissions.` |
| 15 | Sign in as the `+test2` student. Open browser console. Run `firebase.firestore().collection('users').doc(firebase.auth().currentUser.uid).update({role:'teacher'})` | Rejected. |
| 16 | While signed in as the test student, navigate directly to `<host>/teacher-dashboard.html` | "Access Denied" screen shows. Console shows permission errors on the Firestore queries. |
| 17 | Sign out. Sign in as **demo** (👀 button). Try to submit anything that requires writing (e.g. complete a Reading exam) | Submit fails. Banner remains visible. |

If any of these PASS where they should FAIL (e.g., the role update goes through), STOP and tell me which step.

---

## 6. After the smoke test

### 5.1 Promote your real teachers (if needed)

Existing teacher accounts whose user doc already has `role: 'teacher'` keep working without any action from you.

**Only** if you have someone who's supposed to be a teacher but currently has `role: 'student'`:

1. Have them sign in once (you need them to exist in the Students list).
2. Teacher dashboard → Students → find them → click 👑 → confirm.
3. Tell them to log out and back in.

### 5.2 Legacy `@stu.fsm.edu.tr` teachers (if any)

If somehow a `@stu.fsm.edu.tr` account has `role: 'teacher'` (from before this deploy), the new rules don't auto-demote them. Demote them manually from the Admin tab for consistency:

1. Teacher dashboard → **Admin** tab → find the teacher → expand the row → **"👤 Demote to Student"**.

### 5.3 Update your teacher communication

Section B of [WALKTHROUGH.md](WALKTHROUGH.md) has copy-paste-ready text to email your teachers. Tell them:

- New students need to verify their email after registering.
- The "Try a Demo" button is for visitors, not for them or their students.
- If a student says "I can't log in", 99% of the time it's the verification step they missed.

### 5.4 Update your student onboarding

Section C of [WALKTHROUGH.md](WALKTHROUGH.md) has the student-facing instructions. Pin it somewhere they'll see.

---

## 7. Ongoing maintenance

### 6.1 Monthly — clean up expired demo accounts

Two options.

**Option A — Manual (zero setup, takes 2 minutes):**

1. Firebase Console → Firestore → `users` collection.
2. Filter: `role == "demo"` AND `expiresAt < today's date`.
3. Select all → delete.
4. Firebase Console → Authentication → Users → filter "Anonymous" → delete old ones.

**Option B — Script (one-time setup, then 1 command):**

One-time setup:

1. Firebase Console → Project settings → Service accounts → **Generate new private key**.
2. Save the downloaded JSON as `E:\vocab-trainer\y\tools\.serviceAccount.json`. **Never share or commit it.** Already in `.gitignore`.
3. `cd E:\vocab-trainer\y && npm install firebase-admin`.

Monthly run:

```
cd E:\vocab-trainer\y
node tools/cleanup-demo-accounts.js
```

### 6.2 Anytime — promote / demote teachers

- Promote: Teacher dashboard → Students → 👑.
- Demote: Teacher dashboard → Admin → click teacher row → "👤 Demote to Student".

### 6.3 Anytime — review who's a teacher

Teacher dashboard → **Admin** tab. The Teachers list is everyone with `role: 'teacher'`. The Pending list is whitelisted emails who haven't registered yet.

---

## 8. Rollback plan

If anything is wrong and you need to undo:

### Files (instant, no commit)

```
cd E:\vocab-trainer
git checkout -- firestore.rules y/index.html y/index/js/auth.js y/student/js/auth.js y/teacher/js/students.js .gitignore WALKTHROUGH.md
```

That restores the four touched files to whatever the working tree was before today. Then re-deploy:

```
firebase deploy --only firestore:rules,hosting
```

The deployed Firebase state goes back to what it was. New files (`TESTING.md`, `WALKTHROUGH.md` is reverted, `DEPLOY.md`, `build_pdfs.py`, `WALKTHROUGH.pdf`, `DEMO-ACCOUNT.pdf`, `y/tools/cleanup-demo-accounts.js`) stay on disk but are harmless.

### Rules only

If only the rules are problematic:

```
firebase deploy --only firestore:rules
```

…after editing `firestore.rules` back to a working version. Or paste the old rules into the Firebase Console rules editor directly.

### Hosting only

```
firebase hosting:rollback
```

…in the Firebase Hosting section of the Console → previous release → "Roll back".

---

## 9. Things to know going forward

- **Two domain rule.** `@fsm.edu.tr` = staff (promotable). `@stu.fsm.edu.tr` = students (permanently locked). The rules enforce this, the UI mirrors it.
- **Every new account starts as student.** This is deliberate, not a bug. Teacher access is a manual step.
- **Demo users are isolated.** They appear in classroom rosters as "Demo User #XXXX" and can't write any persistent data. They're billed against Firebase Auth's anonymous quota — enable App Check if you start getting hit by bots.
- **PDFs are stale.** The two PDFs in the root were generated before today's role-architecture changes and the 👑 button. If you ever want them updated, run `python build_pdfs.py` after I update `build_pdfs.py` to match the new flow — say the word.

---

## 10. If you get stuck

Open the Firebase Console and check three things in order:

1. **Authentication → Users.** Is the user there? Is `emailVerified` true?
2. **Firestore → users → {uid}.** What does the `role` field say?
3. **Console (F12) on the failing page.** What does the error say? Most failures are permission-denied; the error tells you which rule rejected.

Send me the error message + which step in this doc you were on, and I'll debug.
