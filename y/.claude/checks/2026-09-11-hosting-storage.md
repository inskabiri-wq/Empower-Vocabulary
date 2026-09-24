# 2026-09-11 - the 5.2 GB was 213 old deploy snapshots

## What it was

The storage bar read 52.3% of the 10 GB no-cost quota. None of it was app
content.

    810 hosting versions
      214 FINALIZED   (these are what hold storage)
      595 already DELETED
      1   ABANDONED
    LIVE version : 2fd3a9907db2a7a5  (40 MB)
    213 finalized-but-not-live       = 5.19 GB

Firebase Hosting keeps a full snapshot of **every** deploy forever. Each one
here is about 40 MB, and this week's work alone added several. Only the live
version is needed to serve the site.

This project has been here before: `y/tools/hosting-prune.js` exists because
the pile-up once reached 600+ versions and produced the deploy-blocking
HTTP 429.

## Done, in this order

**1. Pruned.** `DELETE=1 KEEP_RECENT=5 node y/tools/hosting-prune.js`

    deleted 208, failed 0. Live + newest 5 kept.

    FINALIZED   214 -> 6
    reclaimable 5.19 GB -> 0.19 GB

The live version and the five most recent are intact, so rollback is still
possible to any deploy from 2026-09-08 onward.

**2. Set the retention limit.** This is the part that matters.

    before: maxVersions = (not set)
    PATCH -> HTTP 200
    after : maxVersions = 10

`maxVersions` was **never set**, which is exactly why it grew to 810 versions
and why a manual prune alone would just be a treadmill. Firebase now keeps the
10 most recent and discards the rest on its own. Steady state is about 400 MB
instead of unbounded growth.

Order was deliberate: prune explicitly first, so the result is observable and
predictable, then set the limit above the resulting count (6) so nothing extra
is deleted as a side effect of setting it.

## Verified afterwards

The whole point of care here is that the live site must be untouched.

| | |
| --- | --- |
| index, student dash, teacher dash, aiquiz student, service worker | all HTTP 200 |
| `CACHE_VERSION` live vs local | both **v413** |
| service-worker.js, student-assignments.js, aiquiz-teacher.js, reading-exam.js | byte-identical to local |

## A probe that nearly produced a false alarm

The first cache-version check grepped `v[0-9]+` and printed `v1`, which looks
like a catastrophic rollback. It was matching the first version-shaped string
anywhere in the file, not the constant. Re-checked against
`CACHE_VERSION = '...'` and it is v413 on both sides.

Worth writing down because the instinct on seeing "v1" is to panic and start
fixing. The cheaper move was to distrust the grep first.

## Deploy state, for the record

Hosting is current at v413 and byte-identical to local.

`pruneRetention` could not be confirmed from here: the service-account key
cannot list Cloud Functions. It does not matter yet either way, because
`settings/retention` does not exist in production, so the function is inert
whether or not it is deployed. Checked read-only:

    settings/retention exists     : false
    settings/retentionRuns exists : false

## Nothing in the repo changed

No app file, no config file. Both actions were against the Firebase Hosting
API. The scripts used live in the scratchpad; the prune tool was already in
`y/tools/`.
