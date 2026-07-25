# 2026-07-22b - Writing AI: hybrid model tiers + real token/cost logging

Change is server-side only (functions/index.js). No client assets touched, so
no ?v bump and no service-worker bump.

## Why
`gemini-flash-lite-latest` is an AUTO-UPDATING alias. When Google repointed it
from 2.5 Flash-Lite ($0.10 in / $0.40 out per 1M) to 3.5 Flash-Lite ($0.30 /
$2.50), the Writing AI got ~3x more expensive on input and ~6.25x on output
with no code change and no notification. Nothing in the app measured tokens, so
this was invisible. Prices verified 2026-07-22 at
https://ai.google.dev/gemini-api/docs/pricing.

## 1. Hybrid model tiers (analyzeWriting)
Light + Medium keep the cheap Flash-Lite chain; DEEP now runs the full Flash
chain, because deep is where sentence rewrites and precise grammar naming
happen. Deep is already permission-gated (deepUids) and capped per teacher
(deepCaps), so the extra spend stays small and controlled.

    LITE_CHAIN = [gemini-flash-lite-latest, gemini-2.5-flash-lite, gemini-flash-latest]
    DEEP_CHAIN = [gemini-flash-latest, gemini-flash-lite-latest, gemini-2.5-flash-lite]

Aliases (not pinned version ids) are kept on purpose - the original comment
about Google retiring pinned names still applies. Overrides:
  GEMINI_MODEL       -> light + medium (and deep when GEMINI_MODEL_DEEP unset;
                        back-compatible with the previous single-var behaviour)
  GEMINI_MODEL_DEEP  -> deep only

## 2. Measured token + cost logging
callGemini now returns { correction, usage } instead of the bare correction.
usage carries modelVersion (what the alias ACTUALLY resolved to - this is the
early warning for another silent alias move), promptTokens, outputTokens,
thoughtsTokens, totalTokens, read from the API's usageMetadata.

/aiUsage docs gain: modelVersion, promptTokens, outputTokens, thoughtsTokens,
totalTokens, estCostUsd. Cloud Function logs one line per call with the same
figures. estimateCostUsd() uses a GEMINI_PRICES table (dated, with the pricing
URL in a comment) and bills output as candidates+thoughts, since Google's
output price includes thinking tokens. Unknown/future model ids return 0 rather
than throwing, so a new alias can never break a correction.

## Cost reference (measured shape: ~1500 in / ~2500 out per medium essay)
  2.5 Flash-Lite  $0.00115   3.5 Flash-Lite  $0.0067
  3.6 Flash       $0.021     3.5 Flash       $0.02475
At ~47.2 TRY/USD: about 0.32 TRY vs 1.00 TRY per essay (Flash-Lite vs Flash).

## Verification
- node --check functions/index.js OK; em-dash scan of the new code clean.
- Unit tests (scratchpad, extract the REAL source out of index.js and eval it,
  so the shipped code is what is under test) - 18 assertions, ALL PASS:
  four per-model costs; thinking tokens billed as output; longest-prefix match
  so gemini-2.5-flash-lite-001 is not billed at Flash rates; unknown model and
  missing usage both degrade to 0; light/medium -> LITE_CHAIN; deep ->
  DEEP_CHAIN with gemini-flash-latest first; GEMINI_MODEL pins both tiers;
  GEMINI_MODEL_DEEP overrides deep only and does NOT affect medium.
- NOT run against the live API (that needs the real GEMINI_KEY and spends
  money). First real call after deploy should be checked in the function log
  for the "tokens in/out/think" line.

## CORRECTION (found 2026-07-22, after deploy)
The pinning instruction in this log was WRONG. GEMINI_MODEL /
GEMINI_MODEL_DEEP are read from process.env, but they were never declared
anywhere - not in runWith({ secrets: [...] }) and there was no .env file - so
at runtime both are always undefined. `firebase functions:secrets:set
GEMINI_MODEL` alone does NOT work: a secret is only injected if it is also
listed in the secrets array. (The gap is pre-existing; GEMINI_MODEL was
already read this way before the hybrid change.)

Impact: NONE on default behaviour. Both vars being undefined is exactly the
path that gives the intended hybrid tiering, which is what is running now.
Only the manual override was inert.

Fix: added functions/.env (gitignored, model names are not secret) with both
vars present but COMMENTED OUT, so behaviour is unchanged until someone
uncomments one. Declaring them in the secrets array was rejected: a declared
secret that does not exist in Secret Manager makes the deploy fail.

To pin a model now: uncomment the line in functions/.env, then
  firebase deploy --only functions:analyzeWriting

## Ship
firebase deploy --only functions:analyzeWriting

After a week, total the real spend from /aiUsage (sum estCostUsd, or recompute
from the token fields if prices moved). If deep turns out not to be worth the
Flash tier, one env var reverts it:
  GEMINI_MODEL_DEEP=gemini-flash-lite-latest
