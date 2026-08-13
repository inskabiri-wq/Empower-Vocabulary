# 2026-07-27g - Writing lab showed the "not enabled" panel to people who ARE enabled

## Symptom
On the admin's own account the writing lab loads and works, but scrolling down
reveals the red-herring panel "Writing AI is not enabled for your account -
ask your administrator... akabiriaslifar@fsm.edu.tr" sitting underneath the
working tool. On a small screen that panel is the first thing you see, which is
how it looked like an access failure when it was not one.

## Cause - a CSS specificity trap, not an auth bug
`lingualab-write/js/auth-gate.js` is correct: the admin passes on the email
check, `deny()` never runs, and `#corGateDenied` keeps its `hidden` attribute.

But `hidden` only works through the browser's own low-specificity rule
`[hidden] { display: none }` (an attribute selector). corrector.css had:

```css
.cor-gate-denied { min-height: 100vh; display: flex; ... }
```

A class selector, same specificity, declared later - so it WINS, and the
element renders despite carrying `hidden`. The panel was therefore visible for
everyone who passed the gate. It was only ever hidden by luck.

`.cor-modal` in the same file already carried the guard
(`.cor-modal[hidden] { display: none; }`), so the release modal was fine - this
one rule had simply been missed.

## Fix
```css
.cor-gate-denied[hidden] { display: none; }
```
Specificity 0-2-0, beats the 0-1-0 base rule. Matches the convention already
used for `.cor-modal` in the same stylesheet.

## Also checked, and NOT affected
- `#corRelease` ("Release to student", meant to stay hidden): `.cor-btn` sets
  no `display`, so `[hidden]` applies normally. Genuinely hidden.
- `#corRubricHint`: `.cor-rubric-hint` sets no `display`. Fine.
- `#corReleaseModal`: already guarded. Fine.

## Verified
Real corrector.css loaded into a live page, real gate markup:
- `hidden` present (access granted): `display: none`, height **0px**.
- `hidden` removed (access genuinely denied): `display: flex`, height **910px**.
So the panel disappears for people with access and still does its job for
people without. ui-sanity PASS, grammar-sanity PASS, em-dash 0.
corrector.css ?v=6, SW v121.

## Ship
```
firebase deploy --only hosting
```

## Still outstanding from the same review (NOT done)
1. Make the Grammar / Reading / Listening / Writing / Speaking screens exact
   replicas of the Vocabulary header. They currently use `.skill-header`
   (back button + skill icon + name, wrapped in a card) while vocabulary uses
   `.dashboard-header` (Lingualab logo + subtitle). The gear / avatar / Logout
   trio is already identical; everything left of it is not.
2. Placement page: the "<- Exit" button overlaps the Placement Test card.

---

# Addendum - teacher dashboard had no Settings entry at all

## Why the teacher gear looked wrong
`grep` for a settings gear / settings modal in teacher-dashboard.html returns
**0 matches**. It never had one. So app-settings.js correctly fell back to its
floating launcher (bottom-RIGHT). The thing at bottom-LEFT is a different
feature entirely: `js/widgets-tray.js` (`.wt-launch{left:18px;bottom:18px}`),
the Class Timer launcher.

## Fix - the page provides its own opener
This dashboard uses a SIDEBAR, not a top bar with icons, so a floating gear
would have been a second inconsistent control. Added to app-settings.js:

any element marked `data-app-settings-open` becomes an opener; when one exists
the floating launcher is hidden and the page's own control drives the panel.

teacher-dashboard.html gets a "Display" row in its Account section (next to
Widgets / Lingualab / Classroom / Logout), which is where teachers already
look. Generic, so any page can adopt it with one attribute.

## Verified
- Floating launcher created but `display: none` when an opener is present.
- Sidebar row click opens the panel; Escape closes it.
- ui-sanity PASS, grammar-sanity PASS, node --check OK, em-dash 0.
- app-settings.js ?v=4, SW v122.

---

# Addendum 2 - avatar badges never synced (prerequisite for the header work)

## Bug
`updateAvatarDisplays()` in student/js/avatar.js looked up ONE element by id:

```js
const display = document.getElementById('avatarDisplay');
```

But the dashboard has THREE avatar badges:
  #avatarDisplayHub (hub)  #avatarDisplay (vocabulary)  #grAvatarDisplay (grammar)

