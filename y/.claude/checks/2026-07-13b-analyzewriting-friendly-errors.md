# 2026-07-13b — analyzeWriting: friendly teacher errors, real reason for admin

## Why
When Gemini fails (e.g. "Your prepayment credits are depleted..."), teachers were
shown the raw billing text. User asked: teachers should see a clean "temporarily
unavailable, contact your administrator"; the admin (who diagnoses/configures)
should still see the real reason.

## Change
- `functions/index.js` — `analyzeWriting`: wrapped the `callGemini()` call in
  try/catch.
  - Always `console.error(...)` the real failure (with caller email/uid) to the
    function logs.
  - If caller is the admin (`who.email === ADMIN_EMAIL`): rethrow the real error
    (HttpsError preserved, else wrapped as `internal`) so the admin sees the true
    reason.
  - Otherwise (teacher): classify billing/quota via
    `/prepay|credit|quota|billing|resource[ _]?exhausted|exceeded|rate.?limit|429/i`
    -> throw `unavailable` "Writing AI is temporarily unavailable. Please contact
    your administrator."; any other failure -> `internal` "Writing AI could not
    analyze this right now. Please try again in a moment, or contact your
    administrator if it keeps happening."
  - Validation (too short/long), auth, permission, and missing-key errors are
    thrown BEFORE the try/catch, so they still surface unchanged to everyone.

No client change: the corrector already shows `e.message`, so teachers now get the
clean text and the admin gets the raw reason.

## Verification
- `node --check functions/index.js` — OK. em-dash scan — clean.
- Classifier unit test (8 cases): the exact user message + RESOURCE_EXHAUSTED /
  429 / "exceeded quota" -> billing TRUE; "no content" / "invalid JSON" / HTTP 500
  -> FALSE. PASS.
- Not browser-observable (server-side function); no hosting/SW change.

## To ship (user action)
- `firebase deploy --only functions:analyzeWriting`.
- Behaviour after deploy: admin still sees the real billing error while testing;
  a granted teacher hitting the same depleted-credits state sees only
  "temporarily unavailable, contact your administrator."
