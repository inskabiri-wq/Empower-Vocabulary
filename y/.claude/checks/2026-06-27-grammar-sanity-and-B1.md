# 2026-06-27 - Grammar: all-units sanity checker + B1 conversion + hint give-away fix

## New reusable tool (the "sandbox / all units check")
- y/tools/grammar-sanity.js + README-grammar-sanity.md
- Loads window.GRAMMAR_PRACTICE and audits EVERY level/unit/question:
  1. STRUCTURE  one blank, 4 distinct options, valid answer, a hint.
  2. GIVE-AWAY  hard-fails when the hint contains the answer with NO wrong option
     to choose against. Paradigm hints (answer + a distractor) are "review only".
  3. SEMANTICS  curated nonsense patterns + attributive adjective->noun mismatch
     (catches "most difficult restaurant"; ignores predicative "was happy
     yesterday" / adverbial "run fast").
- Exit 0 only when clean, so it can gate a deploy. Run: node y/tools/grammar-sanity.js [--samples]

## Found and fixed this pass
- "most difficult restaurant in the city" = the OLD fallback generators
  (G.comp/G.superl, "in the city / of the year"). My A2 ADJN generators never
  produce it; any level still on the old gen does. Checker now flags this class.
- A2 hint give-aways reworded so the hint never names the answer/distractor:
  a2-past-simple-q, a2-can-could, a2-comparatives (x2: A2+B1), a2-superlatives.
- Checker false positives fixed (attributive-only adj-noun detection).

## B1 converted to validated generators (9 topics, 104-ish each, with hints)
future-will-going, future-plans, modals-obligation, modals-possibility,
conditional-1, conditional-2, too-enough, a-few-little, relative-clauses.
Typed pools => every cross-product is grammatical + meaningful; distractors are
form errors so exactly one option fits; hints teach the concept, not the token.

## Status after this pass (node y/tools/grammar-sanity.js)
- 82 units, 3986 questions.
- HARD issues: structure 148, give-aways 0, semantic 0.
- A2 (25 units) and B1 (20 units) = fully clean.
- Remaining FAIL: B1+ and B2 topics still on the 4-question stub with NO hints
  (148 struct = 37 units). These need the same validated-generator conversion.
- distractor-in-hint = 142 (review-only): agreement paradigms that list am/is/are
  etc. Not a hard fail; can tighten later if wanted.

## Sanity
- node --check OK. em-dash scan: 0. node-load smoke OK (B1 = 1512 q).
- grammar-content.js ?v=25 -> ?v=26 (5 html refs).
- No deploy, no push (user does both). REDEPLOY needed for any of this to go live.

---
## 2026-06-27 (cont.): B1+ and B2 fully converted - WHOLE BANK CLEAN
- Added 18 B1+ validated generators (present/past/future perfect + continuous,
  deduction, past modals, conditional-3, wish, passive-perfect, causative,
  reported + reported-q, relative + non-defining, gerund/infinitive, verb+object).
- Added 19 B2 validated generators (perfect continuous x2, future perfect/cont,
  conditional-3, mixed conditional, wish past/present, modal passive,
  passive-perfect, past deduction, past modals, be used to, causative,
  reporting verbs, reported speech, gerund/infinitive meaning, so/such/unless,
  gerund review).
- Same method: typed pools (objects in every stem to dodge the dedupe collapse),
  hints that teach the concept not the token, form-error distractors so exactly
  one option fits. Context-tagged banks (deduction/past-modals/reported/ger-inf)
  are smaller (12-16) because mass-generating them safely is not possible without
  ambiguity; they are correct and unambiguous rather than padded.
- Fixes found by the checker while building: b1p-wish + b2-past-perf-cont hints
  named the answer ("had"/"had been") -> reworded; b1p-conditional-3 collapsed to
  9 (no object in stem) -> added objects, now 64.

## FINAL: node y/tools/grammar-sanity.js  ->  PASS (exit 0)
- 82 units, 5519 questions. structure 0, give-aways 0, semantic 0.
- A2 2326, B1 1512, B1+ 847, B2 834.
- distractor-in-hint 156 (review-only): agreement/contrast paradigms. Not a hard fail.
- node --check OK. em-dash 0. smoke load OK (all 4 levels).
- grammar-content.js ?v=26 -> ?v=27 (5 html refs). No deploy / no push (user does both).

---
## 2026-06-27 (cont. 2): eyeball pass on new B1+/B2 found bugs the checker missed
Reading the new content by eye (the checker only catches what it is told to)
surfaced 9 topics with text-quality bugs that passed the structural/semantic checks:
- b1p-past-continuous: doubled verb ("was having having lunch") - restructured pools.
- b1p-future-continuous: misspelled -ing ("driveing"/"lieing") + capital pronoun
  mid-sentence ("This time tomorrow, She") - use the real -ing, lowercase subject.
- b2-future-perfect / b2-future-continuous: capital pronoun mid-sentence - lowercased.
- b1p-gerund-infinitive: "She finishs/misss" (added es() helper) + "She is before
  going out" (replaced conjunctions with adjective+preposition) + trailing spaces.
- b1p-past-perfect, b1p-wish, b2-reporting-verbs, b2-gerund-review: trailing " ."
  before the period from empty objects - added tail() handling.
- Also fixed "The dog was cooking dinner" (animacy) in past-continuous.

CHECKER HARDENED: added a text-quality check (doubled word, space-before-punct,
capital pronoun mid-sentence, misspelled -ing, wrong third-person -s) so these
classes now hard-fail. Fixed one checker false positive ("being" is valid).

## FINAL re-verify: node y/tools/grammar-sanity.js -> PASS (exit 0)
- 82 units, 5541 questions. structure 0, give-aways 0, semantic 0.
- node --check OK, em-dash 0, eyeballed all 9 fixed topics (clean).
- grammar-content.js ?v=27 -> ?v=28 (5 html refs). No deploy / no push.
