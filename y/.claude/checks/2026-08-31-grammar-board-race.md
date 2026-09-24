# 2026-08-31 - the Quest Board's zeros were a race, and my first diagnosis was wrong

## The correction first

I reported that the hub tile's 81% was stale cache and predicted it would drop
to 0% after deploying. **That was wrong**, and it was wrong because I diagnosed
the wrong account.

I queried `akabiriaslifar@fsm.edu.tr`, which genuinely has zero grammar
sessions. The signed-in account is **`edtech@fsm.edu.tr`**, which has 13 across
A2, B1, B1+ and B2. Searching every account in the project for one computing to
exactly 81% grammar returned exactly one, and it was that account.

Running the board's own formula against its real documents:

| | value |
| --- | --- |
| hub tile, `sum(correct)/sum(questions)` | **81%** (127/156) |
| board, `mean(percentage)` | **81%** |
| board, `best(percentage)` | **100%** |

All 13 sessions carry `percentage`. Both formulas agree. **The 81% was correct
all along; the board's zeros were the bug.**

## The real cause: a race the map could never recover from

`openMap()` did not compute a summary. It replayed a string:

```js
sum.innerHTML = lastSummary;
```

`lastSummary` was built during `renderMenu()`. If that ran before the Firestore
session read landed, `grStats` was still null and the summary was built from
zeros. Nothing recomputed it, because the refresh was gated on a view the
student had already left:

```js
ensureGrammarProgress(function () { if (state.view === 'menu') renderMenu(); });
```

Open the map and `state.view` is no longer `'menu'`, so the callback fired and
did nothing. The board kept its zeros for the rest of the session.

A second defect compounded it:

```js
if (grLoading) return;   // dropped `after` entirely
```

Anything asking for progress while a load was in flight had its callback
silently discarded, so only the very first caller was ever told.

That also explains the B2 unit cards reading "Not Started": with `grStats` null
the board fell back to a level-scoped local count, and that account has one B2
session.

## Fixed

1. **Callbacks queue** rather than being dropped, and each is run in its own
   try/catch so one throwing does not block the rest.
2. **`refreshAfterProgress()`** refreshes whatever is on screen: the menu if it
   is showing, and an open Quest Board through a repaint handle that `close()`
   clears, so a stale handle can never write into a removed node.
3. **The board builds its own summary.** `statsHTML(info)` moved to module
   level and is called inside `paint()` from the same `info` the unit cards are
   built from, so cards and headline numbers cannot disagree. Opening the map
   also kicks the load itself, so the map works even if opened first.

`lastSummary` and the now-orphaned `stats` variable in `renderMenu` are gone
rather than left unread.

## Executed, not just syntax-checked

The real `ensureGrammarProgress` and `buildRemote` were pulled out of the file
and run against a fake Firestore whose read is resolved by hand, so the race
could be reproduced deliberately:

| check | result |
| --- | --- |
| first caller is called | PASS |
| **second caller arriving mid-load is called too** (was dropped) | PASS |
| a caller arriving after the load fires straight back | PASS |
| accuracy is the real mean, not 0 | PASS |
| best is the real max, not 0 | PASS |
| challenges counted, answered questions summed | PASS |
| one throwing callback does not block the next | PASS |

## What stands from the earlier session, and what does not

- **"Answered" relabel: stands.** 2326 was still a count of questions that
  exist, not questions answered.
- **Per-uid stats cache: stands as an improvement, but was not the cause.** An
  unscoped `journeyStats` key shared between accounts on one browser is a real
  problem; it simply was not this one.
- **My "it will read 0%" prediction: withdrawn.** It will read 81%, and that is
  correct.

## Ritual

- `node --check` across every `.js` - 0 failures
- new names checked for collisions; grammar.js is IIFE-wrapped so its
  `statCard` cannot clash with the one in teacher/js/admin.js, and the two
  never load on the same page anyway
- em-dash scan - clean
- gates: seventeen, all PASS
- bump: grammar.js, CACHE_VERSION -> **v384**; `--check` OK
