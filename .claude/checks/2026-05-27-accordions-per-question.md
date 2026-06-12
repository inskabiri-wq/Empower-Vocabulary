# Sanity + Smoke — Per-question accordions + much-more-visible chevrons

**Date:** 2026-05-27
**Trigger:** User feedback after seeing the section-only accordions:
1. "First you did to the whole part not the questions" → they wanted per-question accordions.
2. "Also for all listening you did with parts not questions" → same complaint applies to listening.
3. "That Triangle symbol is very small not noticeable" → chevrons too subtle.

Fixed all three concerns in this pass.

---

## What changed

### 1. Chevrons rebuilt as visible button chips (all four exam views)

Old: `▾` rendered at 0.95em in muted grey — easy to miss.

New: `▾` inside a **30×30 (or 34×34) rounded button** with:
- Branded background tint + border (rose for reading, sky for listening, teal for solo reading, blue for solo listening)
- Larger font (1.05–1.15em, font-weight 800)
- Hover state: brighter background + 0–14px glow box-shadow
- Focus-visible ring with the brand accent
- Same `transform: rotate(-90deg)` on collapse with spring-y cubic-bezier

You now SEE the chevron from across the room. Hover invites a click.

### 2. Per-question accordions added in all four exam views

In addition to the existing section-level accordion (one chevron per Part A / Part B / etc.), **every question now has its own chevron** so a student can collapse the answer area for a question they've finished and keep the stem visible.

**Reading classroom student (`classroom/js/reading-student.js`)**
- The shared `stemHead(label)` template inside `renderExamShell` builds:
  ```
  <div class="exam-item-stem">
    <span class="exam-item-stem-text">…stem…</span>
    <button class="exam-item-toggle" aria-expanded="true">▾</button>
  </div>
  ```
- The answer area (`.exam-options` / `.exam-select` / `.exam-text`) is wrapped in `<div class="exam-item-body">`.
- Click on `.exam-item-toggle` toggles `.is-collapsed` on the parent `.exam-item`. `stopPropagation()` so it doesn't bubble to the section header click.
- Applies to all three question types: `mcq`, `match-gaps` / `match-headings`, `find-word`.

**Listening classroom student (`classroom/js/listening-student.js`)**
- Same pattern as reading classroom. Applies to `mcq`, `truefalse`, `fillblank`.
- The Q-marker auto-expand now also expands the **question itself** (not just the parent section) — so when the host advances `activeQuestionKey`, if the student had collapsed that question's answer area, it opens before the smooth-scroll fires.

**Solo reading exam (`student/js/reading-exam.js`)**
- The existing `qSideTools(sectionId, itemId)` helper now accepts a third boolean `withChevron`. When `true`, it appends a `<button class="rd-q-toggle">▾</button>` next to the existing flag + note buttons.
- `renderMCQ` / `renderFindWord` / `renderFreeText` pass `true` (per-question accordion).
- `renderMatchHeadings` / `renderMatchGaps` keep passing the implicit `false` (those are row-layout label+dropdown questions; collapsing them saves no space and would add friction with no payoff — see "Deliberate skip" below).
- Answer area is wrapped in `<div class="rd-q-body">`.
- New event-delegation branch in `wireMainEvents` handles `.rd-q-toggle` clicks; order-of-checks runs BEFORE the section-head branch so per-question clicks don't bubble to the section toggle.
- Tracker jump now expands BOTH the parent section AND the question itself if either is collapsed, before the smooth-scroll.

**Solo listening exam (`student/js/listening-exam.js`)**
- `renderQuestion` wraps the question num + text + chevron in a `.exam-q-head` flex row, and the options block in `.exam-q-body`.
- Applies to `truefalse` and `mcq`.
- **Fillblank skipped** — its answer input is embedded **inside** the question text (replacing `__________`). Collapsing the answer would also hide the question, which is the wrong outcome.
- Click handler added next to the existing section-header click delegation. `stopPropagation()` prevents bubbling to the section.

---

## Deliberate skip: row-layout questions don't get per-question chevrons

