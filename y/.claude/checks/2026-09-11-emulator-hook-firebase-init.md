# 2026-09-11 - every page can now be tested logged in

## The problem

`student/js/config.js` and `teacher/js/config.js` each carried a
localhost-guarded emulator hook. That covered **10 of 32 pages**. The other 22
load only `js/firebase-init.js`, so they always talked to production and, being
auth-gated, bounced straight to the login screen.

This cost real time all week. `app.html` in particular could not be opened
signed in at all, so verifying the placement flow, the writing exam and most
classroom pages meant serving a **throwaway copy of the whole tree** from the
scratchpad with a hand-patched `firebase-init.js`. Every verification round
needed a resync.

## The fix

The same block the two config files already used, moved into
`js/firebase-init.js` right after `initializeApp`.

**It has to be there and nowhere later.** Firestore refuses settings changes
once the client has started, so immediately after `initializeApp` is the last
safe moment. That is also why it could never be bolted on from a page script,
which is what forced the throwaway copy in the first place.

## Checked before writing, not after

**10 pages now call `useEmulator` twice** (both dashboards and 8 classroom
pages that load a config.js as well). So the question was whether a double call
throws.

First measurement said yes - and it was wrong. I tested on a page that had
already booted and run queries, where even the FIRST call threw "Firestore has
already been started". That is a property of the page state, not of double
calling.

Re-tested on a fresh app instance before any query, which is the real situation
at boot:

    auth  1st: ok    auth  2nd: ok
    db    1st: ok    db    2nd: ok     DOUBLE_CALL_SAFE: true

So the duplicate is harmless and the two config.js files were left alone rather
than edited for tidiness. Three files not touched is better than three files
touched.

## Executed, on the REAL tree

Not the throwaway copy. `static-y` serving `E:/vocab-trainer/y` directly, which
is itself the proof the workaround is retired.

| | |
| --- | --- |
| **the guard, without the flag** | Firestore = `firestore.googleapis.com`, Auth = production |
| **the guard, with the flag** | Firestore = `127.0.0.1:8080`, signed in |
| `app.html` - the page that could never be tested | stays on `/app.html`, signed in, `menuScreen` shown, "Demo Student" |
| `student-dashboard.html` - a double-call page | stays, emulator, signed in |
| `classroom-aiquiz-student.html` | stays, emulator, join button present |
| AI Quiz safety net | **19/19** |
| gate suite | **24 passed, 0 failed** |
| preflight | **ALL PASS** |

The without-flag result is the one that matters: on localhost, absent the flag,
it goes to the real project. A production hostname can never match the guard at
all.

## Also updated

`tools/README-emulator-e2e.md` step 3 told you to paste a snippet into a
LOCAL-only copy or the browser console. That is obsolete. It now says to set
`localStorage.useEmulators = '1'` and reload, and records both measured hosts.

## Ritual

- `node --check` across 176 js - clean
- em-dash scan - 0
- bump: `firebase-init.js`, CACHE_VERSION v413 -> **v414**, no drift
- preflight ALL PASS

## Deploying

Hosting only, no rules or functions:

    firebase deploy --only hosting

Production behaviour is unchanged by design: the hook cannot fire off localhost.
