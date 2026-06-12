# Fill hint redesign: grammar point + (verb) cue, not the option list · 2026-06-10

User feedback:
1. "Choose from: [4 options]" in the fill game = bad idea. The hint should name
   the GRAMMATICAL POINT (like the time hints): plural, past, etc.
2. The white bar (pic 3 earlier) is the reading/listening assignment modal:
   it is the native "Pick an Exam" dropdown panel rendering OS-white. Already
   covered by `:root { color-scheme: dark }` added to assignments.css in the
   previous pass; confirmed nothing else white remains in that modal (selects
   and date input all use the dark .assignment-form-group styling).

## Engine (grammar.js v17)
- Fill hint now shows the question's grammar point: "Hint: Past Simple"
  (per-question topic title; poolFor stamps q.ht = topic title on every
  question, so mixed "all units" rounds show the right topic per question).
- Word-bank chips REMOVED per user.
- sentenceOf() strips parenthetical cues + normalises whitespace, so the
  unscramble word bank never contains "(open)" as a tile and comparisons
  stay exact.

## Content (grammar-content.js v10): lexical cue in the stem
Because the grammar-point hint no longer reveals the verb, open-class blanks
now carry the textbook bracket cue: "The students ____ (open) the door last
week." Applied to: past simple, present simple (+routine forms in
simple-vs-continuous), present continuous, like/love/hate + -ing, comparatives
(adj cue), superlatives (adj cue), present perfect participle form,
pp-vs-past (both sides), past continuous (both forms), 1st + 2nd conditional
if-clauses, gerund/infinitive (both sides), future continuous -ing form,
wish + past simple, reported statements + questions, verb + object + to.
Closed-class blanks (a/an, some/any, aux do/be/have, modals, there is/are,
relatives, question words) need no cue: the grammar point + time anchor
determines the single answer.

## Verification (8 rebuilds, 25,048 generated questions)
- 0 structural problems, 0 cross-tense questions without a time anchor,
  8,671 questions carry a lexical cue, 0 leftover parens/double spaces in
  unscramble sentences, 0 em-dashes, 100% four-option.

## Cache
- grammar.js ?v=17, grammar-content.js ?v=10 (both dashboards), SW v33 -> v34.

## Deploy
- firebase deploy --only hosting (user runs it).
