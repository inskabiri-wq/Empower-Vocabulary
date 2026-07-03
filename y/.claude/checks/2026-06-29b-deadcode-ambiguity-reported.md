# 2026-06-29 - Code hygiene (dead gens) + ambiguity check + reported-speech fix

## 1. Code hygiene - dead generators deleted
- The old G.* generators were provably dead (every topic uses a VALID generator;
  assembly is `VALID[id] ? buildValidated(...) : []`; no VALID gen calls G.*; no
  t.gen() call anywhere). Removed:
  - 62 G.* generator functions (~82 KB),
  - 81 `gen: G.x, cap: N` spec props + 1 inline gen,
  - the now-unused `var G = {}`.
- 0 G./gen/var-G references remain. grammar-content.js ~2700 -> 1377 lines.
- Verified: node --check OK; checker PASS with the SAME 5541 questions (nothing
  broke - the deleted code never ran).

## 2. Phase-2 content fixes (carried over)
- b1p-future "wills" -> ['will to','going to','are going'].
- b1p-conditional-3 repetitive result clause -> rotates 5 result clauses.

## 3. Ambiguity / "grammar-parser" check (new, in grammar-sanity.js)
- Added a heuristic that flags "more than one correct answer": present/past be,
  will/won't, simple/perfect passive, base/past of one verb - only when there is
  no time anchor and the past is not already forced (wish/would/if/infinitive/
  quote-conversion). Review-only; printed as "ambiguous?".
- First run flagged 13, all reported-speech (backshift is technically optional) -
  exactly the reviewers' row-22 concern.
- FIX: rewrote b1p-reported, b1p-reported-q, b2-reported-speech as
  "quote -> reported" conversion tasks (e.g. "'I am tired,' she said. -> She said
  she ____ tired."), which forces the backshift so only the past form is right.
  Detector now treats a " -> " conversion stem as unambiguous.
- After the fix: ambiguous? = 0.

## FINAL: node y/tools/grammar-sanity.js -> PASS
- 82 units, 5541 questions. structure 0, give-aways 0, semantic 0,
  distractor-in-hint 0, ambiguous 0.
- node --check (content + checker) OK. em-dash 0.
- grammar-content.js ?v=32 -> ?v=33. SW v67. No deploy/push.
