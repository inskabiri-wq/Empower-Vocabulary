# 2026-09-21b - music hidden for the AI Quiz, and the six untested gaps closed

Follows `2026-09-21-aiquiz-question-load-fix.md`. Alireza asked for the music
button disabled and for the six gaps I had admitted to be tested properly.

## 1. Music HIDDEN for the AI Quiz only (not removed - his instruction)

`minigame-core.js` already ships the exact opt-out needed: an EXPLICIT empty
array stubs `toggleMusic` / `nextTrack` / `setVolume` to no-ops and hides
`#musicBtn`, with a comment saying so. No new mechanism was invented.

- `y/classroom/js/aiquiz-student.js` - `MG.setupMusic()` -> `MG.setupMusic([])`
- `y/classroom-aiquiz-student.html` - `<div class="music-control" hidden>`;
  markup and the `<audio preload="none">` element left in place, with a
  TO RESTORE note naming both edits.

The other seven games are untouched - verified, their `music-control` markup
is unchanged. Confirmed live in a browser on a phone viewport:
`musicControlPresentInDom: true`, `musicControlVisible: false`,
`toggleMusicSource: "function () {}"`.

## 2. The six gaps

I had listed six things I had NOT tested. Four were testable and are now
tested. Two remain genuinely untestable from here and are stated as such.

### GAP 1 - a real phone. PARTLY CLOSED.
Mobile viewport emulation: 375x812, Android 14 Pixel 8 UA, 5 touch points.
Joined, played, rendered. Smallest answer tap target **56 px** (above the
44 px floor), all buttons inside the viewport, no horizontal overflow.
**Still not a real iOS/Android device** - emulation shares the desktop engine.

### GAP 2 - concurrent REAL listeners. CLOSED, and this was the big one.
`loadtest-aiquiz.js` drives REST and opens NO listeners, so the actual
production mechanism had never been exercised. 300 real `onSnapshot` watches
on one session document:

    all 300 attached, first snapshot in    260 ms
    host writes ONE question change ->     300 / 300 delivered
    median 54 ms   p95 58 ms   slowest 58 ms

Caveat: admin-SDK listeners are gRPC; a phone uses WebChannel. Same fan-out,
different transport.

### GAP 3 - retry storm. CLOSED.
300 clients all failing `readQuestions` at once, 900 reads issued with the
shipped backoff and jitter:

    whole storm 1942 ms, median per client 1672 ms, slowest 1937 ms
    -> worst case a student waits 1.9 s before the error appears

No thundering herd. The jitter does its job.

### GAP 4 - HALF-OPEN WIFI. CLOSED, and it was the one that mattered.
"Connection refused" is the easy case. The venue case is wifi that connects
but never answers. Simulated with a TCP server on 8080 that accepts every
connection and never responds (`scratchpad/stall-server.js`), run INSTEAD of
the emulator:

    10.2 s -> "Could not join: Failed to get document because the client is
               offline. - tap Join again."   and it stays on the join screen

Firestore has its own ~10 s timeout and reports offline correctly. **The retry
does not compound it**, because the session-document read fails first and the
new try/catch catches it immediately.

What the OLD code did on this same network: `join()` rejected with no
try/catch, so the button was silently dead, with no message, for ever. The fix
converts that into a bounded 10 s wait ending in an actionable instruction.

### GAP 5 - emulator is not production. NOT CLOSED, cannot be.
Different latency, no real quotas, no throttling. Every number here is a
floor, not a forecast.

### GAP 6 - anonymous auth quotas. NOT CLOSED, deliberately.
Testing 300 real sign-ups against Google's production limits the night before
would burn the very quota the event needs. Mitigation stays operational:
stagger the QR, and a phone that has opened the page once never signs up again.

## 3. The "double toast" traced - it was not cosmetic

I had waved it off as cosmetic. Traced properly, one tap gives one toast, so
the double I saw was me clicking twice. But tracing it exposed something that
did matter, measured on the shipped build:

    buttonDisabledWhileJoining   false
    buttonLabel                  never changed
    two taps 150ms apart         2 concurrent joins, 2 identical toasts

