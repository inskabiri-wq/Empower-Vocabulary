# 2026-08-19 - fonts, app icons, two ring treatments

Closes the last three items of "Two ring treatments, App icons, and the three
fonts on the dashboard". (The fourth, tiles refreshing twice, was fixed and
verified earlier the same day - see 2026-08-19-toggle-diagnostic.md.)

## 1. Fonts

### A correction to the previous pass
The earlier sweep reported the app as unified onto `--ll-font` / `--ll-mono`.
That was measured with a hand-written list of stacks, so anything not on the
list survived without being counted. A tree-derived inventory
(`scratchpad/font-inventory.js`, which builds its list FROM the files) found
**26 distinct literal stacks still in place**, including DM Sans in four
spellings, Poppins, Inter, Outfit, Space Grotesk, Space Mono and SF Mono.

Worse, the trim pass had already removed those faces' `<link>` tags, so the CSS
was naming families the page no longer downloaded.

### What was done
- 50 further declarations rewritten to `var(--ll-font)` / `var(--ll-mono)`,
  matching on the stack's FIRST family rather than on an exact string.
- Remaining literals are all deliberate: `inherit` (200, not a typeface),
  Georgia / Iowan Old Style (the writing-exam and corrector serif reading
  option), Great Vibes (certificate signature), the bare `sans-serif` in the
  "Teachers only." bail-out, and the token definitions themselves.

### The actual second typeface
Counting stacks was not the whole story. **Form controls do not inherit
`font-family`** - browsers give them their own default, Arial on Windows Chrome.
Every unstyled `<button>` and `<input>` was rendering in Arial next to Segoe
body text. One rule now fixes it:

    button, input, select, textarea, optgroup { font-family: inherit; }

`font-family` only, not `font: inherit` - control `font-size` defaults to
13.33px, so the shorthand version moves layout.

### Token reach
No single stylesheet loads on every page. brand.css misses 404, join,
teacher-onboarding, fsmvu-loaders and lingualab-write; app-settings.css misses
index (login) and writing-exam. The tokens and the form-control rule are now in
BOTH, which together cover all 30 real pages. (An earlier count of "31 pages
load app-settings.css" was wrong: the grep also matched `js/app-settings.js`.)
The stale "brand.css is the one stylesheet EVERY page loads" comment was
corrected in place.

### Webfonts
- 34 dead requests removed (Nunito / Outfit / Poppins / Space Grotesk / DM Sans).
- The 9 surviving links still asked for Poppins and Outfit alongside JetBrains
  Mono. All webfont links are now one canonical URL:
  `css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap`
- 11 pages used `var(--ll-mono)` with no link at all, so the same token rendered
  JetBrains on some screens and Consolas on others. Those pages now have it:
  **20 pages use mono, 20 have the link, 0 have it without using it.**

**Verified in-browser:** login page renders 244 elements in a single font
family, and all 20 form controls now match the body text.

## 2. App icons

`favicon.ico`, `apple-touch-icon.png` and both `android-chrome-*.png` were still
the old FSM artwork from December. Rasterised from `lingualab-mark.svg` on a
canvas: white rounded ground (iOS ignores alpha and composites on black, and a
transparent navy mark disappears on a dark tab strip), 12% inset.

favicon.ico is packed by hand - ICONDIR + one ICONDIRENTRY per size at
16/32/48, then PNG bytes. PNG-inside-ICO is the Vista+ form and every browser
this app targets reads it.

    favicon.ico                 15406 ->  1993 bytes
    apple-touch-icon.png        36142 ->  3744 bytes
    android-chrome-192x192.png  40457 ->  4111 bytes
    android-chrome-512x512.png 184297 -> 16607 bytes

**Verified:** each file decodes at the right size with white ground
(255,255,255), navy neck (30,58,138) and crimson liquid (238,51,66).

Two things worth recording:
- Piping the PNGs back as base64 through the transcript silently truncated
  apple-touch-icon to 1791 bytes. The bytes now go over a one-shot local POST
  sink instead (`scratchpad/catch-icons.js`), which removes the transcription
  step entirely.
- My first pixel probe sampled at fixed fractions of the whole canvas rather
  than mapping into the 12% inset box, so two good icons read as transparent.
  The probe was wrong, not the files.

Icon links are now on every real page: 27 added, including the SVG favicon and
apple-touch-icon on `lingualab-write/index.html`, which had neither.

**FSM artwork remaining is deliberate:** `fsm-logo.png` and `fsmvu-seal.png` on
the certificate (policy-course.html) and as the tenant marks in js/tenant.js. A
certificate carries the university's marks, not the app's logo.

## 3. The two ring treatments

O Tick Dial and Q Circling Word were the two v4 treatments that could not be
done with pseudo-elements. Both are now built by `js/fsmvu-loader.js`:

- **`markup('dial')`** - 12 ticks sweeping round a still mark. Each tick carries
  its index as an inline `--i`, so ONE rule places all twelve and ONE staggers
  them, instead of 24 `:nth-child()` rules that have to stay in step with the JS
  loop. Verified: 12 ticks, tick 0 at top (75,5), tick 3 at right (137,75) - a
  clean quarter turn.
- **`markup('orbit')`** - the wordmark on a circular `textPath`. The `<path>`
  needs an id, and two loaders on a page would share it - the same collision
  that put the wrong clip on the header mark earlier - so the id is stamped per
  call. Verified: two instances on one page got `fsmvuOrbit1` / `fsmvuOrbit2`,
  each textPath pointing at its own.

`textLength="390"` pins the run to the full circumference (2·pi·62, matching the
r=62 arc). Without it the text ended at 301 of 390 units and the ring turned
with a bald patch. Verified seamless: first glyph starts at (76,14), last glyph
ends at (77,14) - a 1.4-unit gap.

Reduced motion: the dial's ticks rest at 0.16 opacity and are only bright
mid-keyframe, so `animation:none` would leave a dial that looks switched off.
Paired with an opacity override, same as the draw variant.

Both added to `fsmvu-loaders.html` (now 8 cards), rendered from the real helper
rather than a hand-copied snapshot so the page cannot drift from the code. The
page's "FSMVÜ Seal / Six treatments" copy was stale and is now accurate.

## Gates

    JS syntax sweep    clean (all files, find-based)
    emdash-scan        clean
    theme-sanity       PASS
    inline-css-check   PASS
    light-coverage     0 uncovered dark rules
    grammar-sanity     PASS - every unit clean
    bump --check       OK, no drift.  service-worker v254 -> v262

## Not verified

The teacher and student dashboards redirect to login without auth, so the font
result is confirmed on the login page and by static analysis (every
`font-family` in the tree is a token or a deliberate serif/generic; no canvas
`ctx.font` and no SVG `font-family=` attributes exist anywhere). It was not
confirmed on the signed-in dashboards themselves.
