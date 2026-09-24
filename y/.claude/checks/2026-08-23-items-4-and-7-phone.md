# 2026-08-23 - items 4 and 7: skill picker and writing form on a phone

Screenshots settled these. My earlier overflow checks reported them clean and
were right about overflow, which is exactly why they missed the problem:
nothing was spilling, the layouts were simply wrong for the screen.

## 7. Writing assignment form

Two faults in the photo.

**The step tabs wrapped ragged.** Four labels of different lengths in a
`flex-wrap` row gave "① Details / ② Settings & Rubric" on one line and
"③ Targeting / ✨ AI correction" on the next, all different widths.
Now a 2 x 2 grid: four equal 153px cells at 390px, two tidy rows.

**The footer labels broke mid-word.** Cancel, Back and Save all share the
Cancel button's 12px/24px padding, and three of those did not fit the row, so
"Save Assignment" split over two lines and the arrow of "◀ Back" was stranded
above its word. Tighter horizontal padding plus `white-space: nowrap`.

Measured in the real last-step state (Cancel + Back + Save; Next is hidden
there), counting actual line boxes with a Range rather than guessing from
height:

| | 390px | 360px |
| --- | --- | --- |
| labels on two lines | **none** | **none** |
| button widths | 55 / 78 / 112 | 74 / 78 / 127 |
| total vs row | 245 in 313 | 279 in 284 |

## 4. Skill picker

Each tile was a centred column: a 2.2em icon on its own line, then the name,
then the subtitle. About 200px tall, six of them, to answer one question.

On a phone they are now compact rows with the icon at the left, which is how
every other list in the app reads. Tile height **66px, down from ~200**, and the
whole picker is 396px instead of scrolling for most of a screen and a half.
Desktop keeps the centred tiles unchanged (121 to 136px, `text-align: center`).

The children carry inline styles, so those rules need `!important` to win.

## The rule that lost, and why

`.wtabs { display: grid }` had no effect at first. `.wtabs { display: flex }` is
declared in an inline `<style>` block inside `teacher-dashboard.html`, which
sits later in the document than `assignments.css`, so at equal specificity it
wins. **A media query adds no specificity.** Worse, my `.wtabs .wtab
{ width: 100% }` DID apply (two classes beats one), so every tab became a
full-width row: briefly worse than the ragged wrap it was meant to fix.
`display: grid !important` settles it, with a comment saying why.

## A measurement mistake I repeated

I counted "rows" by grouping buttons on their `top` value. Buttons of different
heights in the same row have different tops, so a single row reports as two or
three. At 1280 it claimed two rows for 351px of buttons in a 1122px container,
which cannot happen, and that is what exposed it. Vertical CENTRES are the
correct test, as in the classroom header. The width arithmetic above is the
trustworthy part, and the line-box count is what actually answers the
complaint.

## Ritual

- em-dash scan - clean
- brace balance - 277 / 277
- inline-css-check, profile-hub-check, teacher-mobile-check, grammar-sanity,
  ui-text-check - all PASS
- bump: assignments.css v20 -> **v21**, CACHE_VERSION v331 -> **v332**
- `bump.js --check` - OK