`join()` is async and was fully re-entrant with no feedback of any kind. On
half-open wifi Firestore takes ~10 s to give up, and for all of it the button
looks dead - so a student taps repeatedly, each tap starting another
ten-second join holding its own network operation.

**Fixed:** a `joining` flag plus `setJoinBusy()` which disables the button and
shows "⏳ Joining...", released in a `finally` on every path. And
`friendlyJoinError()` replaces raw SDK text - "Failed to get document because
the client is offline" is true but useless to a student on a phone.

Verified on the stalled network, six taps over 7.5 s:

    every tap   -> button already disabled, "⏳ Joining..."
    toasts      -> exactly ONE, at 10.0 s
    message     -> "No connection right now. Check your wifi and tap Join again."
    after       -> button restored, still on the join screen

Sequential retries after a FAST failure still work and should: five taps at a
non-existent code give five joins and five messages, because each finishes in
milliseconds. The guard is for concurrency, not for stopping a student trying
again.

## 4. A REAL operational trap, found by accident in the end-to-end run

Driving host and student in the SAME browser broke the host page: it reset to
the setup view, the resume key vanished, and every subsequent Create was
`PERMISSION_DENIED` at `firestore.rules:1048` (`allow create: if isTeacher()`).

Cause: **Firebase Auth persists PER ORIGIN.** Both pages were on
`localhost:5173`, so the student page's `signInAnonymously()` replaced the
teacher's session. The host tab was then an anonymous user with no `users`
document, so `isTeacher()` was false and it could no longer create rooms.

Confirmed: the host tab's user became `uid zVW5c8XRlVRusr1HZa3scDFtrBf3,
email null, (no user doc)`. Signing the teacher back in and re-running on
separate origins (host 5173, student 5174) worked first time.

**This is not an app bug, but it is a live trap for the event.** If Alireza
opens the student page in the same browser as his host page - to test-join his
own room - he signs himself out of the teacher account and the host page stops
working. Test-joining must be from a PHONE or a private/incognito window.

## 5. Full end-to-end on the final build (v8 / v418)

Host origin 5173, student origin 5174, real pages, no seeding:

    host: Create room -> WPYPS, lobby, "20 questions - 30s each"
    student: join -> waiting screen, name shown, music control NOT visible
    host: "Start quiz (1)" -> live, "Question 1 of 20", timer running
    student: question in 250 ms, 4 answer buttons
    student: answers -> "Correct  +132", score 132, buttons locked

Scoring, timing, lockout and the hidden music all confirmed on the shipped
build.

## 6. My own harness lied to me, twice

Worth recording because it has now happened three times on this project.

1. The first A/B control "passed" for the old code because the browser served
   `aiquiz-student.js?v=5` from its HTTP cache and never fetched the reverted
   file (`transferSize: 0`). Re-run on a second origin (port 5174) with
   `runningCodeHasFix: false` asserted first, the old code sat stuck for 12 s.
2. The phone test loaded stale HTML referencing `v=5` after the bump to `v=7`.
   Fixed by cache-busting the PAGE url, and by asserting the script version in
   the result rather than assuming it.

**Assert which build is actually running before trusting any A/B.** Also: real
mouse clicks via `computer` land off-target when the viewport is scaled -
hit-tested synthetic dispatch is the reliable path, as
[[test-clicks-with-hit-testing]] already says.

## Ritual

- `node --check` clean, em-dash scan 0 on both changed files
- `bump.js`: aiquiz-student.js ?v 6 -> **8**, CACHE_VERSION v416 -> **v418**;
  `--check` no drift
- **28 gates pass, 0 fail**, 1 production skip
- load rehearsal 500 students x 20 questions: 500/500, no lost updates
- all emulator test data deleted, stall server stopped, viewport reset

## Deploying - HIS, and it supersedes the earlier one tonight

    firebase deploy --only hosting

This deploy now carries BOTH the question-load fix and the hidden music.
