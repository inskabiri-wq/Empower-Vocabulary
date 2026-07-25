# 2026-07-02: 3 reading exams imported as FSMet-native (de-identified)

Source: an external practice reading (3 passages). Ported into the app's Reading
Exam bank, keeping ONLY FSMet-format question types and removing every IELTS marker.

## Exams added
- B2 Reading 14 - Gold                 (b2-r14, B2/exam-14.json)  headings, MCQ, short-answer
- C1 Reading 1 - Detecting Disease by Smell (c1-r1, C1/exam-1.json) MCQ, sentence-fit(match-gaps), short-answer
- C1 Reading 2 - Bats and Wind Turbines (c1-r2, C1/exam-2.json)    headings, MCQ, short-answer
New reading level C1 created (registry levelsFor now A1,A2,B1,B2,C1).

## Question-type policy
Kept: match-headings, match-gaps, mcq, find-word (the FSMet-supported set).
DROPPED entirely (not in FSMet): matching statements-to-people, and True/False/
Not-Given. Those source questions were NOT copied in any form.

## De-identification
Builder (E:/tmp/build-readings.js) refuses to write if any string contains an em
dash or an IELTS fingerprint (IELTS, "Reading Passage N", answer sheet, General
Training, Candidate No, "spend about 20 minutes", "NO MORE THAN ..."). Instructions
use the app's native wording ("Circle the best answer according to the text.",
"Find the answers from the text. Do not use more than 3 words.", "Match the
paragraphs with the headings. There is ONE extra heading."). Titles neutral, no
passage/booklet numbering, hyphens not em dashes.

## Verified (emulator + real login)
- Registry: EXAM_REGISTRY exposes C1 + b2-r14/c1-r1/c1-r2; READINGS_INDEX builds
  cards for all levels.
- Render (c1-r1): no unknown-section warning; passage + 16 MCQ radios + 2 gap
  dropdowns + 2 in-passage gap spans + 7 short-answer inputs.
- Scoring (c1-r1): filled the answer key -> 13 / 13, 100% (multi-word answers like
  "healthy controls", "electronic nose" matched via acceptable[]).
- Render (b2-r14): 6 heading dropdowns + 16 MCQ radios + 7 inputs + 6 paragraphs;
  anyIeltsMarker=false in the live DOM.
- Fingerprint grep on all 3 JSON + registry: CLEAN. em-dash scan on JSON: clean.

## Ritual
preflight ALL PASS. exam-registry.js / reading JSON are cache-first (no ?v=), so
bumped service-worker CACHE_VERSION. No deploy / no push.
