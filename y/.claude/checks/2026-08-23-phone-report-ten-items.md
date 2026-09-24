# 2026-08-23 - ten reported problems, phone and app-wide

Ten items reported with photographs. Eight fixed and measured here, one is a
follow-up, one is honestly incomplete. Order below follows the report.

## First, a correction to my own earlier work

Yesterday's step-7 log claimed "zero horizontal overflow at all four widths,
widest element is `html`". The photograph of the Overview scrolled sideways
proves that was wrong. The check was measuring SYNTHETIC markup I had typed into
the harness, not the real Overview. A measurement of something you wrote
yourself is not a measurement of the product. Everything below is measured
against markup lifted out of the shipped page with `fetch`.

---

## 1. Classroom header, mark and avatar half drawn

`classroom/css/styles.css` phone block forced `flex-wrap: nowrap` and pinned
`.header-actions` at `flex: 0 0 auto`. At 390px the bar needs about 499px of
content in a 366px box. That left `.ll-brand` (which carries `min-width: 0`) as
the ONLY shrinkable child, so it collapsed to 0px wide and its contents painted
outside it: the flask landed on top of "Hello, ...", the wordmark vanished
entirely (a 0px background box with `background-clip: text` paints no glyphs)
and the lockup's second line, being `overflow: hidden`, was clipped away.

The rule was written assuming the greeting would be hidden to buy the space, but
that hide only matches `#studentName` and the teacher page puts that id on the
INNER span, so on this page nothing was ever freed.

Now the bar wraps deliberately: Dashboard + lockup on line 1, actions right
aligned on line 2. Nothing removed, as asked.

## 2. Student drill-down header

`.sd-modal-head { flex-wrap: wrap }` could never fire: `.sd-head-info` is
`flex: 1` so its basis is 0 and it shrinks instead of pushing a sibling to the
next line, and `.sd-head-actions` does not shrink at all.

| at 390px | before | after |
| --- | --- | --- |
| identity column | 79px of 308 | **292px of 338** |
| chip rows | 5 | **1** |
| email | broke mid-word | `word-break: normal`, fits |
| Print/PDF + close | crowding the name | own line above |

Desktop unchanged (still `break-all`, actions beside the name).

## 3. Activity skill toggle

Two declarations fought. `teacher/css/skills.css` set `scrollbar-width: thin`,
and the phone layer tried to hide the bar with `::-webkit-scrollbar` only. Any
non-auto `scrollbar-width` switches Chromium to the standard scrollbar model and
makes it **ignore `::-webkit-scrollbar` completely**, so the hide was dead on
the exact engine it was written for, and `thin` additionally forces a classic
non-overlay bar that reserves layout height. That is the grey track in the
photo.

Now `scrollbar-width: none` plus the webkit rule for older engines, end padding
and scroll-snap so the last pill is never left half-clipped. Strip height
51px -> 41px, one row, still scrollable.

## 4. Overview scrolled sideways, and "C1 undefined"

**The overflow.** `teacher-dashboard.html` had

```html
<div class="t2-panels-row" style="grid-template-columns: 1.4fr 1fr;">
```

An INLINE grid outranks any media query, so the rule that collapses that row to
one column on a phone silently lost, and Needs Attention stayed beside Recent
Activity. Moved to a `.t2-panels-row-wide` class.

Measured against the real `.t2-overview` markup: **zero elements spill** at 390
and 768, both panel rows single column, and the 1.4/1 split preserved at 1280.

**"C1 undefined" was the smaller half of a real bug.** `counts` was a hand
written literal missing `C1` while `LEVELS_ORDER` includes it, so
`counts['C1']` was `undefined`. That printed the label, but it also made
`Math.max(...)` return `NaN`, and `NaN || 1` meant **max has always been 1** -
so every bar was drawn as a percentage of 1 rather than of the real maximum, and
any level with more than one student rendered full height. The chart was mis
scaled, not just mislabelled. `counts` is now seeded from `LEVELS_ORDER` so the
two cannot drift again.

## 5. Access / permissions panel

Not overflow. `mobile-tables.js` gave `tmt-wide` (a full line, label above) to
every cell containing a control, and in this panel every detail cell has one:
six stacked label/control pairs per card. A cell with exactly ONE compact
control (select, checkbox, short input) and a column label now renders label
left, control right, on a single row. Buttons and multi-control cells keep the
full width. The blank action column no longer reserves an empty label line.

