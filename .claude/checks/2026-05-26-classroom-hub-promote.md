# Sanity + Smoke — Classroom Mode promoted to main hub

**Date:** 2026-05-26
**Trigger:** Phase 1 of the Classroom-Mode-grows-up plan. User asked to bring Classroom Mode "out of vocabulary and put it into the main hub besides those skills, like the six skills that we have." Chose layout: **7th tile alongside skills**.

---

## What changed

Classroom Mode was previously buried inside the Vocabulary activity grid (9th card among MCQ / Spelling / Pronunciation / etc.). That made sense when it was a single Vocab Race game; now that it's the umbrella for Vocab Race + Heist + Trust No One + (incoming) Reading + Listening, it's clearly a *delivery mode* that cuts across all skills — not a vocab feature.

Now: it's the 7th tile on `#hubScreen`, rendered as a peer of the six skills.

| Touch | Where |
|---|---|
| 7th `SKILL` entry in the registry | `y/student/js/hub.js` — `id: 'classroom'`, has `href` (not `screen`), `noProgress: true`, violet accent (`#a78bfa`) |
| `openSkill` honours `href` | `y/student/js/hub.js` — if a skill has `href`, `window.location.href = href` instead of `showScreen()` |
| Live-pill render | `y/student/js/hub.js` — `noProgress` skills render `<span class="hub-live-pill">LIVE</span>` in place of the percentage label, and skip the conic-gradient ring fill |
| 4-column grid | `y/student/css/hub.css` — `.hub-grid` now `repeat(4, 1fr)` at desktop so 7 tiles flow as 4 + 3 instead of an awkward 3 + 3 + 1 |
| Classroom-card visuals | `y/student/css/hub.css` — `.hub-card.is-classroom` gets a violet gradient background + matching border glow on hover, so it reads as a different *kind* of card while keeping the same shape |
| Wide-banner on narrow widths | `y/student/css/hub.css` — `@media (max-width: 920px)` and `(max-width: 720px)` make the Classroom card span `grid-column: 1 / -1` so it's a featured banner rather than an orphan tile on its own row |
| LIVE pill animation | `y/student/css/hub.css` — small pulsing dot (1.6s ease) on the left of the LIVE chip to evoke "live broadcasting" |
| Duplicate removed | `y/student-dashboard.html` — the `<a href="classroom-student.html" class="activity-card">` previously nested in the Vocabulary activity grid is gone, replaced by a comment explaining where it lives now |

---

## Files NOT touched

- `y/teacher-dashboard.html` — teachers already see Classroom Mode at top level (sidebar nav `.t2-nav-item` link + the More-menu dropdown item). No equivalent restructure needed on the teacher side.
- `y/classroom-teacher.html` — unchanged; the picker page that aggregates Vocab Race + Heist + Trust No One.
- `y/classroom-student.html` — unchanged; still the entry point students reach via the new hub tile.

---

## Layout behaviour at each breakpoint

| Width | Grid | 7-tile flow |
|---|---|---|
| > 920px (desktop) | 4 columns | Row 1: Vocab · Listening · Grammar · Reading · Row 2: Writing · Speaking · **Classroom** (one slot empty on the right) |
| 720–920px (tablet) | 3 columns + Classroom span | Row 1: Vocab · Listening · Grammar · Row 2: Reading · Writing · Speaking · Row 3: **Classroom** (full-width banner) |
| < 720px (phone) | 2 columns + Classroom span | Row 1: Vocab · Listening · Row 2: Grammar · Reading · Row 3: Writing · Speaking · Row 4: **Classroom** (full-width banner) |

The Classroom card never looks orphaned — it's either a peer in the row or the featured banner under the row.

---

## Checks run

| Check | Result |
|---|---|
| `student/js/hub.js` syntax | ✅ |
| `student/css/hub.css` brace balance | ✅ 39 / 39 |
| `student-dashboard.html` div balance | ✅ 336 / 336 |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |
| Teacher dashboard Classroom-Mode links intact | ✅ sidebar + more-menu both still point to `classroom-teacher.html` |

---

## Standing preferences applied

- **Brand-wide stylish** — Classroom tile reuses the existing `.hub-card` shape, adds a brand-consistent violet gradient + glow + a LIVE-broadcast pill with a pulsing dot. Same dark-glass surface, same accent-bar pattern, same hover-lift. The new wide-banner-on-narrow-widths treatment matches the responsive logic already used in the Dashboard sections.
- **Sanity + smoke + dated md** — this file.

---

## What's next (per the bigger plan)

Phase 1 (this file): Hub restructure ✅
**Phase 2: Reading Classroom** — build the host-projects-passage / students-answer-blind / no-leak / teacher-reveal flow on top of the Trust-No-One scaffolding. Reuses existing reading-exam content.
Phase 3: Listening Classroom — same scaffold + audio control layer with the `replayPolicy` per-pack setting.
