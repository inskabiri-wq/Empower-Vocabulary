# 2026-08-11 - Theme recolours everything; one identical panel

Two complaints, both correct:
1. Changing the colour only recoloured the buttons. The rest of placement,
   courses and the games stayed dark.
2. The wheel's panel had different contents on different pages.

## Why theme only reached the buttons

Three separate causes, all of them real:

**a. Hardcoded surfaces.** 240 background / text / border declarations across
19 stylesheets were literal hex values. A token override on `<body>` cannot
reach a literal `#152035`. Tokenised to `var(--token, <original>)` by
`y/tools/tokenise-colors.js` - the original stays as the fallback, so nothing
moves until a theme actually overrides the token.

**b. Translucent surfaces.** 212 more were `rgba(...)` tints of those same
colours - `rgba(21,32,53,0.9)` for a course row, `rgba(255,255,255,0.06)` for a
card wash. Those cannot read a hex token either, and they were the reason a
page looked half-converted: the solid parts changed and the translucent parts
did not. They now read `rgba(var(--bg-card-rgb), 0.9)` against new channel
tokens.

  `rgba(255,255,255, a)` with **a > 0.2** was deliberately left alone (45
  cases). Above that alpha it is white TEXT or a glow on a coloured button, not
  a surface tint; flipping it would have put dark text on a dark button.

**c. Tokens that were never defined.** `--bg-item` was referenced in 86 places
and defined nowhere, so every one of them silently fell through to its
hardcoded fallback and no theme could touch it. Same for `--bg-tertiary` and
`--bg-hover`. Now defined in `index/css/variables.css`.

And `light` was only offered where the app's hand-written `.light-mode` rules
existed (essentially the student dashboard), so it was a complete token set on
one page and absent on the rest. It is now a full token set like the other
three and works everywhere.

## Verified on the served files

Real stylesheets loaded from the server (variables, brand, classroom, heist,
policy-course, hub, assignments, app-settings), transitions disabled before
reading computed styles, nine surfaces measured across all four themes:

| surface | dark | light | sepia | contrast |
|---|---|---|---|---|
| page background | 15,23,41 | 255,255,255 | 239,228,200 | 10,10,10 |
| header | 15,23,41 | 255,255,255 | 239,228,200 | 10,10,10 |
| card | 21,32,53 | 255,255,255 | 251,243,223 | 10,10,10 |
| course row (translucent) | 21,32,53/.9 | 255,255,255/.9 | 251,243,223/.9 | 10,10,10/.9 |
| courses header (translucent) | 13,20,38/.85 | 255,255,255/.85 | 239,228,200/.85 | 10,10,10/.85 |
| body text | white | 15,23,42 | 61,46,26 | white |
| chip text | 161,161,170 | 71,85,105 | 107,86,61 | 209,213,219 |
| nav button | 28,42,66 | 241,245,249 | 239,228,200 | 24,24,24 |

```
FROZEN_PROPERTIES: []
EVERY_SURFACE_FOLLOWS_THEME: true
```

Note for next time: `background` and `border-color` first measured as frozen.
That was the Browser-pane transition artefact again, not a bug - the pane does
not composite, so a transitioned property reads its START value. Those are
exactly the two properties `.ll-navbtn` transitions. Always kill transitions
before reading computed styles.

## The panel is now the same everywhere

- Theme row: all four buttons, always (was 3 or 4 depending on page).
- Font row: always present, and now applies to the whole page rather than only
  the writing editor (which is why it used to appear on one page only). Gated
  on `data-app-font`, so the default sets nothing and every page keeps the font
  it ships with until the user picks one.
- Text size, line spacing, preview, reset: unchanged, always present.
- **Music is the only page-specific section**, on the game pages, exactly as
  asked: play/pause, next track, volume. It drives the page's own `#musicBtn`
  rather than a second audio system.

## Gate

`y/tools/theme-sanity.js` (new) fails if any theme omits any of the 17 tokens,
and warns on surface colours that go back to being hardcoded. A partial theme
is what "it only changed the buttons" actually looks like, so it is now a
build error rather than something to notice in a screenshot.

## Cache busting

127 stylesheet links across 36 HTML files were bumped, and every link that had
no `?v=` at all now has one - 0 unversioned CSS links remain. Without this the
deploy would have looked like nothing changed again, since most of these
stylesheets had never been versioned.

Service worker `v139`.

## Gates

- `node --check y/js/app-settings.js` - PASS
- `node y/tools/theme-sanity.js` - PASS (all 4 themes complete, 0 strays)
- `node y/tools/ui-sanity.js` - PASS
- `node y/tools/grammar-sanity.js` - PASS
- em-dash scan on changed files - 0
- dead `supportsLight()` removed

## Deploy owed

```
firebase deploy --only hosting
```
