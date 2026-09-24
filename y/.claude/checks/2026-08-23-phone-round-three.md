# 2026-08-23 - five annotated items, phone (round three)

Reported as five circled screenshots with no text. Read as: the third assignment
counter clipped and "Submissions" breaking mid-word; the admin filter pills
wrapping 3 + 1; the classroom greeting stranded at the far left; the Write gear
orphaned on its own line; the Activity "All Activities" select running off the
edge.

## Three of the five were the same bug, for the third time

**A grid track's automatic minimum size is `min-content`, so `1fr` does not mean
"no wider than the container".** The track grows to whatever its contents refuse
to shrink below, and the overflow lands outside the parent.

This has now caused, in order: the Needs Attention panel (round two), the
assignment counters, and the Activity filters. Every phone grid written here now
uses `minmax(0, 1fr)`:

| grid | was | now |
| --- | --- | --- |
| `.assignment-students-summary` | `repeat(3, 1fr)` | `repeat(3, minmax(0, 1fr))` |
| `.assignment-card-footer` | `1fr 1fr` | `repeat(2, minmax(0, 1fr))` |
| `.filters` (Activity, Students) | `1fr 1fr` | `repeat(2, minmax(0, 1fr))` |
| `.av-toolbar-pills` (new) | flex wrap | `repeat(2, minmax(0, 1fr))` |

## 1. "Submissions" broke mid-word

Self-inflicted. Last round I gave `.assignment-btn` `overflow-wrap: anywhere` to
stop labels clipping. That permits a break INSIDE a word whenever it improves
the fit, which is how "Submissions" rendered as "Submission" over "s". The
clipping was never a wrapping problem: it was the `1fr` track. With
`minmax(0, 1fr)` doing the real work, the button is back to
`overflow-wrap: normal` and only breaks at real break points.

## 2. Admin filter pills

Four pills (All / Admins / Teachers / Unassigned) need about 460px, so on a
phone they must wrap. Left to flex they went three then one, which reads as a
mistake rather than a layout. Now an explicit 2 x 2 grid, with the search box
full width beneath and the flex spacer hidden.

## 3. Classroom greeting

`margin-right: auto` from last round pushed "Hello, Alireza" to the opposite
edge of the bar, leaving a wide gap before Logout so it read as a stray line of
text rather than part of the cluster. It now travels WITH the controls.

Measured at 390: cluster spans 196 to 374 with 8px and 12px internal gaps
(previously the greeting sat at x=12, about 180px from the rest). Zero spill.

## 4. The Write gear was orphaned

`js/app-settings.js` appends the settings wheel as a SIBLING of the button row:
it looks for a Logout button to sit beside, finds none on this page, and falls
back to appending to the header itself. Last round I gave `.cor-topactions`
`width: 100%`, which then forced the wheel onto a line of its own under
Print / PDF.

Now `flex: 1 1 auto` instead, so the row takes only the width it needs and the
wheel sits beside it. Measured: gear and buttons share the same row top (76 and
76) at 390, one button row, gear right edge 372 inside 386, no overflow.

## Measured, at 390

| | result |
| --- | --- |
| summary columns | 112 / 112 / 112, one row, "Not Started" visible |
| footer columns | 150 / 150, two rows, no mid-word break |
| admin pills | 175 / 175, two rows, two per row |
| activity filters | 175 / 175, "All Activities" fits |
| classroom greeting | grouped with controls, not stranded |
| Write gear | same row as the buttons |
| **elements spilling** | **0** |
| sideways scroll | none |

Desktop unchanged on every one.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan - clean
- inline-css-check, profile-hub-check, teacher-mobile-check, grammar-sanity - **all PASS**
- bump: mobile-shell.js v8, assignments.css v18, corrector.css v16,
  styles.css v44, CACHE_VERSION v325 -> **v326**
- `bump.js --check` - OK

## Worth automating

Three rounds, three instances of the bare-`fr` trap. A check that flags
`grid-template-columns` with two or more `fr` tracks not wrapped in `minmax(0,`
inside any max-width media block would have caught all three. Not written yet.

---

# Round four: the text inside the boxes, and the Activity dropdowns

Reported: "assignments the boxes are now correct but not the texts inside" and
"activity drop downs are in box but the box is bigger than the screen, I should
scroll to right to see the full text".

## Assignments: right box, wrong text

Round three sized the three counter boxes correctly but left the label beside
the count inside a 112px box, with `text-overflow: ellipsis` as the safety
valve. So the box was right and "Not Started" was chopped, which is exactly what
was reported.

Fixed by stacking: count above label, so the label gets the FULL width of the
box instead of what the count leaves over. Ellipsis dropped, wrapping allowed.

Measured at 390: label renders "Not Started" in a 59px run inside a 112px box,
**not truncated**, three boxes on one row.

## Activity: the dropdowns were never in `.filters`

The two selects on the Recent Activity header sit in an inline
`style="display: flex; gap: 10px;"` div, not in `.filters`. Every phone rule
written for filter clusters targets `.filters`, so none of it ever applied
here, which is why this pair still ran off the screen while the Students tab
pair was fine.

Given the class the app already uses for this exact cluster. Also added
`min-width: 0` and `max-width: 100%` for selects inside `.filters`: a `select`
is sized by its longest OPTION rather than the selected one, so without it the
control reports the width of "Listening Exam practice" and pushes its own
column past the screen.

Measured at 390: both selects 175px, both fit, **sideways scroll 0px**
(previously the row was wider than the viewport).

| | 390 | 768 | 1280 |
| --- | --- | --- | --- |
| filters layout | grid 175/175 | grid 364/364 | flex, natural 135/129 |
| counter item | column | row | row |
| sideways scroll | none | none | none |

Desktop unchanged.

## Lesson worth recording

Both rounds of this bug came from the same place: a cluster that LOOKS like the
others but carries an inline style instead of the shared class, so none of the
shared treatment reaches it. The inline-grid check added earlier catches the
grid case; this was the flex case. Worth widening that check to flag any inline
`display: flex` row inside `.section-header`, since that is the pattern.

## Ritual

- `node --check` mobile-shell.js - ok
- em-dash scan - clean
- all four gates - PASS
- bump: mobile-shell.js v9, assignments.css v19, CACHE_VERSION v326 -> **v327**
- `bump.js --check` - OK
