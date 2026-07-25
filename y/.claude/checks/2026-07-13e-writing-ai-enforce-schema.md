# 2026-07-13e — Writing AI: enforce full data via required schema (per depth)

## Why
After switching to Flash-Lite, some report sections went missing ("stole some
data") because the smaller model drops OPTIONAL fields. Only overall/criteria/
annotations were required. User wants the data returned exactly, every time.

## Change (`functions/index.js`)
- `writingSchema(depth)` now sets a DEPTH-AWARE `required` list. With
  responseMimeType=application/json + responseSchema, Gemini uses constrained
  decoding, so required fields CANNOT be omitted (hard guarantee):
  - all depths: `cefr, estimates, overall, criteria, annotations`
  - medium + deep add: `vocabProfile, grammarProfile, plan`
  - deep adds: `rewrites`
  - nested required tightened: estimates -> ielts/toefl/rubric; vocabProfile ->
    cefr/distribution; grammarProfile -> cefr/features (criteria + annotation +
    rewrite item requireds unchanged).
- `callGemini` passes the depth: `responseSchema: writingSchema(depth)`, and adds
  `maxOutputTokens: 8192` so a full deep response never gets truncated (which
  would otherwise drop fields / break JSON).
- Prompt reinforced: "fill EVERY field the schema requires for this depth with
  real, specific content - never leave a required section empty or generic."

## Verification
- `node --check functions/index.js` — OK. em-dash scan — clean.
- Confirmed compiled: writingSchema(depth), responseSchema: writingSchema(depth),
  maxOutputTokens 8192.
- Depth->required mapping test:
  - light: cefr, estimates, overall, criteria, annotations (no profiles/plan/rewrites)
  - medium: + vocabProfile, grammarProfile, plan
  - deep: + rewrites
  - PASS: true
- Not browser-observable (server-side). Real check: redeploy + Analyze each depth.

## Caveat
- `required` guarantees the section is PRESENT; on a tiny model the CONTENT can be
  thin. If deep feels shallow, force a stronger model just for deep via
  GEMINI_MODEL, or split model-by-depth later.

## To ship (user action)
- `firebase deploy --only functions:analyzeWriting` (re-run if "Failed to list
  functions" - Windows discovery flake).
- Test light/medium/deep; every section should now appear.
