# 2026-09-11 - the Add Teacher bug, and a decision NOT to scope the listeners

## 1. "Add Teacher" has never worked. Reproduced.

Alireza added a teacher email in Admin > Teachers, the teacher tried to sign in
with Google, and was told they had no permission to log in. He deleted them,
they signed in as a student, he promoted them with the crown button, and that
worked.

New gate: `y/tools/teacher-whitelist-check.js`, **7 checks**, all against the
emulator with real ID tokens.

### What the button promises

`teacher/js/admin.js:717` appends the email to `settings/teacherEmails` and says:

    "Email added to whitelist. They will get teacher access on registration."

### What the rules allow

`firestore.rules:183`

    allow create: if isOwner(userId) && emailIsFsm() &&
      request.resource.data.role == 'student';

A user may only ever create themselves as a **student**. The live Google handler
(`index/js/main.js:601`; index.html loads main.js, NOT auth.js) reads the
whitelist, correctly decides `role === 'teacher'`, and then writes that role -
which the rules reject. The rejection is swallowed by the outer catch and
surfaces as "Google sign-in failed: Missing or insufficient permissions".

**The sign-in succeeded. The role write was refused. The error message does not
distinguish them**, which is why it reads as "you cannot log in".

### The three paths, demonstrated

    PATH 1 - whitelisted, no user doc yet
      ok  create with role:"teacher" is DENIED (403)          <- the login failure
      ok  the SAME create with role:"student" succeeds (200)  <- the role is what is refused

    PATH 2 - whitelisted and already a student
      ok  self-update to role:"teacher" is DENIED (403)  - roleUnchanged() blocks it

    PATH 3 - the crown button
      ok  admin promotion to teacher is ALLOWED (200)
      ok  even admin cannot promote a @stu address (403)

Plus two source assertions, so the gate fails if the shape changes:
`auth.js` still states it never recomputes role from the whitelist, and
`index.html` still does not load `auth.js`.

**"Pending approval" is not a real state.** `admin.js:130` computes pending as
"whitelist entries that have not registered yet". Nothing approves them, and
nothing reads the whitelist to grant anything. The crown button is the only
thing that has ever granted teacher.

The rules are right; the UI is wrong. A client that can assert its own role is
privilege escalation. Fix options are recorded in the conversation: tell the
truth in the UI (hosting only), or make the whitelist authoritative in the
rules the way `_granted()` already is (rules deploy). Not started - awaiting a
decision.

## 2. Listener scoping: analysed, and deliberately NOT shipped

Five investigators mapped the constraints, three competing designs were
authored, and a judge ranked them. **Verdict: do nothing now.**

### Why

The cost premise does not survive contact with the measured data. The
2026-09-10 production profile measured **3 assignmentCompletions and 3
writingSubmissions**, 6 documents per dashboard open, **0.01 USD a month**. The
3.89 USD/month that motivated this work is a projection against a roster that
is not imported (79 user docs against a stated ~400). That is a ~150-line
rewrite of two load-bearing listeners to save under a dollar a year.

And the stated goal - scope the reads WITHOUT changing what the dashboard
displays - turns out to be unachievable. All three designs move two numbers,
because of the bug in section 3.

### What the map established, worth keeping

- `assignmentId` is the ONLY field written on every code path of both
  collections. `assignmentCompletions` carries no class, level, module or
  teacherId at all, so class-based scoping is impossible there without editing
  all three writers plus a backfill.
- The shape needs **no index and no rules change**: `fieldOverrides` is empty,
  so a single-field `in` with no orderBy is served automatically. The rules for
  both collections never reference `resource.data`, so a `.where()` can neither
  break them nor be required by them.
- A live scoped `onSnapshot` with `.where('assignmentId','==',...)` already runs
  in production at `writing-submissions-view.js:151`, which proves the shape.
- Admin must stay unscoped: three admin-only surfaces need a complete map.
- **Scoping has no security value.** Any scoped teacher can drop the filter in
  devtools. It is a cost measure and must never be described as a permissions
  fix.

### The trigger, instead of a date

Revisit when the real roster is imported (users crosses ~200) or any single
teacher passes ~20 assignments. Re-run `y/tools/prod-profile.js` and decide
against measured documents. When it fires, the design to use is an
`assignmentId` `in` scope, chunked in 30s, admin exempt, with a
`failed-precondition` fallback to unscoped so the worst case is "as expensive
as today" rather than "the dashboard renders zero completions".

### Do NOT copy config.js:197

`teacher/js/config.js:197` does `ac.slice(0, 30)`, which TRUNCATES rather than
chunks. Applied to an assignmentId scope it produces exactly the failure this
work was meant to avoid: a map missing documents that looks complete.

## 3. A real bug found on the way: "marked this week" is school-wide

`teacher/js/activity.js:58-64` increments `done` and RETURNS, before the
ownership guard at line 81. That guard is what drops other teachers'
submissions for a non-admin teacher (its own comment at 76-78 says so).

So on the teacher dashboard today, **"N marked in the last 7 days" counts every
graded essay in the whole school**, while `count`, `overdue`, `orphaned` and the
list beside it are correctly limited to that teacher's own assignments. One
number in the band is measuring something different from the rest of it.

Verified by reading the control flow directly, not inferred.

The fix is NOT to move the guard up - a graded essay on a deleted assignment
would then inflate `orphaned`, which is meant to count only waiting work that
can never be cleared. The correct fix is an ownership check inside the graded
branch that does not touch `orphaned`. Not applied: it changes a number a
teacher sees, and there is an event coming. Awaiting a decision.

## Ritual

- `node --check` clean on the new gate, em-dash scan 0
- auto-discovered by `gates.js`: **29 gates** (22 pass, 7 skipped - the
  emulator went down when the session hit its usage limit; the emulator gates
  passed earlier in the same session while it was up)
- all emulator test data deleted by the check itself
- no app file changed by any of this work; nothing to deploy

## Also confirmed this session

- The exam answer leak fix IS live: `rules-live-check.js` reports the active
  ruleset byte-identical to disk (57196 bytes, ruleset 246e8468). An earlier
  standing warning that it still needed deploying was stale.
- Games verified against production, not just the emulator: all 11 live
  classroom pages 200, every shipped game file byte-identical live vs local,
  and the live `aiquiz-teacher.js` carries `shuffleOptions` and
  `AUTO_CLOSE_MAX_PLAYERS = 60`.
- `pruneRetention` is deleted from production. **But `functions/index.js:1116`
  still exports it**, so the next `firebase deploy --only functions` recreates
  it.
