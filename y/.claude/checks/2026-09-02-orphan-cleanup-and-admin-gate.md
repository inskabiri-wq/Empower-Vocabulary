# 2026-09-02 - orphans removed from production, and the cascade gated to admin

## The question first: can teachers delete assignments?

Yes, but not everyone's. `renderAssignments` gates the buttons:

```js
const canMutate = amAdmin || isOwner || isLegacy;
if (!canMutate) return '';
```

So a teacher sees Edit/Delete on **their own** assignments. Two notes:

- `isLegacy = !ownerId` means an assignment with **no `teacherId`** can be
  deleted by any teacher. Pre-existing, and it matters more now that delete
  cascades.
- That is UI only. `firestore.rules` is the real control.

## A regression I introduced, caught before it shipped

`firestore.rules` allows deleting the children **only for admin**:

```
assignmentCompletions:  allow delete: if isAdmin();
writingSubmissions:     allow delete: if isAdmin();
```

My cascade deleted children first, so for a non-admin teacher the first batch
would have thrown permission-denied and the assignment would have survived.
Net effect: **27 teachers would have lost the ability to delete their own
assignments at all.**

Fixed by gating on `isAdmin()`:

- **Admin** gets the cascade and the two dialogs.
- **A teacher** gets the old single-dialog behaviour, plus an honest warning:
  the attached work stays, it will appear on the Overview as belonging to a
  deleted assignment, and an admin can clear it properly.

A teacher does not get the second dialog, because on their path nothing
student-owned is destroyed - and a scary dialog for a non-destructive action
is how people learn to click through both.

Four new cases cover exactly that, and the suite found the gap on its own: the
sandbox had no `isAdmin`, so it took the teacher path and the "second dialog"
assertion failed. That is the gate working.

## Production cleanup: done, verified, reversible

Two-mode tool. Dry run first, which **wrote a full backup** (15,894 bytes,
complete document bodies) and printed every doc it would touch. The delete pass
then removes only ids present in that backup, and only those still orphaned at
the moment of deletion.

Removed:

| | before | after |
| --- | --- | --- |
| writingSubmissions | 6 (all orphaned) | **0** |
| assignmentCompletions | 17 (16 orphaned) | **1** |

**22 documents deleted. Zero orphans remain**, confirmed by a separate
read-only script on a fresh read rather than by the deleting script's own word.

Everything removed belonged to assignments titled "Hi", "Opinion Essay
Practice" and "Opinion Paragraph Practice" - test data, as expected. One
submission was under another name (Samaneh sattarzadeh) on the "Hi" test
assignment; it went with the rest.

Backup kept at
`scratchpad/orphan-backup.json`. It is the only copy, and the scratchpad is
session-scoped, so it should be moved somewhere durable if it matters.

## Sanity

- `node --check` across every `.js` including functions - 0 failures
- four executed suites: essays-band-v2, orphan-cases, orphan-notice,
  cascade-delete - all pass
- gates: seventeen, all PASS
- em-dash scan - clean
- bump: teacher-assignments.js, CACHE_VERSION -> **v392**; `--check` OK

## Left open

**The `isLegacy` hole.** An assignment with no `teacherId` is deletable by any
teacher, and for an admin that now cascades. Worth closing, but it changes who
can delete what, so it is a decision rather than a fix.

**Rules could allow an owner to cascade.** It needs a `get()` join on the
assignment inside the rule, which costs a read per deleted document. Not
attempted; the admin gate is the safe answer for now.
