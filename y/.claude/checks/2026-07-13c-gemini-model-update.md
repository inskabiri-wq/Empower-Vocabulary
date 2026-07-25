# 2026-07-13c — analyzeWriting: resilient model selection (retired-model whack-a-mole)

## Why
Billing now works (the "prepayment credits depleted" error is gone). But pinned
model names kept failing in sequence:
- `gemini-2.0-flash` -> "no longer available"
- `gemini-2.5-flash` -> "no longer available to new users" (project counts as new)

Rather than guess another single name, made model selection resilient.

## Change (`functions/index.js`, analyzeWriting)
- Replaced the single `callGemini(key, model, ...)` call with a fallback loop over
  candidate models (auto-updating aliases first, cheapest-capable):
  `['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']`.
  Setting the `GEMINI_MODEL` secret/env forces a single model and skips the loop.
- Loop tries the next model ONLY on availability errors
  (`no longer available|not available|not found|unsupported|does not exist|unknown name|invalid model`).
  On a real error (billing/quota/blocked/bad JSON) it stops immediately so it
  never wastes calls or masks the true cause.
- If none work, the existing admin-vs-teacher mapping applies: admin sees the raw
  reason; teachers see "temporarily unavailable / try again" (billing -> unavailable).
- Logs the model actually used (`console.log('analyzeWriting: used model ...')`)
  and stores it per-call in `/aiUsage` (shows in Reports).

## Verification
- `node --check functions/index.js` — OK. em-dash scan — clean.
- Loop simulation (same regexes):
  - two models unavailable -> uses the 3rd. ✅
  - billing error on first -> stops after 1 attempt, no fallback. ✅
  - all unavailable -> ends with no correction -> friendly/real error path. ✅
  - PASS: true
- Not browser-observable (server-side). Definitive check: redeploy + Analyze.

## To ship (user action)
- `firebase deploy --only functions:analyzeWriting`
- Then corrector -> paste a short essay -> Analyze. It will land on whichever
  candidate the project is allowed to call.
- Future retirements self-heal (the alias updates); if ever needed, force one
  model with `firebase functions:secrets:set GEMINI_MODEL` + redeploy.
