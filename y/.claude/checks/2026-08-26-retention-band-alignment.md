# 2026-08-26 - the retention band floated beside the buttons on desktop

Reported with a screenshot: on a wide screen the retention controls sat marooned
in the middle-right of the filter panel, their top border starting halfway
across, while Filter / Clear / Download sat alone at the far left.

## Cause: I added a `<div>` to a flex ROW

`.activity-filters` is `display:flex; flex-wrap:wrap`. Every child is a flex
ITEM. That is right for the six filter groups, which are meant to sit side by
side - and wrong for the two action bands I added underneath, which were left at
their natural width and so wrapped up alongside the button row instead of
forming a band below it.

The border-top I gave the retention block then started wherever that item
happened to land, which is what made it look detached.

## Fix

Both action bands claim a full row:

```css
.activity-filters .activity-filter-buttons,
.activity-filters .activity-retention { flex: 1 1 100%; }
```

An item with `flex-basis: 100%` in a wrapping flex container occupies a line by
itself, so the two can never share one at any width. The panel now reads as
three stacked sections - filters, actions, retention - instead of five things
competing for one line.

## Verified

**On the real ancestor chain**, the rule wins:

| | computed `flex-basis` on `.activity-retention` |
| --- | --- |
| before | `auto` |
| after | **`100%`** |

**Rendering the panel at five widths** (1600, 1280, 1024, 768, 390): both bands
share a left edge, the retention band sits below the buttons, and both span the
panel's full content width. Every width, every check.

### What I could NOT measure, stated plainly

Geometry inside `#tab-activity` in a static render comes back as zeros, because
that tab is `display:none` until selected and a hidden subtree has no layout at
all. Forcing the tab visible was not enough - an ancestor inside it is hidden
too. So the geometry above comes from rendering the panel on its own, and the
`flex-basis` reading is what confirms the rule applies in the real chain. The
rest is a structural guarantee of the flex spec rather than a measurement.

## A note on today's pattern

This is the third alignment issue in a row, and the third with the same shape:
a rule that looks correct in isolation loses to its context. The game bars lost
to source order, the Admin sub-nav lost to a `<style>` block in the body, and
this lost because its parent was a flex row. None were visible from reading the
rule alone - only from measuring the element in the page it lives in.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- CSS braces 82/82, comments 20/20
- gates: fourteen, all PASS
- bump: activity-tracker.css v9, CACHE_VERSION -> **v371**; `--check` OK
