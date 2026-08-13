# 2026-08-12f - Keyboard hints removed from vocabulary

The strip under the vocabulary activity grid - `1-4 select option` /
`Enter next` / `Esc back to menu` - is gone.

## What was removed

- **Markup**: the `.keyboard-hints` block in `student-dashboard.html`. It was
  the ONLY use of that class anywhere in `y/`, so every rule below was dead the
  moment it went.
- **CSS**, now unreachable:
  - `student/css/styles.css` - `.keyboard-hints`, `.keyboard-hints span`,
    `.keyboard-hints kbd`
  - `student/css/extra.css` - `.light-mode .keyboard-hints`,
    `.light-mode .keyboard-hints span`, the `#menuScreen` block
    (`.keyboard-hints`, ` span`, ` kbd`), the `flex-wrap` mobile tweak, the
    `margin-bottom: 0` rule, the `order: 8` entry in the mobile stack, and
    `.keyboard-hints` from the shared `margin-bottom: 16px` group

`.light-mode kbd` was KEPT: `<kbd>` is still used by the listening exam's
shortcut legend (`listening-exam.js`), so that rule is live.

The shortcuts themselves are untouched - only the on-screen legend went.

## Verified

- `.keyboard-hints` elements in the DOM: **0**; no `<kbd>` left on `#menuScreen`;
  the strings "select option" / "back to menu" no longer appear on the screen
- main column is now exactly: welcome, XP, stats, section title, activity grid
- both stylesheets still parse: extra.css 718 rules / styles.css 200 rules,
  **0 malformed selectors**, braces balanced (861/861 and 232/232), and
  0 remaining `keyboard-hints` occurrences
- mobile stack unchanged and still identical to grammar's:
  welcome -> xp -> stats -> select content -> section title -> games -> map button

### Measurement note

A first pass appeared to show vocabulary's map button jumping to the top of the
mobile stack. That was my test, not the page: it sorted elements by
`getBoundingClientRect().y + scrollY` immediately after switching screens, while
the page was still scrolled from the previous measurement. Reading the computed
`order` property - and walking `.dashboard-body`'s real children - showed the
true layout (welcome 312, xp 453, stats 575, select content 670, section title
930, games 991, map button 1535). **Sort by computed `order`, not by y, when
checking flex sequence.**

## Gates

- `theme-sanity.js` PASS, `ui-sanity.js` PASS, `grammar-sanity.js` PASS,
  `bump.js --check` OK
- styles.css v7, extra.css v8; service worker v195
