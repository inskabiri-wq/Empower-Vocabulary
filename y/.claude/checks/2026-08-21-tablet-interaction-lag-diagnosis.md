# 2026-08-21 - tablet lag on tile click / back to dashboard (DIAGNOSIS)

New and much sharper symptom: the lag is on INTERACTION (opening a tile, going
back), not on load. Earlier passes fixed load-time costs, which is why they did
not help here.

## First, the refresh fix is verified

`tools/demos/journey-prime-trace.html` - **15 / 15, no frame errors**, driving
the real `config.js` + `progress.js` + `hub.js`. Only the Firebase SDK is
stubbed (`config.js:12` refuses to run without it); nothing under test is.

Covers: primed at parse time, first paint already correct, the real numbers
arriving rebuild nothing, no cache still rebuilds once (correct), a stale cache
self-corrects in one rebuild, and corrupt / array / missing-bySkill caches are
all rejected without poisoning the grid.

Two harness bugs found and fixed on the way, both mine:
- read `w.journeyStats`, which is always `undefined` - it is a top-level `let`
  in a classic script, so it lives in the global DECLARATIVE environment and
  never appears on `window`. Reported 12 false failures. Now uses the frame's
  own `eval`.
- `typeof journeyStats` THREW rather than returning "undefined", which only
  happens in the temporal dead zone - config.js was aborting at line 12 on
  `firebase is not defined`, leaving the binding uninitialised.

## The interaction lag

### 1. `.container` carries a full-page `backdrop-filter: blur(20px)` that is visually a no-op

`styles.css:88`. `<div class="container">` (student-dashboard.html:376) is the
single wrapper around all 19 screens.

Measured rather than assumed - repainted the real backdrop (body
`linear-gradient` + the three `body::before` radial gradients) to a canvas and
compared it against the same thing under `blur(20px)`, 45,570 channel samples
taken away from the edges where blur clamps:

| quantity | value |
| --- | --- |
| max channel change from the blur itself | **3 / 255** |
| average channel change from the blur itself | **0.35 / 255** |
| max visible through the dark card (`rgba(15,23,42,0.95)`) | **0.15 / 255** |
| average visible through the dark card | **0.017 / 255** |
| visible in light mode (`--bg-card: #ffffff`) | **zero, fully opaque** |

The backdrop is a smooth gradient, and blurring a smooth gradient returns
almost exactly the same gradient. Then 95% of what little changed is covered by
the card colour, and in light mode 100% of it is.

So it produces **less than one sixth of one colour step** in dark mode and
**nothing at all** in light mode, in exchange for a full-viewport GPU blur that
the compositor must re-evaluate whenever anything inside the container
repaints - which is every screen fade and every card animation. This is the
main cost and it buys nothing.

### 2. Two more backdrop blurs, both directly in the click path

- `skills.css:79` `.skill-header` - `blur(6px)`, present on all five
  `.skill-screen` headers. Hit every single time a tile is opened.
- `extra.css:733` Quest Board - `blur(14px)`.

Each `backdrop-filter` forces its own compositor layer plus backdrop
re-sampling.

### 3. `transition: all 0.3s` on `.container`

`styles.css:89`. `all` makes the browser watch every animatable property on the
biggest element on the page, layout-affecting ones included.

### 4. Every screen transition animates the whole screen subtree

`styles.css:915` - `.screen{display:none}` / `.screen.active{display:block;
animation:fadeIn .25s}`. `fadeIn` is opacity+transform so it composites, but it
still promotes the entire revealed screen to a layer, and going from
`display:none` forces a full layout of that subtree first.

All 19 screens sit in the DOM permanently: **925 static elements in a 72 KB
document**, before the tiles, exam cards and grammar content that JS renders in
on DOMContentLoaded.

### 5. `box-shadow: 0 25px 80px rgba(0,0,0,0.5)` on `.container`

An 80px blur radius on a 1200x720+ element. Static, so usually cached, but it
forces and keeps a large layer.

## Ruled out

- `node tools/anim-cost-check.js` - **PASS**, no always-on animation repaints on
  a screen a student sits on. The earlier fixes held.
- `hubLivePulse`, `hubCardIn`, `as-sk-pulse` all animate opacity/transform only,
  so they are composited.
- `showScreen()` itself is three lines and does no work beyond a class toggle.

## Recommended order (NOT applied)

1. Delete `backdrop-filter: blur(20px)` from `.container`. Proven above to be
   invisible; pure win.
2. Drop or reduce the `.skill-header` blur - it is in the tap path.
3. Replace `transition: all 0.3s` with the properties actually intended.
4. Consider dropping the `fadeIn` on `.screen.active`, or restricting it to
   opacity only.

---

## APPLIED (same day)

Two removals, both proven to be no-ops before touching them:

1. `styles.css` `.container` - removed `backdrop-filter: blur(20px)`, and
   replaced `transition: all 0.3s` with
   `background 0.3s, border-color 0.3s, box-shadow 0.3s`.
2. `skills.css` `.skill-header` - removed `backdrop-filter: blur(6px)`.

### One correction to the diagnosis above

`.skill-header` is NOT sticky - it is a static block with `margin-bottom: 24px`,
so nothing ever scrolls under it and what it was blurring is the container's
flat background. Blurring a flat colour returns the same flat colour, so this
was invisible too, not merely cheap-to-lose.

The Learning Map blur was NOT removed. It is a modal with the whole varied
dashboard behind it, so there the effect is real - and it is not in the tap path
anyway.

### Every remaining backdrop-filter, and why it stays

| where | why it is legitimate |
| --- | --- |
| `extra.css:733` Learning Map modal | modal over the varied dashboard |
| `extra.css:3434` `.exam-mobile-tabs` | `position: sticky`, exam content really does scroll under it |
| `policy-course.css:38` | sticky page header |
| `reading-exam.css:1283` | reading exam overlay |
| `styles.css:640` | modal overlay, already gated to "only blur when shown" |

The two removed were exactly the two that were both always-on AND blurring
something flat or fully covered.

### Verified

Computed styles read from the real `styles.css` in a frame, after letting the
transition settle:

```
bg       rgba(15, 23, 42, 0.95)      <- unchanged
shadow   rgba(0,0,0,0.5) 0 25px 80px <- unchanged
radius   24px                        <- unchanged
backdrop none                        <- removed
transition  background, border-color, box-shadow   <- no longer `all`
```

A first read showed a transparent background and no shadow, which looked like
breakage but was the probe catching the flash-of-unstyled-content transition
mid-flight; reading after it settles shows everything intact. The parsed rule
was also dumped from the CSSOM to confirm nothing was dropped.

Gates: `node --check` on all four changed JS files, em-dash scan clean,
`inline-css-check` PASS, `anim-cost-check` PASS, `tile-art-check` PASS.

Versions: progress.js v4, auth.js v6, styles.css v36, skills.css v16,
exam-registry.js v5, CACHE_VERSION **v296**. `bump.js --check` OK.

### Not done, and why

- `fadeIn` on `.screen.active` was left alone. It is opacity+transform so it
  already composites, the layer promotion happens either way, and you asked for
  the artwork and motion to be kept.
- The `0 25px 80px` container shadow was left alone. It is static and painted
  once, so it costs far less than the blur did, and shrinking it is a visible
  change for little gain.
