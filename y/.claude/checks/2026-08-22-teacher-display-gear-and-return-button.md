# 2026-08-22 - Display gear back on the teacher sidebar, and a way back from the student dashboard

Two requests. Both agreed before implementing: sidebar placement option (a),
and the return button strictly teacher-only.

## 1. The Display gear was deliberately switched off

`teacher-dashboard.html` carried `<body data-app-settings="off">`, and
`js/app-settings.js:707` returns immediately on that attribute, so nothing
mounted. The comments recorded why: the "Display" sidebar row had been removed
on request, and without an opener on the page `app-settings.js` builds its own
floating wheel AND calls `placeInHeader()`, which dragged a Lingualab lockup
into `<header class="t2-page-header">`. The opt-out suppressed the symptom.

Fixed by removing the cause rather than the symptom:

- deleted the `data-app-settings="off"` attribute
- added a `t2-nav-item` row carrying `data-app-settings-open`, directly under
  Widgets, where the user asked for it

`app-settings.js:717-719` decides BEFORE building: if any opener exists it
passes `build(false)` and skips `placeInHeader()` entirely. So the floating
wheel and the header lockup - the whole reason for the opt-out - never happen.

The row's `.ico` span is left empty on purpose: `app-settings.js:722` paints
its own gear SVG into it, so the icon matches every other page rather than an
OS emoji that renders pale and flat on Windows.

The stale comment further down the sidebar (still claiming the row was removed
and no opener existed) was corrected, since it now described the opposite of
the truth.

### Verified - `tools/demos/teacher-display-gear-trace.html`, 12 / 12

Against the real `js/app-settings.js`: row exists, is bound (`.as-opener`),
sits directly under `#wtSidebarBtn`, panel builds, **no** `#appSettingsLaunch`
floating wheel, **nothing** injected into `.t2-page-header`, no Lingualab text
in the header, a real `<svg>` painted into the row, and clicking it opens the
panel.

Checks 11-12 are a control: restore the old `data-app-settings="off"` and
confirm nothing mounts and the row stays unbound - so the ten checks above are
measuring this change, not passing incidentally.

## 2. No way back from the student dashboard

The teacher sidebar links to `student-dashboard.html` ("Lingualab") and nothing
linked back, so a teacher had to retype the URL or log out.

The user held off on this suspecting a security issue. Checked, and it is not
one: `teacher/js/config.js:104` gates the teacher dashboard itself, showing
"Access Denied" unless `role === 'teacher'`, with the Firestore rules gating
the data underneath. A link is a convenience, not a boundary - anyone who
conjured the button would still be refused at the destination.

New `student/js/teacher-return.js`, loaded on the student dashboard.

**Students never see it, and it is not rendered-then-hidden.** The element is
never created at all unless the already-loaded user document says
`role === 'teacher'`: no hidden node, no CSS rule to defeat, nothing in the
markup. A student's page simply does not contain it.

**Zero extra Firestore reads.** `student/js/auth.js:90` already parks the user
document on `window.currentStudentData`; this reads the copy in memory.

Details worth knowing:

- Injected into EVERY `.dashboard-header .header-right`, not just the hub, or a
  teacher who opened a skill screen would lose the way back again.
- Placed before Logout so the destructive action stays last.
- Re-asserts on a bounded interval, because screens re-render; `inject()` is
  idempotent so this cannot duplicate.
- Waits for the user document with a bounded poll (60 x 100ms), so a signed-out
  or errored page does not poll forever.

### The harness caught a real trap

Check 6 failed at first. The button borrows `.logout-btn` for the header pill
look, and `inject()` used `querySelector('.logout-btn')` to find where to
insert - which can resolve to the button itself. Now
`.logout-btn:not([data-teacher-return])`, in both the code and the test.

Nothing currently binds behaviour to `.logout-btn` (the real ones use an inline
`onclick`), so there was no live bug, but a future
`querySelectorAll('.logout-btn')` wiring up logout would have logged teachers
out when they meant to navigate. That hazard is now called out in the file.

### Verified - `tools/demos/teacher-return-trace.html`, 20 / 20

