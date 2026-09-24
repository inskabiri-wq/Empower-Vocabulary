# 2026-08-18 - White + blue repaint, step 1 (student area)

Goal: "simple color for all the app white and blue that is all", done step by
step. Step 1 is the student area only. Teacher dashboard and classroom games
are steps 2 and 3 and are NOT done yet.

## Decisions
- One blue family replaces four accent colours (blue kept, teal / orange /
  amber retired). Green, red and amber-warning STAY: they mean right, wrong and
  careful. Removing them would make the app harder to use, not simpler.
- Light is now the DEFAULT theme. Dark is still selectable and an existing
  explicit dark choice is honoured (see `read()` in js/app-settings.js).
- Fonts NOT touched. The user asked for colour only.

## What changed
- 447 hardcoded colour values swept to a blue ladder across 15 stylesheets.
- 322 surface/text colours tokenised (`var(--token, original)`).
- Light palette retuned; `css/app-settings.css` is the AUTHORITATIVE block
  (it loads last and was overriding `student/css/styles.css`).
- New tokens `--text-accent / -success / -error / -warning`: the state colours
  need a different lightness as TEXT than as a fill.
- 8 per-skill tile accents in `student/js/hub.js` repainted to a blue ladder;
  new `--skill-ink` so small labels stay readable while the ring keeps identity.
- `assignments.css` crystal card: full light override generated (25 rules); it
  was hand-painted in dark oklch and had no light equivalent at all.
- `color-scheme` moved from a global `:root { dark }` to per-theme.

## Bugs found and fixed on the way
1. `js/app-settings.js` painted the gear button inline with `!important` and
   HARDCODED colours, so no stylesheet could theme it. Now inline `var()`,
   which keeps the cross-page guarantee and follows the theme.
2. `tools/tokenise-colors.js` was NOT idempotent: its own fallback matched on
   the next run, giving `var(--x, var(--x, #hex))`. 18 files had already
   nested. Added `replaceOutsideVar()` + `collapseNested()` and repaired them.
3. Same tool matched by VALUE ignoring the PROPERTY, so a text colour could be
   rewritten to a surface token. Added a property-scoped `TEXT_MAP`.
4. Theme preview swatches had been tokenised, so the "light" swatch drew
   near-white on near-white. Restored literals + a `PREVIEW_SELECTOR` guard.
5. The theme class only reached `<body>`, which flashed dark on every load once
   light became the default. Now set on `<html>` first; the 6 `body.`-qualified
   rules were relaxed to bare class selectors.
6. Semantic colours caught by the sweep (timer warning, `.pc-warn`,
   `--rd-warning`, `--wr-warning`) restored to amber.

## Verification
- `node --check` on all 5 JS files touched: pass.
- `node tools/theme-sanity.js`: PASS, 11 tokens x 4 themes.
- `node tools/bump.js --check`: no drift. Service worker v209.
- `node tools/tokenise-colors.js`: 0 changes on a second run (idempotent).
- Contrast audit (WCAG AA, emoji and gradient-clipped text excluded):
  hub light 11 failures -> 0; reading screen -> 0.
  Dark re-checked on a real reload: container correctly rgba(15,23,42,0.95),
  1 marginal pre-existing label (`.hub-section-lbl`, 3.77).

## Not done / flagged
- Teacher dashboard (own `--t2-*` palette) and classroom games: steps 2 and 3.
- 999 em dashes across 84 files, ~430 in USER-VISIBLE strings (comment bank,
  "- Select a class -" placeholders). Out of scope for a colour change; needs
  its own pass because it edits UI text.
- The dashboard loads THREE fonts: body Segoe UI, `#menuScreen` Nunito,
  assignments card Outfit. Reported, not changed.
- Nothing deployed. All on disk.
