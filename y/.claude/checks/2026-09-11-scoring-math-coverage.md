# 2026-09-11 - scoring math coverage

Completes what Alireza asked for: security AND scoring across all the games.
`y/tools/games-scoring-check.js`, **16 checks**.

## A. The formulas, extracted from the shipped files and executed

Not a copy that can drift. The expression text is pulled out of the real file
and compiled, so if someone edits a formula this runs the edited one. If the
line cannot be found the check fails loudly, which is correct: a changed
scoring formula deserves a fresh look rather than a silent pass.

What it found, printed as it runs:

    AI Quiz  ->  correct ? (100 + Math.round(50 * frac)) : 0
    Scramble ->  ok ? 100 + secondsLeft * 2 : 0
    Tug      ->  increment(ok ? 1 : 0)
    Bingo    ->  mark +10, bingo +60

Asserted per game: a wrong answer scores exactly zero; a correct answer always
scores something; and where a speed bonus exists, faster is worth more. AI Quiz
is checked for monotonicity across 100 steps of its clock, not just at the ends,
because a formula can be right at both extremes and wrong in the middle.

All pass. Bingo's two increments are also compared: a bingo (60) must be worth
more than a single mark (10).

## B. Leaderboard ordering, against the emulator

Seeded four players at 900 / 450 / 120 / 0 and ran the host's own query shape,
`orderBy('score','desc').limit(10)`:

    p_top > p_mid > p_low > p_zero      and the winner is the top scorer

## C. Increment semantics

Several games carry a comment saying an atomic increment means "two answers can
never race". That is a claim about Firestore under concurrency, so it is tested
rather than trusted:

| | |
| --- | --- |
| `increment(0)` leaves the score unchanged | ok |
| 25 simultaneous increments all land (2500, no lost updates) | ok |
| a wrong-answer write (`increment(0)` + `answeredQ`) does not disturb the score | ok |

The last one exists because of the AI Quiz change earlier this week: a wrong
answer now writes, where it used to return early. This proves that write cannot
cost a student points.

## The deliberate break

Rewrote the AI Quiz formula to score 25 for a wrong answer and inverted its
speed bonus. Three failures, correctly named:

    AI Quiz  ->  correct ? (100 + Math.round(50 * (1 - frac))) : 25
    FAIL  AI Quiz: a WRONG answer scored 25
    FAIL  AI Quiz: the speed bonus is not monotonic
    FAIL  AI Quiz: score DROPS somewhere as time-left increases

Restored and confirmed byte-identical with `diff -q`, original formula present,
back to 16/16.

## A tool choice I got wrong

The first version of sections B and C used the REST `documents:runQuery`
endpoint and **hung with no output at all** - not even section A, which needs no
emulator, because stdout was still buffered when the process stalled.

Isolated it with a timing probe: `runQuery` streams its results and a plain
`fetch` never settles on it. `PATCH` returned 200, `runQuery` timed out at 8s.

Rewritten on the Admin SDK, which handles the stream and is what
`retention-check.js` already uses. Worth recording because "no output" reads
like "the script did nothing" when it actually means "it hung before the buffer
flushed".

## Where behavioural coverage now stands

    security      games-security-check    138 checks, 9 games
    guessability  games-answer-check        4 sources, every question bank
    scoring       games-scoring-check      16 checks, 4 formulas + ordering + concurrency

All three auto-discovered by `gates.js`: **28 gates**, 27 pass, 1 production
skip. `preflight.js` ALL PASS.

## Ritual

- `node --check` clean, em-dash scan 0
- `aiquiz-student.js` restored byte-identical after the break proof
- all emulator test data deleted by the check itself
- no app file left changed by this work; nothing to deploy
