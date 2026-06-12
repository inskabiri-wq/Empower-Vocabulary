# Empower Vocabulary — Walkthroughs

Two audiences:

- **Part A — For you (Alireza, the admin/owner):** how to deploy what changed, plus how to promote a teacher and handle support tickets.
- **Part B — For teachers:** plain-English instructions you can copy-paste into an email or share as a one-pager.
- **Part C — For students:** even simpler. For when a student emails "I can't log in!"

---

# PART A — Admin / owner walkthrough

## A.1. What changed (the short version)

| Area | Before | After |
|---|---|---|
| Email domain | Client-side check only | Enforced in Firestore rules too — bypass-proof |
| Email verification | Not required | Required. Unverified accounts can't sign in. |
| Demo accounts | Didn't exist | New "👀 Try a Demo" button. 7-day anonymous account. No data saved. |
| Teacher promotion | Auto-granted via whitelist on every login (and could be self-granted) | Manual promotion only — admin must update the user doc |
| Classroom answer privacy | Any signed-in user could read any answer | Only the writer or a teacher can read |
| Password minimum | 6 chars | 8 chars |

Files changed:
- `firestore.rules`
- `y/index.html`
- `y/index/js/auth.js`
- `y/student/js/auth.js`

New files:
- `y/tools/cleanup-demo-accounts.js`
- `TESTING.md`
- this file

## A.2. Deployment — do this once

Open a terminal in the project root (`E:\vocab-trainer`) and follow these in order.

### Step 1: Deploy the firestore rules

```bash
firebase deploy --only firestore:rules
```

If the command isn't recognized, install the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
```

You should see: `✔ firestore: released rules to cloud.firestore`.

**If this fails**: read the error. The most common one is a syntax error in `firestore.rules` (a missing brace). Open the Firebase Console → Firestore → Rules tab → paste the new rules into the editor → click "Publish". The editor will highlight the error line if there is one.

### Step 2: Deploy the website

```bash
firebase deploy --only hosting
```

Wait for "✔ Deploy complete!" and the hosting URL.

### Step 3: Smoke test (5 minutes)

Open the hosting URL in an **incognito** window so you don't have cached auth.

1. Click **"👀 Try a Demo"** → you should land on the student dashboard with an orange banner.
2. Refresh the page (F5) → banner stays, you stay signed in.
3. Click logout → back to login page.
4. Now register with a brand-new test email like `youraccount+test1@fsm.edu.tr` → you should see the blue "📧 Verify your email" panel, NOT the dashboard.
5. Check the email inbox → click the verification link → return to the app → sign in → you should now reach the dashboard.

If all five work, the deploy is good. Otherwise see **A.5** below.

### Step 4: Run the full test plan

Open `TESTING.md`. Click through the sections you care about. The whole thing takes ~20 minutes if you go fast.

## A.3. Promoting a teacher (the new flow)

Before: you added their email to the `settings/teacherEmails` whitelist and they were auto-promoted on next login.

After: every new account — staff and student alike — is created with `role: 'student'`. Teacher access is **manual promotion only**. Two important rules:

- Only `@fsm.edu.tr` (staff domain) accounts are eligible to be promoted.
- `@stu.fsm.edu.tr` (student domain) accounts are **permanently locked** to non-teacher roles. Even you (admin) cannot promote them. Both the UI and the Firestore rules reject it.

### Promote a teacher (the new way, no Firestore Console needed)

1. Have the teacher register normally (with their `@fsm.edu.tr` email).
2. Have them verify their email and sign in once. They land on the student dashboard (correct — that's the new default).
3. **In the teacher dashboard, go to the Students tab.**
4. Find their row. You will see a **👑** button next to ✏️ and 🗑️ (only visible to you, the admin, and only for `@fsm.edu.tr` rows — never for `@stu.fsm.edu.tr`).
5. Click 👑 → confirm "Promote to Teacher?" in the dialog.
6. Tell the teacher to **log out and log back in**. They will now land on the teacher dashboard.

### Demote a teacher back to student

1. **Admin tab** in the teacher dashboard.
2. Click the teacher row to expand it.
3. Click **"👤 Demote to Student"** at the bottom.

### Legacy data cleanup (one-time)

If you have any teacher accounts on `@stu.fsm.edu.tr` from before this change, the new rules don't auto-demote them — but they should be demoted for consistency with the new model. Use the Demote button above for each one.

(Optional but tidy: the `settings/teacherEmails` whitelist is still kept in sync by the promote/demote buttons. The app does not read it for promotion anymore — your 👑/👤 actions are the source of truth — but the list is a useful record.)

## A.4. Demo-account housekeeping

Demo accounts auto-expire after 7 days but **don't auto-delete**. The records sit in Firestore until you clean them up. Two options:

### Option 1 — Manual cleanup in the Firebase Console (zero setup)

Once a month:

1. Firebase Console → Firestore → `users`.
2. Filter: `role` `==` `demo` and `expiresAt` `<` (today's date).
3. Select all matching docs → delete.
4. Firebase Console → Authentication → Users → filter "Anonymous" → delete old ones.

### Option 2 — Run the cleanup script (one-time setup, then one command)

One-time setup:

1. In Firebase Console → Project settings → Service accounts → click **"Generate new private key"**.
2. Save the downloaded JSON file as `E:\vocab-trainer\y\tools\.serviceAccount.json`.
3. Open a terminal in `E:\vocab-trainer\y` and run `npm install firebase-admin`.
4. **Never share the JSON file or commit it to git.** It's already gitignored.

After setup, every month run:

```bash
cd E:\vocab-trainer\y
node tools/cleanup-demo-accounts.js
```

You'll see something like:

```
Found 12 expired demo account(s).
  Deleted users/abc...
  Deleted auth uid abc...
  ...
