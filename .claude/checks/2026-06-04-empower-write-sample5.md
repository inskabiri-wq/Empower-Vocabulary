# Empower Write: added user's essay as Sample 5 · 2026-06-04

## Request
"NO. 7" essay (communication & teamwork vs academic qualifications). User asked
to see the writing feedback rendered IN the Empower Write tool, not just as text.

## What was added
- `.staging/empower-write/js/sample.js`: new sample `S5` (id `teamwork`, label
  "Teamwork vs qualifications (B1+ · essay)") appended and registered in
  `window.CORRECTOR_SAMPLES = [S1, S2, S3, S4, S5]`.
- Full data: task, essay (verbatim), rubric 'essay', Text-Inspector profiles
  (lemmas / verbForms / clauses), and corrections for all three depths:
  - light: 5 annotations (triage).
  - medium: 18 annotations (4 strengths + 14 fixes/tips) with `simple` /
    `simpleSuggestion` variants, by-criterion notes (+ noteSimple), overall
    (+ overallSimple), plan (+ planSimple).
  - deep: same annotations + 4 model `rewrites` + 5-step plan.
  - No scores; CEFR/IELTS/rubric are labelled estimates only.
- `index.html`: bumped `js/sample.js?v=2` -> `?v=3` so the new sample loads.

## Verification
- `node --check sample.js` -> SYNTAX OK.
- Eval check: 5 samples; S5 medium = 18 annotations; deep = 4 rewrites; EVERY
  annotation `quote` and rewrite `before` is an exact substring of the essay
  ("quotes/rewrites NOT found in essay: NONE - all resolve"), so all highlights
  land and no anchor is orphaned.

## How to view
1. Server: http://localhost:8830/.staging/empower-write/ (START-DEMO-SERVER.bat
   if down).
2. Sample picker -> "Teamwork vs qualifications (B1+ · essay)".
3. Choose depth (Light / Medium / Deep), click Analyze.
4. Hover highlights for inline comments; toggle simpler-language; Deep shows the
   model rewrites. This is the same demo the dashboard AI-correction tab links to.

## Not deployed
Empower Write is staging-only (firebase ignore `**/.*` covers `.staging`), so
this never ships with `firebase deploy`. It runs on the local no-cache server.
