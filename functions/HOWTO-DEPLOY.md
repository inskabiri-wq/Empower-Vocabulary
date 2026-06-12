# Deploying the writing-reminder Cloud Function

Status: **STAGED, NOT DEPLOYED.** The code in `functions/index.js` is
complete and tested logically, but Cloud Functions require the Firebase
**Blaze (pay-as-you-go)** plan to deploy.

The `firebase.json` `functions` block was intentionally **removed** so
plain `firebase deploy` (without `--only`) doesn't try to push them
and fail. When you're ready, follow these steps in order.

---

## Step 1 — Upgrade to Blaze

Go to https://console.firebase.google.com/project/empower-vocabulary-practice/usage/details
Click "Modify plan" → "Blaze". Add a billing card. Set a **budget alert** at
say $5/month so you get an email if anything runs unexpectedly hot.

**Expected cost for this function only:** ~$0.30/month at school scale
(720 hourly invocations × $0.0000004 each). SendGrid free tier covers the
emails themselves.

## Step 2 — Get a SendGrid API key

1. Create a free SendGrid account at https://signup.sendgrid.com (free
   tier = 100 emails/day, well above realistic reminder volume)
2. Settings → API Keys → Create API Key → "Restricted Access" → only
   tick "Mail Send" → Full Access
3. Copy the key (starts with `SG.…`). You can only see it once.

## Step 3 — Restore the `functions` block in `firebase.json`

Replace the `"_functions_disabled_until_blaze": "…"` line with:

```json
"functions": [
  {
    "source": "functions",
    "codebase": "default",
    "ignore": [
      "node_modules",
      ".git",
      "firebase-debug.log",
      "firebase-debug.*.log"
    ],
    "predeploy": []
  }
],
```

## Step 4 — Configure secrets

```bash
firebase functions:config:set \
  sendgrid.key="SG.your-key-here" \
  sender.email="noreply@yourdomain.tld" \
  sender.name="Empower Vocabulary"
```

(The `sender.email` should be an address you've verified in SendGrid's
Sender Authentication. The cheapest path is "Single Sender Verification"
on any email you control.)

## Step 5 — Install dependencies + deploy

```bash
cd functions
npm install
cd ..
firebase deploy --only functions,firestore:indexes
```

The `firestore:indexes` deploy ensures the composite index `status ASC
+ submittedAt ASC` on `writingSubmissions` is in place — the function
needs it.

## Step 6 — Verify

```bash
firebase functions:log --only sendWritingReminders
```

Wait ~1 hour for the first scheduled run, then check the logs. You
should see a line like:

```
writing-reminders: sent=0 skipped=0 errors=0
```

(or larger numbers if essays are already past the 12h mark).

---

## What it does

Every hour, the function queries `writingSubmissions` for docs where:
- `status === 'submitted'` (not yet graded or returned)
- `submittedAt < now - 12 hours`
- `reminderEmailSent !== true`

For each match, it looks up the teacher (via `assignments.teacherEmail`
or by `users[teacherId].email`), sends one HTML reminder email via
SendGrid, then stamps `reminderEmailSent: true` on the submission doc
so it never sends again.

If you want a different cadence (e.g. 24h instead of 12h, or repeat at
48h), edit the `twelveHoursAgo` calculation in `index.js`.

---

## Reverting back to staged state

If you ever want to remove the function entirely:

```bash
firebase functions:delete sendWritingReminders
```

Then remove the `functions` block from `firebase.json` again.
