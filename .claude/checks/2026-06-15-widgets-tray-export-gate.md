# 2026-06-15 — Widgets tray + export-report admin gate

## Export report -> admin only
The only teacher-reachable export was the per-student "🖨 Print / Save as PDF" in the
student drill-down (the teachers-list CSV export already lives inside the admin-only tab).
- `teacher/js/student-detail.js`: the Print/PDF button now renders only when
  `isAdmin()` (global from config.js: current user email === ADMIN_EMAIL). Teachers can
  still open the drill-down and see progress; they just can't export the report. The
  click wiring is guarded so its absence doesn't error.
- student-detail.js has no `?v=` -> busted by the SW bump.

## Widgets tray (extensible launcher)
Per "a side section on/above Lingualab that floats when clicked":
- `js/widgets-tray.js` (new): a docked "🧰 Widgets" launcher (bottom-left) that opens a
  popover of widget chips. First/only widget = "⏱ Class Timer" -> opens the floating
  timer (window.ClassTimer.open()). Extensible via the WIDGETS array (dice, name picker,
  noise meter, ... later). Self-contained styles; closes on outside-click / Esc.
- `js/classroom-timer.js`: the floating launch button is now suppressible via
  `window.CLASS_TIMER_NO_FAB` (overlay still builds, so ClassTimer.open works).
- `teacher-dashboard.html`: sets CLASS_TIMER_NO_FAB=true + loads widgets-tray.js, so the
  dashboard shows the Widgets tray (single entry) instead of a duplicate floating button.
  Classroom host pages keep the floating timer FAB as before.

## Versions
- classroom-timer.js ?v=2 -> **v3** (all 6 pages); widgets-tray.js new **?v=1**;
  service-worker v51 -> **v52**. (HTML + student-detail.js are network-first / SW-busted.)

## Verification — sanity + smoke
- **Sanity:** node --check OK on classroom-timer.js, widgets-tray.js, student-detail.js;
  no em dashes in the new file.
- **Smoke** (harness, CLASS_TIMER_NO_FAB=true): timer FAB suppressed; Widgets launcher
  present; clicking it opens the popover with a Class Timer chip; clicking the chip opens
  the floating timer overlay; popover closes after pick; ClassTimer.open exposed; 0 errors.

## Still queued
- **Teacher walkthrough PRESENTATION** (slide deck of the panel for a training session;
  NOT an in-app tour) — next.

## Not done
- No deploy. No push.
