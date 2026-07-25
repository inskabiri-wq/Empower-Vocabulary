# 2026-07-13l — Placement test, phase 2: the runner (placement.html)

## Built
- `y/placement.html` (NEW): intro/gate, MC stage screen, between screens, done
  screen, `#readingExamScreen` (empty - the reading runner builds its own shell)
  + `#listeningExamScreen` (full static markup transplanted from
  student-dashboard.html lines 1049-1142 - the listening runner REQUIRES it).
  CSS: brand.css + reading-exam.css + extra.css (exam-player/exam-q styles).
  Firebase compat app/auth/firestore + inline init exposing window.auth/db.
- `y/student/js/placement.js` (NEW): the orchestrator.
  - `window.__previewMode = true` -> both exam runners SKIP practice-session
    logging (placement never pollutes sessions/XP).
  - Own minimal `window.showScreen` (listening calls it unguarded); unknown ids
    ignored so backFromExam cannot blank the page.
  - Flow: gate (placementConfig + courseActiveFor + one-attempt check; staff can
    preview but never save) -> Stage A 15 grammar + 10 vocab at B1 -> branch
    (>=60% up / else down) -> Stage B up: 10 G B1+/B2 + 5 V B2; down: 10 G A2 +
    5 V A2 -> provisional (up: >=65 B2, >=45 B1+, else B1; down: >=60 B1 else A2)
    -> full READING exam (openReadingExam, untimed, level-mapped w/ fallback
    chain, random pick among available) -> full LISTENING exam
    (startListeningExam) -> final = provisional adjusted by combined R+L
    (>=75% +1 band, <35% -1 band) -> save /placementResults/{uid} ONCE
    {userId, name, studentClass, profileLevel, at, stagePath, sectionScores,
    recommendedLevel, durationSec} -> done screen. beforeunload guard while in
    progress. Grammar qs from GRAMMAR_PRACTICE bank; vocab MC from datasets.json
    (def options, same-level distractors, first-3-words family exclusion).
- Hooks added to the REAL runners (fail-silent, normal flows untouched):
  - `y/student/js/reading-exam.js` (?v=2): submitExam fires
    `window.onReadingExamSubmitted({correct,total,pct,examId})`.
  - `y/student/js/listening-exam.js` (?v=2): submitListeningExam fires
    `window.onListeningExamSubmitted({...})`.
  - student-dashboard.html refs bumped to ?v=2 for both.

## Verification (browser E2E, real page + real runners, stubbed firebase)
- Gate -> Start visible; Stage A "Question 1 of 25"; 25 answers -> between;
  Stage B 15 questions (down branch from random clicks); between -> REAL reading
  exam rendered + active inside placement.html. PASS.
- Reading hook -> Continue; listening intro -> REAL listening exam rendered
  (15 .exam-q, audio src set); REAL submitListeningExam() fired the hook
  (0/15 blanks); Continue -> saved doc correct: rec A2, path "B1 > down > A2",
  scores G 25 total / V 15 total / R 20/25 / L 0/15; RL adj math verified
  (50% combined -> no bump; separate run: 80% RL bumped A2 -> B1 with
  "RL adj" in path). Done screen active. PASS.
- node --check placement.js / reading-exam.js / listening-exam.js - OK.
  em-dash scan of new files - clean.

## REMAINING (task #144)
- Reports wiring: load /placementResults in reports-admin.js, KPI +
  "Placement recommendations by level" chart + Excel sheet (respect filters),
  bump reports-admin ?v=9 -> ?v=10.
- Final: smoke test, SW v100 -> v101, then user deploys BOTH
  `firebase deploy --only hosting` AND `--only firestore:rules`.
- Teacher may then activate targeting in the Placement tab.
