# 2026-08-10 - Settings wheel: one place, every page

## What was wrong

The previous attempt injected a shared 56px bar (`.ll-appbar`) at the top of
pages. On classroom that bar landed **on top of** the page's existing
`header.header`, so the page had two stacked headers. Courses got no bar at
all (it already had a header), and placement got only the bar. Three pages,
three different looks - worse than before the change.

## What changed

The bar is gone. Each page keeps its own header; the wheel simply joins it as
the **first control**, which is the same top-left spot the floating launcher
occupies on the dashboard. Pages with no header of their own keep the floating
launcher.

- `y/js/app-settings.js` - deleted `buildAppBar()` / `pageTitle()`. Added
  `pageHeader()` + `placeInHeader()`, called from `mount()`.
  - selectors: `header.header`, `.pc-header`, `.cor-header`, `header`
  - `.dashboard-header` is deliberately excluded: the student dashboard has six
    of them (one per skill screen, five hidden) and the skill screens are off
    limits. There the floating launcher stays.
  - a header hidden at boot (courses keeps `#crsApp` display:none until
    Firestore answers) is still used when it is the only candidate, otherwise
    that page would have shown a floating gear and looked different again.
- `y/css/app-settings.css` - deleted the whole `.ll-appbar` / `has-ll-appbar`
  block. Added `.as-launch.as-inheader` (static, 36px, no shadow). `!important`
  on position/size only, because the floating defaults sit on `.as-launch`
  itself and the two variants of one component must not be settled by cascade
  order.
- `y/courses.html` - removed the hand-added gear from `.pc-header-right`; the
  component now places it first in the header instead. That was picture 2's
  odd-one-out.

## Verified against the served files

Real `js/app-settings.js` + `css/app-settings.css` loaded from the server and
run against each page's actual header markup.

| page | wheel | position | size | second bar |
|---|---|---|---|---|
| classroom (`header.header`) | first in header | static | 36x36 | no |
| courses (`.pc-header`, hidden at boot) | first in header | static | 36x36 | no |
| writing lab (`.cor-header`) | first in header | static | 36x36 | no |
| placement (no header) | floating top-left | fixed | 42x42 | no |

- first-child-of-header: true on all three header pages
- `.ll-appbar` present anywhere: no (0 refs left in js, css, html)
- `<header>` count on classroom: 1 (was 2)
- inline SVG gear (not the pale Windows emoji): all four
- wheel does not overlap the header title on classroom or courses

## Gates

- `node --check y/js/app-settings.js` - PASS
- `node y/tools/ui-sanity.js` - PASS (88 unified, 0 not unified)
- `node y/tools/grammar-sanity.js` - PASS (every unit clean)
- em-dash scan on touched files - 0

## Versions

`app-settings.css?v=10`, `app-settings.js?v=12`, service worker `v136`.

## Deploy owed

```
firebase deploy --only hosting
```
