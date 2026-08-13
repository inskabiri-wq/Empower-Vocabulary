# 2026-08-11c - Floating gear, switch rows, listening box, book motion

Follow-up to `2026-08-11b`. Five reported problems, all reproduced and measured
in the harness (`y/tools/demos/screen-diag.html`, served by `static-y-alt`).

## 1. A second gear appeared at the top left of the dashboard

Real, and caused by the previous change. `mount()` created the floating
launcher and then hid it with `el.launch.style.display = 'none'` whenever the
page supplied its own `[data-app-settings-open]` gears.

That hiding never worked. The gear block at the bottom of `app-settings.css`
sets `display: inline-flex !important` on `.as-launch.as-launch`, and an
`!important` author rule outranks a non-important inline style. Measured:

    inline display : "none"   (priority "")
    computed       : "flex"   at 18,14  44x44   <- visible

Before, the dashboard took the `mountIntoHost` path and no launcher was ever
created, so the defect was invisible. `build(needLauncher)` now takes the
decision BEFORE anything is created: when the page has its own gear the
launcher is never appended to the document. An element that is not in the DOM
cannot be un-hidden by a stylesheet. Verified: `floatingGear: false`,
7 openers wired.

## 2. Sound / Turkish went back to icons and a switch

The On/Off button pair was a downgrade and threw away the icons. The rows are
the dashboard's ORIGINAL presentation again - icon, name, description, sliding
switch - but rendered by the shared panel and styled in `app-settings.css` on
the panel's own `--as-*` tokens, so they look the same wherever they appear.
The sound icon still flips 🔊/🔇 with state. Verified: both rows render with
icon + description + a 44px track, and clicking flips state and storage.

## 3. Listening box vs vocabulary and reading

The container width was already equalised in `-b`. What remained was the
CONTENT, and it was a much bigger difference than the box:

| | before | after |
|---|---|---|
| listening card | `265x85`, radius 0, no padding, `.activity-card` in a 240px auto-fill grid | `1134x90`, radius 14, pad 18/20 |
| reading card | `1134x90`, radius 14, pad 18/20 | unchanged |
| icon chip | 265x21, radius 0 | `52x52`, radius 12, both screens |
| title | - | `15px / 700 / Nunito`, both screens |

Listening rendered ONE small square tile in a grid sized for many, so the exam
sat alone in the corner while Reading showed full-width rows. Both are exam
lists, so they now use one component: `listening.js` emits the same
`.rd-exam-card` markup, the container is `.rd-exam-list`, and every
`#readingScreen .rd-(exam|level|home)*` rule in `reading-exam.css` is now also
scoped to `#listeningScreen` (34 selectors, skill-home only - no exam-runtime
class was shared). The old card also set its background and border as INLINE
styles, which outrank every stylesheet, so no CSS could ever have aligned them;
those are gone.

Two more differences found and fixed while measuring:

- **Font.** `.skill-screen` never declared `font-family`, so listening, reading,
  grammar, writing and speaking rendered in Segoe UI while vocabulary rendered
  in Nunito. Measured `"Segoe UI"` -> `Nunito` on all of them.
- **Per-skill accents had never applied.** `skills.css` wrote
  `#listeningScreen.skill-screen` (compound, no space) but the markup is
  `<div id="listeningScreen" class="screen"><div class="skill-screen">`, so the
  class is on a CHILD. All five rules matched nothing. Measured
  `--skill-accent` before: `#2dd4bf` (the default) on both screens; after:
  `#38bdf8` listening, `#fb7185` reading.

## 4. The book icons now actually animate

The first attempt was hover-only, which reads as "no animation" - these rows
are looked at, not hovered, and a phone has no hover at all. `.rd-exam-icon`
now carries a permanent `rd-book-bob 3.2s` bob, staggered by `nth-child` so a
list does not move in lockstep, and hover swaps to a livelier `rd-book-pop`.
Hover sets an ANIMATION rather than a `transform`, because a running animation
outranks a plain transform declaration and the hover transform would never have
been seen. Verified: `anim=rd-book-bob 3.2s` on both listening and reading.

## Incident: a `git checkout --` discarded uncommitted work, and how it was recovered

While fixing a bad regex I ran `git checkout -- y/student/css/reading-exam.css`.
That file had uncommitted work from a PREVIOUS session (a px -> rem font-size
pass, whitespace in `rgba(255,255,255,...)`, and one tokenised colour), and the
checkout destroyed it. There is no stash and no backup.

Recovered from the browser's HTTP cache: earlier loads in this session had
fetched `reading-exam.css?v=3`, so the bytes were still there.
`fetch(url, {cache:'force-cache'})` returned them, a line diff against
`git show HEAD:` isolated exactly what the pass had done, and a script
regenerated it from HEAD. Proof of exactness: regenerating the base and
re-applying this session's first edit produced

    sha256 c6b5c497c5bc90ec68987a2a9d48ad2bf358ba9f3b922baefefbfcf7b5717443

which is byte-identical to the cached copy. Nothing was lost.

Two lessons worth keeping: **never `git checkout --` a file in this repo** (the
whole tree is uncommitted work), and the px -> rem pass excludes custom-property
declarations - `--rd-border: rgba(255,255,255,0.08)` stays compact.

## Note on the multi-agent audit

A 10-agent audit workflow was run for this. It hit the account session limit
and 9 of the 10 agents died; only the box-difference investigator returned, and
its findings were never verified by the workflow. Everything above was
re-derived and measured by hand. Its unverified leads that turned out to be
REAL: the missing `font-family`, the compound accent selectors, the auto-fill
grid, and the inline styles on the listening card.

## Gates

- `node --check`: app-settings.js, ui.js, skills/listening.js, skills/reading.js,
  policy-course.js - all pass
- `theme-sanity.js` PASS, `ui-sanity.js` PASS
- `bump.js --check`: **OK, all versions consistent** (the earlier `skills.css`
  drift is gone)
- em-dash scan on added lines: 0
- versions: app-settings.js v20, app-settings.css v36, reading-exam.css v6,
  skills.css v5; service worker v185

## Still open

- `smoke-test.js`: 5 of 5 sampled writing submissions reference assignments that
  no longer exist. Firestore data, unrelated.
- The preview pane reports `visibilityState: hidden` and 0 rAF callbacks, so no
  CSS transition or animation ever advances in it. Read end states with
  `transition: none` / by reading `animationName`, never by sampling a colour
  after a delay.
