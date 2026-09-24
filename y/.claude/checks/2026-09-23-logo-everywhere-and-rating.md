# 2026-09-23 (night) - logo on the teacher dashboard and on phones; "Rate Lingualab"

He said: "deployed, add the logo to teacher dashboard too sure and for phone
aligned!" and, of the not-built list, "1. go" (app rating and feedback).

## The deploy had not landed

Checked live before building on it. Hosting still served v435 (Last-Modified
12:06 UTC, X-Cache MISS - fresh from origin, so not a CDN copy) against v439 on
disk; the active Firestore ruleset was created 11:59 UTC and differs from the
file on disk. None of the .claude/worktrees copies holds the app, so it was not
a deploy from the wrong tree - the deploy after 15:06 Istanbul simply did not
reach Firebase. Everything is on disk; one deploy publishes it all.

## The logo - floated, at every width, on both dashboards

`js/org-brand.js` now PLACES the seal instead of giving it a flex slot. It
collects everything on the seal's line - the title TEXT and subtitle TEXT (not
their block boxes, which run to the edge), any back button, the avatar, the
teacher header's small Lingualab brand and period dropdown - and computes the
free gaps between them. It goes at the true centre of the header when that is
free, otherwise in the gap straight after the title, otherwise the widest gap;
where no gap fits it is hidden (`.no-room`) rather than laid over anything.

- Level: with the avatar when it shares the title's line (student), with the
  title otherwise and always on the teacher dashboard (`data-org-level="title"`,
  its neighbour is a dropdown).
- Size: 26px under 480px, 30px under 720px, 34px above (its old laptop size).
- Re-placed on resize, on a header's ResizeObserver (a hidden screen being shown)
  and on a MutationObserver on the title (the teacher dashboard rewrites it on
  every tab switch). setTimeout, not rAF.
- Teacher dashboard: `.t2-org-mark` in `.t2-page-header` (now position:relative),
  `js/org-brand.js` loaded after the registry; the user document is read from
  config.js's top-level `let currentUserData` (never a window property).
- An allowed FSM domain whose row is missing from the list still gets the seal.

Two earlier measurements were WRONG and are corrected here:
- "dead centre on a laptop" was measured against the logo's own box. Against
  the header it was 19px right of centre and 8px above the avatar. Now 1px.
- The first placer only looked right of the title; on the teacher dashboard's
  non-Overview tabs the title sits at the FAR RIGHT (space-between with the
  dropdown hidden), and the seal touched the subtitle. Replaced with the
  free-interval placer above.

Measured (emulator, real sign-in, `LLOrgBrand.place()` called before each read
because the preview pane never renders and so never delivers resize/observer
events):
- student, 7 screens x 375 and 414, plus hub at 360/700/1024/1366: shown, level
  within 1px, touching nothing (title, subtitle, avatar, back button); header
  height and title width IDENTICAL with and without the seal (84/84, 162/162)
- 320px (first iPhone SE): hidden, no room - by design
- teacher, 5 tabs x 1366 / 375 / 360: shown, level with the title within 1px,
  touching nothing; true centre on every tab except Overview, where the greeting
  holds the centre and the seal sits between it and the dropdown

## "Rate Lingualab" (not-built item #1)

- `js/app-rating.js` - one form for both sides. Stars 1-5 (44-48px tap targets),
  "what helps you most" chips (8 for students, 6 for teachers, different
  question for teachers), optional comment (1000). One rating per person at
  appFeedback/{uid}; reopening shows the previous answer and "Update my
  rating". Says on the form that only the admin sees it. No form for demo
  accounts.
- Students: a row in the profile menu (loaded before profile-hub.js on the four
  hub pages so the first render offers it). Teachers: sidebar item with a new
  star icon, hidden until the account is known and for demo accounts; the phone
  bar lists it under More automatically.
- `teacher/js/feedback-admin.js` + `teacher/css/feedback.css` - Admin >
  Feedback: average, 5-1 breakdown, students vs teachers, most-valued chips, every
  rating with who wrote it; filters by role, stars, "only with a comment". Read on
  demand. No export (exports live in Admin > Reports only).
- Rules: owner writes only as themselves (uid, token email, REAL role from the
  users doc), whole 1-5 stars, chips from a fixed list, bounded strings,
  hasOnly keys, updatedAt = server time, createdAt kept on update; read by owner
  and admin only; demo refused.

Verified end to end on the emulators: student rated from the profile menu on a
414px phone (Send disabled until a star; "Very good"; thank-you; reopening
prefilled and offered Update); teacher rated from the phone More sheet with the
teacher chips; admin saw 4.5 from 2, students 4.0 / teachers 5.0, valued chips
counted, role and star filters correct.

## Gate hygiene

`teacher-whitelist-check.js` overwrote `settings/organizations` with no list and
deleted `settings/teacherEmails` - which is what emptied the emulator's
organisation rows and made the logo vanish in testing. It now snapshots,
merges and restores; proven with a before/after read and still 14/14.

## Checks

- NEW `y/tools/app-feedback-check.js`: 24/24 (2 static: the chip lists in
  app-rating.js and the rules agree; 22 emulator). Negative-tested: without the
  role check exactly "a student cannot pose as a teacher" fails.
- `y/tools/harness/org-brand.html`: 12/12.
- `node --check` all JS clean; em-dash scan clean; `gates.js` 32 passed, 0
  failed, 1 skipped (rules-live, --prod); `bump.js --check` clean.

## Deploy (his) - BOTH, from E:\vocab-trainer

`firebase deploy --only firestore:rules` (demo exclusion, sender check, and the
new appFeedback block) and the hosting deploy.

## Later: his deploy landed, and the review's three rating bugs

Deploy verified live at 16:14 UTC: hosting v445 with org-brand.js,
app-rating.js, feedback-admin.js and messages-admin.js byte-identical to disk;
the active ruleset (created 16:13:44 UTC, 73116 bytes) equals firestore.rules and
rules-live-check passes.

The independent review (rating lens; the logo lens hit his usage limit and was
re-run) confirmed three defects in js/app-rating.js, each with a skeptic who
failed to refute it. All fixed and each proven on the emulators:

1. HIGH - rating could never be saved on courses.html, policy-course.html or
   placement.html. Those pages load neither student/js/auth.js nor
   teacher/js/config.js, so no page variable holds the user's document and
   save() always said "You are not signed in". The walkthrough had only used the
   student dashboard. Fix: open() reads users/{uid} itself when the page has no
   copy (one read, only there); a demo account found that way is still refused.
   Proven: rated from courses.html with window.currentStudentData absent - saved.
2. MEDIUM - a re-rating after a failed first read, or from a second tab, sent a
   create with a new createdAt onto an existing document and the rules refused
   every retry. Fix: create-or-update decided inside a transaction from the
   document as it is now. Proven: form opened with no rating, "another tab"
   created one, the form's save UPDATED it (5 stars) and kept the original
   createdAt.
3. LOW - Escape closed the profile panel underneath the rating form. Fix: the
   form's Escape handler is on window, capture phase, and consumes the event.
   Proven: first Escape closes the form only, second closes the panel.

app-rating.js v2; CACHE_VERSION v446. Gates 32/32, app-feedback-check 24/24,
node --check clean, em-dash clean, bump --check clean. Needs his hosting
deploy (no rules change).
