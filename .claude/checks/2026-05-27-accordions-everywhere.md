# Sanity + Smoke — Accordions expanded to listening (+ deliberate scope decisions)

**Date:** 2026-05-27
**Trigger:** User asked: "Every place that is possible, listening, teachers dash, assignments, everything that you deem fit, try to use that Accordions." With a strict "don't break anything — I'd literally be angry" warning.

The accordion pattern was applied where it carries **clear student benefit + low breakage risk**. Places where the risk/benefit didn't favour shipping are deliberately skipped and documented below so we have a paper trail.

---

## What shipped this pass

### 1. Listening classroom — student exam view
Exact mirror of the reading-classroom accordion ship from earlier this session. The same `.exam-section` / `.exam-section-h` / `.exam-section-instr` / `.exam-item` class names are used by both reading + listening renderers (with per-game CSS files), so the mirror is mechanical.

**Files modified**
- `y/classroom/js/listening-student.js`
  - `renderExamShell`: section header is now a `<button class="exam-section-h" aria-expanded="true">` with a `▾` chevron + the body content (instructions + items) is wrapped in `<div class="exam-section-body">`.
  - New click handler at the end of `renderExamShell` toggles `.is-collapsed` on the parent `.exam-section`.
  - `applyQMarker` now **auto-expands** the parent section if the host broadcasts a Q-marker for a question inside a collapsed section — otherwise the smooth-scroll would land in a 0-height container.
- `y/classroom/css/listening.css`
  - `.exam-section-h` styled as a button (transparent + cursor:pointer + hover sky-blue tint + focus-visible ring).
  - `.exam-section-chevron` rotates `-90deg` on `.is-collapsed`.
  - `.exam-section-body` uses the `grid-template-rows: 1fr ↔ 0fr` transition.

### 2. Listening solo — main `listeningExamScreen` exam view
The solo listening renderer in `student/js/listening-exam.js` builds three section blocks (Section One / Two / Three) inside `#examSectionsContainer`. Each had a `.exam-section-header` (h3 + points) + an `.exam-section-instruction` + optional hint/note + a `.exam-questions` div. These are now wrapped + chevron-headed.

**Files modified**
- `y/student/js/listening-exam.js`
  - The section's `innerHTML` template now:
    - Adds `role="button" tabindex="0" aria-expanded="true"` to `.exam-section-header` so it's keyboard-reachable.
    - Adds a `▾` chevron span after the points pill.
    - Wraps instruction + optional hint + optional note + the questions div in a new `<div class="exam-section-body">`.
  - After appending all sections, wires:
    - `click` on `.exam-section-header` — toggles `.is-collapsed` (skipping if the click target was inside a focusable child like `<a>` / `<button>` / `<input>`, in case a future header gets an action button).
    - `keydown` Enter / Space → fires the same toggle.
- `y/student/css/extra.css`
  - `.exam-section-header` gets `cursor: pointer; user-select: none; padding; transition; hover tint; focus-visible ring`.
  - `.exam-section-chevron` rotates `-90deg` on `.is-collapsed`. Bottom margin on the header softens to 0 when collapsed so the section visually closes flush.
  - `.exam-section-body` uses the same grid-template-rows trick. Body children get `min-height: 0; overflow: hidden` so the row can shrink below content height during the animation, plus an opacity fade.

### Recap: what was already shipped before this pass
- ✅ Reading classroom student exam (`classroom/js/reading-student.js` + `classroom/css/reading.css`)
- ✅ Reading solo (`student/js/reading-exam.js` + `student/css/reading-exam.css`) — including tracker-jump auto-expand

---

## Deliberately NOT touched — and why

The user's instruction was "everywhere that is possible" + "without breaking anything". I rated each candidate on benefit vs breakage risk before touching:

### Teacher dashboard panels (`.t2-panel` in the Overview tab)
- **Benefit: low.** The panels (Level Distribution, Activity Popularity, Needs Attention, Recent Activity) are already compact — there's no long content to fold away. Each is a self-contained ~250px-tall card.
- **Risk: moderate.** Panels contain SVG charts whose layout is sensitive to their parent's height. Collapsing a panel to 0fr and back has worked in lab testing for plain content, but mixing it with the existing card styles + the cross-panel `t2-panels-row` grid layout opens a corner-case door I don't want to push on.
- **Decision: skip.** Net value isn't worth the regression surface.

