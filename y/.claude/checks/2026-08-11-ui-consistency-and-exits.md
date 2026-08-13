# 2026-08-11 - UI consistency pass, exit warnings, hub load

## The two root causes that made this take all day

**1. HTML was cached.** `firebase.json` had cache headers for the service
worker and manifest but NOT for HTML. Firebase then applies its default
`max-age=3600`, so a deployed page could serve an hour-old HTML that still
referenced OLD `?v=` stylesheets. That is why fixes were on disk, verified,
deployed - and still not visible. Fixed:

    **/*.html  ->  Cache-Control: no-cache, no-store, must-revalidate

inserted BEFORE the catch-all `**` rule so it is not shadowed.

**2. `mount()` returned early on the student dashboard.** Pages that own a
`#settingsModal` took `if (host) { mountIntoHost(host); return; }` and never
reached the gear-painting sweep, so the dashboard kept its original gear while
every other page got the shared one. No CSS could have fixed it. `styleAllGears()`
is now called on both mount paths, plus a deferred re-run for gears the modal
renders late.

## Gear: stopped using CSS for it

Every earlier attempt was a stylesheet rule, so the result depended on which
`app-settings.css` a page had loaded, which tokens that page defined
(`--bg-item` is declared by student/, classroom/ and teacher/ styles but NOT by
placement or courses), and stylesheet order. Same rule, different colour per
page.

The gear is now painted from JS with inline `!important`, which outranks every
author rule including other `!important` ones. Verified by injecting a HOSTILE
stylesheet (red, 70px, square, lime border) into each page and confirming the
gear was still `44x44 | radius 12 | rgb(28,42,66) | rgb(196,181,253) | svg 20x20`.

Hover had to move inline too, since a CSS `:hover` cannot outrank inline
`!important`.

## Exit warnings: three pages had the same defect

A plain `<a href>` navigates immediately, so no click handler can ever run.
All three were converted to buttons on a confirming handler:

| page | control | was |
|---|---|---|
| placement | gate-screen "Back to Lingualab" | bare `<a href>` |
| policy course | Dashboard | bare `<a href>` |
| courses catalog | Dashboard | bare `<a href>` |

Listening's exam Exit also now warns, and `back-nav.js` gained a generic
`window.screenExitGuards` hook so the phone's back gesture honours the same
confirm (it goes through `popstate`, not the button).

## Consistency, measured not assumed

- nav buttons: 9 variants -> one signature `36px | radius 10 | Nunito 700`
- gear: 7 gears across 6 pages -> one signature
- header titles: skill screens were 35.2px/700 (listening not even resolving
  Nunito - it fell back to Segoe UI); all now 22.4px/900/Nunito, matching
  vocabulary. Hub deliberately keeps its larger title.
- container box: listening and vocabulary both `1200 x min-height 720`,
  confirmed on the LIVE page. The apparent difference was content height
  (977 vs 720) plus an 8px scrollbar shift, not the box.

## Load smoothing (fixes 1 and 2 of 3)

- `student/js/hub-preload.js` (new): every hub widget's documents read in ONE
  parallel batch at auth instead of each widget queueing its own round.
  Adds no reads - it removes a duplicate profile fetch and overlaps the rest.
  Widgets fall back to their own fetches if the preload never ran.
- Fixed-size skeletons for the assignments panel (placement already had one),
  so nothing shifts when data lands.

## Also

- listening exam back button -> returns to the listening SECTION, not the
  dashboard; label "Exit"; warns when unsubmitted
- exams released fullscreen on exit (`requestFullscreen` was never paired with
  an exit, so the browser stayed full-page after the exam closed)
- grammar: one box not two, question 1.4em to match vocabulary, header hidden
  during a game so it matches the vocab game view
- "Hub" removed from all visible text (11 spots incl. aria-labels); the
  runtime-injected one was in `hub.js:324`
- tiles reordered: vocabulary, grammar, listening, reading
- certificate button deep-links to `#certificate` instead of landing on the
  course overview and needing a second click
- 16 classroom pages had NO Google Fonts link; `extra.css` had an `@import`
  3,870 lines in (CSS ignores an @import after any rule, so it never loaded)

## Gates

- `node --check` on 9 touched JS files - all pass
- `ui-sanity.js` / `grammar-sanity.js` / `theme-sanity.js` - PASS
- em-dash scan - 0
- unversioned CSS links - 0

## Still open

- **`firebase deploy --only firestore:indexes`** - the `sessions`
  (userId ASC + createdAt DESC) index is in `firestore.indexes.json` but a
  HOSTING deploy does not ship indexes. Until it runs, "Error loading sessions"
  continues.
- **`Missing or insufficient permissions`** at `student-assignments.js:268` -
  separate from the index, not yet traced.
- **renderHub() still wipes and rebuilds** the grid on every render (fix 3).
  DOM-only, no read cost; would remove the remaining rebuild flicker.
- **A second gear inside the dashboard's settings modal** renders 40x40/18x18
  instead of 44x44/20x20. Only visible with that modal open.
- **Placement scope** targets `C122 / B1 / Module 3`; the test student is
  `B125 / B1+ / Module 4`. Data, not code - widen or clear the scope.