Only the vocabulary one was ever updated. The hub badge and the grammar badge
kept the hardcoded fox forever, whatever avatar the student chose. This had to
be fixed BEFORE copying the header to four more screens, otherwise the bug
would have been duplicated four more times.

## Fix
Sweep by class instead of one id:

```js
document.querySelectorAll('.avatar-display').forEach(node => {
  node.style.background = av.color;
  const e = node.querySelector('.avatar-emoji');
  if (e) e.textContent = av.emoji;
});
```

Verified safe: `.avatar-display` appears exactly 3 times in the markup and the
avatar PICKER grid uses `.avatar-option`, so this cannot overwrite the choices
shown in the chooser. Every badge added later syncs with no code change.

node --check OK, ui-sanity PASS, grammar-sanity PASS.
avatar.js ?v=2, SW v123.

## NOT done - the header replica itself
Option A (Lingualab logo left, skill name in the subtitle) across the five
skill screens is still open. One detail to handle when doing it: the header
logo is an inline SVG whose gradient uses `id="capGrad"`. Copying it to five
more screens would create six duplicate ids in one document - each copy needs
its own gradient id (capGradGr, capGradRd, ...) or the markup is invalid.

---

# Addendum 3 - placement "Exit" button sat on the card

## Cause
`#plExitBtn` is `position: fixed; top: 14px` and is about 34px tall, so it
occupies roughly y=14 to y=51. `.pl-wrap` had `padding-top: 28px`, so the card
began at y=28 - UNDER the button. The button landed on the card's top-left
corner and its text, which is what the screenshot showed.

## Fix
`.pl-wrap` top padding 28px -> 64px, so the card clears the fixed button.
(Left as a single value rather than a media query: the button is fixed at the
same offset at every width, so the clearance needed is the same everywhere.)

## Verified in browser, both widths
| width | Exit bottom | card top | overlaps card | overlaps title |
|---|---|---|---|---|
| 994px | 51px | 64px | no | no |
| 375px | 51px | 64px | no | no |
13px of clear space below the button; no horizontal scroll at 375px.
ui-sanity PASS, grammar-sanity PASS. SW v124.

---

# Addendum 4 - profile NAME had the same id-only bug as the avatar

`updateAvatarDisplays()` also set the student's name through a single id:

```js
if (el('profileName')) el('profileName').textContent = name;
```

So the grammar screen's badge (#grProfileName) read a literal "Student" for
every signed-in user, exactly like its avatar read a literal fox. Swept by
class for the same reason:

```js
document.querySelectorAll('.profile-name').forEach(n => { n.textContent = name; });
```

Verified against the SERVED file: `.avatar-display` sweep present,
`.profile-name` sweep present, both old id lookups gone.
node --check OK, ui-sanity PASS. avatar.js ?v=3, SW v125.

## Remaining before the header rewrite
`.profile-level` still holds `Level <span id="profileXPLevel">` /
`<span id="profileXP">`, both still id-only. When the five headers are built
those two spans need classes (e.g. `.profile-lvl-n` / `.profile-xp-n`) and the
same sweep treatment, otherwise every new header would show a frozen
"Level 1 - 0 XP". That is the LAST trap; the avatar and the name are now safe.

---

# Addendum 5 - the header replica (option A) - DONE

All five skill screens now use the SAME header component as Vocabulary:
Lingualab logo + subtitle on the left, identical gear / avatar / Logout trio
on the right, back-to-Hub button in the same place.

| screen | subtitle |
|---|---|
| Listening | Listening - Exams & practice |
| Grammar   | Grammar - Practice by level |
| Reading   | Reading - Exams & practice |
| Writing   | Writing - Feedback & practice |
| Speaking  | Speaking - Practice aloud |

`.skill-header` blocks remaining: **0**.

## The two traps that had to be cleared first
1. **Duplicate SVG gradient ids.** The logo's gradient is `id="capGrad"`.
   Five more copies would have put six identical ids in one document. Each
   copy now has its own: capGradLs / capGradGr / capGradRd / capGradWr /
   capGradSp (alongside the existing capGrad and capGradHub).
2. **Frozen profile fields.** avatar / name / level / XP were all updated by
   single-id lookup, so any new badge would have shown a fox, "Student" and
   "Level 1 - 0 XP" forever. All four now sweep by class
   (`.avatar-display`, `.profile-name`, `.profile-lvl-n`, `.profile-xp-n`),
   so the five new badges are live. The ids stay on the old spans because
   progress.js addresses `profileXPLevel` with NO null guard - removing it
   would throw.

