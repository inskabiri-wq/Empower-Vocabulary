# 2026-06-29 - FSM reviewer tracker (29 issues) triage + current fixes

Source: FSM_PrepProjectTracker_v2.xlsx (Rauf + Parisa, dated 23-24 June).
Reviewers tested a deploy from BEFORE the validated-generator rewrite, so most
issues are already fixed in the current build; a redeploy clears them.

## Already fixed in current build (redeploy resolves) - traced to OLD dead gens
- Weak/malformed distractors wills / willn't / am will / could of (rows 5,7-13,19,20)
- Reported-question "where" misused for yes/no (rows 23,24 HIGH) -> validated
  b1p-reported-q uses if/whether; "where" only for real where-questions.
- "We are a teacher" (row 25) -> typed a2-be.
- Lowercase english/french (rows 27,28) -> none in current.
- Punctuation tile in Word Order (rows 6,31) -> engine separates punctuation.
- "sky is grey might/must", "live/lived small town", "cleaned/cleans" -> not in
  current bank (old gens).

## Genuinely open in current build -> FIXED this pass
- b1p-future PRED used distractor "wills" (non-word) in 8 questions ->
  ['will to','going to','are going'] (form errors, no valid alternative, no non-word).
- b1p-conditional-3 if-clause used the SAME ", it would have helped." for every item
  (row 21 repetitive) -> rotate 5 result clauses.

## Deferred (deliberately)
- Deleting the dead old generators: provably unreachable (assembly is
  VALID[id] ? ... : []), but interleaved with live helpers + the VALID map; a large
  deletion there is risk for zero student benefit. Recommend redeploy-first so the
  reviewers re-test, then delete dead gens carefully as code hygiene.
- A perfect "more than one correct" auto-detector needs a real parser; can add a
  heuristic review-flag if wanted.

## Sanity
- node --check OK, em-dash 0, checker PASS (82 units, 5541 q, 0/0/0/0).
- grammar-content.js ?v=31 -> ?v=32. SW v67. No deploy/push.
