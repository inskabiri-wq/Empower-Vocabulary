# Grammar = vocab Quest Board + full A2 content · 2026-06-04

## Request
Make Grammar match the vocabulary MAP (Quest Board) exactly: level tabs -> unit
cards with a progress ring + the games listed inside as challenges, and the TOPICS
must be there when you choose a game. Plus finish all 11 A2 units and a big,
non-repetitive question bank.

## Done
### Content (grammar-content.js)
- A2 now 24 topics / 104 questions covering coursebook Units 1-11 (added Unit 8-11:
  can/could, have to, present continuous, present-simple-vs-continuous,
  comparatives, superlatives, present perfect, present-perfect-vs-past). 5 Q each,
  distinct stems/subjects, non-repetitive. Verified: every answer index in range,
  no missing fields.
- Each activity, across the 24 topics, draws on ~104 questions (Multiple Choice and
  Fill: all 104; Unscramble: the short single-blank ones) -> "~100 per activity".

### Quest Board (grammar.js full rewrite)
- renderMenu() = the vocab Learning Map look, REUSING the global .qc-* classes
  (.qc-card / .qc-donut / .qc-unit-info / .qc-challenges / .qc-challenge /
  .qc-level-summary) from extra.css -> exact theme, no new CSS.
- Level pills (gr-tab) -> a summary row (Progress / Games Done / Topics / Questions)
  -> one .qc-card per TOPIC with an SVG donut + the 3 games (Multiple Choice, Fill
  in the Blank, Unscramble) as .qc-challenge rows (icon + name + % + check).
- Pick a topic's game -> that TOPIC's questions only (so topics are present when
  choosing a game) -> instant feedback -> result records progress.
- Progress persists in localStorage (gr_prog_v1): per (level, topic, game) best% +
  done (>=60%). Donuts/checks reflect it; survives reloads.
- Games kept: Multiple Choice (.gr-opt), Fill in the Blank (.gr-fill-input),
  Unscramble (vocab .token/.answer-area). Back button returns to the board.
- Assignment mode: board scoped to the assigned topics (banner); finishing any
  game marks the assignment complete via markAssignmentCompleted(id,100).

## Cache
- grammar.js?v=4->5, grammar-content.js?v=2->3 (student) + grammar-content.js?v=3
  (teacher form's topic list). No extra.css change (its .qc-* already deployed).

## Verify
- node --check grammar.js + grammar-content.js OK.
- A2 = 24 topics / 104 Q, data issues NONE.
- Quest-board functions/classes all present.

## Deploy
- firebase deploy --only hosting, reopen. Hub -> Grammar -> A2 -> a topic card ->
  a game. Rings fill as you finish games. (Level tabs use the gr-tab pill style;
  say the word if you want the wider tab style from the vocab modal.)
