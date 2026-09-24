# 2026-08-18 - White + blue repaint, step 2 (teacher dashboard + login)

Step 1 covered the student area. This step covers the teacher dashboard and,
because it turned out to be the biggest remaining dark surface, the LOGIN page.
Classroom games are still step 3.

## Teacher dashboard
- `--t2-*` was a complete GitHub-dark set on `:root` with NO light counterpart.
  Added a full `.light-mode` block (same specificity, later in the file so it
  wins). Restated in full on purpose: a partial override would leave
  `--t2-text` white on a white page.
- Retired cyan / purple / orange / sky / indigo / rose to one blue ladder.
  Kept green, red and amber: on this dashboard they mean passed, failed and
  needs-attention, which is the whole point of the Overview tab.
- Darkened light `--t2-text-dim` (#94a3b8 -> #667487). It is used at 9px for the
  sidebar section labels and only made 2.56:1 on white.

## Charts: categories vs states
The popularity chart borrowed `--t2-green`, `--t2-red` and `--t2-amber` as
CATEGORY colours, so "Word Order" drew in the same green as a pass and
"Unscramble" in the same red as a failure. Categories now own scales that carry
no status meaning:
- `POP_SCALE`   - 13 blues for the activity-popularity bars.
- `CARD_ACCENTS`- 4 blues for the stat cards (was cyan/purple/amber/green).
- `LEVEL_COLORS`- light-to-dark ramp, since CEFR level is ORDINAL.
  Also fixed: `C1` was in `LEVELS_ORDER` but missing from `LEVEL_COLORS`, so a
  C1 bar drew with no colour at all.
The matching `.t2-stat-card.amber/.green` CSS rules were repointed too, or CSS
would have kept overriding the JS.

## Login page (index.html)
It never loaded `js/app-settings.js`, so it never got the theme class and stayed
dark - the first screen every user sees, and the only one still black.
- Loads the controller with `data-app-settings="off"`: theme applied, no
  settings wheel on the login screen.
- Full `.light-mode` block in `index/css/styles.css` (the page owns its palette).
- `--bg-secondary` / `--bg-deep` were USED but never DECLARED, so the Terms
  modal fell back to a hardcoded `#0f1729` and rendered dark text on a dark
  card. Declared for both themes.
- Tokenised 6 inline-styled colour groups in the HTML.
- Light overrides for dark-theme idioms: black drop shadow, white inset
  highlight, translucent-white input fills (invisible on white).

## The launch splash was an EMPTY WHITE SCREEN
`.fsmvu-loader--white` renders the seal via `brightness(0) invert(1)` - a
silhouette trick. On the white page that is a white mark on white paper, so the
splash showed nothing at all. Light mode now drops the invert (black
silhouette); dark exam pages keep the white one.
`manifest.json` background_color/theme_color moved to #f6f8fb so the OS splash
hands off to the web splash without a dark-to-light flash.
The crimson seal itself (#ee3342) is UNTOUCHED - it is the university's brand
mark, not app decoration.

## theme-color
Was pinned to #0f172a on all 4 shells, so phone browsers tinted the address bar
black above a white app. `applyTheme()` now sets it per theme (it is our
localStorage theme, not the OS's, so a prefers-color-scheme media attribute
cannot track it).

## Verification
- `node --check`: every JS file in the repo parses.
- `manifest.json` parses.
- `theme-sanity`: PASS. `tokenise-colors`: 0 changes (idempotent).
- `bump --check`: no drift. Service worker v218.
- Contrast audit, corrected to start at the ELEMENT (the earlier version started
  at the parent, which reported white-on-white for every filled button):
  login + Terms modal 0 failures, hub 0, teacher palette 0.
- Teacher dashboard is auth-gated and bounces to login, so it was verified via
  a new harness, `y/tools/demos/teacher-palette.html`, which loads the REAL
  stylesheets in the real order and cache-busts itself on every load.

## Not done
- Classroom games (step 3).
- `index/css/base.css`, `components.css`, `modal.css`, `responsive.css` are
  referenced by NO html file. Dead, left in place.
- Em dashes: 999 across 84 files, ~430 in user-visible strings. Still its own
  job. Only files touched here were hyphenated.
- Nothing deployed.