The new headers therefore carry classes only, no ids: nothing to duplicate.

## Verified (real DOM parse of the served page)
Every one of the six screens (Vocabulary + five skills) reports:
header, logo SVG, subtitle, gear, avatar emoji, profile name, level+XP spans,
Logout. Back button present on all five skill screens and absent on Vocabulary,
exactly as before. Screen bodies intact (grammarBody, listeningActivityGrid,
readingLevelTabs, readingExamList all still present).
**duplicateIds: [] across the whole document.**
ui-sanity PASS, grammar-sanity PASS, em-dash 0.
avatar.js ?v=4, SW v126.

---

# Addendum 6 - three real defects I shipped, now fixed

## 1. TWO controls for one setting
The gear already had a "Dark Mode" toggle row; I ADDED a Theme row beside it
instead of replacing it. Both drove the same class, so the screen showed one
setting twice. The old row is now hidden when our panel mounts (hidden, not
deleted - other code may address it).

## 2. Text size pushed the panel off-screen
The host modal was sized for three short rows. Adding these controls and then
scaling to A++ ran its content past the bottom of the window with no way to
reach it. Capped and made scrollable:
`#settingsModal .modal-content { max-height: 88vh/88dvh; overflow-y: auto; }`
dvh so it also holds on phones where the toolbar hides.

## 3. Only two themes, not the writing exam's four
Sepia and Contrast are now token overrides in app-settings.css using the SAME
values as student/css/writing-exam.css, so they reach every surface built on
tokens - identical coverage to light mode - on every page.
Light still needs the app's own `.light-mode` rules (student dashboard only),
so that ONE button is dropped where those rules are absent rather than offering
a switch to an unreadable page. The row itself is always shown.

## Verified in browser against the real files
duplicateThemeControl: false | themeButtons: dark, light, sepia, contrast
modal overflow-y: auto, height 568px inside a 2122px window at A++ (fits)

## Where the wheel is
Every page carries it except two, both deliberate:
  - activity-logs-tab.html: a FRAGMENT with no <head>, injected into another
    page that already has the wheel.
  - writing-exam.html: opted out, has its own panel. Now that the shared panel
    carries all four themes, this opt-out should be removed so the exam uses
    the one control too. NOT done yet.

ui-sanity PASS. app-settings.css ?v=4, app-settings.js ?v=5, SW v127.

---

# Addendum 7 - one wheel, one panel, everywhere (and not on login)

## Writing exam folded into the shared panel
It was the LAST page with its own separate control, which is exactly the
inconsistency being complained about. Now:
- `data-app-settings="off"` removed from its <body>
- `#wrSettingsBtn` (the gear already in its header) carries
  `data-app-settings-open`, so it opens the SHARED panel
- its own drawer is retired in writing-exam.css:
  `#wrSettingsPanel, #wrSettingsOverlay { display: none !important; }`
  (one button must not open two panels)

Nothing was lost in the move: the shared panel gained an **Editor font** row
(Serif / Sans / Mono, same families as before), shown ONLY on a page that has
`#wrEditor` - so it appears in the writing exam and nowhere else. Saved in the
same `ll-display` record and applied by `applyFont()`, a no-op elsewhere.

## Login page
Wheel removed from index.html on request - a signed-out visitor has no
preferences to set. join.html / reset-password.html still carry it; say the
word and they go too.

## Verified against the SERVED files
loginHasWheel: false | writingExamOptOut: false |
writingGearOpensShared: true | oldWritingDrawerHidden: true |
fontRowInShared: true | fontApplied: true | resetIncludesFont: true |
fourThemes: true

ui-sanity PASS, grammar-sanity PASS, node --check OK.
app-settings.js ?v=6, app-settings.css ?v=4, writing-exam.css ?v=2, SW v128.

## Where the wheel is now
Every page EXCEPT: index.html (login, by request) and activity-logs-tab.html
(a fragment with no <head>, injected into a page that already has it).

---

# Addendum 8 - wheel moved to the top-left, music folded into it

## Position
`.as-launch` was bottom-right; it now sits **top-left (14px / 18px)**, the same
corner the header gear occupies elsewhere, so writing / placement / games match
the rest of the app instead of hiding a control at the bottom of the page.

