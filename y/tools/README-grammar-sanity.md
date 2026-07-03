# Grammar sanity / sandbox check (all units)

`node y/tools/grammar-sanity.js` audits **every level -> every unit -> every
question** in `y/student/js/skills/grammar-content.js` and prints a pass/fail
line per unit plus totals. It exits `0` only when the whole bank is clean, so it
can gate a deploy:

```
node y/tools/grammar-sanity.js            # summary, one line per unit
node y/tools/grammar-sanity.js --samples  # also prints example failures
```

It loads the file the same way the browser does (it sets
`window.GRAMMAR_PRACTICE`), so it checks the questions students actually see,
after the VALID -> FIXED -> generator assembly.

## The three checks (the "logic")

**1. Structure.** Each question must have exactly one blank (`____`), exactly 4
options, 4 *distinct* options, a valid answer index, and a non-empty hint.

**2. Hint give-away.** A hint must teach the rule without handing over the
answer. Logic:
- `ansInHint`  = the hint contains the correct option as a whole word/phrase.
- `distrInHint`= the hint contains one or more of the wrong options.
- **GIVEAWAY (hard fail):** `ansInHint && !distrInHint` -> the hint names the
  answer and nothing to choose against, so the question is free.
- **RULE / distractor-in-hint (review only):** the hint lists the answer *and* a
  wrong option (a teaching paradigm like "I am, he/she/it is, you/we/they are"),
  or only a wrong option. These are reported but do not fail the build, because
  agreement paradigms legitimately list the forms.

The rule of thumb when writing a hint: state the *concept* ("after 'if' use the
present simple"), never the *token* ("the answer is 'study'").

**3. Semantics.** Curated "this cannot mean anything" patterns run on the
*filled* sentence (answer substituted in):
- a child / baby who holds an adult profession,
- a living thing inside a small container ("people in the box"),
- a vehicle indoors ("a car in the kitchen"),
- a window outdoors,
- a transient state pinned to a long time ("ill last year"),
- an abstract noun after a demonstrative article ("this is an hour"),
- drink + non-liquid, eat + non-food,
- the old superlative templates ("... in the city / of the year"),
- **adjective-noun mismatch**: an attributive adjective glued to a noun it
  cannot describe ("the most difficult restaurant", "a happy exam"). Only
  *attributive* position is flagged (an NP opener such as a/the/most sits right
  before the adjective), so predicative "was happy yesterday" and adverbial
  "run fast" are correctly ignored. The allowed adjective->noun lists live in
  `ADJ_OK` at the top of the script; extend them as the bank grows.

## How content is kept correct (so the checker stays green)

Questions are produced by **validated generators** (the `VALID` map in
`grammar-content.js`). Each uses *typed pools*: singular subjects only ever pair
with singular complements, a transient state only pairs with a short time
anchor, an adjective only pairs with nouns it can describe, etc. Because the
pools are typed, every cross-product is grammatical and meaningful, and the
generator can produce ~104 distinct questions per topic without nonsense.
`buildValidated()` then lints and caps each topic.

When you add or edit a topic, run the checker. Green = safe to bump the
`grammar-content.js?v=N` query string and redeploy.

## 4. Ambiguity ("more than one correct answer") - review only

The checker also runs a lightweight grammar heuristic that flags a question when
two options could BOTH be grammatically valid (so the MCQ has more than one
answer). It catches the patterns reviewers keep finding:
- present vs past "be" both valid for the subject, with no time anchor;
- will + won't both offered;
- simple vs perfect passive both valid;
- the base and the -ed past of one verb both offered as the answer pair.

It deliberately skips: stems with a time/aspect anchor, "wish"/"would"/"if" (unreal
past is forced), infinitive answers ("to help"), and "quote -> reported" conversion
tasks (the backshift is forced). It is REVIEW-ONLY (heuristics misjudge), printed as
"(+N ambiguous?)" and the "ambiguous?" total. As of 2026-06-29 the whole bank is 0.
