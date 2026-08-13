# 2026-07-27f - App-wide display settings (text size + line spacing)

Lifting the writing exam's size/spacing controls out into ONE shared panel on
every page. Colour themes are deliberately NOT part of this - see the measured
reason below.

## Why colour was split off (measured, not guessed)
The writing exam has themes because it was built with a COMPLETE token set.
The rest of the app was not:

| stylesheet | var() | hardcoded colours |
|---|---|---|
| student/css/extra.css | 174 | 774 |
| student/css/grammar.css | 115 | 196 |
| student/css/styles.css | 128 | 186 |
| assignments/css/assignments.css | 64 | 151 |
| teacher/css/dashboard-v2.css | 103 | 118 |
| student/css/policy-course.css | 0 | 102 |

App-wide: ~1850 tokenised vs ~2570 hardcoded, PLUS 343 inline
`style="color:..."` attributes in the HTML that ignore CSS variables entirely.
Swapping `:root` to a light palette repaints only about 40% of the app, so a
light theme would produce dark cards on light pages and white-on-white text.
User decision: ship size now, tokenise colour as a staged, gated refactor.

## Why scaling is safe here (the key measurement)
- NO stylesheet sets a font-size on `html` or `body` - the inherit chain is clean.
- ZERO padding / margin / gap / width / height anywhere uses `rem`; they are all
  px (695 padding, 611 margin, 489 gap).

So scaling the root font-size grows TEXT ONLY and leaves every layout box
exactly where it is. Confirmed in browser: card width stayed 420px and card
padding stayed `40px 32px` at every scale from 0.9 to 1.3.

## Files
1. `y/css/app-settings.css` (NEW) - `html { font-size: calc(100% * var(--app-scale,1)) }`
   plus the launcher / overlay / panel. Uses `calc` on a PERCENTAGE so the
   browser's own default (and any OS accessibility font size) stays the base
   instead of being overwritten with a hard 16px.
   Line spacing is attribute-gated (`html[data-app-line]`), so "no choice made"
   changes nothing at all.
2. `y/js/app-settings.js` (NEW) - shared controller, same folder as the other
   shared components (app-dialog.js, widgets-tray.js). Applies the saved scale
   immediately at parse time (it only touches documentElement, so it is safe in
   `<head>`) and mounts the UI on DOMContentLoaded. Storage:
   `localStorage['ll-display']`. Nothing hits Firestore, so it costs nothing.
3. **199 `font-size: Npx` converted to rem** across 15 stylesheets (16px = 1rem,
   so rendering at scale 1 is unchanged). Spacing was deliberately NOT touched.
4. Mounted on **29 pages** via `<head>` (before first paint, so a student who
   chose A++ never sees the page render small then jump).
   - `writing-exam.html` opted out with `data-app-settings="off"` - it already
     owns this panel, two gear buttons would be silly.
   - `activity-logs-tab.html` skipped: it is a fragment with no `<head>`.
5. SW v116 -> v117.

## Verified in a real browser
- Default is a NO-OP: `--app-scale` = 1 = 100%, no `data-app-line`.
- Scale 0.9 / 1 / 1.15 / 1.3 -> root font 14.4 / 16 / 18.4 / 20.8px; heading
  20.16 / 22.4 / 25.76 / 29.12px (em chain follows correctly).
- Layout unmoved at every scale: card width 420px, card padding `40px 32px`,
  input padding unchanged.
- Phone (375px): NO horizontal scroll at ANY scale (scrollWidth == clientWidth
  == 375 at 1, 1.15 and 1.3). Launcher stays fully on screen.
- Launcher is bottom-RIGHT; the teacher dashboard's widgets tray owns
  bottom-LEFT, so they never collide.
- Panel: opens, closes on X / overlay / Escape, preference persists.
- ui-sanity PASS, grammar-sanity PASS, node --check OK, em-dash in added
  lines 0.

## CORRECTION to the first version of this log - the gap was smaller
The first draft claimed form controls broadly do not scale, citing
`button.tab` sitting at 13.6px while its ancestors grew. **That reading was
wrong**: `.tab` carries `transition: all 0.3s`, and the Browser pane was not
compositing frames, which freezes a CSS transition at its start value forever.
Disabling the transition and re-reading gave **13.6px -> 17.68px**, exactly
0.85rem of the scaled root. Controls that HAVE a font-size rule were always
fine. (Same measurement trap as the corrector checkbox in 2026-07-27c - worth
remembering: in this pane, always kill transitions before reading a computed
style.)

The REAL gap was narrow and is now closed: controls that NO stylesheet gives a
font-size to sit at the browser's own 13.3333px and never scale. Verified with
a bare injected `<button>`, which has no transition, so that reading was sound.

