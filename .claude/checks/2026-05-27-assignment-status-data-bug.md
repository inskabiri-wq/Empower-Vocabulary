# Sanity + Smoke — Assignment Status panel "empty for everyone" bug

**Date:** 2026-05-27
**Trigger:** User: "i think it is not reading it and what is the difference between this and assignment ?"

The user is admin and HAS assignments, but the Assignment Status panel was showing the "No assignments across the school yet" empty state. Looked like the empty-state polish I just shipped — actually a long-standing data-binding bug that always made the panel empty.

---

## Root cause

`teacher-assignments.js` declares the live-data globals as:
```js
let allAssignments = [];
let allCompletions = {};
let allWritingSubs = {};
```

Top-level **`let` declarations in a classic `<script>` do NOT attach to `window`**. They go into the script's shared lexical scope. That means:
- `window.allAssignments` → always `undefined`
- bare `allAssignments` from any other classic script in the same page → works (shared script realm)

Two consumer files were reading the BROKEN form:
- `y/teacher/js/assignments-overview.js` line 145 (overview panel) and line 338 (activity panel)
- `y/assignments/js/grading-stats.js` line 77 (writing-assignment grading modal)

Both wrote `(Array.isArray(window.allAssignments) ? window.allAssignments : [])`. The Array.isArray check failed, the fallback `[]` was used, and every consumer rendered as if there were no assignments.

Other consumers in `assignments-overview.js` already used the correct bare-name pattern with a `typeof` guard (lines 112 and 126 for `allWritingSubs` / `allCompletions`) — so the bug was specifically about the three `window.allAssignments` references.

---

## Fix

All three sites changed from:
```js
Array.isArray(window.allAssignments) ? window.allAssignments : []
```
to:
```js
(typeof allAssignments !== 'undefined' && Array.isArray(allAssignments))
  ? allAssignments
  : []
```

Same `typeof X !== 'undefined'` guard as the existing pattern for sibling globals in the same files. Idiomatic and consistent.

Load order in `teacher-dashboard.html` was already correct:
1. `assignments/js/teacher-assignments.js` (declares the globals)
2. `assignments/js/grading-stats.js` (reads them)
3. `teacher/js/assignments-overview.js` (reads them)

So bare-name access from #2 and #3 resolves to the `let` declared in #1.

---

## What changed in this pass

| File | Change |
|---|---|
| `y/teacher/js/assignments-overview.js` | 2× `window.allAssignments` → bare `allAssignments` (overview panel + activity-status panel) |
| `y/assignments/js/grading-stats.js` | 1× `window.allAssignments` → bare `allAssignments` (writing grading-stats modal) |

No other files touched.

---

## Checks run

| Check | Result |
|---|---|
| `node -c y/teacher/js/assignments-overview.js` | ✅ |
| `node -c y/assignments/js/grading-stats.js` | ✅ |

---

## Manual smoke test — hard-refresh required

1. Log in as admin (or any teacher with existing assignments).
2. Open the teacher dashboard → **Activity** tab.
3. Scroll to the **Assignment Status** panel.
4. **Before:** empty state appeared regardless of how many assignments existed.
   **After:** the table renders, listing each assignment with: title · skill icon · target · pending grading count · completion count · submissions count.
5. Same fix applies to the **Overview tab → Assignments Overview** card (KPIs + per-skill bars) — it now populates from the same `allAssignments` array.
6. Open a writing assignment's **grading stats modal** — it now finds the writing assignments instead of showing "No writing assignments yet."

---

## "What's the difference between this and Assignments?"

| Surface | Tab | What it does |
|---|---|---|
| **Assignments** tab | Tab #3 | **Source of truth**. Where teachers CREATE, EDIT, DELETE assignments. Lists every assignment as an editable card with student-completion bars + per-card action buttons. |
| **Assignment Status** panel | Activity tab (#4) — bottom of tab | **Status report**. A read-only table view of the same assignments, sorted with "pending grading" at the top. Used to see "what needs my attention RIGHT NOW" without scrolling through the editable list. |
| **Assignments Overview** card | Overview tab (#1) — under Level Distribution | **KPI dashboard**. Numeric summary (active, overdue, due-today, completed) + per-skill bar chart + per-teacher table (admin only). Used to answer "how is teaching going at-a-glance?" |

All three read from the **same `allAssignments` global** — they just slice + format it for different teacher workflows.
