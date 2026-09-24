# 2026-08-19 - Vocabulary screen density

Unit-pills-to-dropdown deliberately NOT done; the user asked to hold that back.

## Doubled spacing (a real bug)
`#menuScreen .main-content` is a flex column with `gap: 16px` AND every child
carried `margin-bottom: 16px`, so every boundary was spaced TWICE - 32px where
16 was intended. The intent was already half-expressed: a sibling rule zeroed
`margin-top` with the comment "flex gap replaces cascading margins". Only the
bottom half was left behind. Zeroed it; the gap now owns the spacing alone.

The `.qc-summary` blocks keep their margins on purpose: they live in the Quest
Board modal, not in this flex column, so nothing else spaces them.

## Activity grid now matches the hub
Was `repeat(auto-fit, minmax(170px, 1fr))` with a 10px gap, which on the 811px
main column resolved to FOUR 195px columns - tighter and smaller than the hub's
three 277px tiles, so moving between the two screens felt like two apps.
Now `repeat(3, minmax(0, 1fr))` with a 16px gap: three 260px cards.

Phone is untouched - the existing max-width rule still wins and gives 2 columns
at 143px, verified at 375px with no horizontal overflow.

Trade-off, stated plainly: 8 cards at 3-per-row is 3 rows instead of 2, so the
main column is TALLER (442px -> 527px). That is the cost of matching the hub's
rhythm and larger tap targets. If scrolling matters more than consistency, 4
columns is one line to restore.

## Contrast: --dash-primary-lt used as text
The header subtitle's `<strong>` ("Vocabulary") was `--dash-primary-lt`, which
is blue-400 - correct for a ring or a bar, 2.54:1 as text on white. Found 9 more
places doing the same. All 10 now use `var(--text-accent, var(--dash-primary-lt))`;
the fallback keeps the old value anywhere --text-accent is undefined.

## A measurement trap worth recording
First readings said the gaps were 4px and 28px, which made no sense against a
16px flex gap. Cause: the entrance animations (`dashFadeUp ... both`) are frozen
at their `from` state in this preview pane, because it never composites and rAF
never fires - so each animated block sat 12px below its real position and every
gap measurement was wrong by 12.

Re-measured with `animation/transition/transform: none !important` injected:
gaps are 16 and 16, exactly as intended.

This also means my earlier "44px -> 28px" report was itself distorted. The
honest figure is 32px -> 16px.

## Verification
- Contrast audit: hub, Vocabulary, Grammar, Reading, Listening - 0 each.
- Phone 375px: 2 columns, 143px cards, no horizontal overflow, 0 contrast fails.
- node --check every JS file: passes.
- grammar-sanity PASS, theme-sanity PASS, light-coverage 0,
  inline-css-check PASS, em-dash scan clean, bump --check no drift.
- Service worker v247.
- Screenshots were not possible (the pane stopped compositing), so this was
  verified by measurement and audit, not visually.

## Still open
- Unit pills -> dropdown (held back on request).
- The Claude Design loaders file (project 404s through DesignSync).
- Nothing deployed.