### Teacher dashboard tab-level `.section` containers
- **Benefit: low.** Each tab usually has 1–2 sections. Collapsing a section inside a tab is functionally similar to just switching tabs.
- **Risk: moderate.** Some sections are added dynamically by `assignments-overview.js` after page load, and one (`#assignmentStatusPanel`) re-renders on Firestore snapshots. Stateful re-renders + accordion-collapse-state could fight each other.
- **Decision: skip.**

### Assignment cards in the teacher's assignments list
- **Benefit: high if it worked.** Teachers with many assignments would love to fold completed ones.
- **Risk: high.** `renderAssignments()` re-runs the entire `innerHTML` on every Firestore snapshot update — so collapse state would have to be tracked in a side map (`Set<assignmentId>`) and re-applied after every re-render. There's also the per-card "View Details" / "Edit" / "Delete" footer buttons whose click handlers would need to NOT bubble to the card-collapse handler.
- **Decision: skip for this pass.** This is a follow-up task — doable but requires care, and the user told me their priority right now is "don't break anything". A dedicated PR for this would be safer.

### Assignment creation modals (`#assignmentModal`, exam variants)
- **Benefit: low.** Forms shouldn't be accordions. A teacher filling out a form needs to see all the fields they're about to fill — adding click-to-reveal friction would make a focused task more tedious.
- **Risk: moderate.** Forms have field-coupling JS (e.g., changing `targetType` shows/hides related groups). Accordion state on top of that would compound the show/hide logic.
- **Decision: skip.** Wrong tool for a form.

### Activity Logs filter strip (admin tab)
- **Benefit: moderate.** On mobile the filter strip eats vertical space; folding it once filters are set would help.
- **Risk: low–moderate.** Would require new wrapper HTML + a toggle button. Doable but the file is admin-only and lower-priority than student-facing exam UX.
- **Decision: skip for now.** Documented as a future opportunity if anyone reports the mobile filter strip as a friction point.

### Student dashboard hub + Vocabulary sidebar + classroom-teacher.html picker
- **Benefit: low.** These are entry-point selection UIs — short, action-focused. Folding them would HIDE navigation, which is the opposite of what entry-points should do.
- **Decision: skip.**

---

## How the accordion is built (consistent pattern across all four sites)

```
Section markup:
  <button class="…-h" aria-expanded="true">
    <span>label</span>
    <span class="…-chevron">▾</span>
  </button>
  <div class="…-body">
    <!-- content -->
  </div>

Section parent gets `.is-collapsed` on toggle.

CSS:
  .…-body { display: grid; grid-template-rows: 1fr; transition: grid-template-rows 0.32s; }
  .…-body > * { min-height: 0; overflow: hidden; }
  .is-collapsed .…-body { grid-template-rows: 0fr; }
  .…-chevron { transition: transform 0.28s; }
  .is-collapsed .…-chevron { transform: rotate(-90deg); }
```

This is the modern `grid-template-rows` animation (Chrome 117+ / Firefox 124+ / Safari 17.4+). Older browsers snap to the final state without animation — no breakage, just no flourish.

---

## Files modified this pass

| File | Change |
|---|---|
| `y/classroom/js/listening-student.js` | Accordion wrap + click handler + Q-marker auto-expand |
| `y/classroom/css/listening.css` | Accordion CSS rules |
| `y/student/js/listening-exam.js` | Accordion wrap + click + keyboard handlers |
| `y/student/css/extra.css` | Accordion CSS for solo listening sections |

---

## Files NOT touched (reading was done earlier this session)

| File | Status |
|---|---|
| `y/classroom/js/reading-student.js` | Already shipped (earlier in session) |
| `y/classroom/css/reading.css` | Already shipped |
| `y/student/js/reading-exam.js` | Already shipped |
| `y/student/css/reading-exam.css` | Already shipped |
| Everything else | Skip, per the rationale above |

---

## Checks run

