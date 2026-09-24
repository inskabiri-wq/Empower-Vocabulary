# Real login E2E with the Firebase emulators

Goal: actually test `log in -> hub -> vocabulary -> grammar` on your own machine,
against a fake student account, without touching production and without needing a
real FSM login. Today the only way to "verify" is throwaway harnesses, because the
live app needs a signed-in student.

## Java runtime (installed)

The Firestore emulator needs a Java runtime. firebase-tools 15.x requires JDK **21 or
newer** (JDK 17 is refused with "firebase-tools no longer supports Java version before
21"). Microsoft OpenJDK 21 is now installed on this machine, `JAVA_HOME` points to it,
and the Firestore emulator was confirmed to boot. On a different machine: install a
JDK 21+, reopen the terminal, and `java -version` should report 21 or higher.
The Auth emulator itself does not need Java, but the dashboard reads the student's
Firestore doc on load, so both emulators are required for a real login flow.

## Every-time flow

1. Start the emulators (from `E:\vocab-trainer`):

   ```
   firebase emulators:start --only auth,firestore --project empower-vocabulary-practice
   ```

   Default ports: Auth 9099, Firestore 8080, Emulator UI 4000.

2. In a second terminal, seed the demo accounts + data:

   ```
   node y/tools/seed-emulator.js
   ```

   (Run `node y/tools/seed-emulator.js --dry-run` first to see exactly what it writes.)
   This creates:
   - student  `demo.student@fsm.edu.tr` / `Passw0rd!`  (role student, active, verified,
     level B1, class B101, module 2, book empower - so no gate blocks it)
   - teacher  `demo.teacher@fsm.edu.tr` / `Passw0rd!`
   - one class doc

3. Point the app at the emulators. **This is now built in - no snippet to paste and no
   local copy to maintain.** Open any page on localhost and run this once in the
   console:

   ```js
   localStorage.setItem('useEmulators', '1');   // then reload
   ```

   `js/firebase-init.js` reads that flag right after `initializeApp` and, ONLY when the
   page is served from localhost or 127.0.0.1, points Auth and Firestore at the local
   emulators. Clear the flag (`localStorage.removeItem('useEmulators')`) to go back to
   the real project. Measured both ways: with the flag Firestore reports
   `127.0.0.1:8080`; without it, `firestore.googleapis.com`.

   It has to live in `firebase-init.js` and not in a page script, because Firestore
   refuses settings changes once the client has started ("Firestore has already been
   started and its settings can no longer be changed"), so immediately after
   `initializeApp` is the last safe moment.

   `student/js/config.js` and `teacher/js/config.js` still carry their own copy of the
   same block, which is harmless: on a fresh app instance the second `useEmulator` call
   is a no-op for both Auth and Firestore.

   **This covers all 32 pages.** It used to be only the 10 that load a `config.js`, so
   `app.html`, `courses.html`, `placement.html`, `writing-exam.html` and most of the
   classroom pages could not be driven logged in at all.

4. Serve the app locally (the existing `static-y` launch config, or
   `firebase emulators:start` also serves hosting if you add `--only hosting`), open it,
   and sign in with the demo student. You are now in a real login -> vocab -> grammar
   flow with real code and seedable data.

## Notes

- The seed talks to the emulator REST APIs directly (no `firebase-admin` dependency)
  and authorizes with the emulator's `Bearer owner` admin token, so security rules do
  not block the writes.
- The `classes` doc is minimal; if a classroom feature needs more fields, extend
  `classDoc` in `seed-emulator.js` to match `/classes` in `firestore.rules`.
- Emulator data is in-memory by default and is wiped when you stop the emulators. Add
  `--export-on-exit ./emulator-data --import ./emulator-data` to persist it between runs.
- Nothing here changes production: no `emulators` block was added to `firebase.json`,
  and the app connect snippet is localhost-guarded and not wired into shipped code.

## Status

JDK 21 installed (2026-07-02) and the Firestore emulator boot was verified with
`firebase emulators:exec` (it ran and shut down cleanly). `seed-emulator.js --dry-run`
is verified too (requests + Firestore-typed payloads well-formed). The remaining step
is the actual login -> vocab -> grammar clickthrough; all the pieces are ready.
