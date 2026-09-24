# 2026-08-19 - v4 ring treatments (item 6) + a regression I caused

## I broke the student dashboard, then fixed it
Reported mid-turn: "the student dash doesn't load".

Cause was mine. The script that moved the info chips into the Profile box found
the end of the chips block with two chained `indexOf('</div>')` calls. The
second one matched a closing tag belonging to a DIFFERENT element, so the move
carried the `assignments-card-header` ("Your Assignments") out of the
assignments card and left the card unbalanced.

The div count was still 328/328, which is exactly why that check did not catch
it - the tags balanced, they just belonged to the wrong parents.

Fixed by restoring from the pre-move backup and redoing it with real DEPTH
matching: count `<div>` and `</div>` from the opening tag until depth returns
to zero, plus two assertions (the block must contain all four chips, and must
NOT contain "assignments-card"). Verified after: the diff against the backup is
ONLY the chips, the assignments card still owns its header, and the hub renders
8 tiles.

Two things lost in the restore and put back: the mobile-web-app-capable meta,
and six ?v= bumps. `bump --check` then caught skill-registry.js sitting at v4 on
one page and v6 on another; bumped to unify.

## Why item 6 was not optional
`--rotate` split the artwork into an outer ring and an inner core with radial
masks at r=49/50px, and spun the ring half. That only worked because the FSMVU
seal HAS a text ring at that radius. On the flask mark it punched the middle out
and rotated the remainder - and `--rotate` is what the LAUNCH SPLASH uses, so
that would have been the first thing every user saw.

## The treatments
- `--rotate`  -> M Dashed Ring. Mark still, dashed ring turning around it. The
  dashes are an SVG data URI: CSS `border-style: dashed` gives no control over
  dash length, and the 2-on/7-off rhythm is what makes it read as a ring.
- `--shimmer` -> N Comet Sweep. Conic gradient masked into a thin ring. It used
  to be a sheen swept across the artwork, which washed the flask's liquid out.
- `--progress`-> P Arc Trace. Already track + arc + centre mark, so the structure
  fit. What was missing is the arc GROWING and shrinking, which is what makes it
  read as work being done rather than a wheel at constant speed. A conic stop is
  not animatable on its own, so the sweep angle is a registered `@property`.
  Where @property is unsupported the initial-value holds and the arc simply
  turns at fixed length - degrades, does not break.
- `--draw`    -> R Counter Arcs. Two arcs at different radii, opposite spin. The
  old iris wipe clipped the artwork with an expanding circle: fine on a round
  seal, wrong on a flask. The old behaviour is kept under `--iris`.
- `--splash`  -> unchanged. It is the one-shot entrance, not a spinner.
- default     -> unchanged breathe.

Not brought across: O Tick Dial and Q Circling Word. Both need their own child
markup (12 tick elements; an SVG textPath), so they cannot be dropped into the
existing markup the way the other four could. Nothing in the app currently asks
for them.

## Colour
Arcs use the crimson the app already has (#ee3342), matching the mark's liquid.
The faint track behind the arc is tokenised per theme: a crimson tint at 16% is
nearly invisible on white, so light mode uses an ink tint instead.

## Verification
All six variants render at the expected sizes. Arc Trace runs BOTH animations
(fsmvu-spin, fsmvu-arc-grow) and --fsmvu-arc-sweep resolves to 8%, so @property
registered and is driving the grow. The rotate variant's masks are gone
(ringMask none, emblemMask none) and the emblem paints the full mark - the donut
bug is fixed.

- node --check every JS file: passes. manifest valid.
- theme-sanity PASS, light-coverage 0, inline-css-check PASS,
  grammar-sanity PASS, em-dash clean, bump --check consistent.
- Service worker v252.
- Verified by DOM/computed-style reading; the pane still is not compositing, so
  no screenshots.
