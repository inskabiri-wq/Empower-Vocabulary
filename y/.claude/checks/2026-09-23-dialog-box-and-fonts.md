# 2026-09-23 (second round) - dialog font size and card box

Follow-up to `2026-09-23-dialog-sizes-org-logo.md`. That round made the two
BUTTONS the same. He came back with: the exit font size still differs between
the teacher and student dashboards, and the boxes are not the same either. Both
were right, and one of them was a fault in the fix itself.

## 1. The button font size - my own bug

The new rule said `font-size: 0.95em`. An em is a share of whatever the parent
card is set to, so the same declaration produced a different pixel size per
page. Changed to `0.95rem` in both `y/css/brand.css` and the `.appdlg-btn` rule
in `y/js/app-dialog.js`.

Worth recording what it was BEFORE any of this: the student button said
`font-size: 1em` (16px, Segoe) and the teacher button set no font rule at all,
so it fell back to the browser default of 13.3px Arial - a different size AND a
different typeface. That is what he was looking at, since none of this is
deployed yet.

## 2. The card box - measured, then closed

Everything above the buttons was still sized per page. Measured with
`y/tools/harness/logout-dialog-size.html` (extended this round to report card,
icon and text metrics, not just buttons):

| | student | teacher | classroom |
|---|---|---|---|
| card | 420 x **346.6** | 420 x **275** | 420 x 250.6 |
| icon | **72px** | 56px | 56px |
| title | **h2 24px** | **h3 18.7px** | h2 20px |
| message | 16.8px | 16px | 15.2px |
| message copy | **119 chars** | **87 chars** | 27 chars |

Fixes, all in `y/css/brand.css` scoped under `.ll-dialog`:

- `.ll-dialog-icon` pinned to 56px / 26px (student's `.modal-icon{width:72px}`
  was winning on equal specificity plus later load order)
- title unified at `1.25rem`, message at `1rem` / line-height 1.6
- `border-width: 1.5px` on the card - width only, so each page keeps its own
  border colour

(The first draft of these matched bare `h2`/`h3`/`p`. That was wrong and is
corrected in section 4 below - read that one as the final shape.)

**Specificity:** every selector doubles the class, the idiom already used in
this file. A single `.ll-dialog` plus an element scores (0,1,1), which only
TIES `.modal-box h3 { margin-bottom: 16px }` in `y/teacher/css/styles.css`, and
brand.css is deliberately loaded first, so the page won the tie. That alone left
the teacher card 4px taller after everything else matched.

**Copy:** two different sentences cannot make the same box however the CSS is
written. Both dashboards now use the same sentence, word for word: "Are you sure
you want to log out? You'll need to sign in again to continue." The inline
`style` on the teacher's `h3`/`p` was removed as well - inline styles beat every
stylesheet and would have quietly re-opened the gap.

Result: student and teacher logout cards are **420 x 285.2 with every measured
delta at 0** - width, height, button size, button font, title font, message
font, icon. Classroom stays 259.6 tall because it is a different dialog
(leaving a game, 27 characters of copy) sharing the same styling.

Not changed, because it is branding rather than size: the card BACKGROUND still
differs, student `linear-gradient(145deg, rgba(35,35,55,.98), ...)` vs teacher
flat `rgb(21,32,53)`. Raised with him rather than changed unilaterally.

## 3. Login contact line

"Contact your teacher" -> "Contact us". Hiding the address was never meant to
re-route the request to a teacher. The address is still assembled at click time
by `openSupportMail()` so nothing is in the markup to scrape.

## 4. The fix above reached too far - caught and narrowed

A parallel audit (12 regression claims, each put to three independent skeptics)
found the first version of the block was scoped wrong, and it was right.

`.ll-dialog` is NOT the logout dialog. It is the shared shape and motion layer,
and **four** dialogs wear it:

| card | title / message | owner |
|---|---|---|
| `.modal-content` / `.modal-box` | `.modal-title` / `.modal-message` | the logout dialogs |
| `.ph-panel` | `.ph-title` / `.ph-sub` | `js/profile-hub.js` |
| `.rd-confirm` | `.rd-confirm-title` / `.rd-confirm-message` | `student/css/reading-exam.css` |
| `.appdlg-card` | `.appdlg-title` / `.appdlg-msg` | `js/app-dialog.js` |

So `.ll-dialog > h3` and `.ll-dialog > p` styled all four. It would have:

- retyped the profile hub's three panel headings (800 -> 700 weight, 1.15em ->
  1.25rem) and overwritten the 4px sub-line margin with 24px, on four pages
- flattened the reading exam confirm, whose type is deliberately smaller
  (13.5px message), AND killed its `@media (max-width: 720px)` override, since a
  media query adds no specificity - the file's own comment at line 1690 warns
  about exactly this

Narrowed so every selector matches a CLASS:

- `.ll-dialog.ll-dialog > .modal-title` / `> .modal-message`, never a bare
  element. Neither `profile-hub.js` nor `reading-exam.js` uses those class
  names at all (verified: 0 occurrences), so the rules cannot reach them.
- the teacher dashboard's bare `h3`/`p` were given `.modal-title` /
  `.modal-message` rather than being matched as elements
- `border-width` pinned to `.ll-dialog.modal-content, .ll-dialog.modal-box`
  instead of all `.ll-dialog`, so the hub panel and exam confirm keep their 1px
- `.ll-dialog-icon` verified to exist on the two logout modals only

Re-measured after narrowing: student and teacher still **420 x 285.2, every
delta 0**.

## 5. New gate: y/tools/dialog-scope-check.js

So this cannot come back. Three lines:

1. no rule under `.ll-dialog` may target a bare element as its subject
2. `brand.css` must never name another dialog's private classes
3. the two logout dialogs must carry the shared classes, have no inline
   font-size/margin, and use the **same sentence** (different copy cannot give
   the same box, which is what made one card 71px taller)

Negative-tested: re-adding `.ll-dialog.ll-dialog > h3` makes it fail with that
selector named, and it passes again once removed. Its first version used a
fixed-size slice to find the modal, overran into the NEXT modal and reported
that one's inline `font-size: 3em` as a failure here; replaced with a
nesting-aware extractor. Picked up automatically by `gates.js`, which discovers
`*-check.js`.

## Harness note

`logout-dialog-size.html` now also reports card / icon / title / message
metrics and an explicit student-vs-teacher delta line, so the next time this is
asked the answer is a number and not an opinion.

## Checks

- `node --check` across every project JS: clean
- em-dash scan: clean (0 files)
- `node y/tools/gates.js`: **30 passed, 0 failed**, 1 skipped (rules-live, needs
  `--prod`) - 30 because `dialog-scope-check.js` joined them
- `node y/tools/bump.js`: brand.css -> v30, app-dialog.js -> v8;
  CACHE_VERSION v431 -> v433; `--check` reports no drift

## Still on the user

- **Deploy the rules** - still the 11 Sep ruleset, so `supportMessages` is not
  writable and the message box cannot work yet.
- **Set the FSM logo** in Admin > Organizations (the new logo box), value
  `fsmvu-seal.png`, on both rows.
- **Decide the message routing.** The student row says "Message your teacher"
  but every message lands in Admin > Messages, which is him. Either the wording
  or the routing is wrong, and the answer changes the data model, so the
  categories / filters / rating / FAQ work waits on it.
