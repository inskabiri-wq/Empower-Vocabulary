# 2026-08-26 - the Admin sub-nav on a phone, and a fix I made for a bug that was not there

## 1. The circled pills: a real bug, and an old one

The eight Admin sub-nav pills wrapped into ragged rows on a phone. There has
been a rule in `teacher/js/mobile-shell.js` since it was written that turns them
into one swipeable row, and **it has never applied**.

`teacher-dashboard.html` declares `#adminSubNav{flex-wrap:wrap}` in a `<style>`
block inside the **BODY** (line 1781). `mobile-shell.js` appends its stylesheet
to `<head>`, so it sits EARLIER in document order, and with both selectors at
identical specificity (`#adminSubNav`, 1-0-0) the page's `wrap` won every time.

The comment in mobile-shell even describes the exact symptom it was meant to
prevent - "left to wrap they made four ragged rows... each only 35px tall" -
which is precisely what was on screen.

Same trap as the game bars and the toasts earlier today. Qualified with `body`
(1-0-1), which wins regardless of order and needs no `!important`.

### Measured at 390px, both states

| | flex-wrap | visual rows | shortest pill | swipeable |
| --- | --- | --- | --- | --- |
| page CSS only (what shipped) | wrap | **4** | **35px** | no |
| with the rule now winning | nowrap | **1** | **44px** | yes |

Four ragged rows of 35px pills, against one swipeable row of 44px tap targets.
The "before" matches the screenshot.

`teacher-mobile-check` still passes - mobile-shell is load-bearing and that gate
guards it.

## 2. A correction: the Activity Logs buttons were not broken

I reported that at 390px the Filter / Clear / Download buttons were squeezed to
~74px and wrapping onto three lines, 60px tall. **That measurement was wrong.**
It was taken before the iframe's stylesheets had finished loading - the same
trap already recorded in memory, and the second time I have hit it today.

Re-measured properly, waiting on `link.sheet` rather than a guessed delay, and
comparing the page with my rule neutralised against the page with it:

| at 390px | tallest button | multi-line | past the edge |
| --- | --- | --- | --- |
| **before my change** | 24px | **0** | **0** |
| after my change | 42px | 0 | 0 |

**It was already fine.** Nothing wrapped, nothing overflowed. I fixed a bug that
did not exist.

### What I have left in, and why

The rule stays, but as a deliberate choice rather than a repair:

- buttons become full-width rows on a phone, so tap targets go from ~19px tall
  to 40-42px
- **Delete logs older than 6 months** no longer shares a row with anything else,
  which matters for a destructive control

If the compact look is preferred, the block at the foot of
`activity-tracker/css/activity-tracker.css` is self-contained and can come
straight out. Say so and I will remove it.

## The lesson, since this is twice in one day

An iframe probe that measures before its stylesheets load reports the UNSTYLED
layout, and unstyled always looks broken. The fix is to await `link.sheet` on
every stylesheet, or poll for a value only the CSS in question can produce -
never a fixed delay. Both of today's phantom findings came from a fixed delay.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: fourteen, all PASS (including teacher-mobile-check, which guards
  mobile-shell)
- bump: mobile-shell.js v11, activity-tracker.css v8,
  CACHE_VERSION -> **v370**; `--check` OK
