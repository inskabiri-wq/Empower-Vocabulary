# 2026-07-27a — Vocabulary rows now expand like grammar (per-question drill-down)

## The actual complaint, finally pinned down
"Grammar works, vocabulary doesn't" was NOT about the activity log, the index,
or the reports. In the teacher Activity tab a GRAMMAR row is tappable and
expands to show every question with the student's wrong choice vs the answer
("tap for items"); a VOCABULARY row (Match Game etc.) is a flat, dead row.

Cause: `activity.js` builds the drill-down from `session.grammarDetails`, and
ONLY grammar.js writes that field. The vocabulary games never recorded
per-question results at all - nothing to expand.

## Fix (3 files)
1. `y/student/js/games.js` (?v=2) - new tracker mirroring grammar's shape:
   `vocabDetails[]` + `vocabTrackReset()` + `trackVocab(q, picked, correct, ok)`,
   capped at 20 items, exposed as `window.getVocabDetails()`.
   - reset wired at all 4 `score = 0` game-start points
   - 8 capture points, covering every vocab mode:
     * choice / reverse / fillblank (they share `const isCorrect = selected === correct;`)
     * spelling (typed answer vs word)
     * word order (assembled sentence vs correct token order)
     * unscramble (assembled word vs correct)
     * match game (pair tap: a.id vs b.id)
2. `y/student/js/auth.js` (?v=2) - both session-write branches (the
   per-unit "all units" loop and the single-unit path) now save
   `vocabDetails: getVocabDetails()`.
3. `y/teacher/js/activity.js` (?v=3) - one renderer, either source:
   `grammarDetails` OR `vocabDetails` (identical {q, picked, correct, ok}
   shape), so vocab rows get the same tap-to-expand, the same green/red
   "chose X / answer Y" lines, and the same "tap for items" hint.

## Verification
- node --check on all three - OK.
- Unit test of the REAL inserted tracker (executed from the file source):
  20-item cap enforced, first item
  `{"q":"She avoids ____ errors.","picked":"to make","correct":"making","ok":false}`
  - shape matches grammarDetails exactly. PASS.
- Static: activity.js expands vocabDetails; auth.js writes it on both branches.
- ui-sanity PASS; em-dash scan clean.
- SW v111 -> v112.

## Note
Only NEW vocabulary sessions carry the detail - existing rows stay flat
(nothing to backfill from; the per-question data was never captured).

## Ship
firebase deploy --only hosting
