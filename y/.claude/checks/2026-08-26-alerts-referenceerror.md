# 2026-08-26 - I broke the teacher dashboard for the admin

Reported: **Access Denied - "Error loading data: sessions is not defined"** on
`teacher-dashboard.html`, as admin. My fault, from the score-rollup change an
hour earlier.

## What I did

Rewriting the needs-attention card to use the rolled-up average, I replaced:

```js
const sessions = scoredOnly(allSessions.filter(sess => sess.userId === s.id));
const avg = sessions.length > 0 ? Math.round(avgOf(sessions)) : 0;
```

with a call to the new helper - and **deleted the `sessions` declaration while
a template literal further down still read `sessions.length`**:

```js
<div class="alert-student-class">${sessions.length} sessions</div>
```

A ReferenceError. The dashboard's loader catches errors and falls through to
the Access Denied screen, so a one-word mistake in an alerts card presented as
a permissions failure to the person who owns the app.

## Why the checks did not catch it

`node --check` parses. It cannot know whether an identifier will exist at
runtime, and every gate I had was either a parser check or a pure-function
test. **Nothing executed this function.**

## Fixed, and the count now matches the average

The row needed a session count, so it gets one from the **same source as the
average**:

```js
const nSessions = scoredCountFor(s);   // rolled-up count, else the window count
```

Paired deliberately. Reading "3 sessions - 41%" where the 41% came from a
year's work and the 3 came from the recent window would be its own small lie.

## A second hazard the new test found

The harness then failed with **"LLRollup is not defined"** on my own code:

```js
const rolled = (window.LLRollup && LLRollup.averageFor) ? LLRollup.averageFor(s) : null;
```

Guarded on `window.LLRollup`, then called the **bare** `LLRollup`. That happens
to work in a browser only because `window` IS the global object. It is an
implicit dependency that reads like a bug and throws anywhere else. Now
referenced through `window` on both sides. Swept the tree: no other unqualified
references.

## New gate: tools/alerts-runtime-check.js

It **executes** `checkStrugglingStudents()` against stub globals - the thing no
existing gate did.

| case | result |
| --- | --- |
| **the exact regression**: rolled-up totals, no rows in the session window | flags at 30% over 4 sessions |
| rolled-up totals above the threshold | nothing flagged |
| no counters, falls back to the window | flags at 30% over 2 sessions |
| no counters and no sessions | not "low" |
| counters win over the window when both exist | flags at 20% over 10 sessions |
| no students at all | no throw |
| zero counters | no divide by zero |

Seven cases, all passing. Run against the code as it was an hour ago it fails
on the first five, which is the point of it.

## The lesson worth keeping

A syntax check is not a smoke test. Any function that a dashboard's error
handler can turn into "Access Denied" deserves to be actually run, with stubs,
in a gate. Two of my checks today were pure-function tests that would never
have touched this path.

## Ritual

- `node --check` across every `.js` - 0 failures
- em-dash scan - clean
- gates: **ten** now, all PASS (alerts-runtime-check is new)
- bump: activity.js v9, CACHE_VERSION -> **v362**; `--check` OK
