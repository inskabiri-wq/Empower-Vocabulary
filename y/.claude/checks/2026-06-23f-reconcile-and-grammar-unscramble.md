# 2026-06-23 - Roster field reconcile (confirmed) + grammar unscramble fix

## 1. Roster user-doc field reconciliation - CONFIRMED DONE
functions/index.js rosterImport now writes the app's CANONICAL user fields (it
no longer uses currentClass/currentModule/currentYear):
- Students: studentClass, level, module, academicYear (+ studentNo). These are
  exactly what verify-gate.js writes and what the student dashboard + the teacher
  class filter (config.js `where('studentClass','in',...)`) read.
- Teachers: assignedClasses (the scope key). Deliberately NOT assignedYear,
  because config.js treats assignedYear as a LEVEL filter and setting it would
  hide all the teacher's students. (Comment in the code documents this.)
- node --check OK; no stale current* refs remain anywhere.

## 2. Grammar unscramble: period + capitalization give-away - FIXED
Problem: the grammar Unscramble built its word bank from
`sentenceOf(q).split(/\s+/)`, so the first word kept its Capital (revealing the
start) and the final word kept its attached period ("day." revealing the end).

Fix mirrors the proven vocabulary Word Order mode:
- New `orderTokens(s)` lowercases every word and splits trailing sentence
  punctuation into its OWN token. Uses `[.,!?;:]` (NO dash chars, so no em dash
  enters the file). Period/comma become floating tokens.
- Bank tokens render from these neutral tokens (all lower-case, punct separate).
- `recaseAnswer()` capitalizes only the first real word in the answer row for
  display; `naturalJoin()` rebuilds a tidy sentence for the review.
- The Check compares token ARRAYS (lower-case, punct separate):
  builtToks.join(' ') === orderTokens(sentenceOf(q)).join(' ').
- grammar.js ?v=22 -> ?v=23 (student-dashboard.html).

### Verification
- node --check OK. No em dashes in the new block.
- Tokenizer sim: "She goes to school every day." ->
  ["she","goes","to","school","every","day","."]; all words lower-case; period
  is its own token; no token has an attached period; correct arrangement matches.
- REAL-browser E2E (preview, throwaway _unsc_harness.html, deleted): opened an
  A2 Unscramble; bank = [",","watches","one",".","watch","many"] - all
  lower-case, comma + period separate (no capital/period tell). Arranged
  "one watch , many watches ." -> answer row displayed "One watch , many
  watches ." (first word re-capitalized) and the engine accepted it as
  "Correct." So the casing-neutral comparison still passes a right answer.

## Not done
- No deploy. No push.
