# 2026-07-13d — Writing AI: cheaper model + consistency + no giant-comment

## Why
Live logs showed every call used `gemini-flash-latest` = Gemini 3.5 Flash
($1.50 in / $9.00 out, thinking on) -> ~10 TL for 3 analyses and a 50s deep run.
User also reported answers varying between runs and a whole revised passage
landing inside a single comment. Applied four fixes (user said "yes yes and yes").

## Changes (`functions/index.js`, all server-side)
1. Model list cheapest-first:
   `['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest']`
   (was flash-latest first). flash-lite-latest = current Flash-Lite, GA, ~$0.25/$1.50,
   fast, no heavy thinking. Full flash only as last resort. Override via GEMINI_MODEL.
   -> cost down ~6x (to ~25x if 2.5-flash-lite is reachable) and ~6x faster.
2. `temperature` 0.3 -> 0.15 for steadier output.
3. Prompt: quote 3-12 words ONLY; suggestion = corrected version of just that span
   (~20 words max); NEVER paste a whole sentence/paragraph/essay into quote or
   suggestion (full-sentence rewrites belong only in "rewrites", deep mode).
4. Validation guards in analyzeWriting:
   - annotations: drop if quote not in essay, quote > 15 words, or suggestion > 300 chars.
   - rewrites: drop if before > 400 chars or after > 500 chars.
   -> a runaway rewrite can no longer render as one giant comment / full-essay highlight.

## Verification
- `node --check functions/index.js` — OK. em-dash scan — clean.
- Confirmed compiled: temperature 0.15; candidates cheapest-first.
- Guard unit test:
  - good short annotation kept; 20+ word quote dropped; 350-char suggestion dropped;
    quote-not-in-essay dropped -> 1 kept. ✅
  - sentence rewrite kept; 500-char whole-essay rewrite dropped -> 1 kept. ✅
  - PASS: true
- Not browser-observable (server-side). Real check: redeploy + Analyze.

## To ship (user action)
- `firebase deploy --only functions:analyzeWriting`
- Then corrector -> Analyze. Expect: much cheaper (well under 1 TL for a few
  essays), faster, steadier answers, and no whole-passage-in-a-comment.
- Function logs the used model ("used model ...") and stores it per call in
  /aiUsage; check it lands on a flash-lite model.
- If a deploy shows "Failed to list functions", that is the CLI's local discovery
  step flaking (Windows); just re-run the same command (module loads fine).