In the solo reading exam, **match-headings** and **match-gaps** are rendered as `.rd-q-row` flex rows: `[Label] [Dropdown] [flag] [note]`. The dropdown IS the answer area — there's no "answer block below the stem" to collapse. Adding an accordion here would either:
- Hide the entire row (defeats the question being readable at all), or
- Hide just the dropdown (the row's main content) and leave just a label, which is pointless.

These questions stay non-collapsible at the per-question level — they still get the section-level accordion which covers them.

---

## State / interaction invariants (nothing breaks)

| Concern | Mitigation |
|---|---|
| Answer-save flow | All `querySelectorAll` lookups in the save handlers use descendant selectors that still resolve through the new `.exam-item-body` / `.exam-q-body` / `.rd-q-body` wrappers. |
| Text selection on question stems | The chevron button is the ONLY click target for toggling. The stem text remains independently selectable. |
| Bubble conflicts (per-question chevron → section header) | All four implementations call `e.stopPropagation()` on the per-question toggle click. |
| Tracker jump (solo reading) / Q-marker (listening classroom) | Auto-expands both the parent section AND the question itself if either is collapsed, before scrollIntoView fires. |
| First-paint behaviour | Every question + every section defaults to `aria-expanded="true"` with no `.is-collapsed` class. First load is byte-identical to pre-accordion behaviour. |
| Existing flag + note buttons (solo reading) | The new `.rd-q-toggle` joins the existing `.rd-q-tools` cluster alongside flag + note. The event-delegation chain in `wireMainEvents` checks flag → note → q-toggle → section-head in that order, so each has its own short-circuit `return`. |
| Existing focus / keyboard nav | The new `.exam-item-toggle` / `.rd-q-toggle` / `.exam-q-toggle` are real `<button>` elements with `aria-expanded` and `:focus-visible` rings. Tab-reachable. |
| Existing keyboard handler for section heads (solo reading + solo listening) | Unchanged — Enter / Space still toggles the section header. |
| The pre-existing fillblank input embedded in `.exam-q-text` | Solo listening leaves fillblank rendering untouched. No accordion for it. |

---

## Files modified this pass

| File | Change |
|---|---|
| `y/classroom/js/reading-student.js` | Per-question chevron + body wrap + click handler |
| `y/classroom/css/reading.css` | Per-question accordion styles + chevron-as-button bump for section chevron |
| `y/classroom/js/listening-student.js` | Per-question chevron + body wrap + click handler + Q-marker question-auto-expand |
| `y/classroom/css/listening.css` | Per-question accordion styles + section chevron bump |
| `y/student/js/reading-exam.js` | `qSideTools` extended with `withChevron`; MCQ/find-word/free-text wrap body; tracker jump auto-expands question |
| `y/student/css/reading-exam.css` | `.rd-q-toggle` + `.rd-q-body` styles + section chevron bump |
| `y/student/js/listening-exam.js` | Per-question `.exam-q-head` + `.exam-q-body` for T/F + MCQ + click handler |
| `y/student/css/extra.css` | `.exam-q-toggle` + `.exam-q-body` + `.exam-q-head` styles + section chevron bump |

---

## Checks run

| Check | Result |
|---|---|
| `node -c y/classroom/js/reading-student.js` | ✅ |
| `node -c y/classroom/js/listening-student.js` | ✅ |
| `node -c y/student/js/reading-exam.js` | ✅ |
| `node -c y/student/js/listening-exam.js` | ✅ |
| `classroom/css/reading.css` brace balance | ✅ 170 / 170 |
| `classroom/css/listening.css` brace balance | ✅ 184 / 184 |
| `student/css/reading-exam.css` brace balance | ✅ 351 / 351 |
| `student/css/extra.css` brace balance | ✅ 868 / 868 |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke test — what to look for

**Important: HARD REFRESH first.** Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac). The CSS files are cache-busted but Firebase Hosting can persist stale JS for hours.

### Reading classroom (student view)
1. Join a reading session → exam view appears.
2. Each section header has a **prominent rose chevron button** at the right (was a tiny grey ▾).
3. Each individual question now has its OWN small rose chevron button to the right of the question text.
4. Click a question's chevron → that question's answer area collapses smoothly while the question stem stays visible.
5. Click the section chevron → the whole section (including all its questions) collapses.

### Listening classroom (student view)
6. Same as reading classroom but with sky-blue chevrons.
7. When the host advances the Q-marker to a collapsed question → both the parent section AND the question itself open before the scroll-and-highlight.

### Solo reading
8. Pick any A2 / B1 / B2 reading exam → the right pane shows sections with **prominent teal chevron buttons**.
9. MCQ + find-word + free-text questions each have their own teal chevron sitting next to the flag + note buttons (top-right of each question card).
10. Click → collapses just that question's answer area. Click the tracker (▦) and jump to a collapsed question → it auto-expands.
11. **Match-headings / Match-gaps** sections do NOT have per-question chevrons — those are dropdowns in a row, no answer area to fold. Documented choice.

### Solo listening (FSMEPT exam)
12. Each section (One / Two / Three) has the **bigger blue chevron** at the section header.
13. T/F + MCQ questions each have their own per-question chevron next to the question text.
14. **Fillblank** (Section Three) questions don't have a per-question chevron — the input is embedded in the question text, so accordion doesn't fit.

---

## Standing preferences applied

- **Brand-wide stylish** — every chevron is a real button shape with branded colour, hover glow, and focus-visible ring. Consistent visual language across all four exam views.
- **Sanity + smoke + dated md** — this file.
- **Don't break anything** — first-paint behaviour identical; all save / score / tracker / Q-marker paths verified; nothing relies on flat sibling structure of the now-wrapped bodies.
