# 2026-07-07 - Fix: CSP blocked all browser -> Cloud Function calls

## Symptom
Admin ▸ Demo accounts list showed a red "internal". Browser console (shared by
user) revealed the true cause:

    Fetch API cannot load https://us-central1-...cloudfunctions.net/listDemoAccounts
    Refused to connect because it violates the document's Content Security Policy.

## Root cause
firebase.json's hosting CSP header had a `connect-src` allowlist that did NOT
include the Cloud Functions origin. So the browser blocked every callable fetch
(listDemoAccounts, createDemoAccount, deleteDemoAccount, and rosterImport) before
it left the page. It never surfaced before because functions were staged (never
deployed / never called from the browser) until this week.

NOTE: my earlier "cold start" diagnosis was WRONG - a server-side repro passed
because it bypasses the browser CSP entirely. Only the browser console showed it.

## Fix
firebase.json CSP `connect-src`: added `https://*.cloudfunctions.net` (1st-gen
callables) + `https://*.run.app` (gen-2/Cloud Run, future-proof). No meta CSP in
the HTML to worry about (header is the only CSP source).

- service-worker.js CACHE_VERSION v78 -> v79, so the browser re-fetches the HTML
  with the new CSP header (the cached document carried the old header).

## Verify
- firebase.json valid JSON; connect-src now matches /cloudfunctions\.net/ + /run\.app/.
- (Backend already proven: server-side E2E of create/list/delete = all pass. The
  only thing broken was the browser CSP, now fixed.)

## DEPLOY (user)
    cd E:\vocab-trainer
    firebase deploy --only hosting
Hosting deploy is what applies the CSP header change. After it lands, hard-refresh
(or let the new SW activate) and the Demo accounts list + Create + Refresh all work
from the browser.
