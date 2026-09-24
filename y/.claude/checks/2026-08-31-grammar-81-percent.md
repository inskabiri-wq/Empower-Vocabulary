# 2026-08-31 - 81% on a tile, 0% on the board, and zero grammar sessions

Reported with a screenshot: the grammar hub tile showed **81%** while the
grammar Quest Board showed 0% mastered, 0% accuracy, 0 challenges and every
unit "Not Started".

## What the database actually says

Read-only query against production (`.get()` only, no writes anywhere):

| skill | sessions | accuracy |
| --- | --- | --- |
| vocabulary | 16 | 38% |
| listening | 3 | 11% |
| reading | 2 | 26% |
| **grammar** | **0** | no data |

21 sessions total. **No grammar session has ever been written for this
account.** Grammar does save proper docs (`skill: 'grammar'`, with a
percentage) when a drill finishes, so there is no doubt about the mechanism.

Recomputing the hub tile the way `progress.js` does, grammar has **no key at
all** in `bySkill`, so `getSkillProgress('grammar')` returns 0.

**The Quest Board was right. The tile was wrong, and its number was not in
Firestore.**

### A wrong hypothesis, corrected

Before reading the data I proposed that grammar sessions were missing their
`percentage` field, which would have made the two sides disagree. Every one of
the 21 sessions carries a percentage. That theory was wrong and the data
killed it.

## Fix 1: the stats cache was not scoped to a user

`journeyStats` was cached under a single unscoped key:

```js
localStorage.setItem('journeyStats', ...)
```

`primeJourneyStats()` reads it at parse time to paint the hub before Firestore
answers. Two consequences:

- a cache written **before a Firestore cleanup** kept being displayed after it,
  which is what produced 81% for an account with no grammar sessions
- on a shared campus machine, the copy left by the previous person was primed
  for whoever signed in next. Signing out cleared it, and the comment there
  reasons about exactly this, but **closing the tab did not**, which is the
  common case in a lab.

The key is per-uid now. Priming runs before Firebase Auth resolves, so the uid
comes from the session Firebase itself persists in localStorage, found by
scanning for the `firebase:authUser:` prefix rather than rebuilding
`firebase:authUser:<apiKey>:[DEFAULT]`, so an SDK or project change cannot
break it. The legacy unscoped key is deleted on every load.

`assignments/js/student-assignments.js` read the same unscoped key in two
places. Both now go through the shared `window.LLJourneyCache.read()`. Those
branches look for `journeyStats.sessions`, which this object has never had
(it carries `totalSessions`, a number), so they were dead either way; they are
closed rather than left as a cross-user read path.

### Executed, not just syntax-checked

`node --check` cannot catch a ReferenceError, so the real helpers were pulled
out of `progress.js` and run against a fake localStorage:

| case | result |
| --- | --- |
| signed in as B with A's cache present | reads B's |
| ...and does not read A's 81% | confirmed |
| nobody signed in | returns `{}` |
| corrupt auth entry | no throw |
| corrupt stats entry | `{}`, no throw |
| localStorage blocked (private mode) | `{}`, no throw |

The harness itself had a bug first: extracting the helper with
`indexOf('};')` cut the object literal at the `return {};` inside its own
body. Brace-matched now.

## Fix 2: "QUESTIONS 2326" was not the student's work

That tile counted the questions that **exist** in the level's bank:

```js
var n = topics.reduce(function (s, t) { return s + (t.questions || []).length; }, 0);
```

It sat in a row with Mastered, Best, Accuracy and Challenges, all of which
describe the student, styled identically. So four personal numbers and one
inventory number, which is why the row read as nonsense next to a set of zeros.

Now labelled **Answered** and fed from the student's own sessions
(`grStats.totalQ`). The content count is still needed for the unit picker, so
it stays as `info.totalQ`; the new `info.answeredQ` is separate.

## How to confirm on the machine that showed 81%

```js
JSON.parse(localStorage.getItem('journeyStats')||'{}').bySkill
```

After this ships the legacy key is removed on load, so the tile will read 0%
for grammar, which is the true number until a drill is actually completed.

## Ritual

- `node --check` across every `.js` - 0 failures
- no unscoped `journeyStats` read remains anywhere
- new top-level names checked for collisions - none
- em-dash scan - clean
- gates: seventeen, all PASS
- bump: progress.js v5, auth.js v14, grammar.js v39, student-assignments.js
  v13, CACHE_VERSION -> **v383**; `--check` OK
