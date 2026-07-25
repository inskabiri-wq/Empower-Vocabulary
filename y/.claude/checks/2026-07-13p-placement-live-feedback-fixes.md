# 2026-07-13p — Placement: live-test feedback fixes (6 items)

## 1. CRASH: "Unsupported field value: undefined in sectionScores.reading.correct"
Root cause: reading-exam.js computeScore() returns {totalCorrect, totalQuestions,
totalPct} - my submit hook passed result.correct/total/pct which DO NOT EXIST,
so undefined flowed into the doc and the final save threw, leaving writing
"unfinishable". (My earlier harness fired the hook manually with fake fields,
masking it - this round drives the REAL rd-submit-btn + "Submit anyway" modal.)
Fixes:
- reading-exam.js (?v=3): hook passes totalCorrect/totalQuestions/totalPct.
- placement.js (?v=3): hooks coerce Number()||0; new safeScore() normalizes all
  sectionScores before save (null when a section never ran) - undefined can
  never reach Firestore again.

## 2. UI style did not match the app
placement.html now loads index/css/variables.css (real app tokens) and mirrors
the student dashboard look: token gradient background + radial glow, glassy
blurred cards (radius 24, border, shadow) like .container. Nunito/Outfit kept.

## 3. "Where are the questions from? Generated?"
NOT generated at test time and NOT AI: grammar questions are drawn from the SAME
validated grammar bank used everywhere (GRAMMAR_PRACTICE, 5541 sanity-gated
questions), vocabulary from datasets.json (the vocab dataset). Vocab stems now
use the app's own choice-game wording ("Read the sentence and find the meaning
of ...") so they read identical to practice.

## 4. No score after grammar/vocab (but reading shows one)
The between screen after the ladder now shows per-rung results (A2: n/13 (x%),
B1: ..., B1+: ..., B2: ...) + a Total line - mirroring the exams' result style.

## 5. Listening transcript visible after submit
Placement CSS hides #examTranscriptDrawer, #transcriptToggle and
.exam-mobile-tabs (display:none !important) - transcript never shows in
placement mode. Solo listening practice unchanged.

## 6. Copy/paste + Ctrl+F worked in writing
guardWriting(): paste/copy/cut/drop/dragover/contextmenu prevented on the
textarea; Ctrl/Cmd+F/C/V/X/P blocked (capture) while the writing screen is
active; textarea spellcheck/autocomplete/autocorrect off.

## Versions
placement.js ?v=3, reading-exam.js ?v=3 (placement.html + student-dashboard),
SW v103 -> v104. reading-exam.js has 58 PRE-EXISTING em dashes left untouched
on purpose (1771-line file with regexes/student-facing strings; the games.js
blind-normalize broke char classes - not risking it; my added lines are clean).

## Verification (browser, REAL paths, two-part harness)
- App gradient background computed on body. PASS
- Ladder score summary "Total: n / 46" shown after rung 4. PASS
- REAL reading submit: rd-submit-btn -> "Submit anyway" modal -> hook payload
  {correct:0,total:14} NUMBERS. PASS
- Transcript drawer + toggle computed display:none in placement. PASS
- Writing: paste blocked, copy blocked, Ctrl+F blocked. PASS
- REAL submitListeningExam() -> {0,15}; finish -> saved doc all-numeric, no
  undefined anywhere, rec A2, done screen. PASS
- node --check placement.js + reading-exam.js OK; new-file em-dash scan clean.

## Ship
firebase deploy --only hosting. (The stuck student u8C6... has NO saved result -
the save failed - so they can simply retake after deploy; no reset needed.)
