# 2026-09-22c - scramble per-sentence chart, podium fix, university logo

Third batch of the day. Follows `2026-09-22-post-event-three-fixes.md` and
`2026-09-22b-list-batch.md`.

## 1. Sentence Scramble: the "who got what wrong" chart

He said the results chart was "not completely shown". Traced: `sentenceReview`
listed the sentences and nothing else.

**The data did not exist.** `scramble-student.js` wrote only totals -
`score`, `correct`, `answered`, plus `lastRound` / `lastOk` for the LAST round
only. Nothing recorded which sentence a given student got wrong, so no chart
could have been built from what was stored.

**Fix, in two halves:**

- `scramble-student.js` now adds `roundResults.r<idx> = ok` to the SAME write
  via a dotted path. One extra boolean on the student's own document, no extra
  write, no extra cost, no extra contention. At 20 rounds it is 20 booleans.
- `scramble-teacher.js` builds a per-sentence bar from those results: red below
  50%, amber to 79, green at 80+, so the problem sentence is findable without
  reading a number.

**It counts only students who actually REACHED that round**, so a sentence half
the room never got to reads "7/9", not "7/12". Verified in
`y/tools/harness/scramble-review.html` with a 12-student room:

    1  100%  12/12   green
    2   83%  10/12   green
    3   33%   4/12   RED     <- the hard one, obvious at a glance
    4   78%   7/9    amber   (only 9 reached it)
    5  100%   3/3    green   (only 3 reached it - not punished as 3/12)

New CSS (`.sr-*`) lives in `minigames.css`, which scramble loads. Reading and
Listening's equivalent `.per-q-*` bars live in their own sheets, which this
page does not load, so these get their own names rather than a cross-page
import.

## 2. The AI Quiz podium was the broken one

Checked all seven games' result screens systematically, plus a scan for classes
the host JS renders that NO stylesheet on that page defines. The only orphans
in the whole app were `.podium-block` and `.place`, both AI Quiz.

`classroom/css/styles.css` keys on `.podium-place.first` / `.second` / `.third`.
bingo, scramble and tug all emit exactly that. **The AI Quiz emitted
`podium-place podium-first`**, so none of the podium rules applied: no gold, no
`order` putting the winner in the middle, no stepped padding, and
`.podium-block` was unstyled so the rank was a bare number. Three identical
flat boxes with the winner on the left.

Now emits `podium-place first` with a medal in `.podium-rank`, matching the
other games exactly. Verified in `y/tools/harness/podium-check.html`:

                        order     gold   padding-bottom
    reference (bingo)   2 / 1 / 3  yes    40 / 20 / 10
    aiquiz AFTER        2 / 1 / 3  yes    40 / 20 / 10
    aiquiz BEFORE       0 / 0 / 0  no     20 / 20 / 20

## 3. The AI Quiz leaderboard showed 20 of 99

From the real event (room SUZNC): 99 players, `.limit(20)`, heading hardcoded
"Top 20", and `.leaderboard-list` is `overflow: hidden`. So **79 of 99 students
could not find themselves on the final screen.**

Now `RESULTS_MAX = 300`, the heading says "All 99 players" (or "Top 300" if it
ever truncates), and `#perPlayerBody` scrolls - scoped to that id so the shared
`.leaderboard-list` the other seven games use is untouched.

## 4. University logo in the header

`y/js/org-brand.js` (new). Adds the university's mark to the empty middle of
the header. Never replaces the Lingualab mark.

- domain -> university via the existing `OrgRegistry.checkEmail()`, against a
  new `logo` field on each `settings/organizations.list` entry
- **no `logo` field means nothing is added** - a tenant without one keeps
  today's design rather than showing a broken image
- role comes from `window.currentStudentData`, which `student/js/auth.js`
  already publishes. **No extra read.**
- mounts at `[data-org-mark]`, inserted into all 7 dashboard headers
- `logoUrl()` anchors a bare filename to the site root, so it cannot break on a
  page at a deeper path - caught by the harness, which sits two folders down

**Verified, all 7 decision cases pass** (`y/tools/harness/org-brand.html`):

    student @stu.fsm.edu.tr    logo      PASS
    teacher @fsm.edu.tr        logo      PASS
    DEMO account on FSM domain NO logo   PASS   <- the non-obvious one
    anonymous game player      NO logo   PASS
    signed out                 NO logo   PASS
    university with no logo    NO logo   PASS
    unknown domain             NO logo   PASS

Image confirmed loading: `/fsmvu-seal.png`, naturalWidth 180, 34px in the
header, alt "FSM University (Students) logo".

To switch on in production, add `"logo": "fsmvu-seal.png"` to both FSM entries
in `settings/organizations.list`. That is DATA, not a deploy.

## Ritual

- `node --check` clean on every JS touched, em-dash scan 0
- `inline-css-check` PASS
- `bump.js`: scramble-teacher ?v8, scramble-student ?v5, minigames.css ?v12,
  aiquiz-teacher ?v9, org-brand ?v2, styles.css ?v55, CACHE_VERSION **v426**;
  `--check` no drift
- **28 gates pass, 0 fail**, 1 production skip
- four harnesses under `y/tools/harness/`, excluded from deploy by `tools/**`

## STILL NOT DEPLOYED

The newest hosting release is still **2026-09-21**. Everything from the 22nd is
waiting:

    firebase deploy --only hosting

## Left on the list

Login hero photo (images already prepared in y/img/), student support messages.
