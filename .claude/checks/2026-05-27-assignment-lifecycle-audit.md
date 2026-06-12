# Assignment lifecycle audit — 0 → 100

**Date:** 2026-05-27
**Trigger:** "check the whole assignment procedure for 0 to 100 … crucially important everything would work."

Traced every link: teacher creates → Firestore → student sees → student completes → completion recorded → teacher sees progress → (writing) grading → student sees grade. Looked specifically for field-name mismatches, completion-key drift, and rules that block a step.

---

## Result summary

| Phase | Vocab | Reading | Listening | Writing |
|---|---|---|---|---|
| Create (form → /assignments) | ✅ | ✅ | ✅ | ✅ |
| Rules allow create/update/delete | ✅ (after fix) | ✅ (after fix) | ✅ (after fix) | ✅ (after fix) |
| Student matches + sees | ✅ | ✅ | ✅ | ✅ |
| Student starts (routing) | ✅ | ⚠️ manual pick | ⚠️ manual pick | ✅ |
| Completion recorded | ✅ session-match | ❌ **not wired** | ❌ **not wired** | ✅ writingSubmissions |
| Teacher sees progress | ✅ | ⚠️ stuck "not started" | ⚠️ stuck "not started" | ✅ |
| Grading → student sees grade | n/a | n/a | n/a | ✅ |

---

## BUG FOUND + FIXED — level/module target silently rejected

**Severity: high (affects every non-admin teacher).**

`_validAssignmentTarget()` in `firestore.rules` only allowed `class` + `individual` for non-admin teachers — but all three assignment forms (vocab / exam / writing) offer **"Entire Level"** and **"Entire Module"** to every teacher. A non-admin teacher who picked those had their Firestore write **rejected** → the assignment appeared to fail to save. (Admin — i.e. your account — was unaffected, which is why you didn't see it directly.)

**Fix:** rule now accepts all four valid target types for any teacher:
```
function _validAssignmentTarget(d) {
  return d.targetType in ['class', 'level', 'module', 'individual'];
}
```
Same trust model already applied to `class` targeting (teacher self-selects; no per-doc scope cross-check). **Requires a rules deploy** (`firebase deploy --only firestore:rules`) to take effect.

> If you'd rather keep level/module admin-only, tell me — I'll instead hide those two options from non-admin teachers in the three forms so the UI matches the restriction.

---

## What's solid (verified consistent)

### Creation — all 3 forms write the same target shape
`targetType` + `targetClass` (normalised via `_normCls` = trim+UPPER) + `targetLevel` + `targetModule` + `targetStudents[]` + `deadline` + `teacherId` + `teacherName` + `createdAt` + `updatedAt`. Vocab adds book/level/unit/activity; exam adds examId/examTitle/examLevel; writing adds prompt/questionType/level/rubric/etc. All set `createdAt` on create (the list query `orderBy('createdAt')` would silently drop a doc missing it — none are).

### Completion key — consistent (the historical bug class is clean)
- Student writes: doc id **`{uid}_{assignmentId}`**, field `odUserId`.
- Teacher reads: `allCompletions['{student.id}_{assignment.id}']` — **by doc id**, not by the `odUserId`/`userId` field. Since `student.id === uid`, keys match.
- Student's own load queries `where('odUserId','==',uid)` with a legacy `where('userId',...)` fallback.
- My new code agrees: `student-detail.js` uses `comps[student.id + '_' + a.id]`; `assignments-overview.js` matches `key.endsWith('_' + a.id)`.

### Student matcher — same fields the teacher writes
`normClass` (student) === `_normCls` (teacher) exactly. `targetLevel`/`targetModule` trimmed both sides. `targetStudents` holds uids; student checks `user.uid`. ✅

### Writing grading — write matches the restrictive rule
Grading writes exactly `{ score, criteria, teacherComment, status, gradedBy, gradedAt }` → the rule's `hasOnly([...])` set. score 0–20, status ∈ {submitted,graded,returned}. Student reads their own submission (`{uid}_{aid}` doc, allowed by rule). Completion derived from `status ∈ {submitted,graded}`. ✅

---

## GAP (reported, not a regression) — reading/listening assignments don't auto-complete

`reading-exam.js` and `listening-exam.js` record **sessions** but never write an `assignmentCompletions` doc and never receive the `assignmentId` (the "Start" routing just sends the student to `#reading` / `#listening` to pick the exam manually — flagged in-code as a "future enhancement"). And `calculateAssignmentCompletion()` for reading/listening only counts a student done if a `completionRecord.completed` exists — which nothing writes.

**Net effect:** a reading or listening *assignment* will show **"not started" forever** even after the student finishes the exam. Create + display + routing all work; only the completion loop is missing.

Vocab (session-matching) and writing (writingSubmissions) **do** close the loop correctly.

### Two ways to fix (your call — both are focused follow-ups)
1. **Session-matching (no exam-runner change, lighter):** extend `calculateAssignmentCompletion()` so reading/listening also scan `allSessions` for a `reading-exam`/`listening-exam` session created after the assignment, for the assigned exam id, with a passing score — mirroring how vocab already works. Needs the session to record the exam id (verify that first).
2. **Explicit wiring (heavier, exact):** carry `assignmentId` from the assignment card → exam runner → write `assignmentCompletions/{uid}_{aid}` on finish. Most precise but touches the routing + both exam runners.

I recommend **#1** — smaller blast radius, matches the existing vocab pattern. Say the word and I'll build it as its own tested pass.

---

## Checks run

| Check | Result |
|---|---|
| `node -c` × 7 assignment/dashboard JS files | ✅ all OK |
| `firestore.rules` brace balance | ✅ 96 / 96 |

---

## Manual end-to-end smoke test

**Deploy rules first** (`firebase deploy --only firestore:rules`), then hard-refresh.

**Vocab (full loop):**
1. Teacher → Assignments → New Assignment → Vocabulary → fill, target a **Class**, save → appears in list.
2. (As a non-admin teacher) target **Entire Level** → now saves (was the bug).
3. Student in that class → "Your Assignments" shows it → Start → does the activity to 100% → card flips to Done.
4. Teacher card progress bar + Assignment Status + the student drill-down all show the student completed.

**Writing (full loop):**
5. Teacher creates a Writing assignment → student sees → Start → writes → submits.
6. Teacher → submission → grades (4 criteria + status Graded) → saves.
7. Student → "View Submission" shows score + comment. Card = Done.

**Reading/Listening (known gap):**
8. Teacher creates → student sees → Start → routed to skill home → picks the exam → finishes.
9. **Expected today:** teacher still shows "not started" (completion loop not wired — see GAP above).
