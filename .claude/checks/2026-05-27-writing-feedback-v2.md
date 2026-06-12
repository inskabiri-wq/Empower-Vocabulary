# Writing feedback v2 — inline annotations + rubric comment bank (Phase 1: Essay)

**Date:** 2026-05-27
**Trigger:** Teacher wants to upgrade writing grading: select text on a student's essay → right-click → pick a criterion + score → choose/mix/edit pre-written comments → anchored inline comment. Per the agreed decisions: rubric picked on the form; build UI + Essay bank first; bands shown as "5 — Excellent".

---

## What shipped (Phase 1)

A Google-Docs-style inline feedback layer on top of the existing writing grading view, **without changing the working score/comment/status path.**

### New files
| File | What |
|---|---|
| `y/assignments/js/writing-comment-bank.js` | The Essay rubric's **240 comments** (4 criteria × 6 bands × 10), + per-rubric criterion labels + `get(rubric,criterion,score)` / `label()` helpers. `academic` + `short` declared empty for Phase 2; `get()` falls back to essay so the teacher always sees something. |
| `y/assignments/js/writing-annotations.js` | Shared engine: anchor resolution (offset + quote w/ fallback search + graceful detach), highlight render, selection→offsets, the teacher composer popup (criterion tabs → score row → bank list → mix/edit textarea), comment bubbles, recently-used (localStorage per teacher), phone guard, all CSS injected. Used by BOTH teacher (create) + student (read-only). |

### Edited
| File | Change |
|---|---|
| `writing-submissions-view.js` | Essay body now renders via the engine with select→right-click/floating-button→compose. Annotations auto-save on each add/delete AND ride along in Save-grade. Phone warning bar. Cleanup on close. |
| `writing-form.js` + teacher-dashboard.html modal | New **Rubric** dropdown (Essay / Academic / Short) → `assignment.rubricType`. Wired into reset, save, and edit-load. |
| `student-assignments.js` | Feedback modal renders the teacher's inline highlights (read-only) when status is graded/returned; detached comments listed below. |
| teacher-dashboard.html + student-dashboard.html | Load bank + engine before the consumers. |
| `firestore.rules` | `annotations` added to the teacher-grading allowed field set; added to the students' forbidden-fields list (A1) and preserved-through-resubmit list (A2) so students can't tamper. |

---

## The agreed flow, as built

1. Teacher opens a submission. Essay is selectable text with any existing highlights shown.
2. Select a word/phrase/sentence → **right-click** (desktop) OR click the floating **💬 Comment** button that appears on selection (covers trackpads/touch).
3. Composer opens: pick **criterion** (Organization / Content / Language Accuracy / Word Choice — the essay rubric's labels over the internal TA/CC/GR/VO keys) → pick **score** ("5 — Excellent" … "0 — No Attempt") → the **10 bank comments** for that cell appear → click to add, click more to **mix/combine**, **edit** freely in the textarea → **Add comment**.
4. The comment anchors to the selected text as a coloured highlight (one colour per criterion). Score can be set before or after.
5. **Edits are one-off** (the bank is never modified) but **recently-used comments** are surfaced at the top for reuse.
6. Auto-saves immediately (no "forgot to save" data loss).
7. Student sees the highlights + comment bubbles **only when graded or returned** (read-only). Returned → revise & resubmit; graded → read. Annotations survive a resubmit (and gracefully detach if the text changed).

---

## Anchor strategy (why comments never get lost)

Each annotation stores `{ start, end, quote }` against the plain `responseText`. On render:
1. If `text.slice(start,end) === quote` → highlight there.
2. Else search for `quote` in the text → re-anchor (handles inserted/removed text).
3. Else → **detached**: shown in an "Other comments" list, never dropped.

Overlapping ranges: the earlier one wins; the later overlapping one detaches (surfaced, not lost).

---

## E2E test (Playwright, real Chromium): ✅ 8 / 8 PASS

| Check | Result |
|---|---|
| comment bank loads | ✅ |
| essay bank = 240 comments | ✅ |
| bank.label maps CC → Organization | ✅ |
| annotation engine loads | ✅ |
| render anchors a highlight on the quote | ✅ |
| render re-anchors when text shifts | ✅ |
| render detaches when quote is gone | ✅ |
| no page/console errors | ✅ clean |

## Sanity

| Check | Result |
|---|---|
| `node -c` on 5 JS files | ✅ all OK |
| firestore.rules brace balance | ✅ 96 / 96 |
| teacher-dashboard.html div balance | ✅ 299 / 299 |
| student-dashboard.html div balance | ✅ 336 / 336 |

---

## What's PENDING (Phase 2 — after you test the flow)

- **Academic-paragraph bank** (240 comments) — `academic: {}` placeholder ready.
- **Short-paragraph bank** (240 comments) — `short: {}` placeholder ready.
  Until filled, those rubrics fall back to the essay bank (graceful — teacher can still type freely).
- I extracted all three rubric PDFs to `.claude/rubrics/*.txt` so the wording is ready to turn into the other two banks on your go-ahead.

## Deploy reminder

- **Rules must be deployed** for annotations to save: `firebase deploy --only firestore:rules`.
- `firebase deploy --only hosting` for the new JS + form field.
- (Plus the still-pending earlier rules deploy for the level/module assignment fix — same command covers it.)

---

## Couldn't fully verify from here

The deep teacher flow (select → compose → save → student sees) needs a logged-in teacher + a real submission, same Tier-2 credential gap as before. The engine's core logic (anchoring, bank, render) is unit-tested via Playwright above; the click-through UX wants one manual run on a real graded essay.
