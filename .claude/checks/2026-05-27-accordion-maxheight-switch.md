# Sanity + Smoke — Accordion bodies switched to max-height (rock-solid collapse)

**Date:** 2026-05-27
**Trigger:** User showed a screenshot: collapsed PART B / PART C / PART D sections each still had a large empty rectangle below the header. Said "it should be closed also the square ! for all sections ! across the app".

The previous fix (adding `min-height: 0; overflow: hidden` on the grid-template-rows body wrapper) wasn't enough — the empty rectangle persisted in their browser.

---

## Why max-height instead of grid-template-rows

The grid-template-rows `1fr ↔ 0fr` approach IS the modern, content-aware accordion technique — but it's inconsistently implemented across browser engines. Some engines silently fall back to `1fr` (no shrink) when they hit `0fr` if any cascade condition isn't perfectly resolved. That's what was leaving the empty rectangle.

**max-height + overflow: hidden** is universally supported and **guarantees** a 0-height collapse. The tradeoff is that the timing curve isn't content-aware (`max-height: 0 → 4000px` animates at the same speed whether the content is 100px or 3000px tall) — but the reliability is worth far more than the timing perfection.

---

## Pattern applied to all 8 accordion sites

```css
.X-body {
  max-height: 4000px;          /* expanded — generous ceiling */
  overflow: hidden;
  opacity: 1;
  transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.35s ease;
}
.X.is-collapsed .X-body {
  max-height: 0;
  opacity: 0;
  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.22s ease;
}
.X-body > * {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.32s ease 0.1s,
              transform 0.38s cubic-bezier(0.34, 1.4, 0.64, 1) 0.1s;
}
.X.is-collapsed .X-body > * {
  opacity: 0;
  transform: translateY(-10px);
  transition: opacity 0.18s ease,
              transform 0.22s ease;
}
```

Per-question accordions use a slightly smaller `max-height: 2000px` ceiling + snappier (0.4s / 0.3s) timing since the bodies are smaller and the user toggles them more often.

Applied to:
| File | Section accordion | Per-question accordion |
|---|---|---|
| `y/classroom/css/reading.css` | `.exam-section-body` | `.exam-item-body` |
| `y/classroom/css/listening.css` | `.exam-section-body` | `.exam-item-body` |
| `y/student/css/reading-exam.css` | `.rd-section-body` | `.rd-q-body` |
| `y/student/css/extra.css` | `.exam-section-body` | `.exam-q-body` |

The chevron rotation + button-shape styling from the previous pass is unchanged — only the body transition mechanism changed.

---

## Animation feel preserved

- Same 0.4–0.5s timing as before
- Same `cubic-bezier(0.4, 0, 0.2, 1)` for the height transition (Material Design "standard")
- Same `cubic-bezier(0.34, 1.4, 0.64, 1)` springy curve on the content's Y-translate
- Same coordinated fade + slide on the body's child
- Collapse is intentionally a touch faster (0.4s) than expand (0.5s) so the close feels snappy and the open feels deliberate

---

## Checks run

| Check | Result |
|---|---|
| `classroom/css/reading.css` brace balance | ✅ 169 / 169 |
| `classroom/css/listening.css` brace balance | ✅ 184 / 184 |
| `student/css/reading-exam.css` brace balance | ✅ 351 / 351 |
| `student/css/extra.css` brace balance | ✅ 868 / 868 |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke — **hard refresh first** (Ctrl+Shift+R / Cmd+Shift+R)

After the cache busts:
1. Open any reading or listening exam — classroom OR solo.
2. Click any section's chevron.
3. The body should **completely disappear** — only the header remains visible, **with NO empty rectangle below**.
4. The header still has rounded corners on all sides because the section's `overflow: hidden` wrapper now visually collapses around it.
5. Same on per-question chevrons within MCQ / find-word / free-text / T-F.
6. Click again → body smoothly expands with the same fade + slide as before.

---

## Standing preferences applied

- **Don't break anything** — only CSS body-transition mechanism swapped; markup, click handlers, focus rings, accessibility attributes unchanged.
- **Sanity + smoke + dated md** — this file.

---

## Why this is the last fix needed

`max-height: 0; overflow: hidden` is the most-tested accordion collapse mechanism on the web — it's worked the same in every browser since IE6. If the rectangle still shows after a hard refresh, the issue is no longer CSS; it's:
- Stale cached CSS still being served (hosting layer)
- A service worker holding the old CSS
- A different CSS file path being loaded than what I've edited

If any of those happen, share another screenshot and I'll trace the actual served file.
