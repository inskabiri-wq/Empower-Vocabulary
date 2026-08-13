# 2026-07-27d - Student hub: grammar (and reading/listening) rings stuck at 0%

## The bug
`getSkillProgress()` in `y/student/js/hub.js` had ONE branch:

```js
if (skillId === 'vocabulary' && ... ) return journeyStats.averageScore;
return 0;                                   // <- every other skill
```

So grammar, reading and listening rings were hardcoded to 0% no matter how much
a student practised. Nothing was wrong with the data: `skills/grammar.js`
`logGrammarAttempt()` has always written a proper session doc
(`skill:'grammar'`, `correctAnswers`, `totalQuestions`, `percentage`) to the
same `sessions` collection the teacher dashboard reads. It was simply never
read back per skill.

Second, quieter bug in the same function: the VOCABULARY ring was showing
`journeyStats.averageScore`, which is the average across ALL sessions -
grammar, reading and listening included. So the vocabulary number was wrong
too, just not obviously wrong.

## Fix (3 files)
1. `y/student/js/progress.js` (?v=2)
   - new `sessionSkill(s)` classifier, kept in step with the six writers of the
     `sessions` collection:
     | rule | skill |
     |---|---|
     | `s.skill` present | that value (grammar stamps it) |
     | `activity === 'reading-exam'` | reading |
     | `activity === 'listening-exam'` | listening |
     | `activity === 'writing-exam'` | writing |
     | `activity` starts `grammar-` | grammar (legacy docs with no `skill`) |
     | anything else | vocabulary (all the vocab games) |
   - `loadJourneyStats()` accumulates the SAME correct/questions numbers into a
     `bySkill` map alongside the global totals, then computes each `pct`.
   - `journeyStats.bySkill` published. `averageScore` is unchanged and still
     the overall figure on the journey card, which is what that card means.
2. `y/student/js/config.js` (?v=2) - `bySkill: {}` in the initial shape.
3. `y/student/js/hub.js` (?v=5) - `getSkillProgress()` reads
   `journeyStats.bySkill[skillId].pct`. Falls back to `averageScore` for
   vocabulary ONLY when `bySkill` is absent, which is the case for stats cached
   in localStorage by an older build; the next Firestore read replaces it.

## Verification
Node, driving the REAL `sessionSkill` extracted from progress.js over session
docs shaped exactly as each of the six writers creates them:
- match / spelling -> vocabulary; grammar-choice / grammar-fill -> grammar;
  **grammar-unscramble with NO `skill` field -> grammar** (legacy path);
  reading-exam -> reading; listening-exam -> listening; writing-exam -> writing.
- bySkill: vocabulary 65%, grammar 73% (22/30 over 3 sessions), reading 75%,
  listening 60%; overall averageScore 69%.

Real browser, real `renderHub()` from the served hub.js:
- with bySkill: `grammar pct=73% ring=73`, `reading 75/75`, `listening 60/60`,
  `vocabulary 65/65`. The `--pct` custom property matches the label every time,
  so the conic-gradient ring fills too, not just the number.
- legacy cached stats (no bySkill): vocabulary 88% as before, others 0, no
  crash.
- stats not loaded yet: all 0, no crash.
- 8 cards render, `journeyStats` initialises cleanly.

Gates: node --check on all three files, ui-sanity PASS, grammar-sanity PASS,
rubric-sync PASS, em-dash in added lines 0.

## Not changed
Writing and Speaking still show "-" because they are `active: false` in the
hub's SKILLS registry. writing-exam.js DOES write sessions, so the moment
either card is switched to `active: true` its ring will work with no further
change. Flagged, not touched - activating a skill card is a product decision.

## Ship
```
firebase deploy --only hosting
```
Hosting only. No function or rules change. SW v114 -> v115.
