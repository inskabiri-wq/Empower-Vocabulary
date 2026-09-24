# 2026-09-11 - security coverage for all nine classroom games

## What was built

`y/tools/games-security-check.js`. One table, nine games, **134 checks**, driven
against the local emulator with real ID tokens so `firestore.rules` is enforced
exactly as it is for a real phone.

Every game is asked the same questions, and the negatives are the point:

    can a student write ANOTHER student's score?
    can a student take over the room?
    can a student kick someone?
    can a second teacher control a room they did not create?
    can a signed-out person read or join?

plus per-game questions about what that game actually holds: the AI Quiz answer
bank, Heist vault passwords, exam answer documents.

Adding a tenth game is a row in the table.

## Result: 132 pass, 2 fail, and the 2 are the same real bug

**Students can read each other's exam answers, live, in the classroom Reading
and Listening exams.**

`firestore.rules`, in both:

    match /answers/{questionId} {
      allow create, update: if isOwner(uid);
      allow read: if isAuth();          <-- any signed-in user, not just the owner
    }

Proven end to end, starting from nothing but the room code that is on the
projector:

    attacker knows only the room code: PEEK1
    1. read the session doc          -> HTTP 200
    2. LIST every player to get uids -> HTTP 200   found 2 uids
    3. read THEIR answer document    -> HTTP 200
       leaked value: "the correct answer is Paris"
    EXPLOITABLE: YES

Step 2 is what turns this from theoretical into practical: the `players`
subcollection is also `allow read: if isAuth()`, so the attacker does not need
to know anybody's uid in advance. Three requests from the browser console
during a live exam.

Writing is correctly blocked (`isOwner`), so a student cannot tamper with
someone else's answers. They can only read them. In an exam, reading is the
whole game.

## Why the rule is loose, and why the fix is safe

The host has to read every student's answers to grade live
(`reading-teacher.js:431` walks `players/{uid}/answers`). `isAuth()` is the
lazy way to allow that.

Checked what actually reads these documents before proposing anything:

    reading-student.js:211    players.doc(myUid).collection('answers')    own only
    listening-student.js:191  players.doc(myUid).collection('answers')    own only
    reading-teacher.js:431    players.doc(p.uid).collection('answers')    all, for grading

**No student client ever reads another student's answers.** So tightening to
owner-or-host breaks nothing:

    allow read: if isOwner(uid) || _isReadingHost(code);
    allow read: if isOwner(uid) || _isListeningHost(code);

Both helpers already exist and are already used by the delete rule in the same
blocks.

**Not applied.** This is a rules change and rules deploys are the user's, so it
is reported rather than shipped.

## A test failure that was mine, not the app's

The first run reported three failures. One was "student may READ the question
bank" on AI Quiz, which looked like a rules problem and was not: the check read
`meta/questions` without ever creating it, so the 404 was a missing fixture, not
a 403. Seeded it with the owner bypass and it passes.

Worth recording because a 404 and a 403 look equally like "failure" in a status
code, and only one of them is a security finding.

## What is NOT covered yet

This is the security half. The other half Alireza asked for - scoring
correctness and answer-guessability, the class of bug that produced "the right
answer is always option A" - is still to do for the eight games that are not AI
Quiz.

## Ritual

- `node --check` clean, em-dash scan 0
- picked up by `gates.js` automatically and classified `emulator`
- all test data deleted by the check itself as it goes
- no app file or rule changed by this work
