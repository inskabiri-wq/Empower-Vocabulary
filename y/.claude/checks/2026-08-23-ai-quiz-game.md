# 2026-08-23 - AI Quiz: a teacher-paced classroom game for the AI orientation

Asked for: a 20-question game from the AI course questions, ladder after each
question, for an orientation of at least 1000 students. Questions must be easy
to change later, the module must be part of the content, and the page must be a
replica of the other classroom games.

## Why it is a new game rather than a setting on Vocab Race

Vocab Race and Grammar Race are RACES. The teacher publishes the word list once
and every student runs it at their own speed, so the room is never between
questions and a ladder has nothing to attach to. This game holds the room on one
question at a time, which is the whole point of a ladder after each one.

## Files

| file | what it is |
| --- | --- |
| `classroom/js/ai-quiz-questions.js` | **the file to edit when questions change** |
| `classroom-aiquiz-teacher.html` + `classroom/js/aiquiz-teacher.js` | host |
| `classroom-aiquiz-student.html` + `classroom/js/aiquiz-student.js` | phone |
| `classroom/css/minigames.css` | the game's widgets, appended |

Wired into: the game-mode picker on `classroom-teacher.html`, the universal join
router in `classroom/js/student.js`, and `firestore.rules`.

## The question bank

22 questions, generated from the AI Use Guidelines course
(`student/js/policy-course-content.js`) rather than retyped, so nothing was
mistyped in transcription. Bilingual, four options, correct answer as an index.
A game asks 20 of them, so the set is not identical every time.

They are a SEPARATE COPY of the course questions on purpose: the course is
assessed, and it must not change because somebody wanted a livelier game
question.

Every question carries its module (m1 to m4). The host picks which modules a
game draws from, which is the "module in the content" control, and a module can
be dropped without touching the bank.

To retire a question, set `active: false` rather than deleting it, so an id is
never reused for different text.

## Three choices that come straight from the load test

Yesterday's measurement said the ceiling is the teacher's browser, not
Firestore: 194 seconds of rendering for a 600-player game, because the player
list is rebuilt on every score write.

1. **The lobby shows a count, not a card per student.** One number instead of
   1000 DOM nodes rebuilt on every join.
2. **The ladder is a `limit(10)` query, once per question.** Ten reads, not one
   callback per student per answer.
3. **The questions live in their own document**, read once per phone. The
   session document every phone listens to is the thing that gets pushed on
   every question change, so it holds only the question number, the phase and
   the timer.

Measured on the emulator: **session document 206 bytes**, questions document
2538 bytes for 4 questions. At 20 questions and 1000 students that is roughly
4MB of fan-out across a whole game, against roughly 240MB had the questions been
embedded in the session document.

No history is kept, as asked. One write per student per question, and nothing to
clean up afterwards.

## Verified end to end, with the real rules

`y/tools/demos/aiquiz-e2e.html`, against `firestore.rules` as written, not a
relaxed copy. Nine checks, zero failures:

| | |
| --- | --- |
| host creates the session and writes the questions | ok |
| session doc small (206B) | ok |
| 12 students join, each writing only their own doc | ok |
| **a student cannot write another student's score** | ok |
| 4 questions played, ladder cost 10 reads each | ok |
| winner produced | ok |
| top score exactly 4 x 120, so `increment` did not race | ok |

The teacher fixture is seeded through the emulator's admin path, because the
rules correctly refuse to let an account give ITSELF `role: 'teacher'`. That
refusal is the rules working; bypassing it for a fixture is fine, since what is
under test is the new `aiquiz_sessions` block.

## Firestore rules

A new `match /aiquiz_sessions/{code}` block, mirroring the other mini-games and
using the same `_isMiniHost` / `_ownsMiniSession` helpers, plus a `meta`
subcollection that any signed-in user may read and only the host may write. A
new match block for a new collection cannot change behaviour for an existing
one.

The host document field is `hostUid`, not `createdBy`: the shared helpers key on
that exact name, and getting it wrong would have left a teacher unable to run
their own room.

**Note on trust:** the answer key is in a document students can read, which is
the same model as the other mini-games and fine for a room with the teacher
watching the board. It is not exam-grade. If it ever needs to be, the key has to
move out of reach and marking has to move to the host's tab, the way
`reading_sessions` does it. That is written in the rules file too.

## Ritual

- `node --check` across every `.js` in the tree - **0 failures**
- em-dash scan on all new files - clean
- inline-css-check, teacher-mobile-check, grammar-sanity, ui-text-check - PASS
- profile-hub-check - **caught the new student page** as unaccounted for, which
  is exactly its job; added to the classroom family (keeps the wheel, carries no
  profile) and it now reports 9 classroom pages
- bump: ai-quiz-questions.js v2, aiquiz-teacher.js v2, aiquiz-student.js v2,
  minigames.css v7, student.js v6, CACHE_VERSION v334 -> **v335**
- `bump.js --check` - OK

## Not done

- Not tested with real phones on a venue network, and not tested with 1000
  concurrent sign-ins. Those are the two things an emulator cannot answer.
- The host screen shows the question and options for the projector, but there is
  no "how many have answered" counter yet; the note element exists and is empty.