Teacher: button present in every header, is a real `<a>` to
`teacher-dashboard.html`, labelled, before Logout, Logout still last, and no
duplicates after the re-assert interval runs.

Student, tested strictly - not "invisible" but absent: no
`[data-teacher-return]` node, no `a[href*="teacher-dashboard"]` anywhere, no
"teacher" text in the header at all, and the existing markup untouched.

Denied for every non-teacher shape: `demo`, role missing, role `null`, role as
an object, `"Teacher"` with a capital T (case must not pass), and no user
document at all.

Timing: loaded before the user document exists, renders nothing, then appears
once `window.currentStudentData` lands - which is the real order on the page.

## Ritual

- `node --check` teacher-return.js - ok
- em-dash scan across all changed files - clean
- inline-css-check / anim-cost-check / tile-art-check - PASS
- `bump.js student/js/teacher-return.js` - v2, CACHE_VERSION v297 -> **v298**
- `bump.js --check` - OK, no drift

---

## Follow-up: the Display row rendered as a square with the label outside it

Reported with a screenshot: the row looked nothing like its neighbours, and its
icon was oversized and appeared late.

Both were caused by the same wrong assumption, in two places at once. The gear
treatment is an **icon button** treatment - 44x44, bordered, 12px radius - and
it was being applied to a nav row that has a label.

The row was caught FOUR ways:

1. `js/app-settings.js` `styleAllGears()` - as a `[data-app-settings-open]`
2. ...and again by the same function's title sweep, because
   `title="Display settings"` matches `/settings/i`
3. `css/app-settings.css:775` - `[data-app-settings-open].as-opener` sets
   `width/height/min-width: 44px !important`
4. `css/app-settings.css:457` - `.as-opener svg` sizes the icon in `em`

Fixing only the JS was not enough, and the harness caught that: checks 8 and 9
still failed on the CSS. Worth recording, because the JS carries a long comment
claiming stylesheets "could not settle this" and that painting inline is the
only reliable way - but a duplicate of the same rule set exists in the
stylesheet, so a JS-only guard silently does nothing.

### Fix

A page can now mark an opener `data-app-settings-plain`, meaning it supplies
its own presentation and only the click wiring is shared. Honoured in all four
places above.

The Display row also stopped relying on app-settings for its artwork. Added a
`settings` gear to the sidebar's own icon set in `teacher/js/overview-v2.js`, so
the row uses `data-icon="settings"` like Widgets and Lingualab do.

That is what fixes "appears so slowly": `js/app-settings.js` is loaded in
`<head>` (line 1114) while `teacher/js/overview-v2.js` is at the end of `<body>`
(line 3112). Both mount on DOMContentLoaded, but app-settings builds its whole
panel before it paints, so the icon landed noticeably after the rest of the
sidebar. Coming from the sidebar's own set, it hydrates in the same pass as its
neighbours.

### Verified

`tools/demos/teacher-display-gear-trace.html` - **17 / 17**, including a
control that restores the old opt-out and confirms nothing mounts.

`tools/demos/teacher-sidebar-visual.html` renders the real sidebar CSS and
measures every row. A screenshot was not possible (the preview pane does not
composite when hidden), so geometry was read directly:

```
Widgets     220x36   icon emoji   label x=42   border 0px   radius 8px
Display     220x36   icon 18px    label x=42   border 0px   radius 8px
Lingualab   246x36   icon 18px    label x=42   border 0px   radius 8px
Classroom   246x36   icon 18px    label x=42   border 0px   radius 8px
Logout      220x36   icon 18px    label x=42   border 0px   radius 8px
```

Display is now identical to the other rows: same height, same icon size, same
label offset, no 44px square, no border. Previously it was 44x44 with a 1px
border and a 12px radius, with "Display" pushed outside the box.

### Ritual

- `node --check` app-settings.js, overview-v2.js - ok
- em-dash scan - clean
- inline-css-check / anim-cost-check - PASS
- bump: app-settings.js v33, app-settings.css v50, overview-v2.js v6,
  CACHE_VERSION v298 -> **v299**
- `bump.js --check` - OK

### Note

