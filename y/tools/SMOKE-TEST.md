# Smoke Test — Empower Vocabulary

Two layers: a Node script for data-layer checks, and a click-through
checklist for everything a script can't see (rules in action, the actual
UI states).

Run both after every major deploy. Time required: ~5 min script + ~15 min
manual.

---

## Layer 1 — Automated data check

```bash
cd E:\vocab-trainer\y
node tools/smoke-test.js
```

What it verifies:
- `/settings/organizations` schema + denormalized arrays match `list`
- Every assignment has a `teacherId` (ownership backfill complete?)
- Writing submissions: scores in range, criteria in range, sums match
- `graded` / `returned` submissions carry `gradedBy` + `gradedAt`
- `returned` submissions carry a teacher comment
- Doc IDs follow `{uid}_{aid}` pattern
- Cross-doc references resolve (no orphan `assignmentId`s)
- Teachers are at teacher-eligible domains
- User docs have matching Auth records (sampled)

Exits 0 = green, 1 = at least one hard failure.

---

## Layer 2 — Manual UI test plan

Run from a fresh browser (or incognito) so cached auth doesn't paper
over real bugs. Use three accounts:

- **Admin** — `akabiriaslifar@fsm.edu.tr` (the hardcoded admin)
- **Teacher** — any account at a `teacherEligible: true` domain
- **Student** — any FSM student account

### A. Domain authorization (Phase H)

Open `index.html` in an incognito window.

1. **A1** — Register with `someone@gmail.com`. Submitting should show
   an error listing the allowed domains. **DOES NOT** create the account.
2. **A2** — Register with `someone@fsm.edu.tr`. Should succeed → check
   inbox for verification email.
3. **A3** — As admin, open Admin tab → **🏛 Organizations** card appears.
   Add a new domain (e.g. `boun.edu.tr`). Row shows in the table.
4. **A4** — Try to remove the FSM rows. UI shows 🔒 protected — blocked.
5. **A5** — In incognito again, register with `tester@boun.edu.tr`.
   Now succeeds.
6. **A6** — As admin, set `boun.edu.tr`'s **Active** toggle to OFF.
   Wait ~2s. In another incognito, attempt to register again → blocked.

### B. Assignment ownership (Phase F.1)

Use two different teacher accounts (or admin + teacher).

1. **B1** — Teacher Alice creates a writing assignment.
2. **B2** — Teacher Bob (different account) opens the assignments tab,
   sees Alice's row. Bob clicks Edit — should fail at save with a
   permission error (browser console + UI toast).
3. **B3** — Bob clicks Delete — should fail the same way.
4. **B4** — Alice can edit / delete her own. Admin can edit / delete
   anyone's.

### C. Writing flow — happy path (Phase G + post-G fixes)

As Student:

1. **C1** — Open an assigned writing. Top of page shows **📋 Rubric**
   panel (teal). If teacher provided a URL, **📎 Open rubric file →**
   button appears and opens in new tab.
2. **C2** — Type some text. Click Submit. First dialog:
   *"Once submitted, you can't edit unless your teacher returns it."*
   Click **Continue →**.
3. **C3** — Second dialog: *"FINAL CHECK — Are you absolutely sure?"*
   Click **✅ Yes, submit it**.
4. **C4** — Re-open the same writing assignment from the dashboard.
   You should see the **"You've already submitted this"** lock screen
   (NOT the editor with a fresh 40-min timer).

As Teacher:

5. **C5** — Open submissions tracker → click View Essay. Full-screen
   viewer opens with two columns: rubric+essay on the left, grading
   sidebar on the right.
6. **C6** — Fill TA = 4, CC = 4, GR = 3, VO = 4. The Total chip
   should auto-update to **15 / 20** (blue tier).
7. **C7** — Pick status **✅ Graded (final)**, add a comment, click
   Save. Button reads **✅ Final grade saved** for ~900 ms before
   the modal refreshes.

As Student again:

8. **C8** — Refocus the dashboard tab (or refresh). Card now shows
   a purple **🏆 Teacher's Grade · 15 / 20** banner with a **NEW**
   sticker pulse + **📝 View feedback** button.
9. **C9** — Click View feedback → modal shows the 4 criterion chips,
   rubric, and teacher comment.