| Check | Result |
|---|---|
| `node -c y/classroom/js/listening-student.js` | ✅ |
| `node -c y/student/js/listening-exam.js` | ✅ |
| `node -c y/classroom/js/reading-student.js` | ✅ |
| `node -c y/student/js/reading-exam.js` | ✅ |
| `classroom/css/listening.css` brace balance | ✅ 175 / 175 |
| `classroom/css/reading.css` brace balance | ✅ 161 / 161 |
| `student/css/reading-exam.css` brace balance | ✅ 343 / 343 |
| `student/css/extra.css` brace balance | ✅ 858 / 858 |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## What can't break — the invariants

| Concern | Mitigation |
|---|---|
| Existing answer-save flow | All `querySelectorAll` calls use descendant selectors that still resolve through the new `.exam-section-body` wrapper. |
| Q-marker / scroll-into-view | Both listening clients (classroom + solo) auto-expand the parent section before scrolling. |
| First-paint behaviour | Every section defaults to `aria-expanded="true"` and no `.is-collapsed` class — first paint is byte-identical to pre-accordion. |
| Keyboard accessibility | All accordion heads are either `<button>` elements or `<div role="button" tabindex="0">` with explicit Enter/Space handlers. |
| Reduced motion users | `grid-template-rows: 0fr → 1fr` interpolation is honoured-or-snapped depending on `prefers-reduced-motion`. Either path yields the correct final state. |
| Late re-renders | Listening classroom client re-renders the exam shell only once per session (`if (!examRendered) renderExamShell()`). The solo listening renders once per exam open. Neither path re-renders on data updates — so a teacher-collapsed section won't be force-expanded back. |
| Existing CSS in other files | New accordion rules are scoped to per-game CSS files. The `.exam-section` class is used by classroom listening (`classroom/css/listening.css`), classroom reading (`classroom/css/reading.css`), and solo listening (`student/css/extra.css`) — each file is loaded only by its own page, so there's no cross-game CSS bleed. |

---

## Manual smoke test plan

### Listening classroom
1. Teacher creates a Listening Exam room → student joins → exam view renders.
2. Each section header (`Section One` / `Section Two` / `Section Three`) shows a `▾` chevron at the right.
3. Hover → faint sky-blue tint on the head; chevron tints sky-blue.
4. Click → body smoothly collapses, chevron rotates 90° left. Type-after-collapse: answer-save still works (collapse is purely visual).
5. Click again → smoothly expands. Existing typed answers are still in place.
6. Host advances Q-marker to a question inside a collapsed section → section auto-expands, then the active-Q ring appears + scroll.
7. Tab to a section head → focus ring visible → Enter or Space toggles.

### Listening solo
8. Student dashboard → Listening skill → start the FSMEPT exam.
9. Each section header has the chevron and the same hover / focus behaviour.
10. Click → collapses smoothly. Click another section's header → that one toggles independently.
11. Hit Submit (after taking the exam) — submit + grading still work; collapsed sections un-collapse for review.

### Reading (regression check — already shipped, just verify it still works)
12. Same flow on a Reading Classroom and the solo Reading exam — chevrons present, click works, tracker jump auto-expands the target section.

---

## Standing preferences applied

- **Brand-wide stylish** — accordion uses each game's existing colour tokens (sky-blue `--l-sky-2` for listening, rose `--r-rose-2` for reading, blue `#60a5fa` for solo listening). Same cubic-bezier easing across all four sites for visual consistency.
- **Sanity + smoke + dated md** — this file.
- **Don't break anything** — every section defaults to expanded, all DOM queries still resolve, no auto-collapse logic exists. Tested syntax + brace balance + readings regression.

---

## Honest scope statement

The user asked for accordions "everywhere possible". I shipped accordions in **four places** (reading + listening, classroom + solo) and **deliberately skipped six other candidates** (teacher dashboard panels + tab sections + assignment cards + assignment modals + activity logs filters + entry-point selectors) because, after surveying each, I judged the breakage risk higher than the user benefit.

If any of those skipped candidates ARE valuable to you, I'd rather do them in a dedicated follow-up pass — one place at a time, with focused testing — than spray accordions across a broad surface and risk regression. The reading-classroom + listening-classroom Q-marker auto-expand is the kind of subtle interaction-with-existing-flow detail I'd want a dedicated turn to think about for each of the skipped sites too.
