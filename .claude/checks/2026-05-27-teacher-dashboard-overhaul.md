# Sanity + Smoke — Teacher dashboard overhaul (3 dup cleanups + 5 features)

**Date:** 2026-05-27
**Trigger:** After the dashboard review, the user picked: duplicates 1/2/3 + missing features 1/3/4/5/7.

---

## Duplicates resolved

### Dup#1 — Recent Activity is now clearly a teaser
- Overview's Recent Activity panel: added a **"View all →"** button (→ Activity tab) + a "Showing the latest 5 · full history on the Activity tab" caption.
- Reduced the feed from 6 → 5 items so it reads as a preview, not a competing list.
- Files: `teacher-dashboard.html` (panel header), `teacher/js/overview-v2.js` (slice 6→5).

### Dup#2 — the 3 assignment surfaces are now labelled
Each surface got a sub-line stating its distinct job:
- **Assignments tab** → "Create, edit & delete — the source of truth."
- **Overview "Assignments Overview"** → "At-a-glance KPIs & per-skill totals."
- **Activity "Assignment Status"** → "Per-assignment grading status, pending-first."
- Files: `teacher-dashboard.html`, `teacher/js/assignments-overview.js` (×2 panel headers).

### Dup#3 — legacy overview DOM consolidated + hardened (NOT removed)
**Honest call:** I audited every legacy ID and ~25 of them (`totalStudents`, `avgScore`, `levelA2Count`, `inactiveList`, …) are still written by live JS (`updateStats()` + the alert/level functions). Removing the elements would null-crash those functions — the exact breakage the user fears, for zero visible benefit (it's already hidden).

**What I did instead:** wrapped the whole legacy block in one `<div id="legacyOverviewCompat" hidden>` with a clear comment. This:
- Keeps every ID alive (zero crash risk).
- Hardens the hiding (a parent `hidden` hides the subtree unconditionally, belt-and-braces beyond the `body.t2-active` CSS).
- Makes the intent unambiguous in source.

A true removal needs `updateStats()` + the alert/level functions refactored to target the v2 IDs first — a dedicated, riskier pass I flagged for later rather than risk it here.

---

## Features built

### Missing#1 — Individual student drill-down  *(new file: `teacher/js/student-detail.js`)*
Click any student row (or the new 👁️ button) → a full-screen modal:
- Profile header (avatar, name, email, class/level/module/year, active badge)
- Quick stats (sessions · avg score · words · last active)
- **Per-skill breakdown** across all 6 skills (session count + avg-score bar, colour-coded)
- **Assignments** targeting that student with done/in-progress/overdue/not-started chips
- **Recent sessions** table (last 12)
- Modal built dynamically (no big HTML edits); Esc / backdrop / ✕ all close it.

### Missing#4 — Per-student printable PDF report  *(in `student-detail.js`)*
"🖨 Print / PDF" button in the drill-down opens a clean print-optimized window (own stylesheet) and fires `window.print()` → teacher picks "Save as PDF". No PDF library. Includes profile, per-skill table, assignments table, generated-date footer — ready for parent-teacher meetings.

### Missing#3 — Act on Needs Attention  *(in `teacher/js/overview-v2.js`)*
- The existing "View" button now opens the **drill-down modal** (was: just scroll-to-row).
- New **🚩 Flag for follow-up** button per row — toggles a localStorage marker (keyed per-teacher-uid), shows a 🚩 next to flagged names. No Firestore write.

### Missing#5 — Class comparison  *(new file: `teacher/js/dashboard-extras.js`)*
New "🏫 Class Comparison" panel on the Overview tab:
- Average-score bar per class, sorted, with student-count / session-count / active-this-week inline.
- Cohort **this-week-vs-last-week** activity-trend chip with ▲/▼ delta.

### Missing#7 — Deadline calendar  *(in `dashboard-extras.js`)*
New "🗓️ Deadline Calendar" panel on the Assignments tab:
- Month grid with assignment-deadline chips (skill icon + title) on their due dates.
- Prev/next month nav (viewed month persists across data re-renders).
- Today cell highlighted; "+N more" when a day has >3 deadlines.

Both new panels self-install + patch `renderOverviewV2` / `renderAssignments` (same proven pattern as `assignments-overview.js`) — no new Firestore reads, read from `allStudents` / `allSessions` / `allAssignments`.

---

## Files touched

**New**
- `y/teacher/js/student-detail.js` (drill-down + PDF)
- `y/teacher/js/dashboard-extras.js` (class comparison + calendar)

**Modified**
- `y/teacher-dashboard.html` — Recent-Activity teaser, assignment-tab sub-line, legacy compat wrapper, 2 new script tags
- `y/teacher/js/overview-v2.js` — feed 6→5, Needs-Attention View→modal + flag button
- `y/teacher/js/assignments-overview.js` — 2 panel sub-lines
- `y/teacher/js/students.js` — 👁️ View button on each row
- `y/teacher/css/dashboard-v2.css` — drill-down modal, flag button, calendar, clickable-row styles

---

## Checks run

| Check | Result |
|---|---|
| `node -c` on all 5 JS files | ✅ all OK |
| `teacher/css/dashboard-v2.css` brace balance | ✅ 204 / 204 |
| `teacher-dashboard.html` div balance | ✅ 297 / 297 |
| `node y/tools/validate-readings.js` regression | ✅ 46 / 227 / 0 |

---

## Manual smoke test — hard refresh first (Ctrl+Shift+R)

1. **Overview tab:** Recent Activity shows 5 items + "View all →" (jumps to Activity). Class Comparison panel shows per-class bars + week trend. Needs Attention rows have 🚩 + View.
2. Click **🚩** on a Needs-Attention row → flag toggles + persists across reload.
3. Click **View** on a Needs-Attention row → student drill-down modal opens.
4. **Students tab:** rows show a 👁️ button + are clickable → drill-down modal. Verify per-skill bars, assignments chips, recent sessions.
5. In the modal → **🖨 Print / PDF** → print window opens with the clean report → Save as PDF works.
6. **Assignments tab:** Deadline Calendar at the bottom. Deadlines appear as chips on due dates. Prev/next month navigates. Sub-line under the title clarifies the tab is the source of truth.
7. **Activity tab:** Assignment Status sub-line clarifies its role.
8. Confirm no console errors; legacy hidden overview never flashes.

---

## Standing preferences applied

- **Brand-wide stylish** — drill-down modal, flag button, calendar, comparison bars all use the dashboard's indigo/violet tokens + the same scale-in modal animation used elsewhere.
- **Don't break anything** — Dup#3 deliberately stopped short of risky removal; all new panels are additive + self-installing + read-only on existing data; sanity + regression green.
- **Sanity + smoke + dated md** — this file.

---

## Deferred (flagged, not done)

- **True legacy-DOM removal** — needs `updateStats()` + alert/level functions refactored to the v2 IDs first. Own pass when you want it.
- **Classroom-game results history** (the review's Missing#2) — not selected this round; still the most unique-to-your-platform idea if you revisit.
