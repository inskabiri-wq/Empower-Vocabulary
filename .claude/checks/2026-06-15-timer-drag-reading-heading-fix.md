# 2026-06-15 — Timer draggable + reading "Gap → heading" label fix

## Timer: draggable + moved off the music control
The timer button sat bottom-right, exactly where `.music-control` is
(fixed; bottom:20px; right:20px) on the classroom pages, so they overlapped.
- `js/classroom-timer.js`: default position moved to bottom-LEFT (left:18px), and
  the launch button is now draggable (pointer events; clamps to viewport; persists
  to localStorage `ct_pos`; restores on load). `cursor:grab`/`grabbing`,
  `touch-action:none`. A drag (>4px) does NOT open the timer; a clean click does.
- Cache: classroom-timer.js ?v=1 -> **v2** on all 6 pages; service-worker v50 -> **v51**.

Where the timer is wired (6 teacher pages): teacher-dashboard.html, classroom-teacher.html,
classroom-heist-teacher.html, classroom-listening-teacher.html,
classroom-reading-teacher.html, classroom-trust-teacher.html. (Not student pages.)

## Reading A2 Reading 1 — Part B mislabelled "Gap N"
Part B is a paragraph→heading matching task (options a-i are headings; the passage has
`rd-gap` spans atop each "Lie" paragraph that the engine fills inline), but its items
were labelled "Gap 2 … Gap 9". Teacher flagged: "it is not a gap it is a heading."
- `student/data/readings/A2/exam-1.json`: item labels "Gap N" -> "Paragraph N".
- Kept `type: match-gaps` (NOT match-headings): only the match-gaps engine fills the
  passage's `rd-gap` spans, so the chosen heading still shows inline above its paragraph.
  Changing the type would have silently removed that. The label was the only real bug.
- Reading data files have no `?v=`, so the SW bump (v51) busts them.
- JSON re-validated; labels confirmed "Paragraph 2..9".

## Verification — sanity + smoke
- **Sanity:** node --check classroom-timer.js OK, no em dashes (removed the one in the
  header). Reading JSON parses; Part B type + labels confirmed.
- **Smoke** (timer harness): 0 errors; default position bottom-left (18px); simulated
  drag moves the button and persists `ct_pos`; a drag does not open; a clean click opens.

## Note: same "Gap"-vs-heading mislabel may exist in other reading exams
Only A2 Reading 1 was fixed (the one flagged). If other exams encode a heading task as
match-gaps with "Gap N" labels, they'd need the same per-file relabel — a content audit
to do on request.

## Admin sub-tabs (de-crowd) — done
teacher-dashboard.html #tab-admin: added an `#adminSubNav` pill bar (Teachers / Features
/ Content / Organizations). A small inline script toggles the existing panels
(#teachersList, #featureActivationPanel, #contentControlsPanel, #orgAdminPanel) by id, so
only one shows at a time; each panel's own JS is untouched. Default = Teachers; stacking
top-margins dropped when shown alone. HTML (network-first) so no version bump.
- Smoke (harness mirroring the nav+script): default shows only Teachers; clicking
  Organizations / Content shows only that panel; active pill tracks. 0 issues.

## Still queued (per the answers this round)
- **Widgets tray:** a "Widgets" section on/above the dashboard that opens the floating
  timer (and future widgets). Decision was "side section, floats when clicked" — build a
  launcher section that opens the floating widget(s).
- **Export report -> admin only:** gate the EXPORT/printable report so teachers can't run
  it (need to confirm exactly which export: the admin teachers CSV export is already
  admin-tab-only; the per-student "Print / Save as PDF" in the student drill-down is
  teacher-reachable — likely that one).
- **Teacher walkthrough PRESENTATION (not in-app):** generate a guided-tour-style slide
  deck of the dashboard for a training session (the user does NOT want an in-app tour).

## Not done (advice/decisions pending, not built)
- Widgets tray at the top of Lingualab (timer as first widget, extensible): needs a
  placement decision (student hub vs teacher dashboard) before building.
- Admin panel de-crowding: suggestions given; needs a pick.
- Teacher walkthrough/onboarding + presentation: suggestions given; needs a pick.
- "Report admin-only": needs to confirm WHICH report (completions table / student
  drill-down / a specific export) before gating.
- No deploy. No push.