`js/app-settings.js` and `css/app-settings.css` are referenced by 30 and 29
pages respectively, so this touches every page that shows a gear. The change is
additive - it only takes effect where `data-app-settings-plain` is present, and
only the teacher sidebar row carries it - but that is the blast radius if
anything looks wrong after deploying.

---

## Follow-up 2: the button arrived late, and that WAS the "margin" change

Reported: the Teacher Dashboard button appears well after the page, and it
"changes the margin". Both are one problem.

### They are the same bug

Measured the header with and without the button across widths. Header height is
**95px either way**, container width identical, no horizontal overflow at any
width. The button changes no margin at all.

What it changes is the WIDTH of `.header-right`: 291px -> 569px. In a
`space-between` header that pulls the gear and profile badge leftwards. Insert
it late and that shift happens as a visible reflow, after the page has already
painted. That is the "margin change" - a layout shift caused by arriving late,
not by the button's geometry.

So fixing the timing fixes both.

### Why it was late, and the fix

The role lives in the user's Firestore document, which auth.js fetches over the
network. Waiting on that is a round trip.

`teacher-return.js` now remembers the last known role in `localStorage`
(`ll-role`) and applies it at PARSE time - the same trick feature-toggles.js
and progress.js already use for the tiles and the rings. The script is loaded
after the headers in the markup, so the button is in place before first paint,
rather than after a network round trip. That is genuinely faster than the
tiles, which wait for DOMContentLoaded.

**The cache is a hint, never the authority.** When the real document arrives
the role is re-checked and the button is REMOVED if it is not a teacher, and
the cache is corrected on disk. A stale or hand-edited value self-corrects
inside the same page load. Nothing here is trusted with access:
teacher-dashboard.html still gates itself, so the worst a forged cache buys is
a link to "Access Denied" that then disappears.

`ll-role` is cleared on logout alongside `journeyStats`, so a shared machine
does not flash the button at the next person to sign in.

### A responsive defect this introduced, found and fixed

The button makes the header cluster much wider, and the header only fits on one
line down to about 820px; below 600px it stacks and is fine again. That leaves
roughly 600-900px - tablet portrait - where a fourth full pill did not fit. At
900px the gap between the title and the cluster was down to **15px**.

Added a media query for that band: keep the mortarboard, drop the words. The
`title` still says where it goes.

| width | button | gap before | gap after |
| --- | --- | --- | --- |
| 1280 | full label, 162px | 473 | 473 |
| 900 | icon only, 39px | **15** | **181** |
| 560 | stacked, full label | n/a | n/a |

### Pre-existing, NOT introduced here

At 760px and 640px the header-left overlaps the cluster. Measured with and
without the button: gap is **identical either way** (-639 and -519), so this
change neither causes nor worsens it. Worth a separate look; note the figures
come from a cut-down harness with four stylesheets, not the full nine.

### Two harness bugs, both mine

1. Frames were never removed, so their re-assert intervals kept writing the
   shared `localStorage` key. Fixed with disposal per case - though this turned
   out not to be the cause.
2. The real cause: the harness set `window.currentStudentData` BEFORE loading
   the script. On the real page auth.js only sets it after a Firestore read.
   With it already present, the optimistic injection and the settle both ran in
   one synchronous pass, so `atParse` could never observe the optimistic state
   and two checks reported the exact opposite of the truth. The code was right;
   the model was wrong. The harness now delivers the document afterwards, the
   way auth.js does.

### Verified - `tools/demos/teacher-return-trace.html`, 25 / 25

Adds: present mid-parse before DOMContentLoaded (`readyState === 'loading'`);
stale teacher cache flashes then is removed by a student document and corrected
on disk; a hand-edited cache cannot survive; first visit has nothing cached,
then appears and is remembered. Student checks unchanged and still strict.

### Ritual

- `node --check` teacher-return.js, auth.js - ok
- em-dash scan - clean
- inline-css-check / anim-cost-check - PASS
- bump: teacher-return.js v3, auth.js v7, extra.css v33,
  CACHE_VERSION v299 -> **v300**
- `bump.js --check` - OK
