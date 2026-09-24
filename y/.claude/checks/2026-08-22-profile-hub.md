# 2026-08-22 - the avatar picture becomes the way into everything

Agreed before starting: scope (c), display settings open ON TOP, achievements
and the avatar chooser also become their own pop-ups with an X, and the gear and
Logout stop being header items and live under the picture.

## What shipped

`js/profile-hub.js` - one self-injecting module on all 13 pages a signed-in
student can be looking at. Clicking the avatar opens a panel with: choose
avatar, your achievements, display settings, save profile, change password,
Teacher Dashboard (teachers only) and log out. Each sub-popup opens on top with
its own X, and Esc closes only the topmost layer.

The badge subtitle is now the module and class instead of `Level 1 - 34 XP`.

### Why one module and not thirteen copies

The profile modal was ~140 lines inside `student-dashboard.html`. Copying it to
twelve more pages would have produced thirteen versions that drift. The module
injects the markup, so the pages match by construction.

The inline modal had to be **deleted**, not just left unused: it declares
`#previewName` and `#avatarGrid`, and the module injects those same ids.
Duplicates would have broken `student/js/avatar.js`, which binds to them by id
and by class. Those names are kept deliberately for the same reason.

### Cost

Zero extra Firestore reads on a normal load. The profile is cached in
`localStorage` (`ll-profile`) and painted from it immediately; Firestore is read
only when the cache is missing. Without that, twelve pages would have meant
twelve extra reads per student per session.

### The seven headers

The dashboard has seven `.header-right` blocks, one per screen. Each lost its
gear, its profile badge and its Logout button and gained a mount point. The
module builds one badge **per mount**, not one per page, or six screens would
have had no way in.

`student/js/teacher-return.js` is no longer loaded: the panel carries the
Teacher Dashboard row, so the header button it injected is redundant.

`writing-exam.html` turned out to have a gear carrying
`data-app-settings-open` while never loading `js/app-settings.js` - the button
was dead. It now loads the script, and its gear was removed like the others.

## Two bugs found by the harness, both mine

**The panel wired its listeners on every open.** `buildPanel()` is called by
boot AND by every click on the avatar. `makeOverlay()` returns the existing
element, but the click listener was attached again each time, so Display fired
`AppSettings.open()` twice, then three times. Now built once.

**The checker passed on a dashboard with no module.** This is the important one.

`tools/profile-hub-check.js` originally tested for the string
`js/profile-hub.js` anywhere in the file. The dashboard has *comments*
mentioning the module, so it matched - while the actual `<script>` tag was
never inserted at all. The wiring script fell into the identical trap: its
"already wired?" guard tested the same way, and matched a comment the script
itself had written moments earlier, so it silently skipped the insert.

So the one page this entire change is about would have shipped without the
module, and the check would have said PASS.

Both now require a real `<script src=...>` tag, and the check additionally
fails an unversioned tag, since that would never cache-bust. Control-tested
both ways: a comment-only mention fails, and a tag without `?v=` fails.

## Verification

| | result |
| --- | --- |
| `tools/demos/profile-hub-trace.html` | **36 / 36** |
| `tools/profile-hub-check.js` | **PASS**, all 13 pages |
| control: page missing the script | FAILS correctly |
| control: comment-only mention | FAILS correctly |
| control: tag without `?v=` | FAILS correctly |

The harness covers: a badge in every mount point; module-and-class subtitle with
no XP anywhere; floating fallback for pages with no header; all seven panel
rows; Display opening the shared panel exactly once and leaving the panel open
underneath; the avatar chooser on top with its own X, all 16 avatars, the
current one selected, locked ones locked; Esc closing only the top layer;
achievements on top; logout reusing the page's own dialog where one exists;
change password hiding where the page cannot do it; the teacher row hidden for a
student and linked for a teacher; and the old floating wheel suppressed.

### A harness bug worth recording

Three checks asserted on computed `visibility`. `.modal-overlay` transitions
visibility over 0.3s and this preview pane does not composite reliably, so a
correctly closed layer still reported `visible` and read as a failure. A direct
probe proved the close worked. The checks assert on the `.active` class now -
the state that open/close actually toggles - rather than a transitioning
presentational value.

