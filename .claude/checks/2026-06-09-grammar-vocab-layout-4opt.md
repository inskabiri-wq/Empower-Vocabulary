# Grammar: vocab layout + 4 options + back button + blank fix · 2026-06-09

Addresses 4 of the 8 reported issues (the grammar-skill cluster). The other 4
(assignment wiring/UI #5-#7, heist password #8) are the next batch.

## #4 Four options (grammar-content.js v4 -> v5)
- Rewrote every generator so each MCQ yields 4 options (same-family distractors:
  verb forms b/s/ing/ed, am/is/are/be, There is/are/was/were, comparative
  base/-er/-est/more, etc.) + a padTo4() safety net that tops up from the topic's
  own answer pool.
- Verified: 1177/1177 questions = exactly 4 options (100%). 0 structural problems,
  0 agreement errors, 11 units still ~104 each.

## #2 Vocab layout (grammar.js v7 -> v8, grammar.css v6 -> v7)
- renderMenu now mirrors the vocab dashboard exactly:
  CENTRE  = welcome + XP + 5 stats + "Choose a game" + the 3 game cards.
  RIGHT   = Level pills, Unit pills (All / Unit 1..11), questions count, and the
            "Explore Grammar Map" button.
- The MAP is now a modal (gr-map-modal, appended to body) showing the unit Quest
  Board (donuts + per-unit game challenges). Click a unit's game there to play it.
- Game card -> startGame(selectedUnit, game). poolFor() handles unit='all' (mixed
  practice across the whole level) + the chosen unit.
- Factored buildUnitCards(level) -> { cards, stats } reused by the stats row and
  the map modal.

## #1 Back button
- gameTop() back button kept + relabelled "<- Back"; result screen "<- Back to menu".
  Present in every game view.

## #3 Double-line blank (Fill)
- The blank was rendering "_____" text AND a CSS underline (two lines). Now the
  blank is an empty span -> single clean orange underline.
- Also tightened poolFor('fill') to single-word answers so Fill never asks you to
  type a 2-word phrase.

## Cache
- grammar.js v7->v8, grammar.css v6->v7, grammar-content.js v4->v5 (student+teacher),
  service-worker.js v17->v18.

## Verify
- node --check grammar.js + grammar-content.js OK.
- Stubbed-DOM smoke: renderMenu / startGrammarAssignment / resetGrammar all run clean.
- grammar.css braces 141/141. No em dashes in js/css. All version strings bumped.

## Deploy
- firebase deploy --only hosting, reopen. Hub -> Grammar: games in the centre,
  level + unit + map on the right; MCQ now has 4 options; clean blank; back button.

## STILL TODO (next batch)
- #5 teacher-dash grammar assignment wiring (audit create -> student -> completion).
- #6 teacher topic picker grouped by Unit + refresh on level change.
- #7 bigger individual-student popup, shared/consistent for grammar + vocab assignments.
- #8 classroom heist: end screen - password changed but the player is never asked it.
