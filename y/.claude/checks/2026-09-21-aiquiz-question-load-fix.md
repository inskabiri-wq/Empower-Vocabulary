# 2026-09-21 - "questions not loading for some phones", fixed

Reported by Alireza the day before the 300-student orientation: some phones
never showed a question. Diagnosed, fixed, and proved against a control.

## The bug

`y/classroom/js/aiquiz-student.js`, in `join()`:

    var qs = await ref.collection('meta').doc('questions').get();
    questions = (qs.exists && qs.data().items) || [];

One read. No retry, no try/catch, no error surfaced. A single transient
failure left `questions` empty for the WHOLE game, and then:

    var q = questions[shownIndex];
    if (!q) { show('wait'); return; }        // silently, for ever

That phone sat on the waiting screen permanently. Its session listener kept
working, so it looked connected and the student could see the game was
running - no error, no way back. NOT a scale problem: it does this with 20
students. It is a per-device dice roll at one instant, which is exactly why it
hit "some" phones.

Ruled out first, by reading the code rather than guessing:
- **Not a race at room creation.** `createRoom` awaits the session doc AND
  `meta/questions` before `openLobby()` reveals the QR, so no student can see
  the code before the bank exists.
- **Not the security rules.** `match /meta/{docId} { allow read: if isAuth(); }` -
  fully permissive. The recent rules work did not touch it.

## The fix, three parts, all on the failure path

1. `readQuestions(ref)` - three attempts, backoff plus jitter, same shape as
   the existing `attemptAuth`. An empty `items` counts as a failure, because a
   quiz with no questions cannot be played and a doc mid-replication reads
   exactly like that.
2. `join()` now handles the failure instead of proceeding: clears `code` and
   `myRef` (which releases the refresh guard so retrying is clean) and toasts
   "Could not load the questions. Check your connection and tap Join again."
   The whole body is wrapped in try/catch - previously a single rejected
   promise killed `join()` silently and the button just looked dead.
3. `renderQuestion` calls `recoverQuestions()` instead of silently parking on
   'wait'. It re-fetches once per question and draws as soon as the bank
   arrives, so a phone that lost the read heals at the next question rather
   than being dead for the rest of the game. Guarded against stacking, and it
   only draws if the host is still `asking` that question.

**No change to any scoring line, any write, or the happy path.** Confirmed:
`git diff` shows no `+`/`-` on any line containing gained / increment /
answeredQ / myScore, and games-scoring-check still extracts
`correct ? (100 + Math.round(50 * frac)) : 0` from the shipped file.

## Proof, against a real control

Three tests driving the REAL student page in a browser via the emulator hook:

    A. room with NO question bank
       old: parks on 'wait' silently, for ever
       new: stays on the join screen, toast "Could not load the questions...",
            refresh guard released so Join can simply be tapped again     PASS
    B. bank restored, tap Join again
       joins cleanly, no toast, waiting screen with their name            PASS
    C. phone holds a 2-question bank, host asks question 5
       new: recovered in 250 ms, rendered "Question 5 of 10", 4 buttons   PASS

### The control run I got wrong the first time

The first control reverted the file on disk and re-ran test C - and the old
code "recovered" too, which would have meant the test proved nothing. It was
the harness: the browser served `aiquiz-student.js?v=5` from its HTTP cache
and never fetched the reverted file.

    onDisk_hasFix         false
    whatTheBrowserUsed    true      <- ran the FIXED code from cache
    transferSize          0

Re-run on a SECOND ORIGIN (`static-y-alt`, port 5174) so no cache was shared,
with `runningCodeHasFix: false` asserted before starting:

    CONTROL, original code, same scenario:
      stuck on 'wait' for 12s, nothing rendered      <- the reported bug
    FIXED code, same scenario:
      recovered in 250ms, "Question 5 of 10"

This is the third time this project's caching has faked a result. Assert which
build is actually running before trusting any A/B.

## Ritual

- `node --check` clean, em-dash scan 0
- restored byte-identical to the tested build after the control (`diff -q`)
- `bump.js`: aiquiz-student.js ?v 5 -> **6**, CACHE_VERSION v415 -> **v416**;
  `--check` reports no drift. **The bump is the load-bearing part for
  tomorrow** - without it every phone keeps the cached old file.
- **28 gates pass, 0 fail**, 1 production skip
- AI Quiz e2e 19/19, games security 138/138, scoring 16/16
- load rehearsal **500 students x 20 questions: 500/500 every stage, no lost
  updates**, and separately 400 players x 20 questions driven through the real
  host page: peak heap 10.9 MB, DOM flat at 265 all game
- all emulator test data deleted

## Deploying - HIS to run, and it matters before tomorrow

    firebase deploy --only hosting

Hosting only. No rules change, no functions change.
