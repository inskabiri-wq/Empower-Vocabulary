# 2026-08-23 - six follow-up items, phone

Second round on the same report. Two of these were regressions I introduced, and
two were caused by the same mistake in my own harness.

## The harness mistake, again

Twice now I have measured the teacher dashboard WITHOUT `body.t2-active`. That
class is not decoration: it turns the page from an ordinary scrolling document
into a fixed shell (`body { overflow: hidden }`, `.container { height: 100vh }`,
`.t2-main { overflow-y: auto }`). Measuring without it meant the body scrolled,
so the padding I put there appeared to work and the bar appeared to clear the
content. On the real page neither was true.

Every measurement below sets `body class="t2-active"` and uses the real
`#mainContent` wrapper.

---

## 4. Placement never loaded (my regression)

`placement-admin.js` binds its FIRST load to a click on the sidebar row:

```js
var btn = document.querySelector('.t2-nav-item[data-tab="placement"]');
if (btn) btn.addEventListener('click', function () { ... render(); });
```

My bottom bar called `window.switchTab(tab)` directly and returned early for tab
items, so it never fired the row's click. The tab switched, the listener never
ran, `load()` was never called, and the panel sat on
"Loading placement panel..." for the whole session.

`activate()` now clicks the real sidebar row for tabs too. The row's own
`onclick` calls `switchTab` anyway, so the tab still switches, and every other
listener fires. That is the module's stated design ("delegate to the sidebar
row, never a second implementation") which I had broken for exactly the case
that needed it.

Verified: tapping Placement in the More sheet fires the row click **once**,
calls `switchTab('placement')` **once**, and closes the sheet. Primary tabs
behave the same.

## 6. The bottom of every tab was unreachable

Two compounding faults, both mine:

- I put the bar clearance on `body`. The body does not scroll here; `.t2-main`
  does. Moved to `.t2-main`.
- `body` carries `padding: 20px` from `teacher/css/styles.css`. With
  `.container` at `height: 100vh`, that 20px top and bottom pushed the shell
  40px past the viewport, so the end of the scroller sat below the screen and
  the last 13px stayed under the bar no matter how far you scrolled. Now
  `body.t2-active { padding: 0 }` on a phone, so the shell fills the viewport
  exactly.

| | 390 | 768 | 1280 |
| --- | --- | --- | --- |
| shell exactly viewport | yes | yes | n/a (desktop) |
| phantom page scroll | **0** | **0** | 40 (unchanged) |
| `.t2-main` scrolls | yes | yes | yes |
| last panel fully visible | **yes** | **yes** | yes |
| clearance above the bar | 7px | 7px | n/a |

## 3. Needs Attention hung off the screen

Measured with the real runtime row markup: the single grid track computed to
**436px inside a 386px container**.

Cause: a grid item's automatic minimum size is `min-content`, so
`grid-template-columns: 1fr` does NOT mean "no wider than the parent" - the
track grows to whatever the contents refuse to shrink below. The panel has a
nowrap title, a badge and two buttons per row, giving it a 436px min-content.

`minmax(0, 1fr)` on every track, plus `min-width: 0` on the panels, plus
`flex-wrap` on the panel head so "View All" can drop to its own line. After:
track 358px, panel 358px, **zero spills**, no sideways scroll.

This is the same shape of bug as the inline grid last round, and the reason my
earlier "zero overflow" reading missed it: the alert rows are rendered by JS at
runtime, and I had measured the static markup.

## 5. Lingualab Write header stacked (my regression)

My phone layer set `.cor-btn { width: 100% }` with no scope, which caught the
three header buttons and stacked Reset / Edit all / Print PDF into a full-width
column. The rule was meant for the Analyze row only. Now scoped to
`.cor-actions .cor-btn`, and `.cor-topactions` keeps its buttons on a wrapping
row.

After, at 390: header buttons on **one row** at 61 / 77 / 101px, none full
width; Analyze still full width at 328px; depth selector still a column; no
overflow. Desktop unchanged.

## 2. The circles crossing the boxes

`.shape` in `classroom/css/styles.css`: absolutely positioned circles at
`opacity: 0.1`, with `.shape-1` at **300 x 300px**. They live in a fixed
full-viewport layer at `z-index: 0`, behind the cards, and the cards are
translucent, so a 300px circle on a 390px screen (77% of the width) drifts
visibly across card edges and reads as a circle escaping its box.

Nothing removed, as asked: scaled to the screen below 620px and faded slightly.
Biggest shape is now **39% of the width instead of 77%**. Desktop untouched
(still 300px, 24% of a 1280px screen).

## 1. Classroom header alignment

Everything still present. The greeting is now anchored to the LEFT edge of the
second row with the controls grouped right, instead of all three bunched into
the right corner. The lockup is a little smaller on a phone, as offered.

Measured at 390: brand renders **119px wide** (not the 0px it collapsed to
before), greeting at x=12, last control ends at 374 against a 386px header, so
the row is symmetric. **Zero elements paint outside the header.**

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan on all touched files - clean
- inline-css-check, profile-hub-check, teacher-mobile-check, grammar-sanity - **all PASS**
- bump: mobile-shell.js v7, dashboard-v2.css v16, corrector.css v15,
  styles.css v43, CACHE_VERSION v324 -> **v325**
- `bump.js --check` - OK

## Note for next time

Two of the six were mine, and both came from the bottom bar changing an
assumption other modules held: placement-admin listened for a sidebar click,
and the shell's scroll container is `.t2-main` rather than the page. Worth a
sweep for anything else that assumes the sidebar is clickable or that the
window scrolls.
