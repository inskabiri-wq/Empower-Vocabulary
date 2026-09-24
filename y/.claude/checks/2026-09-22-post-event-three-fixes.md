# 2026-09-22 - the orientation ran; three fixes from what it showed

The AI Quiz ran at the FSMVU orientation. **Room SUZNC, 99 students, 10
questions at 20 seconds, all ten played, finished clean.**

## What the production data actually showed

Read-only from production after the event:

    players                99
    answered >= 1 question 90
    NEVER answered          9     <- the "stuck" students
    duplicate names         9     <- the same nine, rejoining
    join window          326 s    (11:40:02 to 11:45:28)

The nine who never answered and the nine duplicate names are the SAME PEOPLE:
"Sare Erkıral" stuck / "sare" twice, "şevval" stuck / "şevval" twice, "B"
stuck / "b" twice. Their player documents exist WITH their names, so the join
succeeded. They were deaf, not absent. About 9% of the room.

This ran on v418, i.e. WITH the previous night's question-load fix. That fix
made the failure visible and recoverable; it did not prevent it, because the
cause was different.

## Fix 1 - the session listener had no error handler

`watchSession()` in `aiquiz-student.js` called `onSnapshot(cb)` with no error
callback, while the host's listeners have had one from the start. A listener
that drops is then gone for good: the phone keeps its question bank, keeps
looking connected, and never hears another word.

Now re-attaches on error with backoff plus jitter (700ms * 2^n, up to 6
attempts), resets its counter on any delivered snapshot, and after six failures
tells the student to reload rather than pretending.

**Verified:** killed the listener for real (signed the student out, so reads
fail `isAuth()`), let the retry chain run, signed back in, advanced the host.
The phone heard Question 4 **300 ms** later and rendered it with four answer
buttons. Old code: deaf for the rest of the game.

## Fix 2 - "everyone answered" now works at real room sizes

Two separate defects, both fixed:

**a) The cap.** `AUTO_CLOSE_MAX_PLAYERS` was 60, so at 99 students the feature
never armed and every question sat out its full 20 seconds. Raised to **400**.
That is a cost ceiling, not a correctness one: the filtered listener delivers
at most one delta per student per question, so 400 x 20 is about 8,000 extra
reads against a measured event total of ~13,400 and a free daily allowance of
50,000.

**b) The count was frozen.** `expected` came from `lastRosterCount`, which only
the LOBBY listener writes - and that listener is released the instant the quiz
starts. So the target froze at the Start-time count for the whole game. With a
326-second join window, pressing Start early would have closed every question
as soon as the first cohort answered. Now re-read with one `players.get()` per
question, with the question index pinned so a slow read cannot leak into the
next question.

**Verified against a 99-player room, the real event size:**

    armed at 99                    "0 of 99 answered"   (old cap: blank)
    60 of 99 answered              still OPEN           (old frozen count: would have closed)
    99 of 99 answered              AUTO-CLOSED in 744 ms, "Everyone answered", ladder shown
    20 latecomers join mid-game    next question reads "0 of 119 answered"

That last line is the frozen-count bug, dead.

## Fix 3 - music restored

`MG.setupMusic([])` back to `MG.setupMusic()`, and the `hidden` attribute
removed from `.music-control`.

Worth recording: **the floating music pill was never the control on this page.**
`y/js/app-settings.js:587` deliberately hides the whole `.music-control`
cluster and moves play / next / volume into the display-settings wheel, so
there is only one music control. Last night's `hidden` attribute was therefore
redundant - what actually disabled the music was `setupMusic([])` stubbing
`toggleMusic` to a no-op, which killed the wheel's button too.

**Verified:** wheel opens, 🎵 / next / volume all present, `toggleMusic` and
`nextTrack` are the real functions again.

## Ritual

- `node --check` clean on both JS files, em-dash scan 0
- `bump.js`: aiquiz-student.js ?v 8 -> **9**, aiquiz-teacher.js ?v 8 -> **9**,
  CACHE_VERSION v418 -> **v420**; `--check` no drift
- **28 gates pass, 0 fail**, 1 production skip
- load rehearsal 500 x 20Q: no lost updates
- all emulator test data deleted

## Deploying - HIS

    firebase deploy --only hosting

Hosting only. No rules or functions change.
