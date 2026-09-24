# 2026-08-26 - one game header everywhere, bigger toasts, and the year-long Activity question

## 1. The four breadcrumb game headers now match the other five

Approved after the difference table. Three changes per file, no game logic
touched.

| | before (heist, trust, reading, listening) | after |
| --- | --- | --- |
| "Pick a different game" | bare inline-styled link inside a breadcrumb | `class="btn btn-secondary ll-navbtn"` |
| control order | `[Dashboard] [Lingualab] [teacher emoji] [Pick a game > The Heist]` | `[Pick a game] [Dashboard] [Lingualab / game name] ... [wheel]` |
| game name | in a breadcrumb; the Lingualab lockup had no subtitle | wrapped in `.{game}-brand`, so app-settings folds it in as the subtitle |
| loose teacher emoji | floating mid-bar with nothing to attach to | gone; replaced by the game's own icon inside the brand |
| width | inset card, because the bar sat inside `.{game}-shell` (max-width 1200-1280, auto margins) | moved OUT of the shell, full bleed |

`app-settings.js` already listed `.heist-brand`, `.trust-brand`,
`.reading-brand`, `.listening-brand` as title selectors. Those classes existed
only on the four STUDENT pages; the teacher pages were missed, which is why the
lockup had no subtitle and the emoji was orphaned. Adding the class was all
that was needed - no change to `app-settings.js`.

### The bar is styled through `.ll-gamebar`, not `.{game}-top`

Each of these four files uses its `.{game}-top` class **twice**: once as the
page header and once as a toolbar row inside the results view. My previous pass
styled the class itself, which would have dropped a header-looking bar into the
middle of the results card. The header instance now carries `.ll-gamebar` and
the shared rule targets that.

Still qualified as `body .ll-gamebar`, for the reason recorded last time: every
game sheet is linked after `styles.css`, so an unqualified selector loses on
source order.

### Verified, all nine hosts, light and dark

Reproducing what `app-settings.js` does to the bar:

| | overflow 390px | overflow 1280px | radius | background | name folded into lockup | actions container found |
| --- | --- | --- | --- | --- | --- | --- |
| all nine | **0** | **0** | **0** | identical | **yes** | **yes** |

Child order is now `btn > btn > ll-brand > header-actions` on all eight games.
The hub is `btn > ll-brand > header-actions`, correctly: it has one nav button,
because Logout deliberately stays on the right beside the name.

### A scripting mistake worth recording

The first run reported "shell NOT FOUND" on three of four files. The comment
stripper was `/[ \t]*<!--[\s\S]*?-->\s*$/` against the text before the bar.
That regex is not anchored at its start, so it matched from the FIRST comment
that could reach the end of the string and swallowed everything between,
including `<div class="heist-shell">`. The script then could not find the shell
and aborted, which is the only reason no file was corrupted - the write came
after the lookup. Replaced with a walk back from the nearest `-->`, plus an
`ll-gamebar` guard that makes the script idempotent. Originals were copied to
the scratchpad first.

Integrity after surgery: `<div>`/`</div>` balanced in all four (78/78, 75/75,
52/52, 59/59), one shell each, and every id still present.

## 2. Toasts are bigger, and they line up on a phone

These fire during a live game on a projector. At `0.95em` in a 340px box a
teacher had to walk to the screen to read one.

| | before | after |
| --- | --- | --- |
| font-size | 0.95em | **1.05em**, line-height 1.45 |
| max-width | 340px | **420px** |
| padding | 12px 18px | 16px 22px |
| accent edge | 4px | 5px |

Applied to both families at once, so `.cls-toast` and the five mini-game
toasts stay identical.

**On a phone they span the screen instead of hugging a corner.** A 420px card
pinned to `right: 18px` does not fit a 390px phone: it either overflows or
squeezes into a column that wraps every message onto five lines. Under 620px
both edges are pinned at 12px, `max-width` is dropped, and the entry animation
becomes a downward slide - a card the full width of the screen sliding in from
the right reads as the whole page moving.

`.cls-toast` animates by class rather than keyframes, so its three states
(`base`, `.shown`, `.fade-out`) each had to lose the horizontal travel too, or
it would slide in from off the right edge of a screen it now spans.

Measured at 390px: both families **12 -> 378 in a 390 viewport, width 366**,
identical. At 1280px: `left 842 + width 420 = 1262`, against a right offset of
18px. Correct.

### A measurement trap, again

The probe first reported the desktop toast ending at 1282px in a 1280 viewport
- a 2px overflow. It was not real. The iframe is hidden, so `requestAnimationFrame`
never fires and the entry animation never advances past its `from` frame, which
carries `translateX(20px)`. The rect was 20px right of the real position. The
computed `left`/`right` values were correct all along. This is the same hidden-frame
trap already recorded in memory; read end states, never a rect mid-animation.

## 3. Activity Logs across a full year - the honest answer

Asked whether it copes with a full year of real students and classes.

**Two queries run on dashboard load** (`teacher/js/config.js:186`):

- **students**: every student in the teacher's scope, no cap. At 400 that is
  400 reads per load, a fraction of a cent. Fine, and fine at 1000.
- **sessions**: `orderBy('createdAt','desc')` then **`.limit(1000)`**, with the
  lifetime total kept accurate by a separate cheap `count()`.

**The headline totals are fine. The per-student numbers are not, over a year.**

`allSessions` is capped at the most recent 1000 rows **across all students**,
and it feeds more than the feed:

| consumer | what it computes |
| --- | --- |
| `activity.js:106` | the Activity Logs list itself |
| `activity.js:350, 361` | each student's **average score**, and the **below-50% needs-attention flag** |
| `activity.js:383` | per-student session counts |

With 400 students active, 1000 sessions is roughly two to three days. So a
student's average is computed from whatever slice of their work happens to fall
inside that window, and a student who was active last month reads as having no
sessions at all. Over one term that quietly becomes wrong rather than slow.

**Not changed in this pass** - it is a real design decision, not a typo, and it
wants its own change: either aggregate per-student totals into the student doc
as sessions are written, or query per student on demand when a teacher opens
that student. Flagged here so it is not rediscovered as a mystery in December.

Unrelated but nearby: `where('studentClass','in', classes)` is capped at 30
classes by Firestore, already noted in the code.

**The 1000-student AI orientation does not touch any of this.** Those players
sign in anonymously, which creates a Firebase Auth entry but no `/users` doc and
no `/sessions` doc. The quiz writes only to `aiquiz_sessions` and one summary
row in `gameReports`.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan on all touched files - clean
- CSS braces 272/272, comments 57/57 balanced
- gates: lobby, ui-text, inline-css, profile-hub, teacher-mobile,
  grammar-sanity - **all PASS**
- bump: `styles.css` v49 -> **v50** (21 refs), CACHE_VERSION v343 -> **v344**;
  `bump.js --check` OK
