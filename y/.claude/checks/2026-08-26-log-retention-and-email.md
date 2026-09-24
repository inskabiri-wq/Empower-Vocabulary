# 2026-08-26 - log retention (export then delete), and what the app can email

## 1. Can anything be emailed from the app? YES, and it is already built

`functions/index.js` already carries **SendGrid**, and a scheduled job
`sendWritingReminders` that runs **every 60 minutes** (Europe/Istanbul) and
mails students whose writing submissions have been waiting.

So the plumbing exists. Anything can be emailed - a weekly report, a log export,
an alert - by adding a function beside it.

### But it has never sent a single email

```
firebase functions:config:get  ->  {}
```

**No SendGrid key is configured.** The job runs every hour, finds no key, logs
`sendgrid.key not configured - skipping reminder pass`, and returns. It has been
doing that silently since it was written.

To switch it on:

```bash
firebase functions:config:set sendgrid.key="SG.xxxx" sender.email="noreply@fsm.edu.tr" sender.name="Lingualab"
firebase deploy --only functions:sendWritingReminders
```

SendGrid's free tier is 100 emails/day.

**One thing to know before relying on it:** `functions.config()` is deprecated
and the Runtime Config service **shuts down in March 2027**. Deploys that use it
will fail after that. Migrating to the params package is a small job, but it has
a deadline.

## 2. Retention: export, then delete

Asked whether logs can be downloaded and then deleted after a retention window.
They can now, and the order is enforced rather than suggested. Default: **6
months**.

**Export already existed** - "Export to Excel" on the tab, respecting the
current filters, capped at 10,000 rows. That half was done.

**Deleting is new**, on the same tab: a months box (default **6**), a *Check
what is older* button and a *Delete older logs* button.

### The order is enforced, because this cannot be undone

1. **Count first.** Check reports how many entries predate the cutoff and the
   exact date, before anything is offered.
2. **Export first.** Delete is REFUSED until "Export to Excel" has been used in
   this browser session. Download-then-delete is the whole request, and a tool
   that lets you skip the download at 3pm on a Friday is a trap.
3. **Type the number back.** The months value has to be confirmed, so a
   mis-click cannot start it.
4. **Capped batches.** 400 per Firestore batch, 2000 per run, and the result
   reports how many went and **how many remain** rather than implying it
   finished.
5. **Nothing is scheduled.** No automatic deletion exists. It only runs when a
   person presses the button.

Rules already allowed it: `activityLogs` is `allow update, delete: if isAdmin()`.

### Guards tested, and the important assertion is that a refusal deletes NOTHING

`tools/retention-guard-check.js` counts the actual delete calls, because a guard
that warns *and* deletes is worse than no guard.

| case | result |
| --- | --- |
| a non-admin | refused, **0 deleted** |
| no export this session | refused, **0 deleted** |
| exported, but months not typed back | refused, **0 deleted** |
| wrong number typed | refused, **0 deleted** |
| nothing old enough | succeeds, deletes nothing |
| the allowed path | deletes 800 of 5000, stops at the per-run cap |
| and then | reports **4200 remaining**, not "done" |

**I have not run it against your data.** Nothing was deleted anywhere.

### The window: 6 months

Six months, not sixty. It is the easier number to defend: KVKK expects a
retention period justified by its purpose rather than chosen for convenience,
and an audit log of what individual students did is hard to argue for over
years. Six months covers a full module and the term after it.

The box is editable and the mechanism does not care what you type. The number
itself still belongs in the retention line of the Terms draft sitting with the
KVKK office, so the document and the app agree.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- `activity-logs-tab.html` `<div>` balance 30/30
- gates: **thirteen**, all PASS (retention-guard-check is new)
- bump: activity-admin.js v6, CACHE_VERSION -> **v366**; `--check` OK
