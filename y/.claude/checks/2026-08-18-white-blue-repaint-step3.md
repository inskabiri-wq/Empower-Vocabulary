# 2026-08-18 - White + blue repaint, step 3 (classroom games)

Final area. Six stylesheets, ~5,000 lines, covering The Heist, Trust No One,
Listening Race, Reading Race and the shared shell (lobby / join / bingo /
scramble / tug).

## Starting state
Every game declared a COMPLETE dark token set and not one had a light
counterpart, so the games would have stayed black while the whole app went
white. The theme plumbing was already fine: all 16 classroom pages load
js/app-settings.js, so they were already receiving the light-mode class - only
the CSS was missing.

## What changed
- 196 colour values swept to blue across 10 files (cyan, sky, violet, indigo,
  amber, orange, rose decoration).
- A full light block per game, restating the WHOLE token set plus the body
  background gradients. Written as `.light-mode body.X, body.light-mode.X` so it
  matches whether the class lands on <html> or <body>.

## Kept, because they are meaning and not decoration
- Green = correct / banked, red = wrong / caught, in every game.
- Amber on the heist timer when time is running out.
- The podium's FIRST place is still gold. Blue made first place look like any
  other card.
- `.trust-q-opt.correct` was CYAN before this work, which had the same problem
  in a milder form. It is green now: a correct answer should not be the same
  hue as every neutral control.

## Three mistakes I made and caught
1. A `split/join` string replace hit the DARK token as well as the light one,
   pushing `--t-cyan`, `--l-sky` and `--heist-cyan` to deep blues that do not
   read on navy. Dark went from clean to 3 failures. Fixed by line number.
2. The sweep collapsed the shell's `--accent-gradient` from three distinct stops
   onto two, leaving a near-flat ramp. Restored.
3. The audit tool had a THIRD bug (see below), so the first dark run reported
   phantom failures. None of those were real.

## The audit tool, third and fourth fixes
Both produced silent wrong answers, so earlier numbers were unreliable:
- It read only the FIRST background layer. CSS paints layers first-on-top, so an
  opaque base under a translucent overlay was never seen - the games' dark
  backgrounds scored as WHITE and their light text was reported unreadable.
  Layers composite bottom-up now.
- `over()` hardcoded `alpha: 1`, which is only correct when the lower layer is
  already opaque. Compositing two translucent overlays produced a fully
  saturated colour. Proper source-over now, with alpha accumulating.
- Also: the background image now composites OVER background-color instead of
  replacing it (`background: <gradients>, #f6f8fb` splits across the two).
Saved at `y/tools/demos/contrast-audit.js` with all four mistakes documented.

## Verification
Harness: `y/tools/demos/classroom-palette.html?game=<name>&theme=<light|dark>`.
The game pages are auth-gated and bounce to login, so the harness loads the REAL
stylesheets in the REAL order and renders each game's own classes. It
cache-busts itself on every load.

Contrast audit, 5 games x 2 themes = 10 runs:
  light: heist / trust / listening / reading / shell - ALL CLEAN
  dark:  heist / trust / listening / reading        - ALL CLEAN
  dark:  shell - 3 findings, all the same pre-existing item: `--error #ef4444`
         at 4.33:1 against the dark card (needs 4.5). NOT a regression - that
         value is untouched by this work. Left alone deliberately because
         --error is used as both text and fill in the games, so lifting it for
         legibility would wash out every red fill. Flagged, not silently changed.

Also lifted classroom dark `--text-muted` #71717a -> #9ca3af (was 3.37:1 on the
dark card). Pre-existing, but it is exactly the invisible-text problem.

- `node --check` every JS file in the repo: passes.
- theme-sanity PASS; tokenise-colors idempotent; bump --check no drift.
- Service worker v233.
- 42 comment em dashes hyphenated in the game stylesheets. The `content: '▶'`
  play glyphs are intact - grep matches those by byte, they are not dashes.

## Repaint complete
Student area, teacher dashboard, login and classroom games are all white+blue.
Nothing deployed.
