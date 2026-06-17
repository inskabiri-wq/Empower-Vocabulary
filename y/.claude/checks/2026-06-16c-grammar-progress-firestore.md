# 2026-06-16 (round 3) - Grammar progress is now Firestore-backed (map + report)

User: "explore map for grammar doesn't catch anything, the bars/score/master
don't get anything, I need the stats picture on grammar too; export report has no
grammar."

## Root cause
The VOCABULARY Quest Board builds its stats from the student's **Firestore
sessions** (`progress.js` `loadMapProgress`, keyed by `level-unit`) - so it is
populated and cross-device. The GRAMMAR map read only **localStorage**
(`gr_prog_v1`) via `getProg`, which is device-local and completely disconnected
from the grammar sessions that `logGrammarAttempt` already writes to Firestore.
So the grammar Quest Board "caught nothing" (empty donuts/scores/stats).

## Fix - `y/student/js/skills/grammar.js`
Mirror the vocabulary approach: read grammar sessions from Firestore once and
MERGE with localStorage.
- New `grRemote` (keyed `level|u<unit>|game` -> {best,done}) + `grStats`
  (overall accuracy/best/challengesDone/totalQ/games), loaded by
  `ensureGrammarProgress()` from `db.collection('sessions').where(userId==me)`
  filtered to `skill==='grammar' || activity startsWith 'grammar-'`.
- `getProg()` now returns max(local, remote) best and OR of done, so per-unit
  cards (donuts, score chips, the master/check icons) light up from real play.
- Headline stats (Accuracy / Best / Challenges) come from `grStats` so they
  reflect ALL play including "all units" menu sessions (which can't attribute to
  a single unit card). The 5th stat changed from "Games X/Y" to "Challenges".
- `recordProg()` also bumps the in-memory remote cache so a just-finished game
  shows instantly; exact figures refresh from Firestore on next load.
- `renderMenu()` kicks `ensureGrammarProgress` once on first view, then re-renders.

## Fix - `y/teacher/js/student-detail.js` (report)
- `ACTIVITY_LABEL` now has grammar entries (`grammar-choice` ->
  "Grammar · Multiple Choice", etc.) so grammar rows in Recent sessions and the
  Answer review read nicely instead of raw "grammar-choice".
- Answer review now also reads grammar's per-question detail, which lives under
  `grammarDetails` ({q, picked, correct, ok}) rather than `answers.items`. So a
  student's grammar attempts now appear with full question-by-question detail.
- (Per-skill breakdown + recent sessions already counted grammar via
  `activityToSkill`, which maps the `grammar-*` activities to "grammar".)

## Versions
- `grammar.js` ?v=20 -> **?v=21**; service worker **v54 -> v55** (busts the
  unversioned `student-detail.js`). HTML is network-first.

## Verification - sanity + smoke
- `node --check` OK on grammar.js + student-detail.js. No em dashes added.
- **Smoke (harness with stubbed Firestore returning fake grammar sessions,
  deleted after):**
  - Header stats populated from sessions: Accuracy 70% (avg of 80/40/90/70),
    Best 90%, Challenges 3 (distinct >=60% game-challenges), a vocab session was
    correctly IGNORED.
  - Explore Map opened: Unit 1 donut = 67% (2 of 3 games done), challenge chips
    `1:choice=70%` + `1:unscramble=90%` marked done. Other units 0%.
  - 0 console errors.

## Note
- Cross-device caveat: a grammar game played from the menu carries `unit:'all'`,
  so it feeds the headline stats but not a single unit card. Playing from a map
  card (which passes a specific unit) lights that unit's card. This matches how
  the data is recorded; can be revisited if per-unit attribution for "all" play
  is wanted.

## Still open from earlier (NOT done this round)
- Security: the Students table 🖊️ Edit button shows for non-admin teachers.
  Firestore rules already REJECT non-admin writes to /users (allow update: if
  isAdmin()), so teachers cannot actually change student data - but the button
  should still be gated to admin (delete/promote already are). One-line fix,
  awaiting the go-ahead.
- Presentation: add a login slide; drop the Admin + student-dashboard slides
  (not relevant to regular teachers).

## Not done
- No deploy. No GitHub push.
