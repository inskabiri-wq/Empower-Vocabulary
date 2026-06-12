# Hub skill grid clipped on the right (PWA / phones) · 2026-06-04

## Symptom
On the installed PWA (phone), the student hub's skill cards are clipped on the
right edge: the second column (Listening / Reading / Speaking) is cut off, AND
the full-width "Classroom Mode" card's right side (the LIVE pill) is cut too.
Left margin looks fine; right has no margin.

## Root cause
`#hubScreen .hub-grid` used `grid-template-columns: 1fr 1fr` (and repeat(N,1fr)
at other breakpoints). A `1fr` track is `minmax(auto, 1fr)`: the `auto` floor
refuses to shrink below each card's min-content. Each `.hub-card` has a fixed
56px ring (`flex-shrink:0`) plus a `white-space:nowrap` subtitle, so two columns'
min-content adds up to MORE than a narrow phone's width. The grid therefore grows
wider than its container and overflows to the right. Because the whole grid is
over-wide, the full-span Classroom card is clipped too (the tell-tale sign it's a
track-sizing overflow, not a per-card issue).

Box-sizing was NOT the cause: `student/css/styles.css` has `*{box-sizing:border-box}`,
and the page viewport meta is correct (`width=device-width, initial-scale=1`).

## Fix (CSS only, in y/student/css/hub.css)
Switched every grid track from `1fr` to `minmax(0, 1fr)` so columns may shrink to
fit, and the nowrap subtitle ellipsis-clips instead of forcing overflow:
- base `.hub-grid`            repeat(4, 1fr)   -> repeat(4, minmax(0, 1fr))
- <=920 (3-col)              repeat(3, 1fr)   -> repeat(3, minmax(0, 1fr))
- <=720 (phone, 2-col)       1fr 1fr          -> minmax(0,1fr) minmax(0,1fr)
- <=1200 (.hub-two-col)      1fr              -> minmax(0, 1fr)
- >=1450 / >=1750 (5/6-col)  repeat(N,1fr)    -> repeat(N, minmax(0,1fr))
Plus `min-width: 0` on `.hub-card` so the grid item can shrink.

This is a no-op on wide screens (minmax(0,1fr) == 1fr when space is ample); it
only changes behaviour when content would otherwise overflow. Desktop hub is
visually unchanged.

## Verify
- hub.css braces 54/54 BALANCED; 8 `minmax(0` tracks; 0 leftover bare `1fr 1fr`;
  `.hub-card { min-width: 0 }` present.
- Not E2E-tested in a real authed PWA this pass (hub needs login). Diagnosis is
  confirmed by the full-span Classroom card also clipping, which is textbook
  grid-track min-content overflow that `minmax(0,1fr)` resolves.

## Deploy
- `firebase deploy --only hosting`. The PWA picks up new CSS on next launch (SW
  already bumped to v12 this session). Then re-open the hub on the phone.

## Follow-up 1 — dynamic re-render + hard guarantee
User reported "loads fine, then suddenly widens." Root: hub.js re-renders on
stats load (MutationObserver on #journeyAccuracy); Vocabulary's subtitle grows
from "Your word sets" to "964 words learned" + 43%, which (with old 1fr tracks)
pushed the grid wide and stretched the full-span Classroom card. `minmax(0,1fr)`
handles it. Added belt-and-suspenders:
- `.hub-card { overflow: hidden }` so a card can never spill its content.
- In the `<=1200px` block: `#hubScreen .hub-main, .hub-rail { min-width: 0 }`
  (let both columns shrink to the single-column width) and
  `#hubScreen { overflow-x: clip }` as a hard stop so the right margin can NEVER
  break on phones / PWA. Safe because the rail is `position: static` at <=1200,
  so clip does not break sticky.
- Could not live-measure this pass: local preview server kept dying, the real
  page requires auth (redirects to login), and a standalone harness froze the
  CDP renderer. The CSS guarantees (shrinkable tracks + clip) are deterministic.

## Follow-up 2 — the real blocker was a STALE PWA CACHE, not the CSS
User: "loads fine 1s then the boxes widen out of the bigger box, AFTER deploy,
many times" + "firebase deploy now finds 202 files, used to be 203."
- The 202 vs 203 is the proof the deploy IS shipping my changes (I deleted
  organizations.js = -1 file). So the server has the fixed hub.css.
- But the installed PWA kept painting with the OLD cached hub.css: HTML is
  network-first (fresh) but CSS is cache-first within CACHE_VERSION, and the
  service-worker update has a 2-load lag (the launch that detects the new SW
  still paints with the old cached CSS; only the next launch serves new CSS).
  firebase.json already sets service-worker.js + manifest to no-cache (correct).
- Fix: cache-bust the stylesheet URL so a fresh fetch is guaranteed on the FIRST
  load after deploy (HTML is always network-fresh, so the new URL can't be
  served stale): `student/css/hub.css` -> `student/css/hub.css?v=13` in
  student-dashboard.html. Bumped CACHE_VERSION v12 -> v13.
- With the fixed CSS actually loaded, `overflow-x: clip` on #hubScreen makes it
  physically impossible for cards to exit the container, so the widen-after-1s
  symptom cannot occur once the new file is served.
- (tools/demos/*.html also link hub.css but are excluded from deploy via
  firebase.json ignore `tools/**`, so they were left as-is.)

## If a very small phone (<~330px) still looks tight
The 56px ring sets a hard ~92px floor per card, so 2 columns need ~200px. On
phones below that, switch the hub to a single column:
  @media (max-width: 360px){ #hubScreen .hub-grid{ grid-template-columns:1fr; } }
Left out for now to preserve the 2-column design on normal phones.