## 6. Placement slow on mobile, and the wrong header

Two separate faults.

- `TAB_HEADERS` in `overview-v2.js` had no `placement` entry, so the tab fell
  through to `TAB_HEADERS.overview` and wore the Overview's greeting and period
  selector. That is why the photo shows "Good evening, Alireza" above a
  placement panel. Entry added.
- `load()` fetched `settings/placementConfig`, the teacher's user doc AND
  `placementResults` in one `Promise.all`. The first two are single documents;
  the third is the whole collection, one document per student who has taken the
  test. Everything waited on the slowest, so the panel showed
  "Loading placement panel..." and nothing else. Split: settings render as soon
  as the fast pair lands, results fill in after, and an empty list before the
  collection arrives now says "Loading results..." rather than "No results yet."

## 7. Writing AI on a phone

`lingualab-write/index.html` loads no phone layer at all, and `corrector.css`
had one narrow block touching only `.cor-dev-grid` and `.cor-plan`. At 390px
`.cor-levels` (Light / Medium / Deep, `inline-flex`, no wrap) had a min-content
width of about 362px inside a 312px box, so it hung out of the row and pushed
the document past the viewport.

Added a self-contained `@media (max-width: 768px)` block for this page only.
Measured on the real markup: `.cor-levels` 328px as a column, actions stacked,
Analyze 44px, **widest element is `html`**, no overflow. Desktop keeps its row.

## 8. Assignment card buttons clipped

`@media (max-width: 600px)` set `.assignment-btn { flex: 1 }`, which is
`flex: 1 1 0%`: every button had a zero basis, so the row always "fitted" and
the `flex-wrap: wrap` above it could never fire. The min-content floor that
normally stops a flex item shrinking past its text was gone too, because
`.assignment-btn` carries `overflow: hidden` for its ripple and that floor only
applies while overflow is visible. So the buttons shrank below their labels and
clipped them - "View Details" reading as "View Detail".

Now a 2x2 grid: 150px columns, two rows, **no text clipped**, 44px minimum tap
target. Done / Trying / Not Started go from three stacked rows to three columns.

## 9. Logout and the back button

Login used `location.replace()` but **logout used `location.href`**, which
leaves the page you just signed out of sitting in history as the back target.
Eighteen such sites across eight files, all of them "signed out or not allowed
here, go to login". All now `replace()`.

Not fully solved, and I want to be clear about it: if you reach a protected page
by ordinary navigation and then sign out, Back can still restore a DIFFERENT
protected page from the browser's bfcache, show it briefly, and only then have
its own auth gate redirect you. Closing that needs a `pageshow` guard on every
protected page; only 4 of 31 pages share a common script, so there is no single
place to put it. Left as a follow-up rather than half-wired.

## 10. The app loads twice and lands randomly

`pwa-register.js` called `location.reload()` on `controllerchange`. The worker
calls `skipWaiting()` on install and `clients.claim()` on activate, so after any
deploy it takes control within the first moments of the first page - exactly
while `index/js/main.js` is doing `location.replace()` to the right dashboard.
Whichever won decided where you ended up, which is why it was random.

The reload was never needed either: `service-worker.js` serves HTML
**network-first**, so every navigation already fetches the current page, and its
assets carry `?v=N`, so a bumped asset is a different URL that misses the cache
anyway. Removed.

## Also added: a check for the trap in item 4

`tools/teacher-mobile-check.js` now fails on a side-by-side grid declared
inline, since no stylesheet rule can defend against one. Scoped to two or more
`fr` tracks: `repeat(auto-fit, ...)` collapses by itself and a fixed rail like
`90px 1fr 46px` fits a phone fine, so neither is flagged. Verified both ways -
it passes on the fixed tree, and re-introducing the exact inline style makes it
fail.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan on all touched files - clean
- inline-css-check, profile-hub-check, teacher-mobile-check, grammar-sanity - **all PASS**
- bump: 20 assets across two rounds, CACHE_VERSION v321 -> **v323**
- `bump.js --check` - OK

## Still open

- Item 9's bfcache residual, above.
- The teacher-dashboard audit still has 4 surfaces unexamined (modals, logout,
  assignments/grading, activity) from a run that hit a usage limit, though the
  modals and the logout path were later measured by hand and were clean.
- Tablet lag still needs a `?perf=1` reading from the Tab S9.