### D. Returned-for-revision flow (Phase F.4)

As Teacher:

1. **D1** — Open another submission (or use the same one — depends on
   your test data). Pick status **🔄 Returned (ask student to revise)**.
   Leave criteria empty. Add a comment.
2. **D2** — Click Save. Button reads **🔄 Returned to student**.

As Student:

3. **D3** — Refocus dashboard. Card now shows an amber **🔄 Returned
   for revision** banner with the teacher comment preview and a
   **🔄 Revise & resubmit** button.
4. **D4** — Click Revise. Writing editor opens with the previous
   text pre-loaded and an amber revision banner at the top showing
   the teacher's comment.
5. **D5** — Edit the text. Submit (double-confirm flow as in C2-C3).
   Status flips back to `submitted` — verify in Teacher view.

### E. Preview as student (Phase F.2)

As Teacher:

1. **E1** — On a writing assignment row, click **👀 Preview** →
   opens `writing-exam.html?preview=1` in a new tab with a purple
   "PREVIEW MODE" banner. Submit button replaced with "Close Preview".
   Typing doesn't create real submissions.
2. **E2** — On a reading/listening assignment, click Preview →
   opens the student dashboard with the same purple banner across
   the top. The exam auto-launches. Submitting doesn't write a
   session — check the session count in your teacher dashboard
   doesn't go up.

### F. Reading/listening picker (Phase G.1, G.2)

As Teacher:

1. **F1** — Click **+ New Assignment** → pick **📖 Reading**. The exam
   dropdown shows `<optgroup label="B2">` with 3 exams (B2 Reading 1, 2, 3).
2. **F2** — Pick a level that has no exams (A2). The dropdown shows
   no optgroup for empty levels — confirms data-driven rendering.

### G. Grading stats (Phase F.3)

As Teacher with grading data:

1. **G1** — Assignments tab → click **📊 Grading Stats**. Modal opens
   with 4 KPI cards (Pending, Graded, Avg score, Avg turnaround), a
   By Class table, and a By Assignment table sorted pending-first.
2. **G2** — Click **⬇ Export CSV**. File downloads with the filename
   `writing-grades-YYYY-MM-DD.csv`. Open in Excel — columns include
   TA, CC, GR, VO, and Total. Emoji + non-ASCII characters render
   correctly (UTF-8 BOM).

### H. Security spot-checks (Firestore rules)

These require opening the browser DevTools console.

Use the student account. Open the console and try:

1. **H1** — Read a teacher's user doc by uid:
   ```js
   db.collection('users').doc('SOME_TEACHER_UID').get()
     .then(d => console.log(d.exists ? 'LEAKED' : 'denied (good)'))
     .catch(e => console.log('denied:', e.code));
   ```
   Should print `denied`.
2. **H2** — Try to write to another student's submission:
   ```js
   db.collection('writingSubmissions').doc('OTHER_STUDENT_UID_someAssignmentId')
     .set({ status: 'graded', score: 20 })
     .then(() => console.log('LEAKED'))
     .catch(e => console.log('denied:', e.code));
   ```
   Should print `denied`.
3. **H3** — Try to add an organization domain as student:
   ```js
   db.collection('settings').doc('organizations')
     .set({ list: [{ domain: 'evil.com', active: true, teacherEligible: true }] }, { merge: true })
     .then(() => console.log('LEAKED'))
     .catch(e => console.log('denied:', e.code));
   ```
   Should print `denied`.
4. **H4** — Try to self-promote to teacher:
   ```js
   db.collection('users').doc(auth.currentUser.uid)
     .update({ role: 'teacher' })
     .then(() => console.log('LEAKED'))
     .catch(e => console.log('denied:', e.code));
   ```
   Should print `denied`.

If any H test prints `LEAKED`, treat as a P0 — investigate before
shipping further.

---

## When to re-run

- **Before any release.** Both layers.
- **After modifying `firestore.rules`.** Both layers — Layer 2 H tests
  specifically.
- **After changing any auth flow.** Layer 2 A tests.
- **After a writing-flow refactor.** Layer 2 C + D + smoke script.
- **Weekly in production.** Layer 1 script — catches silent data drift
  (criteria sums not matching score, orphan submissions, etc.).
