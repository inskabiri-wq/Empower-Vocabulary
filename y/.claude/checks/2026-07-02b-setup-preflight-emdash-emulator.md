# 2026-07-02: setup improvements #3, #4, #5

## #3  y/tools/preflight.js - one-command end-of-change checklist
Runs and prints PASS/FAIL per section (exit 1 on any fail):
 1. syntax-parse every real .js on disk (in-process vm.Script, fast; 103 files);
 2. grammar-content sanity (grammar-sanity.js);
 3. cache-version drift (bump.js --check);
 4. data JSON parses (datasets.json, gateway_dataset.json, multipleChoiceOverrides.json);
 5. em-dash scan of the files passed as args (the ones you changed).
Verified: clean run = ALL PASS; a file with an em dash in a string = em-dash section
FAIL with the offending line + exit 1.

## #5  em-dash guard (write-time) + shared scanner
- y/tools/emdash-scan.js: shared detector. Flags em/en/horizontal-bar dashes in
  shippable text; SKIPS line + block comments (incl. multi-line box art) and regex
  character classes; treats .md/.txt/.json as pure content. CLI + module.
- y/tools/emdash-hook.js: PostToolUse wrapper. Reads the tool JSON on stdin, and for
  Edit/Write/MultiEdit to a js/css/html file under y/, scans it and exits 2 with the
  offending lines so it gets fixed at write time. Gated to /y/ app files to stay quiet.
- Wired in .claude/settings.local.json under hooks.PostToolUse (matcher
  Edit|Write|MultiEdit). settings JSON validated.
Verified: scanner flags a string em dash, ignores a comment em dash and a regex
[.,!?...] class; hook exits 0 outside /y/, exits 2 with message inside /y/.

## #4  y/tools/seed-emulator.js + README-emulator-e2e.md - real login E2E
Dependency-free seed of a demo student + teacher + class into the Auth + Firestore
emulators via their REST APIs (Bearer owner admin token), so real
login -> vocab -> grammar can be tested without production. Student doc carries every
gate field (role/active/registeredAt/lastVerifiedAt/level/class/module/book).
STATUS: built, NOT run - the Firestore emulator needs Java (JDK), which is not
installed on this machine. Verified via --dry-run: all 5 requests + Firestore-typed
payloads are well-formed and valid JSON. README documents the one-time Java install
and the localhost-guarded app-connect snippet (not wired into production).

## Safety
No production app code, firebase.json, or firestore.rules changed. node --check /
preflight clean on all new tools. em-dash 0 in every new file. No deploy / no push.

## Update (same day): Java installed - #4 emulator now unblocked
- `winget install Microsoft.OpenJDK.17` first (docs said JDK 11+). WRONG: booting the
  emulator failed with "firebase-tools no longer supports Java version before 21".
- Installed `Microsoft.OpenJDK.21` (21.0.11 LTS). JAVA_HOME (machine) now points to it;
  jdk-21\bin is first on the machine PATH, so `java` resolves to 21 in a fresh terminal.
- Verified: `firebase emulators:exec --only firestore` boots and shuts down cleanly on
  JDK 21 (printed EMULATOR_BOOTED_OK) even with the fresh-terminal env (both JDKs on
  PATH). So the Firestore emulator, and the #4 login E2E, are unblocked.
- JDK 17 uninstall failed (MSI 1603, needs admin elevation); left in place. Harmless
  because 21 wins on PATH + JAVA_HOME. Can be removed later from an elevated terminal:
  `winget uninstall --id Microsoft.OpenJDK.17`.
- README-emulator-e2e.md corrected (JDK 21+, not 11+) and status updated.
