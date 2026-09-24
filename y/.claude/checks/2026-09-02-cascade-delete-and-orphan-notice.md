# 2026-09-02 - deleting an assignment now takes its work with it, and orphans are named

Two changes: the delete cascades behind two confirmations, and submissions
whose assignment is gone are reported rather than quietly dropped.

## 1. Cascade delete, asked twice

The old delete was one line and one dialog:

```js
await db.collection('assignments').doc(assignmentId).delete();
```

which is how every writing submission in the live project ended up orphaned.

Now it counts first, then asks twice with the real numbers:

> **Delete Assignment?**
> "Opinion Essay" has 2 student submissions and 1 progress record attached.
> Deleting the assignment deletes those too.          [ Continue ]

> **This cannot be undone**
> 1 of these have already been graded and carry your comments. This
> permanently deletes the students' work as well as the assignment. It cannot
> be undone and there is no backup. Delete anyway?
> [ Delete "Opinion Essay" and 3 records ]

Four decisions inside that:

**Counted before asking.** Both dialogs state real numbers instead of a vague
warning, and the second one names how many are already **graded** - those are
the ones carrying teacher comments, and they are what makes this
unrecoverable.

**A failed count refuses to delete.** If the count query throws, nothing is
deleted and no confirmation even opens. Better to stop than to destroy an
unknown quantity of work.

**Children are deleted BEFORE the parent.** If the cascade fails half way the
assignment still exists, so the remaining work is still reachable. Deleting the
parent first and then failing is precisely what creates orphans.

**Batched at 400.** Firestore caps a batch at 500; 400 leaves headroom.

An assignment with nothing attached still asks only once - a second scary
dialog for an empty assignment trains people to click through both.

## 2. Orphans are named, not hidden

The previous change stopped counting orphaned submissions, which was right for
the queue and wrong as an answer: silently dropping student work is how you
stop trusting a number. The band now says so, in amber:

> **2** submissions belong to a deleted assignment, so they are not counted
> above. There is nothing left to grade them against.

It appears alongside a real queue, and on its own when orphans are the only
thing there - in which case the band still shows, saying "Nothing waiting to be
graded" above the note, rather than vanishing and leaving the problem invisible.

Amber deliberately: not green (not a task) and not red (not a student in
trouble). It is a data problem worth knowing about.

## Executed - four suites, all against the real functions

**cascade-delete** (fake Firestore, nothing touches production):

| | |
| --- | --- |
| first dialog appears and states the real counts | PASS |
| nothing deleted yet | PASS |
| a SECOND dialog appears | PASS |
| second dialog names the graded work | PASS |
| still nothing deleted after one confirm | PASS |
| children deleted, assignment deleted | PASS |
| **children deleted BEFORE the parent** | PASS |
| empty assignment deletes after ONE confirm, and only the assignment | PASS |
| a failed count deletes NOTHING, says so, never opens a confirm | PASS |
| 950 children all deleted across batches | PASS |

**orphan-notice**: counted separately, explained in the band, still shows the
real queue, singular wording for one, band still shown when orphans are all
there is, hidden when there is nothing at all. All PASS.

**orphan-cases** and **essays-band-v2** still pass unchanged.

## One stale assertion, twice

The `essays-band-v2` suite went red on the empty state, and both times the code
was right:

1. it asserted `display === 'flex'`; the empty state is `block` now because it
   can carry the orphan note underneath
2. then it asserted the text `"1 marked in the last 7 days"`, but the count is
   inside `<strong>`, so that string is not contiguous

Same lesson as the sheet-name regex and the roster fixtures: when a check fails
right after a deliberate change, suspect the check first.

## NOT done

**The 6 orphaned submissions and 16 orphaned completions already in Firestore
are still there.** The cascade only fixes deletes from now on. Cleaning up the
existing ones is a separate, destructive job on production data and has not
been started.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- dashboard-v2.css braces 243/243
- gates: seventeen, all PASS
- bump: teacher-assignments.js, activity.js, overview-v2.js, dashboard-v2.css,
  CACHE_VERSION -> **v391**; `--check` OK
