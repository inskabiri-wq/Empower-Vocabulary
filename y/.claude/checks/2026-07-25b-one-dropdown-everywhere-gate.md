# 2026-07-25b — ONE dropdown everywhere + a gate that keeps it that way

## The honest starting point
User asked "are you sure the dropdown UI/UX is the same for all the app?" - it
was NOT. A fresh audit found:
  129 <select> total | 30 unified (23%) | 58 off-style | 41 game-themed.
Every previous "unify" pass had only fixed the panel the user pointed at.

## 1. y/tools/ui-sanity.js (NEW) - the enforcement
Scans every shipped .html/.js, finds every <select>, FAILS (exit 1) unless the
tag carries `ll-select` (or the original `filter-select`). `--list` prints file
+ line for each offender. Allowlist requires a written reason (classroom game
screens + the writing corrector keep their own themes). Same pattern as
grammar-sanity.js.
- Token matching, NOT substring: `activity-filter-select` contains
  "filter-select" and a substring test wrongly passed those (see bug below).

## 2. The sweep - 58 selects unified
Codemod added `ll-select` to every off-style tag, preserving existing classes:
app.html 1, role-scope 1, teacher-assignments 1, writing-submissions-view 1,
index.html 4, main.js 4, student-dashboard 7, reading-exam 2, ui.js 1,
teacher-dashboard 31, admin.js 5. Then +6 more found by the fixed gate
(3 in teacher-dashboard, 3 in activity-logs-tab.html).

## 3. The class now exists app-wide
`.ll-select` lived INSIDE teacher-dashboard.html, so the sweep would have been
cosmetic on login/student pages. Moved a canonical `select.ll-select` rule into
`y/css/brand.css` (loaded by every page): padding 10/16, radius 8, 14px,
--bg-item / --border-color / --text-primary, focus = accent, disabled = 0.55.

## 4. Two overrides that reintroduced a second look
- `.activity-filter-select` restated padding/background/radius/font AFTER
  brand.css -> stripped to layout-only (min-width, transition).
- `.filter-select` used font-size 0.9em (14.4px) -> pinned to 14px so the
  original and the shared class are pixel-identical.

## BUG I introduced and caught
The sweep's "already unified" test was a substring match, so the three
`activity-filter-select` dropdowns were skipped as if unified - and because I
had just stripped their styling, they rendered with NO styling at all
(computed 0px padding, browser default). Found by the computed-style harness,
not by the gate. Fixed by (a) adding ll-select to those tags and (b) rewriting
the gate to match whole class tokens.

## Also in this pass (from the same message)
- Activity log rows (picture 2): compact - padding 18/20 -> 10/14, icon
  48px -> 34px, inner margins tightened, radius 14 -> 10.
- Recent-activity rows (picture 1): the stray blue square was the COURSEBOOK
  emoji (📘 Empower / 📗 Gateway) rendering as tofu next to the student name.
  Removed the glyph + its now-dead lookup table.

## Verification
- ui-sanity: 129 selects, 88 unified, 41 exempt, **0 off-style - PASS**.
- Computed-style harness (real pages, all stylesheets cache-busted):
  login 4 selects / **1 look**, teacher 46 / **1 look**, student 7 / **1 look**
  - all exactly `10px 16px | 8px | 14px`. PASS.
- grammar-sanity still PASS; node --check clean; em-dash scan clean
  (normalized only comment/string dashes, none inside regex classes).
- Smoke 19/0/1 (pre-existing orphaned-submissions data issue).

## Answer to "how do I tell you to always use the same one?"
Say it once, in a place that is read every session, and let a script prove it:
  1. `node y/tools/ui-sanity.js` must PASS (this gate).
  2. Add to the end-of-change routine next to node --check + smoke.
  3. One line in the repo's CLAUDE.md: every <select> carries `ll-select`.
Step 3 is NOT done yet - say the word and I will add it.

## Versions
brand.css ?v=15 (all 6 pages), activity-tracker.css ?v=3, teacher/css/styles.css
?v=2, teacher/js/activity.js ?v=2, SW v107 -> v110.

## Ship
firebase deploy --only hosting
