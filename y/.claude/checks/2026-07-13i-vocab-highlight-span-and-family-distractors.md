# 2026-07-13i — Vocab quiz: whole-sentence highlight + confusable phrase distractors

## Why (user screenshot, B2 Unit 4 choice question)
"As far as school is concerned, he's doing well." had TWO defects:
1. The ENTIRE sentence was highlighted orange, so the student could not tell
   which phrase the question was about. Cause: the entry's `exAnswer` (manual
   highlight override, used verbatim by buildWordPattern) was set to the WHOLE
   sentence instead of the phrase span.
2. The distractor "based on what I know now" (= def of "as far as I know") is
   nearly as defensible as the correct "regarding a particular subject or
   person". The three "as far as ..." siblings in Unit 4 share no def keywords,
   so the def-overlap synonym heuristic could never catch them.

## Changes
- `y/datasets.json` — dataset lint found FIVE entries with `exAnswer === ex`
  (whole-sentence highlight). Fixed all to the exact target span:
  - "calm down" -> "calmed down"
  - "as far as is concerned" -> "As far as school is concerned"
  - "keep as" -> "keep the village as it is"
  - "grant" -> "grant"
  - "donate" -> "donated"
  Also normalized 6 pre-existing en/em dashes in content strings (JSON-safe).
- `y/student/js/games.js` (?v=2, first versioned ref)
  - `isLikelySynonym`: new phrase-family rule between the teacher-flagged
    check and the def-overlap heuristic: two multi-word phrases sharing their
    FIRST THREE words are unfair distractors of each other (kills every
    "as far as ..." pairing app-wide, plus future families).
  - Em-dash normalization: comments cleaned; three punctuation REGEX CHAR
    CLASSES that legitimately match en/em dashes now use –— escapes
    (blind replacement had briefly broken them with an invalid `---` range;
    caught by node --check and fixed via char-code-built replacement).
- `y/student-dashboard.html`: games.js -> `?v=2`. (Pre-existing dashes in this
  file left alone: HTML comments + intentional `—` UI placeholders.)
- `y/service-worker.js`: v97 -> v98.

## Verification
- `node --check games.js` — OK; JSON parse of datasets.json — OK.
- git diff on datasets.json: exactly the 5 exAnswer lines + 11 content-dash
  lines; no reformat.
- Browser harness (REAL served inflection.js + games.js + datasets.json):
  - buildWordPattern(entry) now matches ONLY "As far as school is concerned" ✅
  - isLikelySynonym blocks "as far as I know" AND "as far as I'm concerned" ✅
  - no overblocking: "as a whole" vs "as a result" still allowed; single words
    (grant/donate) unaffected ✅
  - PASS: true
- Smoke: 19 passed / 0 warnings / 1 failure (pre-existing "Submissions
  reference real assignments" data issue, unrelated).

## To ship (user action)
- `firebase deploy --only hosting`.
