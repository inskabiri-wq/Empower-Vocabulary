# 2026-06-16 - Admin theme + video embed + thorough report + widget placement

Four fixes in one pass, plus sanity + smoke.

## 1. Video does not show in the mini course (CSP)
Root cause: the `Content-Security-Policy` in `firebase.json` had
`frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com`
- YouTube was never allowed, so the lesson iframe was blocked by the browser
("This content is blocked. Contact the site owner to fix the issue.").
Fix: added `https://www.youtube-nocookie.com https://www.youtube.com` to `frame-src`.
NOTE: this is a hosting header - it only takes effect after
`firebase deploy --only hosting`.

## 2. Admin tab style/theme/font
Finding: the whole teacher dashboard was forced to the bare system font
`Segoe UI` via `body.t2-active`, even though the brand font **DM Sans** is
already loaded on the page and is what `teacher/css/styles.css` sets for `body`.
So the dashboard (Admin included) never used the brand font.
Changes:
- `teacher/css/dashboard-v2.css` `body.t2-active` font -> `'DM Sans', 'Segoe UI', system-ui, ...`.
- `teacher-dashboard.html`: the 4 hard-coded `'Segoe UI'` declarations
  (`.av-root` + the 3 admin sub-panels) -> `'DM Sans', 'Segoe UI', system-ui, sans-serif`.
- Admin sub-panel headers (Features / Content / Organizations) bumped from
  17px/-0.4px to 20px/-0.5px to match the Teachers panel `.av-title`, so the
  four admin sub-views share one heading scale.
- Space Grotesk number accents + JetBrains Mono code inputs kept as-is.

## 3. Per-student report - thorough
`teacher/js/student-detail.js` `printStudentReport()` rebuilt to include
everything available on the profile:
- 4 quick stats (added Assignments done X/Y).
- Per-skill breakdown now has a **Best** column (computed from sessions).
- Assignments table gains a **Skill** column + full dates.
- New **Recent sessions** table (latest 25 of N, date / activity / score).
- New **Answer review** appendix: every attempt (assignment completion or
  session) that captured itemised answers `{q,a,correct,ok}` is rendered as a
  per-question table with their answer vs the correct answer, page-break-safe.
- Removed the em dashes that were in the old report strings (now hyphen / middot).

## 4. Widget placement - above Empower Lab in the sidebar
Per "widget should go above empower lab sidebar section":
- `teacher-dashboard.html`: added a `#wtSidebarBtn` ("🧰 Widgets") nav item in
  the sidebar Account group, directly above the Empower Lab link.
- `js/widgets-tray.js`: build() now binds to `#wtSidebarBtn` when present (no
  more docked bottom-left launcher on the dashboard) and floats the popover
  next to the trigger - to the right of the sidebar item, clamped on-screen,
  repositioned on resize. Falls back to the docked launcher on other pages.

## 5. Admin expandable jumps the content margins
`teacher/css/dashboard-v2.css` `.t2-main` (the scroll container) gained
`scrollbar-gutter: stable`. Expanding an admin row used to make the scrollbar
appear, narrowing the column, which re-centered the `margin:0 auto` content and
shifted it sideways. Reserving the gutter removes the wobble (helps every tab).

## Versions
- `js/widgets-tray.js` ?v=1 -> **v2**; service worker **v52 -> v53** (busts the
  unversioned `dashboard-v2.css` + `student-detail.js`). `firebase.json` is a
  hosting config (served fresh, not SW-cached). HTML is network-first.

## Verification - sanity + smoke
- **Sanity:** `node --check` OK on widgets-tray.js, student-detail.js,
  service-worker.js; `firebase.json` parses as valid JSON.
- **Em-dash scan:** no em dashes in any code I added (new report region clean,
  my dashboard-v2.css comment clean). Remaining hits are pre-existing source
  comments not touched by this change.
- **Smoke (headless preview harness, deleted after):** widgets tray binds to
  the sidebar button, builds the popover, creates NO duplicate fixed launcher,
  opens on click, the Class Timer chip opens the timer overlay and closes the
  menu, timer FAB suppressed - 0 errors. Popover on-screen positioning verified
  by logic (preview reported innerWidth=1 so exact px float-right unmeasurable
  in this headless env; clamp + right-of-trigger math confirmed by review).
- Could not render the authed dashboard in preview (it redirects to the login
  page without a signed-in user), so the Admin tab visuals were reasoned from
  source rather than screenshotted.

## 6. Teacher walkthrough presentation
Built `y/teacher-onboarding.html` - a self-contained slide deck (no external JS,
one Google font link) for a training session. NOT an in-app tour.
- 15 slides: title, big picture, sidebar map, Overview, Students drill-down,
  Assignments (4 steps), Courses + certificate, Classroom mode, Widgets/timer,
  Admin Teachers, Admin Features, Admin Content controls, Admin Organizations,
  daily workflow, close.
- Navigation: arrow keys / PageUp-Down / Space, click left-right thirds,
  Home/End, on-screen Prev/Next, slide counter, progress bar.
- Print: `@media print` lays one slide per page (P key or the PDF button), so it
  doubles as a printable handout.
- Brand styled: DM Sans body, Space Grotesk headings, t2 dark palette.
- Smoke (preview): loads with 0 console errors; 15 slides; Next x3 -> 4/15,
  Prev -> 3/15, End -> 15/15, progress bar 100%; body font resolves to DM Sans,
  headings to Space Grotesk. Em-dash scan: clean.

## Not done
- No deploy (user runs `firebase deploy`; video fix needs `--only hosting`).
- No GitHub push.
- All queued items now complete.
