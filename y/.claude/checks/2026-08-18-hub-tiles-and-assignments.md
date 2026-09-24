# 2026-08-18 - Hub: 3 tiles per row, animation, assignments moved below

The two items left from the original list.

## Assignments moved out of the rail
`.hub-two-col` was `minmax(0,1fr) 360px` - a skills column and a 360px right
rail. The assignments box was the ONLY thing in that rail, so it sat squeezed
into a narrow strip while the tiles fought over what was left.

It is one column now: skills on top, assignments full width underneath. The
markup order already had main-then-rail, so the stack needed no reordering.
- `<aside class="hub-rail">` -> `<section class="hub-below">`. It is the main
  content of the page now, not an aside to it, and the name no longer lies.
  Only 5 references in the repo, all updated.
- Removed the `@media (max-width: 1200px)` rail-collapse rules. There is no
  longer a "rail collapses" state that behaves differently from the desktop one,
  which is one fewer layout to reason about.
- Measured: grid 865px, assignments 865px, assignments below the grid. Same
  width, stacked.

## Three per row
Was 4 by default, going to 5 at 1450px and 6 at 1750px - which made the tiles
small and the hub read as a dense wall. Now 3 at every width above phone, with
`max-width: 1120px` so it does not stretch on an ultrawide monitor. The 5- and
6-column rules are gone. Phone stays 2 columns with Classroom spanning the row
as a featured banner.

## Deactivated skills are hidden, not greyed
`hideInactiveTiles` flipped to true for FSMVU. A switched-off skill is not
rendered at all, so the grid closes up. Because the columns are `1fr`, the
remaining tiles stretch to fill without anything being told how many there are.
Verified by firing `feature-toggles-ready` with speaking+writing off:
8 tiles -> 6, two clean rows of 3, no "Not activated" tile left behind.

The `switchedOff` click guard in hub.js is deliberately kept: it is unreachable
for FSMVU now, but correct for any tenant that sets the flag back to false.

## Animation
Tiles rise and fade in, staggered 40ms left-to-right via `:nth-child`, so the
row reads in the order you would scan it. Hover lifts further (-4px) and the
icon scales and tilts slightly.

`animation-fill-mode: backwards` is the part that matters: without it a tile is
painted at its FINAL position for the length of its delay and then snaps back to
the opening frame, which reads as a flicker on the later tiles.

Reduced motion: entrance and hover motion removed. The rule pairs
`animation: none` with `opacity: 1` on purpose - `animation: none` alone on a
`backwards` animation leaves the tile stuck at opacity 0, i.e. an invisible hub
for anyone with the OS setting on. Verified through the CSSOM that the
reduced-motion rule really does set opacity 1.

## Verification
- Desktop 1280: 3 columns (277px each), 3 tiles per row, assignments below at
  full width. Stagger present (1st 0s, 5th 0.16s).
- Phone 375: 2 columns, Classroom spans 285 of 285px, NO horizontal overflow.
  The Classroom tile now sits 715px down the page instead of ~990px - moving
  the assignments below the tiles is what bought that back. That was the
  "games are too far down on the phone" complaint.
- Contrast audit on the hub: clean.
- node --check all JS: passes. theme-sanity PASS. tokenise-colors idempotent.
  inline-css-check PASS. bump --check no drift. Service worker v236.

## Not done
Still open from the earlier list of suggestions: vocabulary-screen density, and
the 13 unit pills that should collapse into a dropdown.
Nothing deployed.