## Orphaned references, checked not assumed

Removing the inline modal left four ids referenced in JS with no element:

- `auth.js:113` `studentInfoChips` - guarded and inside try/catch. Safe. Now
  dead code; the class and module it used to show are on the badge instead.
- `avatar.js:65-66` `avatarPreview` / `avatarPreviewEmoji` - guarded with
  `if (preview)`. Safe.
- `progress.js:361` `avatarPreview` - unguarded, but inside a commented-out
  block. Dead.
- `avatar.js` `avatarGrid` - binds at DOMContentLoaded, and the module only
  creates that grid when the chooser opens, so the binding no longer happens.
  Selection still works: the module calls `window.selectAvatar()` directly,
  which is the same function, including its Firestore write.

## Ritual

- `node --check` profile-hub.js, profile-hub-check.js - ok
- em-dash scan across the module and all 13 pages - clean
- profile-hub-check / inline-css-check / anim-cost-check / tile-art-check - PASS
- `bump.js js/profile-hub.js` - v2 on all 13, CACHE_VERSION v301 -> **v302**
- `bump.js --check` - OK

## Not done

Change password only appears where `window.openChangePassword` exists, which
today is the dashboard: `student/js/set-password.js` needs Firebase globals and
its `.sp-*` styles from `student/css/extra.css`, neither of which the other
twelve pages have. The row hides itself rather than failing. Extending it is a
separate, self-contained piece of work.

---

## Round 2 - seven defects reported from the live page

### 1. The teacher row was visible to students. The promise was broken.

`.ph-row` sets `display:flex`. That is an AUTHOR rule, and it beats the
browser's own `[hidden]{display:none}`, so `row.hidden = true` did nothing at
all and the Teacher Dashboard row rendered for every student.

Proved rather than assumed:

```
el.hidden -> true          computed display -> flex        on screen -> true
```

**And the harness passed on it**, because it asserted `rowBtn(d,'teacher').hidden`
- the property, which really was `true` - instead of what rendered. A false pass
on the single thing that was promised most explicitly.

Fixed at the root: rows are BUILT from the current profile, so a row that does
not apply is not in the document. `.ph-row[hidden]{display:none !important}`
is the belt to that braces. The harness now asserts the element does not exist,
that no `a[href*="teacher-dashboard"]` exists, and that the panel text never
contains "teacher". Control-tested: the old assertion PASSES on a row that is
plainly on screen, the new one fails it.

The same bug hid the Change password row's condition, so that row also showed
on pages that cannot change a password.

### 2. The panel looked blurry with barely visible edges

`.ll-dialog` in brand.css carries shape and motion only - colour belongs to each
dialog, deliberately. The new panel never got one, so it had NO background and
the blurred page showed straight through it. Now has a solid background, border
and shadow.

### 3. Clicking an avatar did nothing

Selection was delegated entirely to `avatar.js` when that file was present. That
file writes to several dashboard elements this change removed, so it threw, and
nothing was selected. The module now performs the selection itself first and
only then hands off to `avatar.js` for persistence, inside a try/catch, with a
direct Firestore write as the fallback.

### 4. Level, XP, module, class and year had vanished

The first version of the panel showed only the name, which lost information the
old modal had. All of it is back: an XP bar with `Level n - n XP`, and chips for
class, level, module and year. Also fixed the field mapping - the roster writes
`academicYear`, not `year`, so that chip could never have appeared.

### 5. "Save profile" removed

Choosing an avatar saves immediately and the password has its own flow, so the
button had nothing to save - and its toast rendered behind the panel. Gone,
along with the now-unreachable toast helper.

### 6. A stray gear reappeared beside the Lingualab title

Hiding `#appSettingsLaunch` was not enough: with no opener on the page,
`app-settings.js` builds a launcher AND calls `placeInHeader()`, which moves it
into the page header where an id-based hide is beside the point. The module now
injects a hidden `[data-app-settings-open][data-app-settings-plain]` at PARSE
time, before app-settings mounts, so it builds nothing at all.

