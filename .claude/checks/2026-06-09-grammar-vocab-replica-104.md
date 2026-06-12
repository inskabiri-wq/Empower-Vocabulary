# Grammar = vocab dashboard replica + 104 questions / unit · 2026-06-09

## Request
1. "Exact replica of vocabulary but for grammar" - the XP, the map on the right, everything.
2. "104 questions for EACH unit" (all 11 A2 units). User chose: auto-generate ~100/unit.

## Done

### Content - auto-generated banks (grammar-content.js, v3 -> v4)
- Rewrote as a template generator: word pools (28 verbs w/ all forms, 34 adjectives,
  subjects with agreement helpers beOf/doOf/haveOf/bePastOf) + per-topic generators
  that expand to big banks; `build(list, cap)` dedupes by stem + caps.
- 25 A2 topics across **11 coursebook units**, each unit ~104 questions:
  U1 108, U2 104, U3 104, U4 104, U5 104, U6 104, U7 105, U8 104, U9 104, U10 104, U11 104.
  Total A2 = 1149 (whole file 1177 incl. B1/B1+/B2 scaffold).
- Added **Unit 6 = was / were** (past of be) so all 11 units exist (was missing).
- Each game has a healthy pool per unit (fill >= 35 single-word answers, unscramble >= 100
  <=9-word sentences). have-got now blanks the auxiliary (single word -> Fill works);
  there-is/are generates many single-word frames; comparatives/superlatives use explicit
  sensible carrier sentences (the adjective is in the options, so each needs a distinct
  sentence) to reach ~104.
- Verified: 0 structural problems, 0 subject-verb agreement errors across all 1149
  filled sentences, 0 em dashes. Fixed "Bus tickets is", "drink much time", "bought an aunt".

### UI - vocab dashboard replica (grammar.js v6 -> v7, grammar.css v5 -> v6)
- renderMenu() now mirrors #menuScreen exactly (two-column dashboard-body):
  LEFT  = welcome banner + XP block (Level/rank + XP bar + milestones) + 5-stat row
          (Mastered / Best / Accuracy / Questions / Games) + "Your Units" + the Quest
          Board unit cards (donut + the 3 games as challenges).
  RIGHT = "Choose Level" card (A2/B1/B1+/B2 pills) + questions count + "Explore Grammar
          Map" button (scrolls to the units).
- XP = 25 per completed game (global across grammar), level = floor(xp/100)+1 + rank.
- Stats computed from the localStorage progress (gr_prog_v1) in one pass.
- Assignment mode keeps the focused banner + assigned-units board (no level switcher).
- CSS scoped to #grammarScreen, reusing the --dash-* / --text-* tokens that .skill-screen
  already defines -> matches the vocab dashboard without touching extra.css.
- grammar-body widened 820 -> 1080 for the 2-col; games/result kept narrow (max-width
  760 / 620, centered) so quizzes stay readable.
- Removed a stray em dash ('—') that was in the challenge "no score" marker + comments.

## Cache
- grammar.js v6->7, grammar.css v5->6, grammar-content.js v3->4 (student + teacher),
  service-worker.js CACHE_VERSION v16->v17.

## Verify
- node --check grammar.js + grammar-content.js OK.
- grammar.css braces 126/126 balanced.
- No leftover refs to removed summary vars; all dashboard classes present in JS + CSS.
- No em dashes in any of the 3 grammar files.
- Assignment ids preserved (+ a2-was-were); teacher form lists the new topic.

## Deploy
- firebase deploy --only hosting, then reopen. Hub -> Grammar:
  welcome + XP + stats + A2/B1/B1+/B2 + unit cards; right side = level + map button.
  Each unit ~104 questions; pick a unit's game -> donut fills + check persists.

## Notes / next
- B1 / B1+ / B2 are still hand-written scaffold (3 / 2 / 2 topics). A2 is the full one.
- a/an, some/any drills are form-correct; a few drill sentences are deliberately neutral.
