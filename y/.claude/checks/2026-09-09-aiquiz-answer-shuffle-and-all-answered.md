# 2026-09-09 - AI Quiz: the right answer was always first, plus early close

## 1. The correct answer was always the first button

`classroom/js/ai-quiz-questions.js` authors **all 22 questions with
`answer: 0`**, which is the readable way to write them. Nothing shuffled them
before they reached the phones. Confirmed by search: the only `Math.random` in
the whole AI Quiz path was a retry backoff.

So a student could score 100% by tapping the first option twenty times without
reading a word. In the game chosen for the 1000-student event.

**Fix:** `shuffleOptions()` in `aiquiz-teacher.js`, applied once at room
creation. It shuffles the options and remaps `answer` to wherever the correct
option landed.

The "once" matters. Three consumers must agree:

    renderQuestion()          reads `questions`      (the projector)
    meta/questions            written from it        (every phone)
    saveResume()              stores it              (host refresh)

Shuffling per client would desynchronise the projector from the room. The meta
write was also changed from `picked.map` to `questions.map` for the same
reason.

## 2. Early close when everyone has answered

A question used to end only on the clock or on Reveal, so a class that all
finished in eight seconds still watched a thirty-second timer.

### Two designs rejected, one measured wrong before shipping

**count() aggregation.** My first implementation polled two `count()` queries
every two seconds: one read each regardless of room size, which looked ideal.
Tested it against the real SDK and got **`players.count is not a function`**.
count() is a modular-SDK API; the COMPAT build this app uses does not expose it
at any version, 10.7.1 included. This is already written up in
`teacher/js/config.js:238`, where an existing count() call has been throwing
into its catch since it was written. Had I not executed it, the feature would
have shipped silently doing nothing.

**Re-attaching the roster listener.** The obvious approach, and the one that
would undo the single decision that makes this game safe at 1000: `askQuestion`
releases that listener on purpose because a 1000-player game delivers about a
thousand callbacks per question, twenty thousand across a game.

### What shipped

A listener **filtered** to `where('answeredQ', '==', qIndex)`, so it delivers
only the answers to the current question rather than the whole roster on every
score write, and only in rooms of **60 or fewer**. A class of 30 costs at most
30 deltas per question. Above the threshold the feature stays off and the
question ends exactly as it always has.

Turning it off for big rooms is the honest behaviour anyway: in a
1000-person hall someone always has a locked phone, so "everyone answered"
would never fire and the timer would rule regardless.

The student side now writes on a wrong answer too. It used to `return` early
when nothing was gained, so a wrong answer wrote nothing and there was no
signal at all. It is still ONE write per student per question:
`{ score: increment(gained), answeredQ: shownIndex }`, and `increment(0)` is a
no-op on the score.

Equality on the question index, not a boolean, so a stale marker from an
earlier question cannot be counted.

## Executed

New gate `y/tools/aiquiz-answer-spread-check.js` extracts the REAL
`shuffleOptions` from the shipped file and runs it, so it cannot pass while the
function is broken:

| | |
| --- | --- |
| bank is authored answer-first (22/22 `answer: 0`), so the shuffle is load-bearing | ok |
| `createRoom` shuffles: `questions = picked.map(shuffleOptions)` | ok |
| meta/questions written from the shuffled list, not raw `picked` | ok |
| 400 trials: the option at the new index is always the correct one | ok |
| the source question object is never mutated | ok |
| correct answer lands in 4 positions `{0:109, 1:106, 2:99, 3:86}` | ok |
| 2-option and 1-option questions handled without corruption | ok |

Deliberate-break proof: disabling the shuffle turns the gate red
(`FAIL - 1 problem`), restoring it turns it green.

Against the emulator, with the real compat SDK and rules enforced:

| | |
| --- | --- |
| `players.count()` | **not a function** (why the design changed) |
| filtered listener counts only this question: 3 of 5 seeded | PASS |
| stale `answeredQ: -1` not counted for question 0 | PASS |
| listener fires incrementally 3 -> 4 -> 5 as students answer | PASS |
| reaching the expected count is the auto-close trigger | PASS |
| only 3 deliveries for 3 answers, no roster-wide traffic | PASS |

Seeded session and its 5 players deleted afterwards, confirmed 404.

## Ritual

- `node --check` across every `.js` in `y` plus `functions` - **0 failures**
- eleven gates PASS, including the new `aiquiz-answer-spread-check`
- em-dash scan - clean
- bump: `aiquiz-teacher.js` v7, `aiquiz-student.js` v5,
  CACHE_VERSION v403 -> **v404**

## Verify after deploying

Hard-refresh. Host an AI Quiz and look at the projector: the correct answer
should no longer be option A every time. With a normal class, the question
should close by itself once the last student answers, and the host screen
should show "N of M answered" while it waits.