### 7. Achievements were all locked with nothing explained

The unlock states were hardcoded to false and never consulted the numbers. They
now read `journeyStats` and `bestStreak` and show progress toward each one
("3 / 10"), with the locked state legible rather than nearly transparent.

## Still open

"Access denied brings you back to vocabulary" is `teacher-dashboard.html`'s own
behaviour for a non-teacher plus the dashboard's hash routing. Students can no
longer reach that link at all now, so it is far less reachable, but the redirect
target is still odd. Not fixed in this pass.

## Verification

`tools/demos/profile-hub-trace.html` - **47 / 47**, including the new checks for
row absence, a solid panel background, the identity chips, real avatar
selection, and the hidden settings opener.

`tools/profile-hub-check.js` - PASS, 13 / 13.

Bump: profile-hub.js v3 on all **13** pages (12 last round - the dashboard's
missing tag is fixed), CACHE_VERSION v302 -> **v303**.

---

## Round 3 - scope corrected, badge anchored

Reported: the badge floats instead of sitting still; classroom should keep the
WHEEL and not get the profile, while placement and courses should get the
profile; the Teacher Dashboard row is a different size and shade; and issue 6.

### Scope, as it should have been

| | gets |
| --- | --- |
| dashboard, courses, placement, policy-course | the PROFILE, no wheel |
| the 8 classroom student games | the WHEEL, no profile |
| writing-exam | its OWN settings, neither (see below) |

Eight classroom pages had the module removed and keep their wheel.

### The badge floated because it had nowhere to go

`mountBadge()` falls back to `position:fixed` top-right when a page offers no
`[data-profile-hub-mount]`. Only the dashboard had mounts, so on every other
page it pinned itself over the corner. Each profile page now names its slot:

```
courses.html        .pc-header-right
policy-course.html  .pc-header-right
placement.html      .ll-header-end
```

The checker FAILS a profile page with no mount now, so floating can no longer
reach production quietly. Control-tested.

### The Teacher Dashboard row was a different size

That row is an `<a>`; the rest are `<button>`s, and the two disagree by default
on box model, font and margin. Pinned `box-sizing`, `width`, `margin`,
`font-family`, `font-size`, `line-height` and `appearance` on `.ph-row`. The
harness now measures every row and asserts width, height, padding, font size
and radius are identical, with both element types present.

### writing-exam reverted, and why

Adding the hub there was wrong and I broke the page doing it.

`student/js/writing-exam.js:793` binds `#wrSettingsBtn` by id to open the
page's OWN settings panel (theme, text size, spacing, editor font). That button
also carried `data-app-settings-open`, which was spurious - the shared script
was never loaded on that page, so the attribute did nothing and only made the
button look shared. I read the attribute, removed the button, and added
app-settings: that would have thrown a TypeError on a null element and orphaned
the exam's settings entirely.

Reverted: the button is back without the spurious attribute, the shared
app-settings assets are removed again, and the hub is off that page. Offering
Log out in the middle of a timed exam was not a good idea either. It is in
EXCLUDED with that reasoning written down.

### Issue 6 fixed

`teacher-dashboard.html` Access Denied linked to
`student-dashboard.html#vocabulary`, deep-linking whoever landed there into one
exercise. Now the hub root. The identical mistake had already been fixed once on
the sidebar's Lingualab row.

### Verification

- `tools/demos/profile-hub-trace.html` - **53 / 53**
- `tools/profile-hub-check.js` - PASS, 4 profile + 8 classroom
- control: profile page with no mount - FAILS correctly
- control: profile put back on a classroom page - FAILS correctly
- writing-exam: own gear and own panel both present, no orphaned bind

A harness bug on the way: the teacher block destructured `{ f, d }` without `w`,
so the new geometry checks threw `w is not defined` and the run hung with zero
rows rendered rather than reporting a failure. Found in the console.

Bump: profile-hub.js v5 on **4** pages, CACHE_VERSION v303 -> **v305**.

