# 2026-08-12 - The closed settings panel was swallowing clicks

## Report

"THE TILE FOR READING IN THE DASH DOESN'T WORK."

## What it actually was

A regression I introduced in `2026-08-11b`, and it was not about Reading.

`.as-panel` closes with `opacity: 0` and nothing else. Opacity does not remove
an element from hit-testing, so the closed panel - a 326px column pinned dead
centre at `z-index: 99967` - stayed on top of the page and absorbed every click
that landed inside its rectangle.

Before that change the student dashboard took the `mountIntoHost` path and no
`.as-panel` was ever created there, so the defect could not show. Once `build()`
started running on every page, the dashboard got an invisible click-blocker over
the middle of its hub grid.

Measured with `elementFromPoint` at each tile's centre, hub screen, 1440x900:

| tile | before | after |
|---|---|---|
| vocabulary | clickable | clickable |
| grammar | clickable | clickable |
| **listening** | **BLOCKED by .as-panel** | clickable |
| **reading** | **BLOCKED by .as-panel** | clickable |
| writing | clickable | clickable |
| speaking | clickable | clickable |
| **classroom** | **BLOCKED by .as-panel** | clickable |
| **courses** | **BLOCKED by .as-panel** | clickable |

Four of eight. Reading was simply the one the user reached for. This affected
EVERY page that loads `app-settings.js` - any control under that centre column
was dead.

Closed state is now `visibility: hidden; pointer-events: none`, restored on
`.open`, with `transition: ... visibility 0s linear .18s` so the fade-out still
plays. `visibility` also takes the panel out of the tab order and the
accessibility tree, which `opacity: 0` never did. `.as-overlay` already had the
`pointer-events` guard; only the panel was missing it.

Verified after the fix: all 8 tiles hit-testable; a genuine hit-tested click
(dispatched at the element `elementFromPoint` returns, not `el.click()`, which
bypasses overlays) opens `readingScreen` with 5 level tabs and 14 exam cards,
no console errors. Panel when open: `visibility: visible`,
`pointer-events: auto`, its own buttons hittable.

## How it was found

`element.click()` bypasses hit-testing, so the first harness "proved" the tile
worked when a real user click could not reach it. The tell was
`elementFromPoint` at the tile centre returning `BUTTON.active` - a theme button
inside the invisible panel. **Test clicks with `elementFromPoint` + dispatched
mouse events, never `el.click()`, when the question is "does clicking work".**

A second harness (`reading-tile-diag.html`, since removed) booted the
dashboard's real scripts against a stubbed Firebase, skipping only the Firebase
SDK and `auth.js`. That is the way to exercise this SPA's behaviour without a
login.

## Ruled out on the way

Read live Firestore with the service account before blaming data:

- `settings/featureToggles`: `reading = true` (so not the "Not activated" path).
  For the record `speaking`, `writing` and `game_listening` ARE false.
- `settings/contentControls`: `practiceHidden.reading = []`,
  `hiddenLevels.reading = ["A1"]`. Nothing that empties the list.

Both simulated states DO produce a "tile does nothing" experience, so they are
worth checking first next time: a switched-off skill leaves the tile grey with
an OFF pill and clicking does nothing but show an alert; all-exams-hidden opens
the screen onto "No exams yet for <level>".

## Also

- `skills/reading.js` empty state had an em dash in user-visible text
  ("No exams yet for B2 - coming soon"). Fixed.

## Gates

- `node --check`: app-settings.js, ui.js, skills/listening.js, skills/reading.js,
  hub.js - pass
- `theme-sanity.js` PASS, `ui-sanity.js` PASS, `bump.js --check` OK
- app-settings.css v37; service worker v187 (covers the unversioned
  `skills/*.js`)
