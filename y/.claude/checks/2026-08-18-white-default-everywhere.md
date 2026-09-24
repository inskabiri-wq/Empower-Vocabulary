# 2026-08-18 - "Why is the teacher dash unchanged?" + white default everywhere

Two reports: the teacher dashboard only turned white after visiting the student
dashboard and coming back, and many boxes were still dark blue.

## 1. Why it needed a round trip - stale stored theme
The OLD app's dark-mode toggle wrote `localStorage['theme'] = 'dark'`, so nearly
every existing account had 'dark' stored. My change deliberately honours an
explicit choice, so the teacher dashboard obeyed it and opened dark. The student
dashboard happens to rewrite that key, which is why a round trip "fixed" it.

That stored value was a preference about an app that looked completely
different, so it is now cleared ONCE, guarded by `ll-theme-epoch`. Anyone who
picks dark after the repaint keeps it; the reset cannot run twice.

## 2. The dark boxes - a blind spot in every tool I built
The Admin tab declares its own palette INSIDE a <style> block in
teacher-dashboard.html:

    #tab-admin { --t2-bg: #0a0f1a; --t2-surface: #152035; ... }

Two things made this invisible:
- It is an ID selector (specificity 100), so it outranked the `.light-mode`
  override in teacher/css/dashboard-v2.css (10). Even once the stylesheet was
  repainted, the Admin tab kept its dark values.
- It lives in HTML, and every tool written for this repaint - the colour sweep,
  tokenise-colors, theme-sanity - walks `*.css` only. None of them ever read it.

teacher-dashboard.html alone holds 1,151 lines of CSS and 27 design tokens.
Added `.light-mode #tab-admin` (110, so it wins), which fixes the Teachers list,
Demo accounts, Organization and Content panels together, since `--av-*` are
aliases of `--t2-*`.

## 3. The same blind spot on seven other pages
Pages that declare a dark palette in inline CSS and had NO light rules:
app.html, join.html, reset-password.html, teacher-onboarding.html,
placement.html, courses.html, classroom-teacher.html, 404.html.
All given light overrides appended to their own <style> block, so they win on
document order.

## 4. New permanent check
`node y/tools/inline-css-check.js` - reports any HTML page whose inline CSS
declares a dark palette, paints dark surfaces or sets near-white text without
light-mode rules, and exits non-zero. fsmvu-loaders.html is exempt with a
reason: it is a design reference sheet for the white seal on dark.
Currently PASS.

## Is white the default everywhere? Yes.
Checked every HTML entry point for the theme controller:
- 26 pages load js/app-settings.js.
- writing-exam.html does not, but runs its own `data-theme` system and is now
  `<body data-theme="light">`.
- activity-logs-tab.html is a FRAGMENT pasted into the dashboard, not a page.
- reading exam: light is the CSS base, not just the JS default.

## Verification
- Admin tab harness (`y/tools/demos/admin-tab-palette.html`) fetches the REAL
  <style> blocks out of teacher-dashboard.html and injects them, so the cascade
  under test is the real one. Light: --t2-bg #f6f8fb. Dark: #0a0f1a. Contrast
  audit on #tab-admin: CLEAN in both themes.
- Fixed both harnesses: they set the theme BEFORE app-settings.js loads, or the
  new one-time reset stamps light over the requested theme and the dark test is
  silently meaningless. The first dark run was invalid for exactly that reason.
- `--t2-text-dim` fixed in BOTH inline blocks: light 4.39 -> pass, dark 3.02 ->
  pass (10px .av-table headers).
- node --check all JS: passes. theme-sanity PASS. tokenise-colors idempotent.
  inline-css-check PASS. bump --check no drift. Service worker v235.

## Still open
- Tiles 3-per-row with animation; assignments full-width below the tiles.
- Nothing deployed.
