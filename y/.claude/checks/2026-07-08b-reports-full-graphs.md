# 2026-07-08 (b) - Reports: every old-Excel data family graphed + full CSV parity

## User question / directive
"Where is the data from the Excel report we deleted? I need ALL of it graphed."

## Answer established
No data was deleted - only the sidebar button. The data is Firestore
sessions/users; the Reports workbook's Students sheet carries it. Honest gap
found: the new Students sheet was missing 3 old-CSV columns (Words Practiced,
Status, Days Since Last Active) and most families were not yet charted.

## Changes (teacher/js/reports-admin.js ?v=1 -> ?v=2)
- aggregate() now computes every old-CSV data family: per-skill counts+avgs,
  per-class counts+avgs, unique words (global + per student), per-student
  averages (distribution buckets), engagement buckets from lastLogin
  (Active 7d / 8-30d / 30d+ / Never), module + academic-year splits, top
  units, weekly avg-score trend (weeks keyed by Monday).
- KPI row: + "Unique words practiced".
- Charts grew 4 -> **14** (all hand-rolled SVG, filter-aware):
  sessions/day, avg per skill, sessions per skill, avg per week (trend),
  score distribution, sessions per class, avg per class, top practiced word
  lists, top students by unique words, students per level / module / year,
  engagement (last login), games by type.
- Excel Students sheet: restored Words Practiced, Status (Active = login
  within 7d, matching old CSV), Days Since Last Active (N/A when never).
- teacher-dashboard.html script ?v=2; service-worker v80 -> v81.

## Verification
- node --check OK; em-dash clean; bump --check: all versions consistent.
- Real-browser iframe harness (real script, stubbed data): **14 SVG charts**
  render; all 10 new chart titles present; words KPI present; Excel Students
  head has all 3 restored columns; Ali's unique words = 3 (dedup across
  sessions works); Status=Active for 1-day-ago login; never-logged-in student
  gets "N/A"; all 5 sheets written.

## Deploy: included in the same pending deploy as 2026-07-08a
    firebase deploy --only firestore:rules,hosting

## Addendum (same day) - "no data" bug fix + emoji
- LIVE BUG (user screenshot): panel stuck on "Waiting for student data to
  load...". Cause: config.js declares `let allStudents` / `let allSessions`
  (top-level let = global LEXICAL binding, NOT a window property), but the
  panel checked `window.allStudents` - forever undefined. My iframe harness
  had set window props, so it passed while the real page failed.
- Fix (reports-admin.js ?v=2 -> ?v=3): all data reads via bare identifiers
  with typeof guards (students0()/sessions0()/skillOf()); waiting loop capped
  at 15 tries (~12s) then renders anyway.
- Emoji: sub-tab + heading 📊 -> 📈 (user preference).
- service-worker v81 -> v82.
- Verified with a FAITHFUL harness: real <script> elements with top-level
  `let` (eval can't create global lexical bindings - that was the earlier
  harness gap). Result: waiting message while empty -> data pushed into the
  lexical arrays -> panel renders 14 charts + KPIs + 1 game row. Emoji + ?v=3
  confirmed in served HTML.

## Addendum 2 (same day) - bigger charts + click-to-zoom + COMPLETE workbook
- Charts: grid minmax 310px -> 430px (2 per row, not 4 cramped), chart height
  190 -> 230, fonts up (values 12px, labels 10.5px).
- NEW click-to-zoom lightbox (user request "hover -> screen size"; click/tap
  chosen over hover - works on tablets, no accidental triggers): every chart
  card is clickable (zoom-in cursor + magnifier hint), opens a near-fullscreen
  overlay where the SAME data is RE-RENDERED at 1100x430 with 16px/13px fonts
  (not stretched). Close: X button, backdrop click, or Esc.