Placement already owns that corner with its fixed "Exit" button, so the wheel
steps aside there rather than stacking on it:
`body:has(#plExitBtn) .as-launch { left: 122px; }` (112px under 480px).
Measured: default 14/18; on a placement-shaped page 14/122.

## Music now lives in the wheel (game pages only)
The classroom games carried their own floating music button (`#musicBtn` +
a global `toggleMusic()`), which is exactly the kind of stray second control
this work is removing. The panel now shows a **Music** row - but ONLY where
`#musicBtn` exists, so it never appears on non-game pages - and:
- the row calls the page's OWN `toggleMusic()`, so there is no second audio
  system to fall out of sync
- it re-reads the page button's label afterwards, so the two always agree
- the page's floating button is hidden on mount: one control, in the wheel

Applies to the 12 classroom pages that have a music button (bingo / heist /
scramble / trust / tug, student + teacher, plus the two lobbies).

## Verified against the served file
musicRowInWheel: true | pageFloatingBtnHidden: true |
click 1 -> toggleMusic called once, both labels "Music off" |
click 2 -> called twice, both labels "Music on" | labelsMatch: true

ui-sanity PASS, grammar-sanity PASS, node --check OK.
app-settings.css ?v=5, app-settings.js ?v=8, SW v130.

---

# Addendum 9 - three follow-ups from the screenshots

## 1. Music pill still on screen (picture 1)
I hid `#musicBtn` only. That button is one of THREE inside a
`<div class="music-control">` wrapper - play, next-track, and a volume slider -
so the pill stayed visible minus one button, which looked broken.

Now the WHOLE cluster is hidden (`pageBtn.closest('.music-control')`) and all
three controls moved into the wheel: a Music toggle, a Next button, and a
volume slider bound to the page's own `#volumeSlider` + `setVolume()`. Nothing
was dropped, and there is still only one audio system.

## 2. Wheel sat on the courses header (picture 2)
courses.html has its own `.pc-header` bar, so a floating wheel in the top-left
covered "Dashboard". Given a gear button in `.pc-header-right` carrying
`data-app-settings-open` - the floating launcher hides itself, same mechanism
as the teacher dashboard. Any page with its own header can do this with one
attribute.

## 3. Panel did not fit on mobile (picture 3)
The four theme buttons in a single flex row pushed the content wider than the
box. Because the panel is anchored to the RIGHT, the overflow ran off the LEFT
edge - which is why the labels read "EME" / "XT SIZE" / "EVIEW".

Two changes:
- `.as-panel` uses `width: min(340px, 100vw)` + `box-sizing: border-box` +
  `overflow-x: hidden`, so it can never exceed the viewport;
- `.as-row` is a GRID, not a flex row: 2 columns by default, 3 when the row has
  exactly three buttons, 1 for a lone button. Four themes now sit 2x2 instead
  of forcing a wider box.
Mobile breakpoint 480 -> 560px so mid-size phones get the full-width sheet.

## Verified at 375px against the served files
wholeMusicClusterHidden: true | panel left 0, right 375, width 375 |
contentSpillingOffScreen: [] | Music toggle fired once, Next once,
volume set to "80" through the page's own setVolume().

ui-sanity PASS, grammar-sanity PASS, node --check OK.
app-settings.css ?v=6, app-settings.js ?v=9, SW v131.

---

# Addendum 10 - dashboard load stagger (placement + assignments)

## Why only those two lagged
The skill cards render from a LOCAL array - no network at all. Placement and
Assignments each need Firestore round trips before they can draw anything, so
they always arrived a beat later.

## A - reuse the user doc already in memory
auth.js fetches `users/{uid}` and caches the FULL document on
`window.currentStudentData` (confirmed: it carries studentClass / level /
module). But `users/{uid}` was being read **7 times** across 5 scripts on one
page load. Two of those were on the critical path:

- `student-assignments.js` read it as the FIRST of four sequential stages -
  the scope queries cannot start until class/level/module are known. Reusing
  the cache deletes that entire stage: **4 network stages -> 3**.
- `placement-tile.js` had it as one of four parallel reads, so the batch was
  paced by the slowest of four rather than three.

Both keep a real fetch as a fallback (`if (!userData)` /
`cached ? Promise.resolve(null) : ...get()`), so if auth has not landed yet the
behaviour is exactly what it was before. Net effect: FEWER reads, not more.

