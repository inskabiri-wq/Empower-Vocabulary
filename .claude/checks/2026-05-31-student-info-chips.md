# Student info chips (Class · Level · Module · Year) in the Your-Assignments box

**Date:** 2026-05-31
**Trigger:** "bring student info to the student dash (class/level/module/year — skip teacher), merge it into the assignments box in one box, separated a bit from the assignments."

---

## Zero extra Firebase reads
All four fields live on the student's **own user doc** (`studentClass`, `level`, `module`, `academicYear`), which `student/js/auth.js` **already loads** on auth and caches as `window.currentStudentData`. So this is pure rendering — **0 new reads**. (Teacher skipped per request — students can't read teacher docs per the rules anyway, so it would've needed denormalization.)

## What changed
- **`student-dashboard.html`** — added a `#studentInfoChips` row **inside** the `.assignments-card`, right under the "Your Assignments" title and above `#assignmentsContainer` (one box, as asked). Chips start `display:none`.
- **`student/js/auth.js`** — right after `window.currentStudentData = data`, populate the 4 chips from that same `data` (Class /Level /Module + raw year). Only non-empty values show; the wrapper hides entirely if the student has none. Wrapped in try/catch (non-fatal).
- **`student/css/hub.css`** — `.student-info-chips` = small muted pills, and **set apart from the assignments** via `padding-bottom:14px` + a `border-bottom` hairline (the "separate it a bit").
- **`service-worker.js`** — `CACHE_VERSION` **v5 → v6** so it reaches the browser (v5 is already deployed).

## Checks
- `node --check` auth.js + service-worker.js → OK.
- hub.css braces 54/54; divider present.
- 4 chip ids in the HTML; auth.js populates them.
- SW v6.

## Follow-up (user: "why is it under assignment!")
- **Moved the chips ABOVE the "Your Assignments" title** (top of the box, hairline divider below them) so they read as the student's own info, not assignment metadata.
- **Fixed double-labelling**: a value that already starts with its label (e.g. `module: "Module 1"`) was rendering "Module Module 1". Now smart-prefixed → shows "Module 1". (`Class B125`, `Level B1+`, `Module 1`, `2026-2027`.)
- `CACHE_VERSION` → **v7**.

## Deploy
Hosting-only. `firebase deploy --only hosting` → worker v7 → cache purge → auto-reload → chips at the top of the box, correctly labelled.
