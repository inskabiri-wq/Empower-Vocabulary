# 2026-06-27 - Hints on demand (reveal-on-click)

## Why
Rule-based topics (have got, used to, articles, past) cannot have a *useful*
hint that does not also reveal the answer - the rule IS the answer mapping. So
the fix is the DELIVERY, not the text: hints were shown by default (every
question open-book). Now they are hidden behind a button.

## Change (grammar.js ?v=25 -> ?v=26)
- Added hintBlock(h) + wireHint(b): the rule hint renders collapsed behind a
  "Show hint" button (toggles to "Hide hint"); CSP-safe (onclick wired after
  innerHTML, no inline JS).
- Wired into renderChoice (Multiple Choice) and renderUnscramble - the two views
  that showed q.hint (the rule). Fill view only shows the topic name (q.ht), not
  the rule, so it is unchanged.
- Heist / Trust / classroom games do not render q.hint (checked) - nothing to do.

## Also this pass
- a2-a-an distractors ["an","the","one"] -> ["other article","every","each"]:
  "the X"/"one X" were both valid (ambiguous); every/each are ungrammatical in
  "It is ___ N" for every noun, so exactly one option is correct now.
  grammar-content.js ?v=29 -> ?v=30.

## Sanity
- node --check grammar.js + grammar-content.js OK. em-dash 0.
- Grammar checker: PASS (82 units, 5541 q, 0/0/0/0).
- No deploy/push. Eyeball the grammar game after deploy: hint hidden, "Show hint" reveals it.
