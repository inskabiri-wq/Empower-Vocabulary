# 2026-07-22 - Marketing site rebuilt for GOOGLE SITES + 10+ premium components

User corrected the target: GOOGLE SITES (not Apps Script), and said the first
version's coloring was good but the design was "naive". Rebuilt
marketing-site/index.html as a much more sophisticated, self-contained page
(21st.dev / aceternity / magicui vibe) recreated in vanilla HTML/CSS/JS - React/
Spline can't run reliably inside a Google Sites embed, so vanilla is robust and
looks the same.

## 13 labelled components (>= 10 requested)
1 Aurora + dot-grid animated background (masked)
2 Glass sticky nav with shine-swept logo
3 Hero with animated word-rotator headline (play / a game / effortless / yours)
4 3D tilt + cursor spotlight on the app mock-up
5 Infinite marquee (games ticker, 9x2, pause on hover)
6 Count-up statistics band (spotlight tiles)
7 Bento feature grid (asymmetric lg/md/sm, cursor spotlight)
8 Animated rotating gradient-border card via @property --ang (Writing AI)
9 Tabbed panel (For students / For teachers)
10 "How it works" steps with an animated light beam (SVG-free CSS beam)
11 Value/testimonial cards (illustrative copy, marked for replacement - NOT
   fake attributed reviews)
12 Accordion FAQ (4 items, real answers)
13 Shine CTA + mailto contact (akabiriaslifar@fsm.edu.tr)

Fonts elevated to Inter (body) + Space Grotesk (display) for the dev/premium
feel; kept the blue/teal/violet palette the user liked. Reduced-motion + no-IO
fallbacks; safety timeout so nothing stays hidden. `<base target="_top">` kept
so links/mailto escape the Sites iframe.

## Delivery
- marketing-site/index.html - the whole site (paste into a Google Sites
  "Embed code" block).
- marketing-site/README.txt - rewritten for Google Sites (Insert > Embed >
  Embed code > paste > size the block; plus a note that each COMPONENT block
  can be embedded separately if they want Sites-native spacing).
- Code.gs left in the folder (only relevant if they ever host on Apps Script;
  not needed for Google Sites).

## Verification (browser, local static server :8899)
- No console errors. No horizontal overflow (desktop + narrow).
- Components present: marquee 18 items, bento 5 tiles, tabs 2, FAQ 4,
  gradient-border rendering, beam present, word-rotator cycling, count-up
  lands on 400+/6/9/8,000+.
- Interactions: teachers/students tab switch works; FAQ accordion opens with
  measured height.
- Screenshots: hero (aurora + glass mock + marquee + stats) and the Writing-AI
  gradient-border card both look premium.
- Em-dash scan of index.html + README: clean (0).

## Notes for the user
- Testimonials are illustrative value statements (no fabricated named reviews);
  swap in real quotes when available.
- Copy still says "8,000+ practice questions" and lists Speaking - tell me if
  either should change.

Standalone deliverable; nothing to deploy to Firebase.
