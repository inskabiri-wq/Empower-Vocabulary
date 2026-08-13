# 2026-08-11b - One settings panel, skill-screen box, reading motion

Seven reported items. Diagnostics were run in a real browser against a harness
that loads `student-dashboard.html` with its scripts stripped
(`y/tools/demos/screen-diag.html`), served by the new `static-y-alt` launch
config on port 5174 (port 5173 was held by another session serving a WORKTREE
copy, which is why the first round of measurements showed stale markup).

## 1-3. The two settings panels are now one panel

The dashboard had its own `#settingsModal` with hand-written Sound / Turkish /
Dark Mode rows, and `app-settings.js` had a SECOND mount path
(`mountIntoHost`) that injected the Display controls into it. Every other page
got the `.as-panel` dialog. One control, two presentations - so they drifted.

- `mountIntoHost()` / `hostModalBody()` and the `.as-inline` CSS are **deleted**.
  There is exactly one mount path now.
- `#settingsModal` is deleted from `student-dashboard.html`. All 7 gear buttons
  carry `data-app-settings-open`, which already suppresses the floating
  launcher and wires the shared panel.
- Sound effects and Turkish hints are ordinary panel sections (`SWITCHES` in
  `app-settings.js`), rendered only where the page exposes `toggleSound()` /
  `toggleTurkish()` - the same contract the Music row uses for `toggleMusic()`.
  They call the page's function and re-read the localStorage key it writes, so
  the buttons cannot disagree with the page.
- `ui.js`: `openSettingsModal()` / `closeSettingsModal()` delegate to
  `AppSettings`; element lookups in the toggles are now optional; `toggleTheme()`
  is gone (app-settings owns all four palettes) and `loadSettings()` no longer
  re-applies the theme - it was toggling `light-mode` back OFF after
  app-settings had applied it in `<head>`.

### The panel now owns its palette

Measured drift: the SAME panel rendered `rgba(15,23,42,0.95)` on the dashboard
and `#152035` on classroom, with two different border alphas, because it read
`--bg-card` / `--border-color` from whatever the page declared. It declares its
own `--as-*` tokens now, with `body.<theme> .as-panel` overrides so theming
still works but page-to-page drift cannot.

Verified, both pages, all four themes, transitions disabled to read end state:

    panel rgb(21,32,53)   rgba(59,130,246,0.25)  16px  20px 20px 28px   (dark)
    panel rgb(255,255,255) rgba(15,23,42,0.14)   ...                     (light)
    panel rgb(251,243,223) rgba(61,46,26,0.16)   ...                     (sepia)
    panel rgb(10,10,10)    rgba(255,255,255,0.3) ...                     (contrast)

Signature strings are byte-identical between `student-dashboard` and
`classroom-bingo-student`; both panels 340px wide. Only the CONTENT differs:
dashboard shows Sound / Turkish, game pages show Music.

## 4. "Listening box still is not the same" - measured

It was real, and it was not the card. Container width, 1440x900 viewport:

| screen | before | after |
|---|---|---|
| vocabulary (`#menuScreen`) | 1385 | 1385 |
| listening | **1400** | 1385 |
| reading / grammar / writing / speaking / hub | **1400** | 1385 |

Vocabulary is tall enough to show the page scrollbar; the skill screens are
not, so the viewport - and the `.container` card with it - was 15px wider on
the short screens. Same CSS, different width. Fixed with
`html { scrollbar-gutter: stable }` in `student/css/styles.css`. All seven
screens now measure `1385 x ... @ x20`.

The earlier note that this was "an 8px scrollbar shift, not the box" was half
right: it WAS the scrollbar, but it was a real 15px difference in the rendered
box, not an artefact of how it was measured.

## 5. Vocabulary had no subtitle

`extra.css` carried `#menuScreen .header-left .subtitle { display: none }` - the
only screen with that rule. The markup was always there. Rule removed; the
subtitle reads "Vocabulary / Practice by level" like every other skill screen.

## 6. Reading 1 / 2 / 3 had no motion

`.rd-exam-card` had no hover state at all, while every other card in the app
lifts and tilts its badge (`.activity-card:hover .game-badge`). Added the same
motion at the same timing: card `translateY(-3px)` + border + shadow, icon
`scale(1.12) rotate(-4deg)`, with a `prefers-reduced-motion` opt-out.

## 7. Certificate back button

Already deleted from `policy-course.html` in the working tree but never
deployed, which is why it is still visible live. The dead `pcCertBack` listener
in `policy-course.js` is now removed too, so it cannot come back. The
certificate screen has Print only; the header Dashboard button is the way out.
The remaining "Back to course" buttons are on the quiz RESULT cards, where they
belong.

## Gates

- `node --check` across all `y/**/*.js`: pass (the only failure is
  `y/node_modules/node-domexception/.history/...`, a dependency's history file)
- `theme-sanity.js` PASS, `ui-sanity.js` PASS, `grammar-sanity.js` PASS
- em-dash scan: 0 in added lines (pre-existing ones in `extra.css` /
  `styles.css` / `student-dashboard.html` left alone)
- `bump.js`: app-settings.css v35, app-settings.js v19, extra.css v5,
  styles.css v5, reading-exam.css v4, policy-course.js v13; service worker
  v181 -> v183
- `bump.js --check`: the only remaining "drift" is `skills.css v=3,4`, a tool
  false positive - `student/css/skills.css` and `teacher/css/skills.css` are
  different files that share a basename. Fixed a REAL one on the way:
  `placement.html` was pinned to `reading-exam.js?v=3` / `listening-exam.js?v=2`
  while the dashboard was on v4 / v5.

## Not fixed

- `smoke-test.js` reports one failure: **5 of 5 sampled writing submissions
  reference assignments that no longer exist**. Firestore data, unrelated to
  this change.
- A CSS transition cannot be verified in the preview pane: it reports
  `visibilityState: hidden` and 0 rAF callbacks, so no frame ever composites
  and no transition advances. Read end states with `transition: none` forced.
  (A first pass here misread that as a Chrome custom-property bug and stripped
  the transitions from `.as-row button` and `.ll-navbtn`; both were restored.)
