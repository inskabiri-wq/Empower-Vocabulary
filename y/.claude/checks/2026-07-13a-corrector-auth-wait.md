# 2026-07-13a — Corrector: wait for auth before "not signed in"

## Why
User opened the corrector (signed into the dashboard) and clicked Analyze, but got
"Please sign in to the dashboard first, then reopen this page." They ARE signed in.
Root cause: Firebase restores the session asynchronously, so
`firebase.auth().currentUser` is null for a moment after page load. The corrector
read it synchronously on click and wrongly reported "not signed in".

## Changes
- `y/lingualab-write/js/corrector.js` (?v=5)
  - Added an auth watcher: `initAuthWatch()` (registers `onAuthStateChanged`,
    seeds from `currentUser`) called at the top of `init()`; module state
    `_authUser` / `_authResolved` / `_authWaiters`.
  - Added `whenAuthUser(cb)`: resolves immediately if a user is present or auth
    has settled, else waits for `onAuthStateChanged` (4s safety timeout so it
    never hangs).
  - `runLiveAnalysis()` now shows "Checking sign-in..." and calls `whenAuthUser`.
    Only if auth settles with NO user does it show the (clearer) message:
    "You are not signed in on this tab. Open Lingualab, sign in, then come back
    here and click Analyze again." Otherwise it calls new `doAnalyze(essay)`
    (the original httpsCallable('analyzeWriting') flow, unchanged).
  - Bumped `index.html` corrector.js `?v=4 -> ?v=5`.
- `y/service-worker.js`: CACHE_VERSION `v93` -> `v94`.

## Verification
- `node --check` corrector.js — OK. em-dash scan (js + html + sw) — clean.
- Controlled browser harness (loads the real ?v=5 with a stubbed Firebase +
  captured `onAuthStateChanged`, clicks Analyze BEFORE auth resolves):
  - A: signed-in-late (auth resolves after the click) -> proceeds, httpsCallable
    CALLED (this is the exact bug, now fixed). Note goes "Checking sign-in..." ->
    analyze. ✅
  - B: signed-out -> httpsCallable NOT called, shows the new "not signed in"
    message. ✅
  - C: already signed in at click -> immediate "Analyzing..." + call. ✅
  - PASS: true
- Smoke: 19 passed / 0 warnings / 1 failure ("Submissions reference real
  assignments" — pre-existing orphaned-submission data, unrelated).

## To ship (user action)
- `firebase deploy --only hosting`, then hard-reload the corrector tab (SW v94
  purges old cache) and test: paste a short essay -> Analyze.
- Note: if it still says not signed in AFTER this deploy, then the session truly
  is not on that tab (e.g. opened logged-out) - sign in to Lingualab and retry.
