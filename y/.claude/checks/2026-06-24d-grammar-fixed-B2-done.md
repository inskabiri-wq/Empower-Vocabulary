# 2026-06-24 - Grammar fixed bank: B2 done (all existing levels now fixed)

## B2
- 19 topics x 4 = 76 fixed, hand-authored questions added to the FIXED map.
- Replaces the ~936 generated B2 questions.
- Verified (Node load): 19 topics, 76 questions, 0 option problems.

## Status of the whole grammar rewrite
FIXED now (generators fully bypassed):
- A2: 25 topics, 100
- B1: 20 topics, 80
- B1+: 18 topics, 72
- B2: 19 topics, 76
- TOTAL: 328 fixed questions, all 4-option, valid answer, sensible distractors,
  matching explanations. node --check OK, no em dashes.
- grammar-content.js ?v=14 -> ?v=15.

## Remaining
- C1: still 0 grammar topics. C1 needs a NEW topic spec authored from scratch
  (no C1 generators exist either). Awaiting the user's C1 topic list (or I
  propose a standard C1 set: mixed conditionals deep-dive, inversion, cleft
  sentences, participle clauses, advanced modals, etc.).

## Not done
- No deploy. No push. (Everything above is local until the user deploys.)
