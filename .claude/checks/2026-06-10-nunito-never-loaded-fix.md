# Real font bug: Nunito never loaded + revert Empower overstep · 2026-06-10

## Overstep (reverted)
Added an unrequested "Select Content" card + "Empower" book row to the grammar
sidebar. User only asked about FONT. Reverted grammar.js side back to the
Level/Unit cards.

## Root cause of the persistent font mismatch
Nunito was NEVER actually loading on the page:
- extra.css:3870 `@import url(...Nunito...)` is buried mid-file. CSS @import is only
  valid as the FIRST rule of a stylesheet -> browsers IGNORE it. So no Nunito.
- The HTML <head> font <link> only loads Outfit + JetBrains Mono, not Nunito.
=> #menuScreen `font-family:'Nunito',system-ui,...` fell back to system-ui;
   vocab's .map-btn-gamified `font-family:'Nunito',sans-serif` fell back to sans-serif
   (Arial); grammar's `font:inherit` -> system-ui (Segoe UI). Two different fallbacks
   = the visible difference. Nothing to do with Firestore reads.

## Fix
- Added a proper <link href="...family=Nunito:wght@400..900..."> to student-dashboard.html
  <head> (next to the Outfit link). Now Nunito actually loads, so #menuScreen AND
  #grammarScreen (and every element asking for Nunito) render in real Nunito -> they match.
- Side effect (intended): the vocab dashboard will now show its REAL Nunito font for the
  first time (it had been on the system fallback), so it'll look slightly rounder.

## Cache
- grammar.js v13->v14 (side revert), service-worker.js v25->v26.

## Verify
- node --check grammar.js OK. Empower/Select-Content removed; sidebar = Level/Unit.
  Nunito link present.

## Deploy
- firebase deploy --only hosting; reopen (SW v26).
