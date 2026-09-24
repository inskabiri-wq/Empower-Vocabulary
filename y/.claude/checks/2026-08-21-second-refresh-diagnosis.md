# 2026-08-21 - second refresh, DIAGNOSIS ONLY (no app code changed)

Reported still double-refreshing after deploying v295. Asked for reasons, not a
fix. No application file was modified in this pass. Two harnesses were added.

## The reason, reproduced 9/9

`tools/demos/hub-double-render-trace.html` drives the real `student/js/hub.js`.

```
1. journeyStats starts as a zero default            config.js:132
2. gridSignature() INCLUDES getSkillProgress()      hub.js:186
3. so the first renderHub() draws every tile at 0%
4. auth.js:153 -> loadJourneyStats() -> Firestore
5. progress.js:144 -> updateJourneyCard()
   -> writes #journeyAccuracy                       progress.js:165
6. new MutationObserver(renderHub) on that element  hub.js:372   FIRES
7. signature now differs -> grid.innerHTML = ''     hub.js:212
   -> the entire grid is torn down and rebuilt
```

Measured, with no direct `renderHub()` call anywhere in the test - only the
`#journeyAccuracy` write that `progress.js` really performs:

| check | result |
| --- | --- |
| renderHub() with no data change rebuilds nothing | 0 rebuilds (guard works) |
| writing `#journeyAccuracy` rebuilt the WHOLE grid | yes |
| full teardown, not an in-place update | yes |
| percentages `0% 0% 0% 0%` -> `43% 61% 30% 12%` | yes |
| settles - one extra rebuild, not a loop | yes |
| **with stats present at first paint, same write rebuilds nothing** | **0 rebuilds** |

That last row is the important one: it is not the observer that is wrong, it is
that the first paint has no data to draw.

## Why the v295 fix did not fix this

The `lastPublished` seed was real and is still correct - it removed a redundant
`feature-toggles-ready` publish, control-tested at 13/13. But that is a
different path. This one never touches feature toggles, which is why four
rounds of work in that area could not reach it.

## Same bug class as the one already fixed

`progress.js:141` DOES write `journeyStats` to localStorage. `progress.js:152`
only reads it back **inside the catch block**, i.e. only when Firestore errors.
So the happy path can never prime the first paint - exactly the mistake
`feature-toggles.js` made with `lastPublished`, in a different file.

## Secondary contributors (real, not yet harnessed)

- **Profile icon, up to 3 paints.** `progress.js:260 loadProfile()` paints from
  localStorage (:277), then again after its Firebase get (:272); `auth.js:124`
  then calls `loadAvatarFromFirebase()` for a third.
- **Assignments card.** `renderMyAssignments()` has 8 call sites; :323 on data
  load and a `setTimeout(..., 500)` at :1847 both land after first paint.
- **Placement tile appends late.** `skill-tile-placement.svg` loads well after
  the other eight tile SVGs in the waterfall - the card is appended to
  `#hubGrid` after the grid is built.

## Not causes (checked, so they stop being suspects)

- Duplicate auth boots: `auth.js` (`bootedForUid`), `hub-preload.js`
  (`started`), `placement-tile.js` (`booted`) are all guarded.
- `loadJourneyStats()` has two call sites but only `auth.js:153` runs on boot;
  `auth.js:228` fires after logging a practice session.
- The observer does not retrigger itself - confirmed it settles.
- `js.js` / `dom.js` initiated by `content.js:326` in the waterfall are injected
  by a browser extension, not by this app.
- Deploy landed: the waterfall shows `feature-toggles.js?v=9`.

## Waterfall notes

`DOMContentLoaded 535ms`, `Finish 2.07s`. That ~1.5s tail is when the late data
arrives, and it is the window the rebuild happens in - long enough to read as a
second load rather than a flicker.

## Fix direction (NOT applied)

Prime `journeyStats` from its existing localStorage copy before the first
render, the same way `feature-toggles.js` now primes its toggles. Check 9 above
already demonstrates this makes the rebuild a no-op. Alternative or additional:
update the percentage text in place instead of rebuilding the grid.
