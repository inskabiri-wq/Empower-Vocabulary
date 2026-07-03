# 2026-07-02: FIRST REAL END-TO-END - login -> vocab -> grammar (emulators)

## Setup completed this session
- JDK 21 installed (17 removed); firebase.json got a local-only "emulators" block
  (auth 9099, firestore 8080, ui 4000) - deploys ignore it.
- Emulator-connect snippet (localhost + localStorage.useEmulators==='1' double guard)
  added AFTER firebase init in: y/index/js/main.js (login page - the real init),
  y/index/js/firebase-config.js (NOTE: loaded by NO page - dead file, review finding),
  y/student/js/config.js (dashboard).
- Seeded via y/tools/seed-emulator.js: demo student/teacher/class (all 200 OK).

## E2E walked and PASSED (real browser, real app, zero console errors)
1. Login page connected to emulators (auth.emulatorConfig = 127.0.0.1:9099).
2. Signed in demo.student@fsm.edu.tr -> gates passed -> student-dashboard.html.
3. Hub rendered seeded profile: Demo Student, B101 / B1 / Module 2 chips, and the
   SDK's own "Running in emulator mode" banner (proof production untouched).
4. Vocabulary: Empower lock LIVE (selectedBook=empower, Book picker hidden);
   Multiple Choice question answered correct (score 1, TTS synth has 3 voices).
5. Grammar: A2 Fill drill; Show hint revealed "Grammar: Do/Does rule" + "Starts
   with: d" (no verb clue for the auxiliary - correct behaviour); typed "does" ->
   "Correct."
6. Emulator Firestore user doc shows lastLogin updated BY the login flow (11:59Z).

## Found along the way
- The stale-cache class hit the E2E itself twice: an old SW served a pre-patch
  firebase-config.js, and Chrome's memory cache served a stale main.js through
  reloads. Fresh NAVIGATION (new document) picks up the new code - documented here
  because pilot users may need the same (reopen tab, not just reload).
- y/index/js/firebase-config.js is loaded by no page (dead duplicate of the init) -
  code-review item.
- Hub title still says "FSM Language Trainer" (not Lingualab) - branding review item.

## Ritual
node --check on all touched JS OK; preflight ALL PASS; service worker v70 -> v71
(main.js/config.js are cache-first, no ?v=). No deploy / no push.