## B - hold the slot from first paint
The placement tile now renders a muted placeholder card in the grid the moment
the DOM is ready, replaced by the real card when the reads land. It is removed
on every exit path too - out of scope, non-student role, or a failed read -
so it can never be left stranded (4 dropSkeleton call sites). aria-hidden, and
the pulse is disabled under prefers-reduced-motion.

The assignments box already had its own "Loading assignments..." state holding
its space, so it needed no placeholder - only the speed fix above.

## Verified
Static, against the SERVED files: assignments reuses cache + has fallback;
placement reuses cache, skips the user read, and has its fallback; skeleton
added, removed on all 4 exits; skeleton CSS present; reduced-motion honoured.
node --check on both files, ui-sanity PASS, grammar-sanity PASS, em-dash 0.

HONEST GAP: I could not get the instrumented stub to actually execute
loadMyAssignments() in the harness this session (it recorded 0 reads, i.e. the
function never ran), so the stage-count drop is argued from the code path and
the earlier instrumented baseline rather than re-measured end to end. The
branch is unambiguous - `if (!userData)` around the only users/{uid} read - but
it is worth confirming on the live page: the assignments list should now appear
about one round trip sooner.

hub.css ?v=16, placement-tile.js ?v=4, student-assignments.js ?v=6, SW v132.

---

# Addendum 11 - the courses wheel did not match the others

## Cause - mine
When I gave courses.html its own opener I hand-wrote a gear EMOJI in the
markup instead of the inline SVG the real wheel uses. Emoji renders per-OS
(flat and pale on Windows), so that one wheel looked nothing like the rest.
The teacher dashboard's sidebar row had the same emoji.

The deeper problem was ownership: a page was supplying the ARTWORK, when it
should only supply the attribute.

## Fix - the component owns the icon
When app-settings.js binds an opener it now replaces a gear glyph with its own
`gearSvg()` - the exact markup the floating launcher uses - and tags the
element `.as-opener` for sizing (1.15em, follows the host's font-size so it
sits right in a sidebar row and a header bar alike). Handles both shapes:
a bare button, and an emoji inside a `.ico` span next to a text label.

Any page can now add a wheel with one attribute and get the identical icon.
No page needs to know what a gear looks like.

## Verified against the served files
Both opener shapes rebuilt and driven:
coursesGear_isSvgNow: true | emojiGone: true |
teacherRow_isSvgNow: true | labelKept: true |
identicalToFloatingWheel: true (same viewBox and path payload) |
stillOpensPanel: true

ui-sanity PASS, grammar-sanity PASS, node --check OK.
app-settings.css ?v=7, app-settings.js ?v=10, SW v133.

---

# THE WHEEL PLACEMENT RULE (decided - implement next, NOT yet done)

## The criticism, and it is correct
The wheel was being placed per-page instead of to one rule, so the app has
THREE placements today:

| surface | today |
|---|---|
| student dashboard + 5 skill screens | first in the header cluster (wheel / avatar / Logout) |
| teacher dashboard | sidebar "Display" row |
| courses | header-RIGHT, next to the student chip |
| placement | floating top-left, beside Exit |
| live mode / classroom games | floating top-left |
| writing exam | its own toolbar, top-right |

Root cause: the five skill screens are SCREENS INSIDE student-dashboard.html,
so they inherit that page's header. Placement, courses and the games are
SEPARATE PAGES with their own header or none, so the code fell back to a
floating button. That is an implementation detail leaking into the design.

## The rule (chosen)
**The wheel is always the FIRST item in the page's header control cluster,
in the same spot on every page. No floating wheel exists anywhere.**

One documented exception, chosen deliberately: the **teacher dashboard** keeps
its sidebar "Display" row, because that dashboard navigates by sidebar and has
no header cluster at all.

## What that means in work
1. `app-settings.css` / `app-settings.js`: retire `.as-launch` entirely
   (the floating launcher and its placement CSS, including the
   `body:has(#plExitBtn)` offset). The panel is opened ONLY by
   `data-app-settings-open`.
2. Give a matching header cluster to the pages that have none:
   placement.html, the 12 classroom-*.html pages, policy-course.html,
   lingualab-write/index.html. Same markup, same position.
3. Move the wheel to FIRST position in the clusters that already exist:
   courses.html (currently header-right, after the chip) and
   writing-exam.html (currently top-right of its toolbar).
