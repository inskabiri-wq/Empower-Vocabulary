# 2026-08-19 - Lingualab mark (logo swap)

Source: "Logo swap workflow request-handoff.zip" -> the LinguaLab design only.
The bundle also contained Ozyegin assets (ozu-logo.png, OZU Loaders.dc.html);
those were ignored on instruction - that university was cancelled.

## What the design is
`LinguaLab Loaders v4.dc.html` builds every one of its six loaders around one
mark: a FLASK - body path, a liquid fill across the lower third, and a cap bar
on top. Design colours were #16264a navy with #a4123c crimson liquid, on cream.

## Recolour
The instruction was to use the colour we already have, with white as the
priority. So:
  body + cap   #16264a -> #1e3a8a  (blue-900). Same VALUE as the design navy, so
               the mark keeps its weight, but it belongs to a blue app.
  liquid       #a4123c -> #ee3342  the FSMVU crimson the app already carries.
               That is "the colour we have".
Verified by rasterising and reading pixels on a white ground:
  cap/neck/body rgb(30,58,138)   liquid rgb(238,51,66)   outside white.

## Where it landed
- `y/lingualab-mark.svg` - new asset, used by the loaders (they need a URL for
  background and mask).
- `css/fsmvu-loader.css` - `--ll-mark` points at it. The old `--fsmvu-seal`
  variable is KEPT as an alias so nothing that still names it breaks. Every
  class name and the `FSMVULoader.show()/hide()` API are unchanged, so all 9
  pages that use the loader keep working with no edits.
- `js/app-settings.js` - the header lockup's graduation-cap glyph is now the
  flask, drawn inline so the lockup costs no extra request.

## Two things worth stating
1. The FSMVU SEAL IS NOT RETIRED. It is still the university's mark on the
   printed certificate (policy-course.html) and the tenant seal in tenant.js.
   A certificate carries the university's seal, not the app's logo, so those
   two must never be swapped for each other. Confirmed both still point at
   /fsmvu-seal.png.
2. The white-variant rule changed. It used to force a BLACK silhouette in light
   mode; the new mark is already drawn in blue with a crimson fill and reads
   correctly on paper, so light mode now shows it in full colour. White is the
   app default, so that is the case that matters most. Dark grounds keep the
   white silhouette.

## A bug avoided
capSvg() is injected per header, so two lockups can exist on one page. A fixed
clipPath id would mean the second one clips against the first and loses its
liquid. The id is now unique per call; verified by rendering two and reading the
SECOND one's pixels - liquid intact.

## NOT done
- The six v4 RING treatments (dashed ring, comet sweep, tick dial, arc trace,
  circling word, counter arcs). The app's existing six motions are already wired
  into 9 pages and work; swapping the mark was the ask. Say the word and I will
  bring specific ring treatments across.
- The wordmark stays as it is. The design sets "Lingua" navy + "Lab" crimson in
  Newsreader; the house rule is not to change fonts, and the current lockup is
  already an on-brand blue gradient.
- Fonts untouched.

## Verification
- node --check every JS file: passes.
- theme-sanity PASS, light-coverage 0, inline-css-check PASS, em-dash clean,
  bump --check no drift. Service worker v248.
- Screenshots were not possible (pane not compositing), so the mark was verified
  by rasterising it to a canvas and reading pixel values, not visually.
