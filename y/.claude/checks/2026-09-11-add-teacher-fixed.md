# 2026-09-11 - Add Teacher fixed, marked-this-week fixed, retention export held back

Three changes Alireza asked for after the diagnosis in
`2026-09-11-teacher-whitelist-and-scoping-decision.md`.

## 1. "Add Teacher" now does what it says

The whitelist was decorative. `settings/teacherEmails` was written by Admin >
Teachers and read by the Google sign-in, but the role write it produced was
refused by the rules, and the refusal surfaced as "Google sign-in failed:
Missing or insufficient permissions".

### A SECOND live bug, found while fixing the first

`signInWithGoogle` wrote `role` on EVERY sign-in - `'teacher'` when whitelisted,
`'student'` otherwise. That second write lands on an EXISTING TEACHER's document
as a demotion, which `roleUnchanged()` refuses.

**So a teacher promoted with the crown button could not sign in with Google at
all.** That is exactly the account Alireza had just created by hand, and it
would have failed the next time that teacher used Google. Nothing in the UI
said why.

A third path, `checkUserRoleAndRedirect` at `main.js:338`, has the same defect
but is DEAD CODE: only `index/js/auth.js` calls it and `index.html` does not
load that file. Left alone deliberately - removing dead code is separate work.

### The fix, both halves

**Rules.** New `isWhitelistedTeacher()` helper, then:

- `users/create` also accepts `role == 'teacher'` when the caller is on the
  whitelist.
- a new narrow `users/update` branch allows student -> teacher for a
  whitelisted owner, and nothing else about the document may move.

Not self-granting: `settings/teacherEmails` is admin-only writable, so the
authority is a document the user cannot touch. Same shape as the existing
`_granted()`. The domain must ALSO be teacher-eligible, so two independent
admin-controlled documents have to agree.

**Client.** `main.js` now READS the role from the document and writes it only
when it is genuinely changing and the rules permit that change. The
password-login path got the whitelist promotion too, because Admin's message
promises "the next time they sign in" and only Google ever checked.

**UI.** The success message now describes what actually happens.

### Proof

`y/tools/teacher-whitelist-check.js`, extended from 7 checks to **14**:

    PATH 1  whitelisted, no user doc yet
      ok  a WHITELISTED address may create itself as a teacher (200)
      ok  the same address may still create itself as a student (200)
    PATH 2  whitelisted AFTER registering as a student
      ok  a whitelisted student may promote itself to teacher (200)
    NEGATIVES
      ok  a NON-whitelisted staff address cannot create itself as a teacher (403)
      ok  a NON-whitelisted student cannot promote itself (403)
      ok  a @stu address ON the whitelist still cannot become a teacher (403)
      ok  a whitelisted teacher cannot self-assign role:"demo" (403)
      ok  the promotion branch is one-way - cannot self-demote (403)
    PATH 3  the crown button still works
      ok  admin promotion to teacher is ALLOWED (200)
      ok  even admin cannot promote a @stu address (403)
    SOURCE ASSERTIONS
      ok  signInWithGoogle no longer writes role:'student'
      ok  signInWithGoogle writes the role only when creating a fresh document
      ok  index.html does not load index/js/auth.js
      ok  the password-login path promotes whitelisted teachers as well

**The break proof.** Removed the teacher-eligible domain guard from
`isWhitelistedTeacher`, pushed, re-ran: exactly one failure, correctly named -
`whitelisted @stu create as teacher returned 200, expected 403`. Restored and
confirmed byte-identical with `diff -q`, back to 14/14.

New utility `y/tools/push-rules.js` loads firestore.rules into the running
emulator and READS THE RULESET BACK, comparing byte counts. The emulator reads
rules once at startup, so editing them mid-session otherwise leaves every check
testing the old ruleset - which has previously produced a "the fix works" run
that proved nothing.

## 2. "N marked in the last 7 days" was counting the whole school

`teacher/js/activity.js:58` returned before the ownership guard at line 81, so
for a non-admin teacher `done` counted every graded essay in the project while
`count`, `overdue`, `orphaned` and the list beside it were correctly limited to
their own assignments.

Fixed by repeating the guard inside the graded branch rather than hoisting it:
hoisting would make `orphaned` count finished essays, and that counter is
specifically the pile a teacher can never clear. Admin is unaffected -
`allAssignments` is the full list for an admin, so nothing is skipped.

## 3. pruneRetention held back from redeploy

Alireza deleted the deployed function. `functions/index.js` still exported it,
so the next `firebase deploy --only functions` for any unrelated reason would
have silently recreated it. The export is renamed to
`_pruneRetention_notExported`; the implementation is kept intact and
`y/tools/retention-check.js` still exercises it via `./retention.js`.

Remaining exports verified against the deployed list: analyzeWriting,
createDemoAccount, deleteDemoAccount, listDemoAccounts, rosterImport,
sendWritingReminders. Exactly the live set minus pruneRetention.

## Ritual

- `node --check` clean on all four JS files, 0 em dashes in every added line
  (firestore.rules' 40 are pre-existing and untouched)
- `bump.js`: main.js v4, activity.js v16, admin.js v2, CACHE_VERSION v414 -> **v415**;
  `--check` reports no drift
- **28 gates pass, 0 fail, 1 production skip**
- AI Quiz re-verified explicitly after the rules change: **19/19**
- games security re-verified: **138/138**
- all emulator test data deleted by the checks themselves

## Deploying - BOTH are needed, and both are Alireza's

    firebase deploy --only firestore:rules      <- without this the Add Teacher fix does nothing
    firebase deploy --only hosting              <- main.js / activity.js / admin.js + v415

Order does not matter much, but rules-first is safer: the client tolerates a
refused promotion and carries on as a student, so rules-then-hosting never has
a broken window.
