# 2026-08-22 - teacher dashboard on phone, steps 3-5: the tab contents

Step 1 was the shell, step 2 the tables. This is each tab's own widgets at
390px. Approach: find what actually overflows rather than restyling on spec.

## Scanned for real breakers first

Every `width` / `min-width` / `grid-template-columns` in `teacher/` above a
362px content box. Two hits in ~40 files:

**`reports-admin.js:481`** - `repeat(auto-fit, minmax(430px, 1fr))`. auto-fit
drops to one column on a phone, but the track keeps its 430px minimum, so the
charts grid overflowed by 68px. Now `minmax(min(430px,100%), 1fr)`, which lets
the single column shrink to the screen and is unchanged above 430px.

**`assignments-overview.js:319`** - a table with an inline
`style="min-width: 600px"`. Inline styles beat stylesheet rules, so this was the
one place cards could still have overflowed. Step 2's
`table.tmt-cards{min-width:0 !important}` already beats it - `!important` in a
stylesheet outranks a plain inline declaration. Measured to confirm rather than
assume: **computed `min-width` is 0px at 390 and 600px at 1280.**

The 170px and 180px `minmax()` grids in the same file fit a 362px box, so they
were left alone.

## Filters and the skill strip

Neither overflowed, both wasted the screen:

- `.filters` had `flex-direction: column` below 600px - five selects plus a
  search box, one per row, about 250px of screen before the first student.
  Now a two-column grid with the search spanning the full row: **195px**.
- `.skill-filter-strip` declares `flex-wrap: wrap` AND `overflow-x: auto`, which
  cancel out - wrapping means there is never anything to scroll. Seven pills
  became **three stacked rows**. Now `nowrap` with a real horizontal scroll:
  **one swipeable row**, scrollbar hidden, `overscroll-behavior-x: contain` so
  swiping the strip does not drag the page.
- `.section-header` stacks, so the title takes a row and the filters the next.

## The student drill-down, which is the answer to "the data is useless"

That complaint was about `teacher-mobile.html`, the gate page, which shows a
handful of counts. The real dashboard already has the drill-down: assignments,
per-question answers, a skill breakdown and recent activity. It just was not
reachable on a phone. Opened it at 390 with the modal built the way
`student-detail.js` builds it (appended to `body` after load):

| | 390px | 1280px |
| --- | --- | --- |
| modal width / fits | 340 of 386, yes | 653, yes |
| assignments table (5 col) | cards | table |
| question review (4 col) | cards | table |
| activity table (3 col) | left as a table | table |
| card heading | "She ___ home." (counter skipped) | n/a |
| overlay above the tab bar | yes | n/a |
| horizontal overflow | none | none |

The middle rows are the real result: these tables are injected **after** load,
and the MutationObserver caught them. That is the case a one-pass-at-load
implementation would have missed, and it is the common one here - every table on
this dashboard arrives after a Firestore read.

## Full-width sweep, all four widths

Header, cards, tables, filters, strip, reports grid, drill-down:

| | 390 | 480 | 768 | 1280 |
| --- | --- | --- | --- | --- |
| left / right gutter | 14 / 14 | 14 / 14 | 14 / 14 | desktop |
| header, cards, tables aligned | yes | yes | yes | yes |
| horizontal overflow | none | none | none | none |
| tab bar / sidebar | bar | bar | bar | sidebar |

## Ritual

- `node --check` mobile-shell.js, mobile-tables.js, reports-admin.js - ok
- em-dash scan on all three - clean
- inline-css-check - PASS
- profile-hub-check - PASS
- grammar-sanity - PASS (every unit clean)
- bump: mobile-shell.js v3 -> **v4**, reports-admin.js v13 -> **v14**,
  CACHE_VERSION v317 -> **v318**
- `bump.js --check` - OK

## Next

Step 6: delete the gate and `teacher-mobile.html`. Step 7: a
`teacher-mobile-check.js` gate plus the measured harness at 390/480/768/1280,
so this cannot silently regress.