4. student-dashboard.html already complies - wheel is first in the cluster on
   the hub, vocabulary and all five skill screens. Leave it.
5. Placement's fixed "Exit" button and the cluster must share the top row
   without overlapping (Exit first, then the cluster) - the overlap fixed in
   Addendum 3 must not come back.
6. Re-run: ui-sanity, grammar-sanity, and a per-page check that EVERY page
   reports exactly one wheel, in the cluster, and zero `.as-launch` nodes.

## Status
NOT started. Flagged rather than begun because it touches ~16 pages and needs
a per-page visual pass at desktop and phone widths; starting it without room
to verify is how half-applied UI ships.

---

# Addendum 12 - wheel placement rule APPLIED (skills pages untouched)

## What changed
1. `.as-launch` restyled from a floating CIRCLE (44px, 50% radius) to a
   HEADER CONTROL (42px, 12px radius) matching `.header-icon-btn` on the
   dashboard, so on a page with no header of its own it reads as page chrome
   rather than a floating action button.
2. The per-page offset is GONE. There is no longer a
   `body:has(#plExitBtn) .as-launch { left: 122px }` special case - the rule
   is that the wheel occupies the same slot on every page, full stop.
3. Placement now moves ITS control instead: `#plExitBtn` shifted from
   left:18px to left:70px, so Exit sits to the RIGHT of the wheel.

## Confirmed placements after the change
| surface | wheel |
|---|---|
| student dashboard + 5 skill screens | header cluster (UNCHANGED - not touched, per instruction) |
| teacher dashboard | sidebar "Display" row (agreed exception) |
| courses | first item of `.pc-header-right` |
| writing exam | its header toolbar |
| placement / classroom games / policy course / writing lab | injected header control, same slot |

Pages carrying their own opener: courses.html, teacher-dashboard.html,
writing-exam.html. Everything else uses the injected control, and all of them
land in the identical spot.

## Verified in browser against the served files
Generic page: top 14, left 18, 42x42, radius 12px.
Placement page: top 14, left 18, 42x42, radius 12px - IDENTICAL slot.
sameSlotEverywhere: true. placementExitOverlapsWheel: FALSE (Exit at left:70
clears the 42px wheel that ends at 60).
ui-sanity PASS, grammar-sanity PASS.
app-settings.css ?v=8, SW v134.

## Deliberately NOT done
The skill screens were not touched, per instruction - they already put the
wheel first in their header cluster and were working.

---

# Addendum 13 - the SHARED APP BAR (the change that is actually visible)

## Why the last two deploys showed nothing
My previous "fixes" were a 44px circle becoming a 42px rounded square, and a
button moving 52px. Both real, both invisible on screen. The user deployed
twice and correctly saw no difference. I had also been treating "classroom,
courses, live mode and games all look different" as a question of WHERE THE
GEAR SITS, when the actual problem is that those pages have no common top
chrome at all.

## What was built
`.ll-appbar` - one fixed 56px top bar, injected by app-settings.js on any page
that does NOT already own a header. It contains the wheel as its FIRST item,
then the page title (taken from document.title, "| Lingualab" stripped).
`body.has-ll-appbar { padding-top: 56px }` reserves its height so it never
covers content.

Applies to: the 12 classroom / live-mode / game pages, placement,
policy course, the writing lab, 404, join, reset-password.

Left alone deliberately: student dashboard and the five SKILL SCREENS (per
explicit instruction), teacher dashboard, courses, writing exam - all of which
already have a real header of their own.

Placement's fixed Exit button is nudged to top:10px so it reads as part of the
bar instead of fighting it.

## Verified in the browser on a real served page (404.html)
barPresent: true | bar top 0, left 0, width 1280 (full width), height 56
spansFullWidth: true | wheelInsideBar: true | wheelIsFirstItem: true
title: "Page Not Found" | bodyPaddingTop: 56px
contentHiddenUnderBar: [] (nothing covered)
noFloatingWheelLeft: true - the floating button is gone, it now lives in the bar

ui-sanity PASS, grammar-sanity PASS, node --check OK.
app-settings.css ?v=9, app-settings.js ?v=11, SW v135.

## Caveat carried forward
Verified on 404.html because the classroom pages redirect to login without a
session. The bar is injected by the same code path on every page, but its
interaction with each game's own layout has NOT been eyeballed. That is the
first thing to check on the live site.
