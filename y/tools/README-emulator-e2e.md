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

3. Point the app at the emulators. Do NOT commit this into production config. Add the
   snippet below to a LOCAL-only copy, or paste it once in the browser console right
   after the page's Firebase init, or guard it so it only runs on localhost with a flag.
   The guard shown here refuses to run anywhere except localhost:

   ```js
   // run only against the emulators, never production
   if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
     firebase.auth().useEmulator('http://127.0.0.1:9099');
     firebase.firestore().useEmulator('127.0.0.1', 8080);
   }
   ```

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