---

## Round 4 - stacking, phone header, wording, and a replica gate

### Log out opened UNDERNEATH the profile panel

The page's logout modal is an ordinary `.modal-overlay` at z-index 1000, while
these panels sit at 10000 and up, so the confirm appeared behind the thing that
launched it. `logout()` now closes every profile layer first, which is also the
right behaviour on its own: the panel's job is done the moment Log out is
chosen.

### The badge wrapped under the title on a phone

The header had no room for the name and the module line, so the badge dropped to
a second row. Below 620px it now collapses to the picture alone - the part that
is actually the button - and the mount holds the right-hand edge with
`margin-left:auto`. The name is in the panel it opens.

Measured at 390px: 42px wide, on the title's row, hugging the right edge, on all
four pages.

### Wording, app-wide

Fixed rule: **Leave / Stay** for leaving a screen, **Log out / Stay** for leaving
the app. Never "Cancel", never "Yes, Logout".

| where | was | now |
| --- | --- | --- |
| student logout modal | Cancel / Yes, Logout | Stay / Log out |
| teacher logout modal | Cancel / Yes, Logout | Stay / Log out |
| placement.js | Stay / Exit | Stay / Leave |
| listening exam, reading exam, courses, profile panel | already correct | unchanged |

`student/js/writing-exam.js:655` still passes no `cancelLabel`, so its leave
dialog says "Cancel". Left alone deliberately - that page was marked do not
touch. It is the one place not on the rule.

### The replica gate

`tools/demos/profile-replica-trace.html` - **20 / 20**. This is the answer to
"the margins and boxing are still not the same". Each page loads a DIFFERENT set
of stylesheets, so the dashboard proves nothing about courses or placement. The
harness renders the badge and the panel under each page's own sheets and
compares the measurements:

```
student-dashboard   badge h 50  pic 38x38  panel 420px  rows 4 @42px  phone w 42
courses             badge h 50  pic 38x38  panel 420px  rows 4 @42px  phone w 42
placement           badge h 50  pic 38x38  panel 420px  rows 4 @42px  phone w 42
policy-course       badge h 50  pic 38x38  panel 420px  rows 4 @42px  phone w 42
```

It checks badge height, padding, radius, border, picture size and roundness;
panel width, padding, radius and opacity; row count, height, padding and radius
BOTH across pages and between siblings within a page; that no page falls back to
a floating badge; and the four phone properties.

A harness bug on the way: it read `[data-ph-name]` to decide whether the badge
had collapsed, but the media query hides the WRAPPER, and a hidden parent does
not change a child's computed display. It said "still showing" while the badge
had plainly collapsed to 42px. Reads `.ph-badge-txt` now.

### Memory

Saved `profile-header-replica-rule`: a new student page wires the module and a
mount, never hand-builds the header, is added to the checker's page list, and
must pass both gates. Includes the two families and the wording rule.

### Ritual

- `node --check` profile-hub.js, placement.js - ok
- em-dash scan - clean
- profile-hub-check / inline-css-check / anim-cost-check / tile-art-check - PASS
- behaviour harness 53 / 53, replica harness 20 / 20
- bump: profile-hub.js v6, placement.js v9, CACHE_VERSION v305 -> **v306**

---

## Round 5 - a regression I caused on the teacher writing form

### The gear ate a tab

The writing form's second tab is

```html
<button onclick="switchWritingTab('settings', this)">② Settings &amp; Rubric</button>
```

`styleAllGears()` in app-settings.js swept every `button, a` and treated
anything whose **onclick** matched `/settings/i` as a gear. So it replaced that
tab's label with a cog and squeezed it to 44x44.

It only appeared now because that sweep had never run on the teacher dashboard:
the page carried `data-app-settings="off"` until I removed it to add the Display
row. My change did not create the greedy match, it exposed it.

Tightened: the accessible NAME must BE "settings" or "display settings", not
merely contain the word, and the onclick is only consulted for the specific
`openSettingsModal`. The `⚙` glyph and `.header-icon-btn` signals are unchanged.

