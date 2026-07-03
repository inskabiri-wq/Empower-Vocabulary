# 2026-06-24 - Grammar fixed banks B1 + B1+ ; map "all units" progress fix

## Fixed grammar banks (continuing the all-levels pass)
- B1: 20 topics x 4 = 80 fixed questions (FIXED map).
- B1+: 18 topics x 4 = 72 fixed questions.
- Running total now FIXED: A2 100 + B1 80 + B1+ 72 = 252.
- STILL GENERATED: B2 (19 topics, ~936 generated) - next to author.
- C1: 0 grammar topics exist (C1 is a level with NO grammar content yet) -
  needs a NEW C1_SPEC + authored topics from scratch.
- All verified via Node load: 0 option problems at A2/B1/B1+. node --check OK,
  no em dashes. grammar-content.js ?v=13 -> ?v=14.

## Grammar map "all units shows no progress" - FIXED
- Cause: playing "all units" saves under key `LEVEL|uall|game`, but the map
  donuts read per-unit keys `LEVEL|u1|game`, etc., so "all" play lit nothing.
- Fix (grammar.js getProg): a specific unit's progress now ALSO counts the
  "all units" play for that game (you do see that unit's questions inside the
  "all" set). `getProg(level,unit,game) = max(unit-key, all-key)`.
- Verified (real browser, throwaway _map_harness.html, deleted): seeded only
  A2|uall|{choice,fill,unscramble} = {90,80,70,done} -> first unit card shows
  100% donut, 3/3 games, scores 90/80/70, all checks green. grammar.js v23->v24.

## Not done
- No deploy. No push. B2 + C1 grammar authoring remain.
