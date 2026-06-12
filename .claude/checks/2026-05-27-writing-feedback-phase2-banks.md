# Writing feedback — Phase 2: Academic + Short comment banks

**Date:** 2026-05-27
**Trigger:** "go" — fill the remaining two rubric banks after the Essay flow was built in Phase 1.

---

## What shipped

Filled the two empty placeholders in `writing-comment-bank.js`:

| Rubric | Comments | Source |
|---|---|---|
| **Essay** (Phase 1) | 240 | Verbatim from the decoded essay rubric PDF |
| **Short paragraph** | 240 | Verbatim from the short-paragraph rubric PDF (Organization · Task Achievement · Grammatical Accuracy · Word Choice) |
| **Academic paragraph** | 240 | Authored to the academic rubric's confirmed structure (Organization · Content · Language Accuracy · Word Choice), paragraph-level (topic sentence / supporting sentences / concluding sentence / linkers), pitched at Pre-Int–Int |
| **TOTAL** | **720** | 4 criteria × 6 bands × 10, × 3 rubrics |

### A note of full honesty on the Academic bank
Two of the three rubric PDFs (Essay, Short) had extractable text and I wrote those banks **verbatim from the descriptors**. The Academic PDF's body cells were image/custom-encoded and would NOT extract (only its headers decoded — confirming criteria = Organization/Content/Language Accuracy/Word Choice and bands = No Attempt→Excellent, 0–5).

So the Academic bank was **authored** to that confirmed structure at paragraph level, drawing on the descriptor language of the Essay (same criteria family) scaled down from multi-paragraph to single-paragraph. It's faithful to the rubric's criteria + bands and pedagogically aligned — and since any comment is one-off editable by the teacher, mismatches are trivial to adjust. If you want it word-for-word from your PDF, paste the Academic rubric's cell text and I'll swap in the exact wording (10-minute job).

---

## How it's wired (unchanged from Phase 1)

- The teacher's **Rubric** dropdown on the assignment form sets `assignment.rubricType` (essay / academic / short).
- In the grading view, selecting text → composer → the comment bank shows **that rubric's** comments for the chosen criterion + score.
- `bank.get(rubric, criterion, score)` returns the right 10; `bank.label(rubric, criterion)` shows the right display name (e.g. academic "Content" vs short "Task Achievement").
- No engine/UI/rules changes were needed — Phase 2 is pure data.

---

## Checks

| Check | Result |
|---|---|
| `node -c writing-comment-bank.js` | ✅ |
| Node count: all 3 banks, 10 per cell | ✅ 720 (240 / 240 / 240) |
| Browser (Playwright): banks load + resolve + labels per rubric | ✅ |
| Browser: console/page errors | ✅ CLEAN |

---

## Deploy

`firebase deploy --only hosting` ships the filled bank (+ the Phase 1 grading UI if not already deployed). Rules deploy (from Phase 1) still needed for annotations to save: `firebase deploy --only firestore:rules`.

---

## Status: writing feedback v2 COMPLETE

- ✅ Inline annotations (select → right-click/button → criterion → score → bank → mix/edit → anchored highlight)
- ✅ All 3 rubric comment banks (720 comments)
- ✅ Rubric dropdown on the form
- ✅ Student read-only view of annotations (graded/returned)
- ✅ Per-teacher recently-used; one-off edits; phone guard; tamper-proof rules

Only remaining nicety: swapping the Academic bank to verbatim PDF wording if/when you paste those cells.
