# 2026-07-27b - Exam rubrics in the writing lab (IELTS / GRE / TOEFL / CELPIP / PTE)

## What changed
The writing lab could only mark against three classroom rubrics, all sharing a
HARD-CODED set of four criteria (CC/TA/GR/VO). It can now mark against 11 exam
tasks, and the engine no longer assumes any particular number of criteria.

11 rubrics, keys per rubric:

| id | exam task | criteria | scale |
|---|---|---|---|
| ielts-gt-t1 | GT Task 1 letter | TA/CC/LR/GRA | IELTS band 0-9 |
| ielts-ac-t1 | Academic Task 1 report | TA/CC/LR/GRA | IELTS band 0-9 |
| ielts-t2 | Task 2 essay | TR/CC/LR/GRA | IELTS band 0-9 |
| gre-issue | Analyze an Issue | HOL (holistic) | GRE 0-6 |
| gre-argument | Analyze an Argument | HOL (holistic) | GRE 0-6 |
| toefl-independent | Independent essay | HOL (holistic) | TOEFL 0-5 |
| toefl-integrated | Integrated read+listen | HOL (holistic) | TOEFL 0-5 |
| celpip-t1 | Email | CON/VOC/RDB/TSK | CELPIP 1-12 |
| celpip-t2 | Survey response | CON/VOC/RDB/TSK | CELPIP 1-12 |
| pte-essay | Write Essay | CONT/FORM/DSC/GRAM/RANGE/VOCAB/SPELL | PTE 0-15 |
| pte-swt | Summarize Written Text | CONT/FORM/GRAM/VOCAB | PTE 0-7 |

COPYRIGHT: every criterion name, "what it measures" line and band anchor is
ORIGINAL wording written for this app. No official published band descriptor
(IELTS, ETS, CELPIP, PTE) is reproduced, and the AI prompt explicitly forbids
quoting them.

## Files
1. `y/assignments/js/writing-rubrics.js` (?v=1) - the registry. Converted to a
   UMD wrapper so the SAME file is both a browser script (window.WRITING_RUBRICS)
   and a CommonJS module. Added CLASSIC, COLORS, isExam(), color(), summary(),
   and keys() now falls back to the classroom four for unknown ids.
2. `functions/writing-rubrics.js` - byte-identical copy (deploy uploads only
   functions/, so it cannot reach up into y/).
3. `y/tools/rubric-sync.js` (NEW GATE) - fails if the two copies drift, or if
   the registry loses its dual export. `--fix` copies y/ -> functions/.
4. `functions/index.js`
   - `critsFor(rubricId)` - the one place criteria come from.
   - `writingSchema(depth, crits)` - criteria properties, the `required` list
     AND the annotation `criterion` enum are all generated from the rubric.
     Constrained decoding therefore GUARANTEES the model returns exactly the
     right criteria for the chosen exam and cannot invent others.
   - `writingPrompt` - now feeds the model the exam task, its guidance, the
     expected length + time, the scale (asking for the per-criterion verdict as
     an estimated band on THAT scale), and our own high/mid/low anchors.
     Holistic rubrics get an explicit "put every annotation under HOL" line.
   - `analyzeWriting` - accepts any registry id; unknown ids fall back to
     'essay'. Annotations whose criterion is outside the rubric are dropped.
5. `y/lingualab-write/js/corrector.js` (?v=9)
   - `critKeys()` / `critKeysOf()` replace the `CRIT_ORDER` constant; the "By
     criterion" grid and the comment grouping both walk them, and any extra key
     the AI returns is appended rather than silently dropped.
   - `critLabel` / `critColor` / `rubricLabel` consult the registry first.
   - `scaleLabel` - the estimate row now reads "IELTS band (predictive)" etc.
   - `syncRubricHint` - one line under the picker with scale, length, time and
     the criteria list.
   - `buildPrompt` (offline preview path) generates its criteria JSON example
     from the rubric too.
   - meta line pluralises properly ("1 fix", not "1 fixes") - holistic rubrics
     make single-mark results common.
6. `y/lingualab-write/index.html` - loads the registry before the comment bank;
   `#corRubricHint` span; corrector.js ?v=9, comment-bank ?v=2, css ?v=4.
7. `y/lingualab-write/css/corrector.css` (?v=4) - `.cor-rubric-hint`, optgroup
   styling, and `max-width:100%` on `.cor-select`/`.cor-lbl` (exam names are far
   longer than the classroom ones and were stretching the toolbar).
8. `y/assignments/js/writing-comment-bank.js` (?v=2) - `label()` asks the
   registry first for exam rubrics; classroom rubrics unchanged.
9. `y/service-worker.js` - CACHE_VERSION v112 -> v113.

## Verification
Real-browser harness against the SERVED files with Firebase stubbed, driving
the REAL Analyze button (real payload -> real renderer), not simulated hooks:

- All 14 rubrics (11 exam + 3 classroom): the id the client SENDS matches, the
  number of criterion cards matches `keys(id).length`, and the comment groups
  match the cards. gre/toefl = 1 card, pte-essay = 7 cards, rest = 4. PASS.
- Dropdown groups: Classroom / IELTS(3) / GRE(2) / TOEFL(2) / CELPIP(2) /
  PTE Academic(2).
- Hint line renders, e.g. "Task 2 (essay) · IELTS band 0-9 · 250+ words ·
  40 min · 4 criteria: Task Response / Coherence and Cohesion / ...".
- Estimate row switches scale name per rubric (IELTS band / GRE score / PTE
  essay points / plain "Rubric" for classroom).
- 7 distinct criterion colours, no zero-height cards, no horizontal scroll at
  desktop width, 1-column grid at 375px.
- Console: zero errors.
- Server side, executed from the real function source: schema `criteria.required`
  and the annotation enum are 1 key for holistic, 7 for pte-essay, and an unknown
  id falls back to the classic four.
- node --check on all 6 touched JS files, rubric-sync PASS, ui-sanity PASS
  (0 off-style dropdowns), grammar-sanity PASS.
- Em-dash scan on ADDED lines only: 0. (writing-comment-bank.js has 113
  pre-existing em dashes in teacher comment text, untouched - a blind sweep of
  those is what broke games.js last time.)

## Known, NOT changed
- The writing ASSIGNMENT form still offers only the three classroom rubrics.
  Its grading composer is built on the 0-5 comment-bank bands, which do not map
  onto a 0-9 IELTS band, so exam rubrics stay in the writing lab for now.
  `label()` is already registry-aware, so opening it up later is a dropdown edit.
- `#corLevels` (the Light/Medium/Deep buttons) still overflows a 375px phone.
  Pre-existing, unrelated to rubrics.

## Ship
```
firebase deploy --only hosting
firebase deploy --only functions:analyzeWriting
```
The function deploy is REQUIRED - without it the server keeps the old fixed
four-criteria schema and an exam rubric would come back with CC/TA/GR/VO.
