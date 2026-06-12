# Laggy accordions on phone · 2026-06-04

## Symptom
User: "the accordion on phone so laggy."

## Cause
All the exam / assignment accordions animate `max-height` (0 <-> 4000px /
2000px / 1200px) over 0.3-0.5s. `max-height` is a layout property, so it
reflows every frame; and these bodies sit inside `backdrop-filter: blur(...)`
cards, so the blur re-renders over the moving area each frame. On a phone GPU
that combination drops frames = visible lag. Several also run a per-child
opacity+transform stagger on open, multiplying the work.

## Fix (one rule, brand.css, applies app-wide)
brand.css is loaded on all 16 pages, so a single `@media (max-width: 768px)`
rule covers every accordion:
- Height change made ~instant (`max-height 1ms`) so there is no per-frame
  reflow/blur churn; a soft `padding`/`opacity` 0.16s fade keeps it from feeling
  abrupt.
- Per-child stagger disabled on phones (`> * { transition:none; opacity:1;
  transform:none }`).
- `!important` is needed to beat the more-specific per-file `.is-collapsed`
  transitions. Desktop (>768px) keeps the full animation unchanged.

Selectors covered: `.rd-section-body`, `.rd-q-body` (solo reading);
`.exam-section-body`, `.exam-item-body`, `.exam-q-body` (solo listening +
classroom reading/listening); `.asg-acc-detail` (assignment cards).

## Cache
- brand.css is an SW-cached asset. Bumped CACHE_VERSION already at v13, AND
  cache-busted `css/brand.css?v=13` on student-dashboard.html (the page being
  tested on phone) so the fix loads on the first open there, not after the SW's
  2-load lag. Other pages pick it up via the v13 SW on reopen.

## Verify
- brand.css braces 11/11 BALANCED; rule present (`max-width:768px` + `.asg-acc-detail`).
- Desktop animation untouched (rule is inside the <=768px media query).

## Deploy
- `firebase deploy --only hosting`, reopen the app. Accordions should snap open/
  closed instantly on phones with no jank.

## Follow-up - residual lag was backdrop-filter blur
After the height-snap fix the user said "much better but still laggy a bit".
Remaining cost = `backdrop-filter: blur`, which re-renders on every scroll frame.
Worst offender: a `position: sticky` exam toolbar (`extra.css`) with `blur(10px)`
that re-blurs continuously while scrolling; also `.container` `blur(20px)`.
Checked backgrounds: `--bg-card` = rgba(15,23,42,0.95), sticky = 0.85, modal =
0.72 - all near-opaque, so the blur is decorative and safe to drop.
- Added to the same `@media (max-width: 768px)` block in brand.css:
  `* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }`
  Desktop keeps the frosted glass; phones lose only a barely-visible blur and gain
  smooth scrolling.
- Re-bumped cache so it actually loads: `brand.css?v=13` -> `?v=14` on
  student-dashboard.html, CACHE_VERSION v13 -> v14.
- Verified: brand.css braces 12/12 BALANCED; rule present.

## If it's a DIFFERENT accordion (e.g. teacher-dashboard sections)
Those use different class names not in the list above. Tell me which screen and
I will add its selectors to the same rule.
