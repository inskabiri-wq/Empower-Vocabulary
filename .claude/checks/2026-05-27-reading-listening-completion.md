# Reading/Listening assignment completion loop — wired

**Date:** 2026-05-27
**Trigger:** Audit found reading/listening *assignments* never auto-completed. User: "go … crucially important … ship soon … work for 400 students."

Closed the loop with **session-matching** (the same proven pattern vocab already uses), so it's reliable, retroactive, and needs **no rules deploy** for completion to work.

---

## The matching rule (identical on teacher + student)

A reading/listening assignment is **completed** for a student when that student has a `/sessions` doc where:
- `activity === 'reading-exam'` (reading) / `'listening-exam'` (listening), AND
- `createdAt >= assignment.createdAt`, AND
- the session's exam id (`session.unit`) `=== assignment.examId`
  - legacy listening fallback: `session.unit === 'fsmept'` also matches (pre-fix single listening exam), AND
  - if the assignment somehow has no exam id, any matching-activity session counts.

Attempting the assigned exam = done (graded exams have no "100%" gate, unlike vocab). An explicit `assignmentCompletions` doc still overrides if one ever exists.

Why this is safe for 400 students:
- Reuses the exact session-match machinery vocab already runs at scale — no new Firestore reads, no new collection writes, no rules change.
- Works **retroactively** — students who already sat the exam are credited immediately.
- Teacher and student compute completion from the **same rule**, so the two views can't disagree.

---

## Changes

### 1. `y/student/js/listening-exam.js` — record the real exam id
The listening session hardcoded `unit:'fsmept'` + `level:'exam'`. Now writes:
```js
level: (currentExam && currentExam.level) || 'exam',
unit:  (currentExam && currentExam.id)    || 'fsmept',
examTitle: (currentExam && currentExam.title) || '',
```
So `session.unit` carries the real exam id (`sample-fsmept`), matching `assignment.examId`. Reading already did this (`unit: state.exam.id`). Now both skills are uniform + future-proof for a second listening exam.

### 2. `y/assignments/js/teacher-assignments.js` — `calculateAssignmentCompletion`
Replaced the reading/listening stub (which only counted an explicit completionRecord — that nothing wrote) with the session-match above. Result: the teacher's card progress bar + Assignment Status panel + the student drill-down now show reading/listening completions.

### 3. `y/assignments/js/student-assignments.js` — `checkMyAssignmentStatus`
Added a reading/listening branch BEFORE the vocab matcher. Pools every session source the student side may hold (Firestore `allSessions`, in-memory `myProgress`, localStorage `sessionHistory` + `journeyStats.sessions`) so it finds the exam attempt wherever it landed, then applies the same match rule. The student's "Your Assignments" card flips to Done after they finish the assigned exam.

ID spaces verified aligned: the exam picker (`exam-form.js`) writes `assignment.examId` = EXAM_REGISTRY id (`b2-r1`, `sample-fsmept`); reading session writes `unit: state.exam.id` = same id; listening session now writes `unit: currentExam.id` = same id.

---

## Checks run

| Check | Result |
|---|---|
| `node -c y/student/js/listening-exam.js` | ✅ |
| `node -c y/assignments/js/teacher-assignments.js` | ✅ |
| `node -c y/assignments/js/student-assignments.js` | ✅ |
| Teacher vs student match rule identical | ✅ (same `examActivity` + `aExamId` + id-match) |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## End-to-end smoke test

1. Teacher → New Assignment → **Reading Exam** → pick an exam (e.g. "A2 Reading 1"), target a class, save.
2. Student in that class → "Your Assignments" shows it (pending).
3. Student → Reading skill → opens that exam → finishes → session recorded.
4. **Student card flips to Done** (no teacher action needed).
5. Teacher → assignment card progress bar + Assignment Status + student drill-down all show that student completed. ✅
6. Repeat for **Listening Exam** (the FSMEPT exam) — same result.
7. Retroactive check: a student who already did the exam before the assignment was created should NOT count (date gate); one who did it after should count.

---

## Status of the two audit findings

- **BUG#1 (level/module target rule)** — fixed in `firestore.rules`; **still needs `firebase deploy --only firestore:rules`** to take effect for non-admin teachers.
- **GAP (reading/listening completion)** — **fixed here**, pure client JS, live on next hard-refresh (no deploy needed).

---

## Shipping note (400 students)

- The completion derivation runs client-side over already-loaded sessions — no extra reads, scales the same as the existing vocab path.
- The one thing that still needs a deploy is the **rules** (for the level/module save fix). Deploy before go-live.
- Hard-refresh both teacher + student after deploy so the new JS is fetched.