Regression test added to `teacher-display-gear-trace.html`: a tab that only
mentions settings keeps its label, gets no cog and is not resized, while a
button genuinely titled "Settings" is still treated as a gear so the rule has
not over-corrected. **21 / 21.**

### The second pop-up went almost black

Each `.modal-overlay` dims the page by 70%, and they compound: a pop-up over the
panel left the screen at 91% black, a third would reach 97%. Sub-layers now use
a light tint and drop their own blur, since the panel underneath is already
dimming the page.

Named `ph-sublayer`, NOT `ph-sub` - that class already exists for the panel's
subtitle text and carries `opacity: .75`, which would have made the overlays
themselves translucent.

### The calendar button was invisible

The Deadline field is a bare `<input type="date">`. The browser draws its picker
as a small low-contrast glyph, which on a white card is close to invisible.
Styled in brand.css so every date, datetime, month and time input in the app
gets a findable button, with the glyph inverted on non-light surfaces. Firefox
has no such pseudo-element and shows its own control; noted in the CSS so nobody
hunts for why it is webkit-only.

### writing-exam

Already fixed in v306. The error in the screenshot -
`Cannot read properties of null (reading 'addEventListener')` - is
`student/js/writing-exam.js:793` binding `#wrSettingsBtn`, the button I had
deleted in v302. It was restored last round, along with removing the hub from
that page. The floating badge in the same screenshot is from the same old build.
Confirmed on disk: `profile-hub` count 0, `wrSettingsBtn` count 1.

### Verification

- `teacher-display-gear-trace.html` 21 / 21
- `profile-hub-trace.html` 53 / 53
- `profile-replica-trace.html` 20 / 20
- profile-hub-check / inline-css-check / anim-cost-check - PASS

Bump: app-settings.js v34 (30 pages), profile-hub.js v7, brand.css v25 (26
pages), CACHE_VERSION v306 -> **v307**.

Blast radius worth noting: the gear-detection change touches all 30 pages that
load app-settings. It is strictly narrower than before, so the risk is a gear
that USED to be styled no longer being recognised. Anything relying on a bare
"settings" substring in an onclick would need `data-app-settings-open` adding.

---

## Round 6

| # | reported | fixed |
| --- | --- | --- |
| 1 | assignment skill cards barely visible | tiles were hardcoded `rgba(255,255,255,.04)` fill and `.1` border - dark-theme literals inline - so on the white dashboard they had no fill and no edge. Tokenised, plus a soft shadow |
| 2 | calendar invisible everywhere | already fixed app-wide in v307 (brand.css), undeployed when reported |
| 3 | preview wheel not clickable | see below - it was dead on writing-exam, now works |
| 4 | Stay killed the profile panel | logout closes the panel so the confirm is not underneath it, and now reopens it if the student stays |
| 5 | 4 avatars locked with no explanation | each locked tile shows its XP threshold, has a title, and clicking one explains instead of doing nothing |
| 6 | writing exam "Back to dashboard" went to #writing | now the hub root |
| 7 | two Close buttons in grading | footer Close removed; the header "✕ Close" is the conventional one |
| 8 | name printed twice beside the badge | `#crsStudentChip` / `#pcStudentChip` hidden; still written to by id, so nothing breaks |
| 9 | change password | confirmed: dashboard only, by design. Recorded in the memory |
| 10 | classroom wheel should be top right | `placeInHeader()` now appends the wheel, so it lands at the right edge; 36px below 620px |

### The writing exam gear, resolved properly

I had this wrong twice. `student/css/writing-exam.css` says outright that the
page's own drawer is **retired** - `#wrSettingsPanel { display: none !important }`
- and its gear is meant to open the SHARED panel. But `js/app-settings.js` was
never loaded on that page, so the button had nothing to open and did nothing.

Round 3 I added app-settings and removed the button, which broke the id bind in
`writing-exam.js:793`. Round 4 I reverted the wrong half, taking app-settings
back out and leaving the gear dead again.

Correct state now: the button keeps BOTH its id (so the bind works, harmlessly
toggling a hidden drawer) and `data-app-settings-open`, and the page loads
app-settings. The gear works for the first time.

