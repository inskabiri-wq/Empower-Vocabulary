# 2026-09-02 - a deleted assignment kept its essays in the band

Reported: deleted an assignment, the band still shows it. Two separate causes,
plus a third thing that is not a display bug at all.

## What production actually holds

```
assignments          : 2
writingSubmissions   : 6
assignmentCompletions: 17
```

**All 6 writing submissions point at an assignment that no longer exists.** The
one the band was counting - "Alireza / Hi / submitted" - is one of them. So the
band was correct about its own data and the data was stale.

**16 of the 17 assignmentCompletions are orphaned too.**

## Cause 1: deleting an assignment deletes only the assignment

```js
await db.collection('assignments').doc(assignmentId).delete();
```

That is the whole delete. Its `writingSubmissions` and `assignmentCompletions`
are left behind, pointing at an id nothing resolves.

## Cause 2: the band never refreshed on an assignment change

It was wired to the `writingSubmissions` listener only. Deleting an assignment
fires the **assignments** listener, which re-rendered the assignments list and
nothing else - so even after a correct delete the band would have kept its old
contents until a submission happened to change.

## Fixed (display, non-destructive)

**Orphans are not counted.** A submission whose assignment no longer exists is
work a teacher can never clear - there is nothing left to grade against - so
counting it makes the to-do list permanently uncloseable.

Two guards on that filter, both deliberate:

- it only applies **once assignments have actually loaded**. Before that
  snapshot arrives the map is empty and everything would look orphaned, which
  would hide real work.
- a submission with **no `assignmentId` at all** is kept. We cannot prove it is
  dead, and silently dropping student work needs better evidence than a missing
  field.

For a non-admin teacher `allAssignments` is already scoped to their own, so
this also drops other teachers' submissions - correct here, since the band is
that teacher's marking queue rather than everyone's.

**The band now refreshes on the assignments snapshot too**, so a delete updates
it live.

### Executed

| | |
| --- | --- |
| a submission for a DELETED assignment is not counted | PASS |
| the live one survives | PASS |
| before assignments load, nothing is filtered | PASS |
| all orphaned means an empty band, not a stuck one | PASS |
| a submission with no assignmentId is kept | PASS |

The twenty earlier band checks still pass unchanged.

## NOT fixed, and it needs a decision

**The orphaned data is still in Firestore.** Hiding it from one panel does not
remove it, and it will keep accumulating every time an assignment is deleted:

- 6 orphaned writing submissions (student work, including graded ones with
  teacher comments on them)
- 16 orphaned completions

Three options, none of which I have taken:

1. **Delete submissions with their assignment.** Correct going forward, and it
   destroys student work and teacher marking permanently. Needs a confirmation
   dialog that says exactly how many.
2. **Archive instead of delete** - flag the assignment `deleted: true` and keep
   everything. Nothing is lost; queries need a filter.
3. **Leave it, sweep periodically** with a tool like the retention prune.

This touches production data, so it is his call, not mine. The counts above are
what a cleanup would affect.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: seventeen, all PASS
- bump: activity.js, teacher-assignments.js, CACHE_VERSION -> **v390**
- every query in this investigation was read-only
