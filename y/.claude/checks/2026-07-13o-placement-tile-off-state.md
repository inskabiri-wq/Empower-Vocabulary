# 2026-07-13o — Placement tile: OFF = grayed, never removed

## Why
User: flipping Admin > Features > Placement Test made the student tile
DISAPPEAR. App convention (hub.js feature toggles): a switched-off skill stays
VISIBLE but grayed with "Not activated" - it is never removed. The placement
tile now follows the same rule.

## Change (y/student/js/placement-tile.js, ?v=2)
- TARGETING (placementConfig.scope) decides WHO gets the card at all;
  the Features toggle only decides its STATE:
  - toggle ON  -> live card (TEST pill / DONE pill with recommendation).
  - toggle OFF or never enabled -> grayed `is-off` card, "Not activated",
    OFF pill; clicking shows the AppDialog "not activated for your programme"
    alert instead of navigating (same as other switched-off skills).
  - out of scope -> no card (that is targeting, not on/off).
- placement.html itself still refuses to run while the toggle is off
  (unchanged), so the gray card cannot be bypassed via direct URL.
- student-dashboard.html: placement-tile.js ?v=1 -> ?v=2; SW v102 -> v103.

## Verification (browser harness, real tile + course-target scripts, 5 states)
- toggle ON: card present, live, TEST pill, click navigates (no alert). PASS
- toggle OFF: card present, is-off, "Not activated", OFF pill, click alerts. PASS
- featureToggles doc missing entirely: same grayed OFF card. PASS
- out of scope (classes ['10C'], student 9A): NO card. PASS
- completed student, toggle ON: DONE pill, "Completed - recommended B1+". PASS
- node --check OK; em-dash clean.

## Ship
firebase deploy --only hosting (rules unchanged since 2026-07-13k).
