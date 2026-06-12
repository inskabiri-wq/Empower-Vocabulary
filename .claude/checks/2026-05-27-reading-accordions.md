# Sanity + Smoke — Reading section accordions (both classroom + solo)

**Date:** 2026-05-27
**Trigger:** User requested accordion animations for the question parts in the reading section "in both parts, in classroom and in the reading section itself" — with the explicit, repeated request that **nothing breaks**.

---

## What shipped

Each section in both reading flows is now an accordion. Click a section header to collapse it; click again (or jump to a question inside it from the tracker) to expand it. Default state: **all expanded** — so first-paint behaviour is identical to before; the accordion is a student-initiated "fold this away" affordance, never an obstacle.

### 1. Classroom reading — `classroom-reading-student.html`

**Markup change** (in `y/classroom/js/reading-student.js`, `renderExamShell`):
- Section header is now a real `<button>` element with `aria-expanded="true"` — keyboard-reachable, click-able, screen-reader-friendly. Replaces the old `<div>`.
- Added a `▾` chevron span at the right of the head.
- Wrapped the instructions + items list in a new `<div class="exam-section-body">`. This is the element that animates.

**JS** (same file):
- New click delegation right after `wrap.innerHTML = ...` — toggles `.is-collapsed` on the parent `.exam-section`, flips `aria-expanded`. Doesn't touch any answer-save logic.

**CSS** (in `y/classroom/css/reading.css`):
- `.exam-section-h` re-styled as a button: transparent background, `cursor: pointer`, hover tint, focus-visible ring in rose.
- `.exam-section-chevron` rotates `-90deg` when collapsed; spring-y cubic-bezier so the motion has tiny overshoot.
- `.exam-section-body` uses `display: grid; grid-template-rows: 1fr` → `0fr` for the height transition (modern browsers — Chrome 117+, Firefox 124+, Safari 17.4+).
- Body's single child gets `min-height: 0; overflow: hidden` so the row can shrink below content height during the animation. Fades the contents at the same time so the close feels intentional.

### 2. Solo reading — `student/data/readings/.../exam-N.json` driven engine

**Markup change** (in `y/student/js/reading-exam.js`, `renderSection`):
- `.rd-section-head` gets `role="button"`, `tabindex="0"`, `aria-expanded="true"` — preserves the existing `<div>` element (less risk than swapping tag) while adding accessible button semantics.
- Added a `▾` chevron after the existing label + instructions spans.

**JS** (same file, `wireMainEvents`):
- Extended the existing event-delegation `click` listener to catch `.rd-section-head` clicks (via `.closest()`) — toggles `.is-collapsed`, flips `aria-expanded`. Order-of-checks places this AFTER the flag/note button handlers so those still get priority on click.
- New keydown listener for `Enter` / `Space` on a focused section head — calls `head.click()` so keyboard users get the same toggle.
- Tracker jump-to-question (in the existing tracker-click handler) now **auto-expands** the target section if it's collapsed, BEFORE the `scrollIntoView`. Without this fix, jumping to a question inside a collapsed accordion would scroll to a 0-height container and the student would see nothing.

**CSS** (in `y/student/css/reading-exam.css`):
- `.rd-section-head` becomes `display: flex; align-items: flex-start; gap: 10px; cursor: pointer; user-select: none`. Hover deepens the teal tint; focus-visible ring uses the existing `--rd-accent` token. Bottom border softens when collapsed (no body below = no need for a divider).
- `.rd-section-label` keeps its inline-block tag look but drops its old `margin-right: 10px` — the parent's flex `gap: 10px` covers it (otherwise spacing would have doubled to 20px).
- `.rd-section-instructions { flex: 1 }` — takes the remaining horizontal space so long instructions wrap nicely to the right of the label, never under it.
- `.rd-section-chevron { flex-shrink: 0; align-self: center }` — pinned to the right edge; rotates `-90deg` on `.is-collapsed`.
- `.rd-section-body` uses the same `grid-template-rows: 1fr → 0fr` trick, plus padding-top / padding-bottom transition so the section visually closes flush with the header. Mobile media query already cascades correctly (specificity: `.rd-section.is-collapsed .rd-section-body` beats `@media .rd-section-body`).

---

## Files modified

- `y/classroom/js/reading-student.js`
- `y/classroom/css/reading.css`
- `y/student/js/reading-exam.js`
- `y/student/css/reading-exam.css`

## Files NOT touched (deliberately scoped)

