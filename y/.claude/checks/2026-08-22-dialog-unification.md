# 2026-08-22 - one shape and one motion for every dialog

Reported with six screenshots: the confirmation boxes look nothing like each
other. Agreed scope: unify the box, the margins and the animation, keep every
colour, and include the shared overlay.

## What was actually there

Four independent implementations, agreeing on almost nothing:

| | card class | radius | padding | max-width | entry motion |
| --- | --- | --- | --- | --- | --- |
| student logout | `.modal-content` | 24px | 36px 44px | 420px | 0.3s bouncy |
| teacher logout | `.modal-box` | 16px | 28px | **500px** | **none** |
| AppDialog | `.appdlg-card` | 18px | 24/24/20 | 420px | 0.2s, own curve |
| reading exam | `.rd-confirm` | 14px | 24/22/18 | 420px | 0.2s, own curve |

Overlays were just as split: `rgba(0,0,0,.7)` + blur(8px) fading over 0.3s;
`rgba(0,0,0,.8)` with **no fade at all** (display:none / flex);
`rgba(8,12,24,.74)` + blur(6px) over 0.18s; and `rgba(8,12,26,.72)` + blur(4px)
over 0.15s.

**Correction to my first reading:** I reported AppDialog as having no entry
animation. It does - a 0.2s transition driven by an `.in` class. My grep only
looked for `animation:` and `@keyframes`, and missed a transition. Only the
teacher logout genuinely had none.

## The shared layer

Lives in `css/brand.css`, which all 39 pages load, and which every page using
`js/app-dialog.js` also loads - so no new stylesheet and no new `<link>` tags.
It owns SHAPE and MOTION only; colour, border and background stay with each
dialog, so the dark exam sheets stay dark and the white logout card stays white.

Chosen values (the user picked the student logout's bouncier curve):

```
--ll-dlg-radius  18px
--ll-dlg-pad     28px 28px 22px
--ll-dlg-width   min(420px, calc(100vw - 32px))
--ll-dlg-dur     0.3s
--ll-dlg-ease    cubic-bezier(0.34, 1.56, 0.64, 1)
--ll-dlg-from    scale(0.9) translateY(20px)
```

### Two mechanisms on purpose

The dialogs arrive two different ways, so one mechanism cannot serve both:

- `.ll-dialog-pop` - a keyframe, for dialogs BUILT when they open (AppDialog,
  the reading exam). The element does not exist until it should animate.
- `.ll-dialog-toggle` - a transition, for dialogs already in the markup and
  revealed by a class (both logout modals). A keyframe there would fire on page
  load and spend itself while the modal was still hidden, so the modal would
  then simply appear.

Both read the same tokens, so they move identically.

### A marker class, not the existing class names

`.modal-box` is ALSO the big assignment and writing modals, which set their own
width inline. Styling that class directly would have crushed them to 420px.
Only the four confirmation cards carry `ll-dialog`.

## Two real traps, both caught before shipping

### 1. `.open` would have blanked every login modal

The shared overlay hides with `visibility`, and the app uses **two** reveal
classes - `.active` on the dashboards and classroom, `.open` on the
index/login modals. Neither the classroom nor the index stylesheet sets
`visibility` itself; they only ever faded with opacity. A rule covering
`.active` alone would have left every login modal permanently invisible.

Both classes are now listed, with a note that a third must be added here too.
Regression checks 13-16 cover it.

### 2. The click-swallowing backdrop

The student stylesheet carried a CRITICAL note: a `backdrop-filter` layer keeps
swallowing clicks in Chromium even at zero opacity, so `pointer-events` and the
blur must both be gated on the reveal class. That note travelled with the rule
into brand.css rather than being lost with the code it described.

## Verified - `tools/demos/dialog-consistency-trace.html`, 16 / 16

Each dialog rendered with its OWN stylesheets, the way its real page loads
them:

```
student    radius 18px  padding 28px 28px 22px  width 420  0.3s  cubic-bezier(0.34, 1.56, 0.64, 1)
teacher    radius 18px  padding 28px 28px 22px  width 420  0.3s  cubic-bezier(0.34, 1.56, 0.64, 1)
appdialog  radius 18px  padding 28px 28px 22px  width 420  0.3s  cubic-bezier(0.34, 1.56, 0.64, 1)
reading    radius 18px  padding 28px 28px 22px  width 420  0.3s  cubic-bezier(0.34, 1.56, 0.64, 1)
```

Also asserts the big assignment modal keeps its own width and 28px padding.

### Two harness bugs, both mine

- Measured with `getBoundingClientRect()`, which returns the TRANSFORMED box.
  This pane never composites, so a keyframe sits frozen on its opening frame
  and the rect came back scaled: 420 x 0.9 = 378, which looked like a genuine
  width difference on two of the four. `offsetWidth` is the layout box and
  ignores the transform.
- Split `transition-timing-function` on commas, which also splits inside
  `cubic-bezier(...)`. AppDialog transitions two properties, so its value is
  "cubic-bezier(...), ease" and the whole string read as a mismatch. Now parsed
  with bracket depth.

## Ritual

- `node --check` app-dialog.js, reading-exam.js - ok
- em-dash scan across all eight changed files - clean
- inline-css-check / anim-cost-check - PASS
- bump: brand.css v24, app-dialog.js v3, reading-exam.js v6,
  student styles.css v37, teacher styles.css v38, reading-exam.css v18,
  CACHE_VERSION v300 -> **v301**
- `bump.js --check` - OK

## Blast radius

`brand.css` is on 39 pages and now owns `.modal-overlay` for all of them, so
this touches every modal in the app, not only the six screenshotted. That was
the agreed scope ("include them"). Classroom and index keep their own overlay
colours - their stylesheets load after brand.css - but now inherit the shared
visibility and pointer-events handling.

Worth a look after deploying: the classroom modals and the login modals, since
those were not in the original screenshots.
