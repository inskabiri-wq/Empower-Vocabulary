# 2026-08-23 - the profile badge sometimes showed "Student"

Report: the badge sometimes shows the real name and sometimes the placeholder
"Student", and it is worst after opening placement and coming back.

## Reproduced before changing anything

Four scenarios, real `js/profile-hub.js` driven against a stubbed auth and
Firestore. `cold` = session not yet restored at boot, `warm` = session already
live (which is what coming back from another page looks like):

| scenario | badge |
| --- | --- |
| cold / db early | Alireza Kabiri |
| cold / db late | Alireza Kabiri |
| warm / db early | Alireza Kabiri |
| **warm / db late** | **"Student", permanently** |

Exactly one cell fails, which is why it looked random.

My first attempt at this harness ALSO failed the cold cases, and that was the
harness, not the module: it fired the auth callback on a fixed 120ms timer that
elapsed before the script had finished loading, so nothing ever called the
listener it was supposed to be testing. Driving the environment off the module's
own registration instead of a delay fixed it. Same class of mistake as the dead
dev server yesterday - **when a probe says "did not run", suspect the probe.**

## Root cause

```js
if (a.currentUser) { readFor(a.currentUser.uid); return; }   // one shot, then leaves
if (typeof a.onAuthStateChanged === 'function') {            // never reached
  a.onAuthStateChanged(function (u) { if (u) readFor(u.uid); });
}
```

and, inside `readFor`:

```js
if (!window.db) return;    // gives up, and nothing retries
```

When the session is already restored the first branch runs and **returns before
subscribing at all**. `firebase-config` assigns `window.db` a moment after this
module boots, so that single attempt lands in the gap, bails, and there is no
listener left to try again. The badge keeps whatever the cache held, or the
template default "Student" when the cache is empty.

A warm session is exactly the returning-from-placement case, which is why that
navigation triggered it. It is intermittent because it is a race between
`firebase-config` and this module's boot.

Two further defects in the same area, both of which make a bad value stick:

- `fromUserDoc()` returns an object for ANY object it is given, with the name
  defaulting to `'Student'`. So an empty or half-written document looked exactly
  like a successful read: the caller stopped looking AND wrote "Student" into
  localStorage, where it painted on every subsequent load. A wrong name that
  outlives the network problem that caused it is worse than a slow one.
- The cache key is a single global `'ll-profile'` with no owner, so on a shared
  device the next account paints the previous student's name until its own read
  lands.

## Fix

`js/profile-hub.js`:

1. **Subscribe first, then take the immediate shot.** The listener is now
   registered unconditionally and `readFor` is called after it, so the warm path
   has the same second chances the cold path always had.
2. **Wait for Firestore instead of giving up.** A missing `window.db` now
   retries every 100ms, up to 10s, rather than returning.
3. **A placeholder is not an answer.** `fromUserDoc` reports `named`, and
   nothing that is not named is cached or treated as resolved; an unnamed doc
   leaves the door open for a later attempt.
4. **The cache is stamped with its owner** and discarded when the signed-in uid
   does not match.

## Verified

All seven cases pass, including the one that failed and the two hardening cases:

| case | badge | cache |
| --- | --- | --- |
| cold / db early | Alireza Kabiri | stamped u123 |
| cold / db late | Alireza Kabiri | stamped u123 |
| warm / db early | Alireza Kabiri | stamped u123 |
| **warm / db late** (was broken) | **Alireza Kabiri** | stamped u123 |
| document with no name | Student | **not cached** |
| cache belonging to another uid | Alireza Kabiri | replaced |

And a genuine long-gap test, with `onAuthStateChanged` never firing again so
recovery can only come from the retry loop:

| db arrives at | badge resolves |
| --- | --- |
| 1500ms | 1559ms (59ms after) |
| 3000ms | 3120ms (120ms after) |

## Ritual

- `node --check` profile-hub.js - ok
- em-dash scan - clean
- profile-hub-check - PASS
- inline-css-check - PASS
- teacher-mobile-check - PASS
- grammar-sanity - PASS
- bump: profile-hub.js v11 -> **v12** (4 refs in 4 files),
  CACHE_VERSION v320 -> **v321**
- `bump.js --check` - OK

## What could still go wrong

If a student's user document genuinely has no `name` field, the badge shows
"Student" - correctly, since there is nothing else to show - and keeps retrying
rather than caching it. That is a data problem, not a display one, and it would
now be visible as a badge that never settles instead of one that silently lies.