### Memory updated

`profile-header-replica-rule` now records the classroom wheel position and its
phone size, hiding a page's existing name chip, and why change password is
dashboard-only.

### Verification

- `profile-hub-trace.html` 53 / 53
- `teacher-display-gear-trace.html` 21 / 21
- profile-hub-check / inline-css-check / anim-cost-check / tile-art-check - PASS
- `node --check` on all four changed JS files - ok, em-dash scan clean

Bump: app-settings.js v36 (**31** pages, writing-exam joins), app-settings.css
v52 (30), profile-hub.js v8, teacher-assignments.js v2,
writing-submissions-view.js v2, writing-exam.css v9,
CACHE_VERSION v307 -> **v308**.

---

## Round 7

### The calendar icon - my previous fix made it worse

Round 5 set opacity on the native glyph and then inverted it under
`body:not(.light-mode)`. Probed the actual condition:

```
bodyHasLightMode : false      wouldInvert : true
```

The teacher dashboard is visually white but carries no `.light-mode` class, so
that rule inverted a dark glyph to **white on white**. It was not that the fix
did not take; it took, and hid the icon further.

"Light" is expressed at least three ways across this app, so detecting it by
class is not something to build on. We supply a `background-image` instead,
which replaces the browser's glyph outright: a brand-blue calendar that reads on
white cards and dark navy alike, with no theme detection at all.

Verified from the CSSOM: the rule parses, the data URI is 377 chars and decodes
to real `<svg>`, and the old invert rule is gone. Not verified as PIXELS - this
preview pane does not composite, and a pseudo-element's computed style is not
readable here either (`getComputedStyle(el, '::-webkit-calendar-picker-indicator')`
returns the element's own style, which is how the first probe reported a 320px
wide indicator).

### Grading panel stayed open after saving

`saveGrading()` set a success label and stopped. With the duplicate footer Close
removed last round, that left the only exit as the header X, on every essay. It
now closes 900ms after saving, long enough to read the status-aware label, which
is the only confirmation there is.

### Coming back landed mid-page

Every screen lives in ONE document and is shown by toggling a class, so the
window keeps the previous screen's scroll offset. Open a skill from halfway down
the hub, come back, and the header is off-screen - which reads as the header
having moved rather than the page being scrolled.

`showScreen()` now returns to the top. `auto`, not `smooth`: this is a screen
change, not a scroll, and animating it means the new screen visibly slides past
on every navigation.

Measured: scrolled to 1200, switched screens, back to 0 with the header in view.

### Ritual

- `node --check` ui.js, writing-submissions-view.js - ok
- em-dash scan - clean
- profile-hub-check / inline-css-check / anim-cost-check - PASS
- bump: brand.css v26 (26 pages), ui.js v2, writing-submissions-view.js v3,
  CACHE_VERSION v308 -> **v309**

---

## Round 8

### 4. The Lingualab lockup vanished from courses and placement - my doing

`addBrand()` had exactly one caller: `placeInHeader()`. And `placeInHeader()`
only runs when a page has NO `[data-app-settings-open]`.

The profile hub started injecting a hidden opener, so those pages stopped
qualifying, `placeInHeader()` stopped running, and the lockup went with it. It
was never a decision; the brand was riding along inside the wheel's placement
routine and I did not notice it was coupled.

`mount()` now adds the brand on the opener path too. Safe on the student
dashboard: it has no `<header>` element at all, so `pageHeader()` returns null
and nothing happens, and `addBrand()` bails anyway if a `.ll-brand` exists.

Verified: brand present on both a classroom-style and a placement-style header.

### 1. Placement profile was not top right

The mount was nested inside `.ll-header-end`, the trailing spacer. Its
`margin-left:auto` only pushed it within that spacer, which is no wider than its
own contents, so the badge sat beside the title. It is a direct child of the
header now.

Measured: 22px from the header's right edge, not floating, name "Alireza".

### 2. Classroom alignment

