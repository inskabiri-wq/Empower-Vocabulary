# 2026-08-23 - how many students fit in ONE classroom room, measured

Question: can 1000 students play one game in one room at the same time?

Measured against the Firestore emulator with the SHIPPED render code, rather
than reasoned about. Harness: `y/tools/demos/classroom-load-test.html`.

## Method

- Firestore emulator on 8080. Rules were relaxed **in the running emulator's
  memory only**, through its `:securityRules` admin endpoint. `firestore.rules`
  on disk was never opened. The harness calls `db.useEmulator()` before any
  other Firestore call, so nothing could reach production.
- `updatePlayersDisplay`, `getInitials` and `escapeHtml` are pulled out of
  `classroom/js/teacher.js` by brace matching and evaluated, so the test runs
  the real render path instead of a retyped copy.
- Each size: N players join, a teacher `onSnapshot` listener attaches to the
  players subcollection exactly as `teacher.js` does, then all N students write
  a score update at once, which is one question of a game.

## Result

| players | snapshot callbacks per question | render per callback | render CPU per 20-question game |
| --- | --- | --- | --- |
| 30 | 30 | 1.0 ms | **0.6 s** |
| 100 | 100 | 2.8 ms | **5.7 s** |
| 300 | 300 | 13.5 ms | **81 s** |
| 600 | 600 | 16.1 ms | **194 s** |

**Firestore coalesces nothing.** Snapshot callbacks equalled the player count
exactly at every size: 30/30, 100/100, 300/300, 600/600. Each student write
delivers its own callback to the teacher, and `updatePlayersDisplay` rebuilds
the entire player list on each one, so total work on the teacher's machine is
O(N squared).

Standalone render cost, measured separately with the list at full height and
layout forced:

| players | 30 | 100 | 400 | 700 | 1000 |
| --- | --- | --- | --- | --- | --- |
| ms per render | 5.9 | 15.5 | 49.2 | 69.5 | 81.2 |

## Verdict

| room size | one game |
| --- | --- |
| 30 (a normal class) | fine, under a second of CPU |
| 100 | acceptable, about 6 seconds spread over the game |
| 300 | broken; the teacher's tab spends 81s rendering |
| 600 | unusable; 194s |
| 1000 | not viable without the changes below |

**Rooms are independent**, so 1000 students spread over many rooms is a
different question and is fine. It is the single large room that fails.

## Two numbers NOT to trust from this run

- **Write throughput** (25 to 271 writes/sec). That is one browser tab issuing
  sequential writes to a single-process emulator, not 600 real devices against
  production Firestore. Firestore's own ceiling is around 10,000 writes/sec per
  database and no document here is hot, since every student writes only their
  own doc. Firestore is not the constraint.
- The **two render measurements disagree** (16.1 ms at 600 in the harness
  against 69.5 ms at 700 standalone) because the harness clips the list to a
  300px scroll box, letting the browser skip painting off-screen cards, while
  the standalone run laid out the full list. The direction is identical either
  way; treat the harness figures as the optimistic end.

## A measurement error worth recording

The first run of this harness reported 1.4 ms per render at 300 players. The
container carried `display: none`, which I had added to keep the page tidy, so
the browser skipped layout and paint entirely. A hidden element is not a cheap
render, it is no render. The standalone number for the same code was 49 ms.
Fixed by making the container visible; the comment in the harness now says why.

## Not measured, but visible in the code

`classroom/js/student.js:788` has every student read the WHOLE players
collection at game end to compute their own rank. At 1000 players that is a
million document reads in one burst, roughly $0.60 per game. Worth fixing at the
same time as the listener.

## What would raise the ceiling

1. Teacher live leaderboard: `orderBy('score','desc').limit(20)` plus a
   throttle, with the full list fetched once at the end.
2. Update changed player cards in place rather than rebuilding the list. This
   alone turns O(N squared) into O(N).
3. Student rank from a small precomputed leaderboard document instead of every
   student reading everyone.
4. Optionally batch score writes every few questions, cutting write volume by
   an order of magnitude.

Items 1 and 2 are the ones that matter; either would move the ceiling from
around 100 to well past 1000.