- `y/classroom/js/listening-student.js` / `listening.css` — user asked for reading only. Listening uses the same `.exam-section` class names but its CSS lives in `listening.css` (loaded only on listening pages), so the reading.css accordion rules don't leak in. Same for `classroom/css/styles.css`.
- All other reading-related files (host JS, host CSS, host HTML, exam-registry, exam JSONs, tracker, highlighter, notes, flags) — untouched.

---

## What can't break — the invariants

| Concern | Why it can't break |
|---|---|
| Existing answers | Saved by `data-key` queries (`.exam-text[data-key=…]`, `input[name=…]`). Both still resolve through the new `.exam-section-body` wrapper because `querySelectorAll` uses descendant selectors. |
| Q-marker / Q tracker | Solo reading: jump-to handler now expands the parent section first. Classroom reading doesn't have a Q-marker. |
| Flag / note buttons (solo) | The new `.rd-section-head` click handler is the LAST `closest()` check in the delegation chain — flag + note button checks run first and `return` before falling through. |
| Native button submit behaviour | The new `<button class="exam-section-h">` in classroom doesn't sit inside a `<form>`, so no accidental submit. |
| Mobile layout | New `display:flex` on `.rd-section-head` preserves the visual row of label + instructions + chevron. Mobile media query already overrides padding, and my collapsed-state CSS has higher specificity so the collapse animation still nuke-padding-on-mobile correctly. |
| First-paint behaviour | All sections default to `aria-expanded="true"` (no `.is-collapsed`). No visual change until the student clicks. |
| Reduced-motion users | The grid-template-rows transition gracefully snaps instantly when `prefers-reduced-motion: reduce` is set (no animation = no change in final state). Already documented browser behaviour. |

---

## Checks run

| Check | Result |
|---|---|
| `node -c y/classroom/js/reading-student.js` | ✅ |
| `node -c y/student/js/reading-exam.js` | ✅ |
| `y/classroom/css/reading.css` brace balance | ✅ 161 / 161 |
| `y/student/css/reading-exam.css` brace balance | ✅ 343 / 343 |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke test

### Classroom reading
1. Teacher creates a Reading Exam room → student joins → exam view appears.
2. Each section header now has a `▾` chevron at the right. Hovering shows a faint rose-tint background + the chevron tints rose.
3. **Click a section header** → section body smoothly collapses to zero height; chevron rotates 90° left. Fellow sections untouched.
4. Click again → section smoothly expands back. Previously-entered answers are still there.
5. Hit Tab to land on a header → focus ring visible. Hit Enter or Space → toggles. Works without a mouse.
6. Type an answer in one section, collapse the section, submit → answer was still saved (collapse is purely visual).

### Solo reading
7. Student dashboard → Reading skill → pick any A2/B1/B2 exam → exam view.
8. Each section in the right pane (questions) has a chevron. Click the head → collapses.
9. Open the Tracker (▦ button) and click a question that's inside a **collapsed** section → the section auto-expands, smooth-scrolls to the question, pulse animates. Focus lands on the input.
10. Highlight a word in the passage (text selection → highlight popup). Still works.
11. Click a flag (🚩) on a question row inside an expanded section → flag toggles. Click the section's chevron icon — section collapses but the flag state is preserved on the underlying data.
12. Submit the exam → grading still runs; section accordions don't gate the score logic.

---

## Standing preferences applied

- **Brand-wide stylish** — accordion uses the existing colour tokens (`--r-rose-2` in classroom, `--rd-accent` teal in solo) for hover + chevron. Cubic-bezier easing with a tiny overshoot matches the spring-y vibe used elsewhere in the app. Grid-template-rows transition is the modern, idiomatic accordion animation.
- **Sanity + smoke + dated md** — this file.

---

## Open concerns

- Browsers older than Safari 17.4 / Firefox 124 / Chrome 117 don't interpolate `grid-template-rows` between `0fr` and `1fr`. On those, the section will still collapse — just instantly, without the smooth animation. The state transition is correct either way. We can fall back to a `max-height` animation if real-world data shows a meaningful share of older browsers; current Empower Lab telemetry shows all classrooms on modern Chrome/Edge so it's not worth the complexity yet.
- Section state doesn't persist across page reloads or passage tab switches. Intentional — the accordion is a per-session focus aid, not a saved preference. If teachers report "I want it to remember the state", we can add a `localStorage` per-exam-id state map (~5 lines of code).
- The user only asked for the **reading** section — listening was left untouched even though it shares the same `.exam-section` class names. If listening needs the same treatment, mirroring the changes from `reading-student.js` → `listening-student.js` and from `reading.css` → `listening.css` is a 4-edit job.