- Excel completeness audit (user: "nothing missing?"): honest gaps found and
  filled. Workbook grew 5 -> 14 sheets: Summary (generated timestamp + the
  ACTIVE FILTERS that produced the file + KPI numbers), Students (full old-CSV
  parity), Skills, Classes, Levels, Modules, Years, Word lists (per-unit
  sessions+avg), Weekly, By day, Engagement, Sessions (RAW one-row-per-session
  incl date/student/skill/activity/unit/score/correct/total/words, capped at
  10000 with truncation notice), Games, Game players (one row per player per
  game - full scoreboards). Known exclusions (deliberate, per earlier user
  choice): writing grades (kept in the grading view's own CSV), assignment
  completion detail.
- reports-admin.js ?v=3 -> ?v=4; service-worker v82 -> v83.
- Harness (faithful lexical-let, real script): 14 charts, 14 zoomable cards,
  grid 430 confirmed, zoom opens with 1100x430 SVG + right title, closes via
  button; workbook = exactly the 14 sheets above; Summary carries Period
  filter; raw Sessions rows correct incl student join; Game players rows = 2.

## Addendum 3 (same day) - unit merge + hover animation
- User spotted bare "2"/"1" bars in Top practiced word lists: grammar practice
  saves unit as a bare number ("2") while vocabulary saves "Unit 2" - the same
  coursebook unit was counted as two bars. Fix: normUnit() ("2" -> "Unit 2")
  applied in aggregate byUnit, the Excel Word-lists sheet and the raw Sessions
  sheet. Verified: "Unit 2" + "2" + numeric 2 -> ONE bar (U2), Excel row
  ["Unit 2", 3, 73].
- Hover cue added (user: "no animation for hovering, it is a click"): chart
  cards lift 3px + blue border + shadow on hover (.16s transition), bars go
  full-opacity; zoom lightbox gets fade + pop-in entrance animation. CSS lives
  in a <style> block inside #reportsPanel (style tags apply document-wide, so
  the body-appended overlay is covered).
- reports-admin.js ?v=4 -> ?v=5; service-worker v83 -> v84. bump --check OK.

## Addendum 4 (same day) - TRUE hover-zoom + level-qualified units + ASSIGNMENT graphs
- HOVER now opens the big chart (user insisted, 3rd ask): 300ms hover-intent
  delay (scrolling past does not trigger), the lightbox closes the moment the
  mouse leaves the dialog (live hover preview), clicking inside PINS it open
  (also the touch path). Hint text in the dialog explains both.
- Units chart now LEVEL-QUALIFIED ("B1 U2") because unit numbers repeat across
  levels, restricted to vocab+grammar (reading/listening put exam ids in the
  unit field - excluded), retitled "Top practiced units - level · unit
  (vocab + grammar)". Excel Word lists sheet: Level | Unit | Sessions |
  Vocabulary | Grammar | Avg - answers "which level/skill is Unit 2".
- ASSIGNMENT graphs (user asked to search: data existed in the dashboard's
  allAssignments + live allCompletions globals, graphs did not): new
  assignmentStats() derives EXPECTED counts from each assignment's target
  (class/level/module/picked students) vs the roster, completed from the
  completions map. Adds: KPI "Assignment completion %", charts "Assignments by
  skill" + "Assignment completion % (10 most recent)", Excel "Assignments"
  sheet (Deadline/Title/Skill/Target/Expected/Completed/%) + 2 Summary rows.
  Workbook now 15 sheets.
- reports-admin.js ?v=5 -> ?v=6; service-worker v84 -> v85.
- Harness (faithful lexical-let): 16 chart cards (15 SVGs + one legit "no
  data"); B1 U2 label; vocab "Unit 2" + grammar "2" merged (Excel row B1/Unit 2
  /2/1/1/75); exam id excluded; hover opens after intent delay, closes on
  dialog leave, does NOT open on quick pass-by, click pins and survives mouse
  leave; KPI 75% (3 of 4 targets done) exact; Assignments sheet row
  [2026-07-07, Unit 4 vocab drill, vocabulary, Class B101, 2, 2, 100].

## Addendum 5 (same day) - hover faster + split vocab/grammar units + roster/AI answers
- Hover-zoom delay 300ms -> 120ms; card lift transition .16s -> .12s eased;
  lightbox entrance quicker + smoother (fade .12s, pop .14s cubic-bezier).
- "Top practiced units" DIVIDED into two charts: "Top vocabulary units" +
  "Top grammar units" (byUnit already tracks .vocab/.grammar split), so a
  unit's vocab and grammar practice no longer share a bar.
- reports-admin.js ?v=6 -> ?v=7; service-worker v85 -> v86.
- Harness: two separate unit charts, no mixed chart, vocab U2=2 / grammar U3=1
  with no cross-contamination; hover ignores a 90ms pass-by, opens by 170ms.
- ROSTER: not broken by my work - rosterImport is DEPLOYED (live 401 admin
  gate) and the client commit path is intact; it needed the same
  functions-deploy + CSP(cloudfunctions.net) fix that unblocked the demo panel.
  If still failing for the user it is stale cache OR a specific sheet/console
  error - need the exact message.
- WRITING AI: y/lingualab-write/ is a UI SHOWCASE - real AI stubbed
  ("Practice mode: Claude is the API until funded", corrector.js:650); samples
  are pre-baked in sample.js. Activation = a Cloud Function calling an LLM
  (Claude/Gemini) to produce the correction JSON + wiring the Analyze button.
  Walked the user through it (no build yet - they asked to walk through).
