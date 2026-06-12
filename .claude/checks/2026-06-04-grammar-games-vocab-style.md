# Grammar practice rebuilt vocab-style (3 games) · 2026-06-04

## Request
Make Grammar feel like Vocabulary: level selection + activity cards, with the
games Multiple Choice, Fill in the Blank, Unscramble. Vocab theme. Focus A2.

## Finding
The vocab games (games.js) are tightly coupled to WORD data (currentWords pool,
word/def, pool-derived distractors, spelling letters). Forcing grammar into them
would be a fragile hack on the most-used engine. So: built grammar's OWN games
that REUSE the vocab visual classes (global: .token, .answer-area, .answer-token,
.score-display, .action-btn) for an exact theme match, with grammar logic. Menu
cards use a small isolated .gr-act style mirroring .activity-card.

## Built (y/student/js/skills/grammar.js — full rewrite)
- Flow: level pills (A2/B1/B1+/B2, A2 default) -> activity grid (3 cards) ->
  game over that level's pooled questions (shuffled, 10) -> instant feedback +
  explanation -> score -> Play again / Back to activities.
- Games, all derived from existing data (stem + options + answer):
  - Multiple Choice: pick the option (.gr-opt, green/red states).
  - Fill in the Blank: type the missing word; compared case/space-insensitive to
    the correct option; shows the answer if wrong.
  - Unscramble: rebuild the full sentence (stem with blank filled), words shuffled
    into a token bank; click to place / remove; Check. Uses vocab .token /
    .answer-area classes. Filtered to single-blank, <=9-word sentences so awkward
    items (e.g. B2 reported-speech) never appear there.
- Assignment mode preserved: startGrammarAssignment(a) scopes the pool to the
  assigned topics (banner shown), and finishing one round calls
  markAssignmentCompleted(a.id, 100). Reset-on-hub clears assignment context.
- grammar.css: added .gr-act-grid / .gr-act / .gr-act-badge / .gr-act-sub (menu)
  and .gr-fill-input / .gr-blank (fill game). Existing .gr-opt / .gr-feedback /
  .gr-result / .gr-tab / .gr-asg-banner reused.

## Cache
- grammar.css?v=3 -> v4, grammar.js?v=3 -> v4 in student-dashboard.html. (No SW
  bump needed: only these two files changed and both are query-versioned; HTML is
  network-first.)

## Verify
- node --check grammar.js OK; GAMES/renderMenu/startGame/renderChoice/renderFill/
  renderUnscramble/renderResult/startGrammarAssignment/markAssignmentCompleted/
  levelPool all present. grammar.css braces 68/68 BALANCED.
- Not live E2E'd (needs auth). Logic is self-contained DOM + the same completion
  call the assignment path already uses.

## Deploy / test
- firebase deploy --only hosting, reopen. Hub -> Grammar -> A2 -> a game card.
- Try all three; on a grammar assignment, Start -> any game -> finish -> completes.
