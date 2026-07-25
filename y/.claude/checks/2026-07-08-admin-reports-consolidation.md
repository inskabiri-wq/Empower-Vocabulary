# 2026-07-08 - Admin > Reports: one home for all results (+ game history)

## Goal (user)
One admin Reports page with visualization (graphs), filters and Excel; DELETE
report/export buttons everywhere else EXCEPT the classroom games' live one-time
results; classroom game outcomes must ALSO persist into the Reports page
("teacher X in class Y with N students played Z" + scoreboard + download);
manual retention ("kept until you delete", cleanup button + periodic prompt).

## What was built

### 1. Persistent game reports - NEW /gameReports
- **NEW y/classroom/js/game-report.js** - `window.saveGameReport(db, data)`.
  Doc id `<game>-<code>-<YYYYMMDD>` (idempotent set-merge), fail-silent.
  Fields: game/mode/code/teacherId/teacherName/level/unit/examId/examTitle/
  outcome/wordCount/playerCount/players[{name,score}]/day/endedAt.
- Hooked into all 5 hosts' showResults(): teacher.js (Race - CRITICAL: Race
  deletes its session doc on close, so this is the only surviving record),
  heist-teacher.js (score=balance), trust-teacher.js (fetches players, saves
  outcome=winner), reading-teacher.js + listening-teacher.js (exam meta from
  session doc). Script tag added to classroom-teacher.html + the 4 host pages.
- **firestore.rules**: /gameReports - create/update teacher, read teacher,
  delete ADMIN only (retention cleanup).

### 2. NEW Admin > 📊 Reports panel
- teacher-dashboard.html: sub-tab + #reportsPanel + IDS + margin CSS;
  **NEW y/teacher/js/reports-admin.js?v=1** (lazy-renders on first open):
  - Reuses in-memory allStudents/allSessions/activityToSkill (no new practice
    reads); queries gameReports (limit 300) once.
  - Filters: period (7/30/90/all) + level/class/module/year - charts + Excel
    + games list all follow them.
  - KPI tiles: students, active-in-period, sessions, avg score, games played.
  - 4 hand-rolled SVG charts (CSP-safe, no library, t2 theme vars): sessions
    per day, avg score per skill, sessions per class, students per level.
  - Excel workbook (vendored SheetJS): Students (mirrors old sidebar CSV incl
    per-skill splits), Skills, Classes, By day, Games.
  - Games history: expandable row per finished game (icon, teacher, level/unit
    or exam, player count, date) with scoreboard + avg + outcome, per-game
    Excel download, per-row Delete.
  - Retention: "kept until you delete" + cleanup select (30/60/90/180d) +
    batch delete + banner prompt when reports older than 6 months exist.

### 3. Removed (per user decision)
- Sidebar "Export Report" (#exportReportNav) + more-menu duplicate
  (#exportReportMore) + their reveal block in teacher/js/config.js.
- Activity tab "Export Excel" button (ActivityAdmin.exportToExcel UI; function
  kept, unreferenced).
- KEPT (user chose): writing-grades CSV (grading view), per-student printable
  PDF (drill-down), teachers CSV (admin panel), and all classroom-game live
  results/downloads (explicitly preserved).

### 4. Housekeeping
- service-worker.js CACHE_VERSION v79 -> v80.
- Normalized 134 pre-existing em/en dashes in touched host HTML/JS (emoji-safe
  replacer; box-drawing untouched); all files re-parse OK.

## Verification
- preflight: **ALL PASS** (109 js parse, grammar sanity, cache drift, JSON,
  em-dash changed files). firestore.rules brace-balance OK + block present.
- **Real-browser harness (clean iframe, real reports-admin.js, stubbed data)**:
  4 SVG charts render; KPIs render; 30d range lists only the recent game; row
  text "Vocabulary Race B1 · Unit 4 · Demo T · 2 players"; 6-month banner
  fires; per-row Delete deletes right id; all-time range widens list; cleanup
  older-than-90d batch-deletes the old one; Excel export writes workbook with
  all 5 sheets (lingualab-report-2026-07-08.xlsx).
- Page-load smoke: reports-admin.js + game-report.js serve 200; sub-tab/panel
  present; exportReportNav/exportReportMore/Activity-Excel all GONE from served
  HTML; game-report.js tag present on all 5 host pages.

## DEPLOY (user)
    cd E:\vocab-trainer
    firebase deploy --only firestore:rules,hosting
(rules deploy is REQUIRED - without it every gameReport write is denied.)

## Notes
- Games played BEFORE this deploy have no saved report (Race sessions already
  deleted); history starts accruing from the first game after deploy.
- gameReports doc stays lean (name+score only) - full per-question answers stay
  in the live session (reading/listening) while it exists.
- Live E2E on production (play a game, see it in Reports) still worth doing
  after deploy.
