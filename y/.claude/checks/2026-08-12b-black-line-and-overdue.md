# 2026-08-12b - The black line, the overdue date, and the gear

## 1. The black line down the right edge - mine, now removed

Caused by `html { scrollbar-gutter: stable }`, which I added in `2026-08-11b` to
stop the `.container` card being 15px wider on screens too short to scroll.

The gutter is reserved OUTSIDE the scrollport, and `body::before` - the radial
glow layer - is `position: fixed`, so it sizes to the scrollport and stops short
of it. Measured at a 1280px viewport:

    window.innerWidth        1280
    documentElement.clientWidth  1265
    body::before width       1265   <- glow stops here
    reserved gutter            15px <- flat base colour, no glow

That unlit 15px band is the black line. Removed. A 15px width difference nobody
notices is not worth a stripe everybody does, and the real box mismatch was the
card component, already fixed in `reading-exam.css` / `listening.js`.

Verified after removal: `scrollbar-gutter: auto`, no reserved channel on a
non-scrolling page.

## 2. "Due Today!" on an assignment that was due yesterday

Real bug, and a nasty one. `student-assignments.js:374` computed

    const daysLeft  = Math.ceil((deadline - now) / 86400000);
    const isOverdue = daysLeft < 0;

`Math.ceil` returns **-0** for any difference between -1 and 0 days, and
`-0 < 0` is **false** in JavaScript. So for a full 24 hours after the deadline
instant, `isOverdue` stayed false and `daysLeft === 0` matched the
`'Due Today!'` branch. An assignment due Aug 11 still read "Due Today!" on
Aug 12.

Compounding it: the deadline comes from an `<input type="date">`, and
`new Date('2026-08-11')` parses as UTC midnight - 03:00 in Istanbul. So the
instant the maths compared against was not the date printed on the card.

Fixed by comparing CALENDAR DAYS in local time, which is what a date-picked
deadline means and what the card prints:

    const startOfLocalDay = d => { const x = new Date(d.getTime()); x.setHours(0,0,0,0); return x; };
    const daysLeft  = Math.round((startOfLocalDay(deadline) - startOfLocalDay(now)) / 86400000);
    const isOverdue = daysLeft < 0;

Verified by extracting the expressions BACK OUT of the saved file and running
them, so the test covers the shipped code and not a copy:

| now | daysLeft | label |
|---|---|---|
| Aug 10 12:00 | 1 | Due Tomorrow! |
| Aug 11 00:05 | 0 | Due Today! |
| Aug 11 23:50 | 0 | Due Today! |
| **Aug 12 00:05** | **-1** | **Overdue** |
| Aug 12 12:00 | -1 | Overdue |
| Aug 14 12:00 | -3 | Overdue |

It now flips at local midnight, exactly where the printed date changes. The
only other consumer, `daysLeft <= 1` (the "urgent" fire card), still means
"due today or tomorrow" and sits after the `isOverdue` branch, so it is
unaffected. `86400000` appears nowhere else in the app.

## 3. The stray top-left gear - already fixed, NOT yet deployed

Re-verified on the current working tree: no `#appSettingsLaunch` in the DOM, 7
gears wired as `.as-opener`, and a sweep of every `position: fixed` element
within 80px of the top-left corner returns EMPTY. The closed panel is
`visibility: hidden; pointer-events: none`.

The screenshot still shows it because none of this is deployed. Everything from
`2026-08-11b` onward is on disk only.

## Gates

- `node --check`: student-assignments.js, app-settings.js, skills/reading.js,
  skills/listening.js - pass
- `theme-sanity.js` PASS, `ui-sanity.js` PASS, `bump.js --check` OK
- em-dash scan on added lines: 0 (pre-existing ones in student-assignments.js
  L49/526/837/1072 and styles.css L13-16 left alone)
- styles.css v6, student-assignments.js v7; service worker v188
