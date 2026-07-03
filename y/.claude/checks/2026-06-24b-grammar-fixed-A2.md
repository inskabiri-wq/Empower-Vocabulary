# 2026-06-24 - Grammar: fixed (hand-authored) questions, A2 done

Replacing the TEMPLATE GENERATORS (which produced wrong carriers like
"We ____ a teacher" and one shared, mismatched explanation per set) with
FIXED, hand-authored questions. Level by level; A2 complete this pass.

## Architecture (zero-breakage, incremental)
- New `FIXED` map in grammar-content.js, keyed by the SAME topic ids the app
  already uses (a2-be, a2-present-simple, ...). Each entry is an array of
  `mk(stem, correct, [distractors], explain)` - real sentence, 3 sensible
  distractors, matching explanation.
- Assembly changed (all 5 levels, one shared line) to:
  `questions: FIXED[id] ? build(FIXED[id], len) : build(t.gen(), t.cap)`.
  So a topic with a FIXED entry uses it; everything else still falls back to its
  generator. No topic ids / titles / blurbs changed, so grammar.js, assignments,
  content controls, and the classroom games are untouched.

## A2 authored
- All 25 A2 topics, 4 fixed questions each = 100 questions (target ~104/level).
- Verified (Node load of the real file): 25 topics, 100 questions; every Q has
  exactly 4 unique options with a valid answer index; ZERO bad-agreement carriers
  (no "We am/is", no "We ____ a teacher").
- B1 / B1+ / B2 (and C1 if present) still generate as before (B1 = 20 topics,
  52 q/topic) - untouched until authored.

## Verification
- node --check OK. No em dashes in the FIXED block.
- REAL-browser smoke (preview, throwaway _gq_harness.html, deleted): opened A2
  Multiple Choice -> served a FIXED question ("Right now they ____ dinner." /
  [have, are having, having, has]); stemIsFixedA2 = true; 100 fixed A2 stems live.
- grammar-content.js ?v=11 -> ?v=12 (5 refs across the HTML).

## Next (the rest of "all levels in one pass")
- Author FIXED banks for B1, B1+, B2, C1 the same way (drop into the FIXED map).
- Until then those levels keep their generated questions (so still live, just not
  yet curated).

## Not done
- No deploy. No push.
