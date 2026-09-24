# 2026-08-22 - teacher dashboard on phone, step 2: tables become cards

Plan: bottom tab bar with More, gate stays until step 6. Step 1 was the shell;
this is the contents.

## A wasted round first: the dev server was down

Step 2's first three verification runs all reported `converted: false,
labelsStamped: 0`, and a debug probe returned `moduleDefined: false` with
`errors: []`. That combination looks like a broken module, and I started reading
the module for the bug.

It was not the module. `curl` to the preview returned **000** - the static-y
server had stopped, so every `<script src>` in the harness 404ed and the
`s.onload = s.onerror` handler could not tell the two apart. The module had
never run.

Worth writing down because it is the third harness fault this week that
presented as a code fault (`w is not defined`, the missing classroom stylesheet,
now this). **A probe that reports "did not run" should check the file is being
served before it checks the file.** The fix is one line: assert
`fetch(src).status === 200` at the top of any harness that loads a script.

## `teacher/js/mobile-tables.js`

Below 768px every table row becomes a card: one cell leads as the heading, and
each remaining cell shows its column name beside its value.

It stamps `data-label` from the `<th>` row rather than having the renderers do
it. Eight modules build tables, several with their own markup, so editing them
all would mean eight places to keep in step and any new table would arrive
un-converted. A MutationObserver re-stamps, because these tables are rebuilt on
every filter change and snapshot.

### Which tables convert

Scanned every header row in `teacher-dashboard.html` and `teacher/js/`:

| cols | table | |
| --- | --- | --- |
| 12 | Students roster | cards |
| 7 | Admin teachers | cards |
| 6 | Assignments overview | cards |
| 5 | Teacher totals, Student assignments | cards |
| 4 | Confusing pairs, Question review, Skill summary | cards |
| 3 | Reports top list, Activity log (x2) | **left as tables** |

Below four columns a table already reads fine on a phone and cards only make it
longer, so `MIN_COLS = 4` leaves those alone. Two more headers are built from
runtime templates; the stamping reads the live DOM, so they are handled by
whatever they actually render.

### The heading is not always column one

`# | Question | Their answer | Correct answer` would have produced a card headed
"1". A leading counter column (`#`, `No`, or a cell that is just a number) is
now kept as a small badge and the next column leads, so the card is headed by
the question. Verified on rows 1 and 2 independently.

Placeholder cells - empty, or a hyphen or dash standing in for no data - are
hidden rather than printing "Class" above nothing. Cells holding buttons get the
full card width instead of being squeezed against their label.

Measured at 390 / 1280 with the real stylesheets:

| | 390px | 1280px |
| --- | --- | --- |
| students row `display` | block | table-row |
| cell `display` | flex | table-cell |
| label shown via `::before` | "Book" | none |
| the "-" Class cell | hidden | visible |
| 3-column table converted | no | no |
| wrapper `overflow-x` | visible | auto |
| horizontal overflow | none | none |

## The header the user said was "badly placed"

Measured rather than guessed, and there were three separate faults, all mine
from step 1:

1. **Doubled gutter.** `body` carries `padding: 20px` and `.t2-main` another
   `28px`, so content started 34px in - 17% of a 390px screen lost to margins.
2. **The header was indented past its own content.** Step 1 gave
   `.t2-page-header` a 14px padding of its own, so the title started at 62px
   while the cards below it started at 48px. That 14px step is what reads as
   "badly placed".
3. **The gap between header and content was gone.** Step 1 forced
   `.t2-main{display:block}`, which silently dropped its `gap: 20px` - the
   header sat directly on the first card. Only `.t2-shell` needed to stop being
   a row; `.t2-main` is now left as the flex column it was.

Also: the period select was wrapping onto its own line and sitting left-aligned
under the title, because `justify-content: space-between` puts a single wrapped
item at the start. The header now stacks deliberately on phone and the select
spans the column.

And `scrollbar-gutter: stable` on `.t2-main` was making the right margin 15px
wider than the left. It is there to stop a desktop row-expand from shifting the
layout sideways; phones use overlay scrollbars, so it reserves space for a
scrollbar that will never appear. Off below 768px.

| | 390px | 480px | 768px | 1280px |
| --- | --- | --- | --- | --- |
| left gutter | 14 | 14 | 14 | 59 |
| right gutter | 14 | 14 | 14 | 73 |
| symmetric | yes | yes | yes | n/a (desktop gutter) |
| title / card / table aligned | yes | yes | yes | yes |
| actions aligned with title | yes | yes | yes | no (flush right, by design) |
| page scrolls | yes | yes | yes | yes |
| bar overlaps content | no | no | no | no bar |
| horizontal overflow | none | none | none | none |

Card width at 390 went from 303px to 343px - 40px back.

## Ritual

- `node --check` mobile-shell.js, mobile-tables.js - ok
- em-dash scan on both - clean
- inline-css-check - PASS
- profile-hub-check - PASS (4 profile pages, 8 classroom pages)
- bump: mobile-shell.js v2 -> **v3**, mobile-tables.js v1 -> **v2**,
  CACHE_VERSION v316 -> **v317**
- `bump.js --check` - OK

## Next

Step 3-5: Overview and Students read-only, Assignments, Activity log - now that
the frame and the tables both work, these are mostly checking each tab's own
widgets at 390. Then 6 (delete the gate and `teacher-mobile.html`), then 7 (a
`teacher-mobile-check.js` gate plus a measured harness at 390/480/768/1280).