Done.
```

## A.5. If something is broken after deploying

| Symptom | Likely cause | Fix |
|---|---|---|
| Real students can't log in — "Missing or insufficient permissions" | Rules deployed but the existing user docs lack required fields | Manually check the student's `users/{uid}` doc has a `role` field |
| Existing teachers get sent to the student dashboard | Their user doc still says `role: 'student'` (the old auto-promote no longer runs) | Follow **A.3** to promote them |
| Verification email never arrives | Firebase email throttled, or wrong sender domain | Firebase Console → Authentication → Templates → check the "Email verification" template; resend |
| Demo button does nothing | Anonymous auth not enabled | Firebase Console → Authentication → Sign-in method → enable **Anonymous** |
| CSP-related errors in console | Not configured by these changes — only relevant if you later add CSP headers | Ignore for now |

If you need to roll back: re-deploy the previous rules file from git history (`git log firestore.rules`), and roll back the four HTML/JS files the same way. Frontend rollback is instant (re-run `firebase deploy --only hosting`).

---

# PART B — For teachers (copy-paste-ready)

> Subject: How to use Empower Vocabulary
>
> Hi everyone,
>
> The Empower Vocabulary app has some changes. Read this once — it should answer most questions.
>
> ## 1. Signing in
>
> Go to the app. Click **"Sign In"**. Use your `@fsm.edu.tr` email.
>
> **If this is your first time logging in after the changes:** you might be sent to the student dashboard by mistake. That's because every account starts as a student. Tell me (Alireza) once, and I'll promote your account to teacher. Then log out and log back in — you'll land on the teacher dashboard.
>
> ## 2. New students registering
>
> When a student registers:
> 1. They enter their `@stu.fsm.edu.tr` email.
> 2. The app sends them a **verification email**.
> 3. They have to click the link in that email.
> 4. **Then** they can sign in.
>
> If a student says **"I registered but it won't let me log in"** — 99% of the time, they didn't click the verification link. Tell them:
> - Check inbox AND spam folder
> - The email comes from `noreply@empower-vocabulary-practice.firebaseapp.com`
> - On the login page, after a failed sign-in, click **"Resend email"** and enter your password
>
> ## 3. "Try a Demo" button
>
> Visitors can click **"👀 Try a Demo"** to use the app for 7 days without an FSM email. They see an orange banner saying "Demo mode — your progress isn't saved." Their work is **not saved** and they do **not** show up in your student list. This is for prospective students, parents, or anyone curious.
>
> ## 4. Classroom sessions
>
> Same as before. Demo users CAN join your classroom and appear in the roster, but their submissions are ignored. You don't need to do anything special — just be aware that a "Demo User #1234" appearing in your roster is not a real student.
>
> ## 5. Things you cannot do anymore (security tightening)
>
> - You can **no longer read other students' answers** in classroom sessions unless you're a teacher (you are, so this doesn't affect you, but it stops cheating).
>
> ## 6. If something feels wrong
>
> Email me: akabiriaslifar@fsm.edu.tr
> Don't try to "fix" it yourself in the Firebase Console. The rules are strict on purpose. Tell me what you tried to do and what you saw.

---

# PART C — For students (also copy-paste-ready)

> Subject: How to use Empower Vocabulary
>
> ## Step 1: Register
>
> Go to the app. Click the **"Register"** tab. Use your `@stu.fsm.edu.tr` email. Fill in your name, class, module, and academic year. Click **"Create Account"**.
>
> ## Step 2: Check your email
>
> You will receive an email from `noreply@empower-vocabulary-practice.firebaseapp.com`. **Click the link in it.** This proves the email is yours.
>
> If you don't see the email after 1 minute, **check your spam folder**.
>
> ## Step 3: Sign in
>
> Go back to the app. Click **"Sign In"**. Enter your email and password. You will land on your dashboard.
>
> ## Common problems
>
> **"It says 'Please verify your email' but I clicked the link!"** → Click the link in the email a second time. Then go back to the app and sign in again. Sometimes the first click doesn't refresh the app.
>
> **"I never got the verification email."** → On the login page, type your email and password, then click **"Resend email"**. Wait 1 minute, then check inbox AND spam.
>
> **"It says 'Only FSM email addresses can register'."** → You must use `@fsm.edu.tr` or `@stu.fsm.edu.tr`. Personal gmail, hotmail, etc. don't work.
>
> **"I want to try the app before I register."** → Click **"👀 Try a Demo"** on the login page. It works for 7 days. Your progress isn't saved, but you can see what the app does.
