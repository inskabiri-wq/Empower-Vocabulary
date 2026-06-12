# Student dashboard — full-width two-column hub

**Date:** 2026-05-31
**Trigger:** "teacher dash is full page but student dash is marginalized." User picked the **two-column hub** layout.

---

## Cause
The hub landing (`#hubScreen` — Skills grid + Your Assignments) was a stack of blocks each capped at **`max-width: 900–940px` and centred** (`hub.css`), so on a wide monitor it floated mid-page with big empty side margins. (The teacher dash fills the page via a sidebar+fluid layout; the vocab sub-screen `#menuScreen` already had two columns — the landing never got it.)

## What changed (layout/CSS only — no data/logic touched)
- **`student-dashboard.html`** — wrapped the hub body in `.hub-two-col`:
  - **Left `.hub-main`** = Skills label + `#hubGrid` (unchanged grid).
  - **Right `.hub-rail`** = a compact **stats card** (🔥 Streak · 🧠 Sessions · ⭐ XP) + the **relocated** Your-Assignments box. **All IDs preserved** (`#hubGrid`, `#assignmentsSection`, `#assignmentsContainer`, `#assignmentBadge`) → hub.js + the assignments renderer untouched. (The assignments card was originally a sidebar widget, so the narrow rail is its native fit.)
- **`hub.css`** — `.hub-two-col` grid (`minmax(0,1fr) 360px`, max-width 1340, centred), un-capped the inner blocks, sticky `.hub-rail`, `.hub-rail-stats` card. Collapses to **one column ≤1200px** (rail drops below; the grid's existing 920/720 breakpoints still drive tiles-per-row), so 4 tiles + the rail never get cramped.
- **`hub.js`** — added 3 `MIRROR_MAP` entries (`currentStreak→hubRailStreak`, `journeySessions→hubRailSessions`, `profileXP→hubRailXp`). Reuses the existing mirror/observer mechanism that already feeds the hub header → the rail card populates from in-memory dashboard values with **zero new Firestore reads**.

## Why it's safe
- Pure layout: HTML re-wrap + CSS + 3 mirror entries. No change to the assignments data/rendering, no new reads, no rules.
- Every consuming ID preserved (smoke-verified, each exactly once).
- Responsive: >1200px two-column; ≤1200px single column (existing 4/3/2 tile breakpoints intact).

## Checks
- `node --check student/js/hub.js` → OK.
- `hub.css` braces 52/52; new classes present.
- `student-dashboard.html` tags balanced; 4 preserved IDs each ×1; new structure + rail IDs present.
- hub.js mirror entries present. → **SMOKE PASS** (`.claude/twocol-hub-smoke.py`).
- **Not visually tested** — the student dashboard is auth-gated (can't log in here). After deploy: open a student account on a wide screen, confirm skills fill the left + assignments/stats sit in the right rail, and it stacks cleanly on a phone.

## Follow-up — "still in margins" (round 2)
First pass widened the hub *layout* but it still sat in ~316px side margins. **Real cause:** `.container` (student/css/styles.css:42) caps everything at **`max-width:1200px`** and `body` centres it — the teacher dash only looks full-page because it overrides this via `body.t2-active .container` (full-bleed). So the fence was the container, above my hub layout.
- **`hub.css`:** `.container:has(#hubScreen.active){ max-width:1900px; }` — widen the card **only when the hub is active** (vocabulary screen untouched), capped at 1900 so it doesn't stretch on ultrawide. `:has()` degrades gracefully (stays 1200 if unsupported — no breakage).
- `.hub-two-col` max-width `1340 → none` so the hub fills the widened card.
- Added `@media (min-width:1450px)→5 cols` and `(min-width:1750px)→6 cols` for the skills grid (additive; the default 4-col and ≤920/≤720 classroom-span breakpoints still apply) so the width fills with right-sized tiles instead of 4 giant ones.
- Verified: braces 57/57; rules present.
- **Needs a fresh deploy** (this is on top of what's already live).

## Deploy
Hosting-only (HTML/CSS/JS). Ships with `firebase deploy --only hosting` + hard-refresh (SW already v4).

## Assignment-section ideas (offered, NOT yet built — awaiting your pick)
Card grid (2–3/row), group-by-urgency (Overdue/Due-soon/Upcoming/Done), colour-coded countdown chips, filter pills with counts, a "X of Y done this week" strip, friendlier empty state.
