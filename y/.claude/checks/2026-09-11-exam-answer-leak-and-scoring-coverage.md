# 2026-09-11 - the exam answer leak, closed; guessability covered

## 1. Students could read each other's exam answers. Fixed.

Found by `games-security-check.js` on its first run. In the classroom Reading
and Listening exams, `firestore.rules` had:

    match /answers/{questionId} {
      allow create, update: if isOwner(uid);
      allow read: if isAuth();          <-- ANY signed-in user
    }

Proven end to end from nothing but the room code on the projector:

    1. read the session doc          -> 200
    2. LIST players to harvest uids  -> 200   (that subcollection is isAuth() too)
    3. read THEIR answer document    -> 200
       leaked value: "the correct answer is Paris"

Three requests from a browser console, mid-exam. Writing was correctly blocked,
so nobody could tamper; they could only read. In an exam that is the whole game.

### The fix, and why it is safe

`isAuth()` was the lazy way to let the HOST grade. Checked who actually reads
these documents before changing anything:

    reading-student.js:211    players.doc(myUid).collection('answers')   own only
    listening-student.js:191  players.doc(myUid).collection('answers')   own only
    reading-teacher.js:431    players.doc(p.uid).collection('answers')   all, grading

No student client ever reads another student's answers, so naming the host
explicitly breaks nothing:

    allow read: if isOwner(uid) || _isReadingHost(code);
    allow read: if isOwner(uid) || _isListeningHost(code);

Both helpers already existed in the same blocks, used by the delete rule.

Re-ran the exploit against the tightened rules:

    3. read THEIR answer document    -> HTTP 403
       EXPLOITABLE: no
    host can still read for grading  -> HTTP 200

A POSITIVE assertion was added alongside the negative one, because tightening
too far would break grading silently:

    the HOST can read a student's answer (grading must keep working)  ok

## 2. Security coverage: nine games, 138 checks

`y/tools/games-security-check.js`. One table, nine games, real ID tokens
against the emulator. Every game is asked whether a student can write another
student's score, take over the room, kick someone; whether a second teacher can
control a room they did not create; whether a signed-out person can read or
join. Plus per-game questions about what each game holds: the AI Quiz bank,
Heist vault passwords, exam answers.

**138 of 138 pass** after the rules fix.

## 3. Guessability coverage: every question source

`y/tools/games-answer-check.js`. The AI Quiz bug had a shape:

    a bank authored with the answer in a fixed slot,
    consumed by code that does not shuffle.

Either half alone is fine. Both together is the bug. So this checks every
source in the app:

| source | result |
| --- | --- |
| grammar bank, 5541 questions (MG.grammarMCQs passes `q.answer` through UNSHUFFLED, so the bank must be spread at authoring time) | top slot **25.4%** |
| `MG.vocabMCQs`, executed for real over 800 generated questions | top slot **27.8%** |
| 46 reading/listening exam JSONs, 717 letter answers | top slot **26.5%** |
| each exam file individually | none clusters |

Uniform over four options is 25%. **AI Quiz was the only guessable source in
the app, and it is already fixed.** That is worth knowing: the instinct after
finding one such bug is to assume the codebase is full of them.

## The break proof found a bug in my own gate

Dropped in a fake exam with 50 answers all in slot "a". **The gate passed.**
Those 50 diluted into the 717 real answers and moved the corpus top slot from
26.5% to 28.9%, comfortably under the threshold.

So the aggregate check could not see a single badly-authored exam - which is
precisely the AI Quiz bug, one bank with everything in one slot. Added a
per-file check (files with 10+ letter answers, flagged above 70% in one slot),
and re-ran:

    FAIL  individual exams whose answers cluster in one slot
          readings/zz-temp-skew-probe.json  50 answers, 100% in one slot  a:50

Probe deleted, confirmed gone, gate green again.

A check that cannot fail is not a check. This one could not, until it was
tested.

## Ritual

- both gates auto-discovered by `gates.js`: **27 gates**, 26 pass, 1 production skip
- `node --check` clean, em-dash scan 0 on both
- all emulator test data deleted by the checks themselves
- only `firestore.rules` changed outside `y/`

## Deploying

Rules only. No hosting change, no functions:

    firebase deploy --only firestore:rules

**DONE.** Deployed 2026-09-11 08:30:56Z, ruleset `246e8468`. Verified after the
fact with `node y/tools/rules-live-check.js`, which reads the active ruleset
back from the Rules API:

    live bytes 57196 == disk bytes 57196
    live ruleset === firestore.rules on disk : YES
    missing-FIELD grants 0, missing-DOCUMENT grants 0, closed ownership checks 7

So the answer leak is closed in production, not just on disk.
