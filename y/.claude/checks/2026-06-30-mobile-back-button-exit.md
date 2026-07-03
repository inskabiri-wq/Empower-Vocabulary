# 2026-06-30: mobile browser Back button walks straight out of the app

## Root cause
back-nav.js pushed its history "sentinel" (the entry that catches Back and opens
the logout modal) at LOAD time, with no user gesture. Mobile Chrome ignores
history entries added without user activation (its anti "history-trap"
intervention), so the sentinel was skipped and the first Back left the site.
Desktop honours load-time pushState, which is why it "was OK" there.

## Fix (back-nav.js)
Replaced the load-time history.pushState(sentinel) with armSentinelOnFirstGesture():
the sentinel is pushed on the first pointerdown / touchstart / mousedown / keydown
(capture phase, once). By then the push is user-activated, so mobile Chrome keeps
it and Back is reliably trapped. All the other pushes (per showScreen, and
ensureRootSentinel inside popstate) were already gesture-driven, so unchanged.

## Verified (real browser, real back-nav.js, harness)
- On load: history NOT grown, no sentinel (lenStart 2, log []).
- First gesture: history +1 (sentinel armed); second gesture: no change (once).
- Navigate -> Back walks to hub; Back again at hub -> logout MODAL opens, stayed
  on hubScreen. log = [showScreen:grammarScreen, showScreen:hubScreen, MODAL].
- node --check back-nav.js + service-worker.js OK. My lines add 0 em dashes.
- back-nav.js is cache-first with no ?v, so bumped service-worker v69 -> v70 to
  purge the stale copy on the next deploy. No deploy / no push.