## The fix (app-settings.css)
```css
:where(button, input, select, textarea, optgroup) { font-size: 0.8333rem; }
```
0.8333rem x 16px = 13.3333px, i.e. the browser default restated in rem: at the
default setting nothing moves, and now it scales. `:where()` contributes ZERO
specificity, so literally any other rule - even a bare `button {}` in another
stylesheet - still wins. It can only fill a gap, never override a decision.

Measured: bare button/input/select/textarea 13.3328px at scale 1 (sub-pixel
identical to the 13.3333px default) and 17.3326px at 1.3, while
`.tab` and `.form-input` kept their own 13.6px and scaled to 17.68px.

## Cache correctness (found while verifying)
The px -> rem conversion rewrote 15 stylesheets, but most were linked with no
`?v=` at all (or a stale one), so a returning student would have kept the OLD
file from HTTP cache and the setting would silently do nothing on those
surfaces. This was not theory: `.ll-select` measured a flat 14px until the
cache was busted, even though brand.css on disk already said `0.875rem`.
All 15 now carry a fresh version across 28 pages (brand v16, extra v2,
dashboard-v2 v2, assignments v3, hub v15, reading-exam v2, ...).
SW v117 -> v118.

## Dashboard verification (the auth-gated surfaces)
Harness loading the REAL dashboard stylesheets in their real order
(variables, brand, student styles/hub/skills/extra, assignments, teacher
styles/dashboard-v2, app-settings) with representative markup:

| element | scale 1 | scale 1.3 |
|---|---|---|
| h1 / h2 / p | 32 / 24 / 16px | 41.6 / 31.2 / 20.8px |
| .hub-name, .hub-pct | 13.33px | 17.33px |
| .filter-select, .ll-select | 14px | 18.2px |
| .form-input, textarea | 13.33px | 17.33px |
| .assignment-btn | 13.6px | 17.68px |
| .create-assignment-btn | 15.2px | 19.76px |
| bare button (no rule) | 13.33px | 17.33px |

`notScaling: []` - nothing left behind. No horizontal scroll at 375px at
either scale. Every scale-1 value is identical to the pre-change reading.

## Round 2 - into the EXISTING gear, plus colour

### The icon
The student dashboard already had a top-right wheel opening `#settingsModal`
(Sound Effects / Turkish Hints / Dark Mode). Adding a second floating gear was
wrong. `mount()` now looks for `#settingsModal .settings-modal-content`:
- **found** -> the Display controls are injected INTO that modal as an extra
  group under a divider, and NO floating launcher is created.
- **not found** (login, courses, classroom, placement, writing lab, teacher
  dashboard - which has no gear of its own) -> the floating launcher is used,
  so the setting stays reachable everywhere.

### Colour, without inventing a second mechanism
The app ALREADY has a light theme: 144 `.light-mode` rules (136 in
student/css/extra.css, 8 in student/css/styles.css), toggled by ui.js
`toggleTheme()` via `body.light-mode` + `localStorage['theme']`.
The new Theme row drives THAT SAME class and THAT SAME key rather than a
parallel one, so the gear's original Dark Mode row and the new buttons can
never disagree. `syncLegacyThemeRow()` keeps the old row's icon/label/active
pill truthful when the change comes from our buttons, and a listener on
`#themeToggle` syncs our buttons when the change comes from the old row.

### The safety gate on colour (important)
That light theme covers the STUDENT DASHBOARD ONLY. A Light button on the
teacher dashboard or the classroom pages would just produce an unreadable
page. So `supportsLight()` scans the page's loaded stylesheets for any
`.light-mode` selector and the Theme row is rendered ONLY when light CSS is
actually present. Colour appears where it works and is absent where it would
break - and as more areas get tokenised the row starts appearing there by
itself, with no code change.

### Verified (real browser, real code)
With a page that HAS a gear:
- `floatingLauncherCreated: false`, `injectedIntoExistingModal: true`,
  `injectedInsideHost: true`, rows `[theme, scale, line]`.
- Our Light button -> `body.light-mode` true, old row reads "Light Mode" with
  the sun icon, `localStorage.theme === 'light'`.
- The ORIGINAL row clicked -> body class flips AND our buttons follow:
  dark -> light -> dark, **in sync both directions**.
- Text size still drives from inside the modal: root 16px -> 20.8px -> 16px.

With a page that has NO gear (login):
- `launcherCreated: true`, `inlineCreated: false`, theme row present (that page
  loads extra.css, so light IS supported there).
- Console: zero errors.

Gates: node --check OK, ui-sanity PASS, grammar-sanity PASS, em-dash 0.
Versions: app-settings.css ?v=3, app-settings.js ?v=3, SW v120.

## Still open on colour
Light mode beyond the student dashboard is the staged tokenisation job
(~2570 hardcoded colours + 343 inline style attributes). Until that lands, the
Theme row simply will not appear on those pages - by design, not by omission.

## Ship
```
firebase deploy --only hosting
```
Hosting only. No rules or functions change in this batch.
