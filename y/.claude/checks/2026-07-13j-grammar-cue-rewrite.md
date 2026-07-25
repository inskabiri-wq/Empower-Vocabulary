# 2026-07-13j — Grammar hints: full Option-C rewrite (recipes -> thinking cues)

## Why
User: "the grammar hint gives away the answer by giving the grammar". In MC the
four options differ BY grammatical form, so a hint naming the structure or its
formula ("present perfect: have/has + past participle") IS the answer. User
chose Option C: rewrite every hint as a thinking cue (points at evidence in the
sentence, asks the deciding question, never names the target form), rather than
hiding/moving hints.

## Changes
- `y/student/js/skills/grammar-content.js` (?v=33 -> ?v=34 on all 5 loader pages:
  student-dashboard, teacher-dashboard, classroom-teacher, classroom-heist-student,
  classroom-trust-student)
  - ALL 81 `H = ...` topic hints rewritten via exact-match codemod
    (scratchpad cue-codemod.js), plus 3 inline per-generator hints the map
    missed and 2 of my own first-draft cues that collided with option words
    ("is" / "had been") - 86 hint strings total.
  - Cue rules: point at the evidence (time words, subject, the word before the
    gap), ask the deciding question, NEVER name the tested structure, its
    formula, or any option word. Example: 'routine/every day -> present simple;
    now -> present continuous' became 'Find the time expression: a routine
    (every day, usually) or happening as we speak (now, Look!)?'
  - Post-answer `explain` texts untouched - the rule is still taught AFTER the
    student answers.
- `y/tools/grammar-sanity.js` - new hard-fail rule 2b RECIPE: q.hint must not
  contain mapping arrows (->), formula plus (+), participle/base-form/-ing/
  infinitive mentions, "adds -", tense names (present/past/future +
  simple/continuous/perfect), named conditionals, passive, comparative/
  superlative. Reported once per distinct hint per unit; counts as hard fail;
  new "recipe hints" line in totals. q.explain stays exempt by design.
- `y/service-worker.js`: v98 -> v99.

## Verification
- `node --check` grammar-content.js + grammar-sanity.js - OK. em-dash scan - clean.
- Gate run: 82 units / 5541 questions -> PASS, every unit clean:
  struct 0, giveaway 0, semantic 0, recipe 0. (First run FAILED with 114
  giveaways + 3 recipes - the new lint caught my own bad cues + the unmapped
  inline hints; all fixed. distractor-in-hint review count fell 151 -> 112.)
- Codemod audit: git diff = 81 changed lines, every one an H assignment.
- Browser (served file, iframe): 5541 questions load, ZERO recipe-pattern hints
  at runtime. PASS.

## To ship (user action)
- `firebase deploy --only hosting`.
- Classroom fill game (mixed sources) shows the topic TITLE as its hint
  (grammar.js q.ht) - fine for fill (student must produce the form), unchanged.
