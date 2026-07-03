# 2026-06-21 - Modular activation: grammar PRACTICE GAMES on/off

The grammar practice screen (student dashboard) offers three free games:
Multiple Choice, Fill in the Blank, Unscramble. Vocabulary modes were already
deactivatable (Phase 4 `mode_*`), but these grammar games had no toggle. Now an
admin can deactivate each one. Nothing is deleted; assignments still complete via
any remaining active game.

## Storage model
- `settings/featureToggles.gmode_choice | gmode_fill | gmode_unscramble`.
  A missing key means ACTIVE. Keyed `gmode_*` so it NEVER collides with the
  vocabulary `mode_choice` / `mode_unscramble` keys (verified - see below).

## Admin - `teacher/js/feature-activation.js` (?v=4 -> ?v=5)
- New "Grammar games" group in FEATURES with the 3 toggles. Reuses the existing
  card/flip/save plumbing (confirm-on-deactivate dialog, merge write). The
  render() auto-groups by `group`, so this is purely additive.

## Student - `student/js/skills/grammar.js` (?v=21 -> ?v=22)
- `gameOn(id)` reads `window.featureToggles['gmode_'+id] !== false`;
  `activeGames()` = GAMES filtered by it.
- `renderMenu()` "Choose a game" picker uses `activeGames()`; shows a
  `.gr-empty` "No grammar games are active" if all three are off.
- `buildUnitCards()` (the Quest Board / map modal) builds the challenge rows
  AND the per-unit donut math (`X/Y games`, mastered, pct) from `activeGames()`.
  Guarded against divide-by-zero (`gpu = games.length || 1`) when all are off.
- Re-renders on `feature-toggles-ready` if the grammar menu is already open, so
  a just-deactivated game disappears without a reload.
- Assignment mode shares buildUnitCards, so deactivated games are also hidden
  there; an assignment still completes via any active game in an assigned unit.

## Versions
- feature-activation.js ?v=4 -> ?v=5 (teacher-dashboard.html)
- grammar.js ?v=21 -> ?v=22 (student-dashboard.html)
- (Service worker already at v65 from phase 2b; both files are query-versioned.)

## Verification
- `node --check` clean on grammar.js + feature-activation.js. No em dashes in
  touched files.
- Logic sim (all toggle combos): all on -> 3; unscramble off -> 2; only choice
  -> 1; all off -> [] with guarded pct 0 (no NaN); vocab `mode_choice` off ->
  grammar still 3 (NO collision). PASS.
- REAL-browser smoke (preview static-y, throwaway _gr_harness.html loading the
  real grammar-content.js + grammar.js, then deleted):
  - Picker cards: all->[choice,fill,unscramble]; unscrambleOff->[choice,fill];
    onlyChoice->[choice]; allOff->empty state true; vocab mode_* off->3 (no
    collision).
  - Map modal Quest Board: distinct games + donut text tracked the active count
    exactly: "0/3 games" -> "0/2 games" -> "0/1 games".

## Not done
- No deploy. No push.
- The CLASSROOM (teacher-hosted) grammar games - the standalone Grammar Race +
  grammar questions in Heist/Trust - are a SEPARATE surface and were left as-is
  (gated only by the whole-game `game_*` toggles). That was the open question
  the user dismissed earlier; this change is strictly the student free-practice
  grammar games.
