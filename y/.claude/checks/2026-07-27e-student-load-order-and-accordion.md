# 2026-07-27e - Placement + assignments arrive late, assignment accordion feels slow

Three reported symptoms, three separate causes. NO new Firestore reads, no
function calls, no AI calls: read count before and after is identical.

## 1. Placement card appeared after the other hub cards

`y/student/js/placement-tile.js` did not listen for sign-in, it POLLED:

```js
setTimeout(function () { waitAuth(tries - 1); }, 400);   // x40
```

So after Firebase restored the session the card still sat idle for up to
400ms before its four reads even started. Every other feature on the page
already uses the auth event.

Fix (?v=3): `onAuthStateChanged`, with `a.currentUser` short-circuit for the
already-signed-in case and a DOM-ready guard because `boot()` appends to
`#hubGrid`. A tiny retry remains ONLY for the case where the Firebase SDK
script has not been parsed yet. Same four documents read.

## 2. Assignments list arrived about a second after the skill cards

The skill cards need no network at all, so any wait is visible next to them.
`loadMyAssignments()` ran FIVE sequential network round trips:

```
users/{uid} -> assignments(scope x4) -> assignmentCompletions
            -> sessions(100) -> writingSubmissions
```

`writingSubmissions` only ever needed `myAssignments`, which is known after the
scope queries - it did not depend on completions or sessions, it was just
queued behind them.

Fix (?v=5): extracted `fetchMyWritingSubmissions(user)` (never rejects) and
STARTED it next to the completions query, awaiting it where it was already
awaited. Four stages instead of five:

```
users/{uid} -> assignments(scope x4) -> (completions || writingSubmissions) -> sessions(100)
```

The sessions fallback genuinely depends on completions (`_needsSessionFallback`)
so it correctly stays in order.

NOT done, deliberately: the two-pass "draw cards first, fill status later"
render. It would flash a wrong status (a "Start" button on an assignment the
student already finished) for a few hundred ms, and the safe version means
touching `checkMyAssignmentStatus` - the completion-matching logic that tasks
#57-#66 exist to keep correct. Offered as a follow-up instead.

Also NOT done, per explicit decision: starting the completions query before
the assignments are known. It removes another round trip but bills 1 read for
students with zero assignments (Firestore charges a minimum of one read even
for an empty result). User chose to keep reads identical.

## 3. The assignment accordion felt very slow

`assignments.css` animated `.asg-acc-detail` between `max-height: 0` and a
FIXED `1200px` over `.3s`. Measured real card content: **200px**. So
**1000px of the 1200px travel was empty space** - 83% of every animation.
Opening looked like it snapped then stalled; closing did nothing for a beat
then dropped.

(Phones never saw this: `brand.css` already overrides the transition to 1ms
under 768px. It was a desktop-only symptom.)

Fix: `toggleAsgCard()` now drives `max-height` from the element's real
`scrollHeight` (inline style beats the stylesheet), forcing a reflow between
the measure and the collapse so the closing direction animates too. On open it
hands height back to CSS via `transitionend`, so later content growth (a grade
arriving) is never clipped at the old measure. Duration `.3s -> .22s` with a
standard ease curve, since the distance is now real.

## Verification (real browser, instrumented Firestore stub, real code)
- **Placement first read at +0ms** from the auth event (was: up to +400ms).
- **Assignment reads: 8** - `users/{uid}` 1, `assignments(scope)` 4,
  `assignmentCompletions` 1, `writingSubmissions/doc` 1, `sessions(100)` 1.
  **Identical to before the change.**
- Stage offsets prove the overlap:
  `users +0ms -> scope x4 +1002ms -> completions +1999ms AND writing +1999ms
   -> sessions +3006ms`. Previously writing started a full stage after sessions.
- `renderMyAssignments()` completes and produces a card (render path intact,
  real skill-registry.js + exam-registry.js loaded).
- Accordion, driven through the REAL header click handler: content 200px,
  open sets `max-height: 200px` exactly, close sets `0px`, duration `0.22s`.
- node --check on both changed JS files; ui-sanity PASS; grammar-sanity PASS;
  rubric-sync PASS; em-dash in added lines 0.

## Related finding, NOT acted on (needs a decision)
`users/{uid}` is read separately by at least FIVE scripts on one student
dashboard load: auth.js, student-assignments.js, placement-tile.js,
progress.js, set-password.js. That is roughly 4 wasted reads per page view per
student, plus 4 avoidable round trips. A shared cached promise would REDUCE
cost and latency together. Reported to the user as a separate proposal.

## Ship
```
firebase deploy --only hosting
```
Hosting only. SW v115 -> v116; student-assignments.js ?v=5,
placement-tile.js ?v=3, assignments.css ?v=2 (both dashboards).
