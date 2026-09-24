# 2026-09-02 - the ownerless-assignment hole, closed in both layers

## What it was

`firestore.rules`:

```
function _ownsAssignment() {
  return isAdmin() ||
    !('teacherId' in resource.data) ||          <-- the hole
    resource.data.teacherId == request.auth.uid;
}
```

An assignment with **no `teacherId`** could be edited or deleted by **any**
teacher, not just its author. The client mirrored it with
`const isLegacy = !ownerId`.

That was tolerable when a delete removed one document. It is not now that an
admin delete also removes every submission and progress record attached to it.

## Checked before closing

Production has **0 ownerless assignments** (2 total, both owned). So nothing is
stranded. If one ever appears, admin can still fix or remove it, and
`y/tools/backfill-assignment-owner.js` exists to stamp an owner.

## Closed in both layers

**Rules:** ownership is now required, admin still bypasses.

**Client:** `canMutate = amAdmin || isOwner`. The stale comment block that
described case 3 as "grandfathered until the backfill stamps an owner" was
rewritten to say ADMIN ONLY.

Both together, because the client alone is theatre and the rules alone leave
buttons that fail.

## Verified against the real rules engine, before AND after

Not by reading them: seeded real users and assignments in the emulator and
attempted deletes as signed-in identities.

| | old rule | new rule |
| --- | --- | --- |
| **teacher deletes an ownerless assignment** | **allowed (200)** | **denied (403)** |
| admin deletes an ownerless assignment | 200 | 200 |
| teacher deletes another teacher's | 403 | 403 |
| owner deletes their own | 200 | 200 |
| admin deletes anyone's | 200 | 200 |

The before/after was produced by temporarily restoring the old clause, running
the suite, and restoring the file - so the one line that changed is provably
the line that closed it.

**One honest caveat.** The "a teacher cannot EDIT an ownerless assignment"
check passes under BOTH rules, so it does not independently prove the update
path. `allow update` also requires `_validAssignmentTarget()`, and the test
patch sends only `title`, so it is refused on target validation regardless of
ownership. Update is denied either way; ownership is not what this particular
case demonstrates.

## Two harness problems, both mine

**The emulator's children outlive the wrapper.** Stopping the background task
left node and java holding ports 4000/4400/8080, so the next start died with
"Could not start Emulator UI, port taken". Killed by PID and restarted.

**Accounts persist between emulator runs**, so the second run failed with
`EMAIL_EXISTS` - which looks exactly like a rules failure and is not. `signIn`
falls back to `signInWithPassword` now.

## The same pattern lives in six other rules, untouched

`_ownsClassroomSession` (631), `_ownsHeistSession` (744), `_ownsTrustSession`
(814), `_ownsMiniSession` (913), `_ownsReadingSession` (999),
`_ownsListeningSession` (1051) all grandfather a missing owner field the same
way.

Not changed. Those are live game sessions rather than assignments, deleting one
destroys far less, and widening a security change the week of an event is not
worth it. Worth a look afterwards.

## Ritual

- `node --check` across every `.js` including functions - 0 failures
- rules braces 140/140, and the emulator compiled them (it refuses to start on
  a syntax error)
- four executed suites: all pass
- gates: seventeen, all PASS
- em-dash scan: **0 in anything I wrote**. `firestore.rules` carries 40
  pre-existing ones in comments, none from this change; cleaning them would add
  diff noise to a security file right before a deploy, so they are flagged
  rather than touched.
- bump: teacher-assignments.js, CACHE_VERSION -> **v393**; `--check` OK

## Needs deploying

This one is not just hosting: **`firestore.rules` must be deployed** or the
hole stays open on the server.

```
firebase deploy --only firestore:rules
```