Round 6 appended the wheel to the end of the HEADER. The header's last child is
what `.as-hosthdr > *:last-child` gives `margin-left:auto` to, so the wheel took
that margin and the name-and-Logout cluster lost it, sliding left against the
title.

The wheel now goes into the actions CONTAINER
(`.header-actions` / `.ll-header-end` / `.cor-header-actions`, else whatever
holds Logout), so the cluster keeps its own right alignment and the wheel joins
it.

Measured with the classroom stylesheet loaded: header is flex, wheel inside
`.header-actions` and last within it, Logout to its left, 24px to the right
edge, everything on one row (4px spread).

The first attempt at this measurement loaded no classroom CSS, so the header was
not flex and the wheel read as 903px from the edge. That was the test being
wrong, not the code.

### 3. The phone showed "Student"

That is the placeholder name, shown when the profile never loaded. The module
POLLED for auth every 150ms and gave up after six seconds - survivable on a warm
desktop, not on a phone restoring a session over mobile data.

It now waits for `onAuthStateChanged` instead of polling for a user, and only
polls for the SDK itself to parse, which is a local script rather than a network
round trip.

### Verification

- `profile-hub-trace.html` 53 / 53
- `profile-replica-trace.html` 20 / 20
- profile-hub-check / inline-css-check / anim-cost-check - PASS

Bump: app-settings.js, profile-hub.js, CACHE_VERSION -> see below.

---

## Round 9

### Student dashboard profile on mobile - two causes, both found

Reported repeatedly. There were two independent reasons, which is why one fix
never settled it:

1. `student/css/styles.css` set `.dashboard-header { flex-direction: column }`
   at 600px. Stacked, the header has no "top right" to be at.
2. `student/css/extra.css` set `.header-left { width: 100% }` at 768px in a
   `flex-wrap: wrap` header. A full-width left block pushes `.header-right`
   onto a second line regardless of anything else.

Now a row, with `flex: 1 1 0; min-width: 0` on the left. Measured at 1280 / 700
/ 480 / 390: same row as the title, never below it, flush right, collapsing to
the picture alone at 480 and below.

Written into the `profile-header-replica-rule` memory with BOTH causes and the
third one from earlier (a mount nested in a wrapper), since this is the thing
that keeps coming back.

### Avatar pop-up scrolling

Two causes again. The list had no `overscroll-behavior`, so reaching its end
handed the remaining wheel movement to the page - scroll chaining, which is what
made the pointer feel like it controlled whichever it fancied. And the page
behind was scrollable throughout.

`overscroll-behavior: contain` on the list, plus `body.ph-locked` while any
layer is open, released on close. Verified: overflow-y auto, overscroll
contain, body hidden while open, visible again after.

### Meta row on the assignment cards

The skill chip pairs an emoji with mono text, which have different intrinsic
line boxes, so the words sat visibly above the icon. Line-height and alignment
pinned on both parts.

The row was `flex-wrap: wrap`, so a long activity name dropped it to a second
line. It is `nowrap` now, and only the free-text part gives way - it truncates
with an ellipsis while chips, dots and the time keep their size. Below 560px the
whole row steps down a size rather than wrapping.

### Courses header band

`.light-mode .pc-header` was `rgba(255,255,255,0.85)` with a sticky
`backdrop-filter: blur(8px)`. Translucent over the page's own tint, it read as a
slightly wrong shade across the top. Solid white now, and the blur is dropped -
it was also re-rendering on every scroll frame for a band nobody wanted.

### Last dialog off the wording rule

`student/js/writing-exam.js` passed no `cancelLabel`, so its leave dialog said
"Cancel" - which reads as cancelling the exam rather than cancelling the
leaving. Now Leave / Stay like everything else.

### Verification

- `profile-replica-trace.html` 20 / 20
- profile-hub-check / inline-css-check / anim-cost-check - PASS
- em-dash scan clean, `node --check` on writing-exam.js ok

Bump: styles.css v40, extra.css v34, assignments.css v16, policy-course.css v15,
writing-exam.js v3, CACHE_VERSION v312 -> **v313**.
