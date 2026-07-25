# 2026-07-08 (d) - Writing AI: function + teacher access + usage reports

## User decisions
2) cheapest model, exact structured return -> Gemini Flash + responseSchema.
3) teachers only for now (students option reserved).
4) admin grants specific teachers via a dropdown; track who does what; usage in
   Excel + graph.

## Built + verified this turn

### Cloud Function (functions/index.js) - analyzeWriting
- Callable, teacher-gated (assertWritingAI: admin always; else uid must be in
  settings/aiWritingAccess.teacherUids). Calls Gemini (model gemini-2.0-flash,
  configurable) with responseMimeType json + a full responseSchema matching the
  corrector's EXACT shape (cefr, estimates, criteria CC/TA/GR/VO, annotations
  with enum criterion/severity, vocab/grammar profiles, plan/planSimple,
  rewrites). Guard: drops any annotation whose quote is not a verbatim substring
  of the essay (so the highlighter never breaks). Logs every call to /aiUsage
  (teacherId/name/email, depth, rubric, essayChars, model, at). NO scores.
  Key via functions.config().gemini.key. Node 20 global fetch.
- firestore.rules: /aiUsage read=teacher, delete=admin, create/update=false
  (server-written only). settings/aiWritingAccess uses the existing settings
  rule (auth read, admin write).
- Verified: function loads; exports analyzeWriting; schema/guard/usage/config
  present; rules brace-balanced + aiUsage block.

### Admin access manager - NEW y/teacher/js/ai-writing-admin.js (+ Admin sub-tab)
- New "✍️ Writing AI" admin sub-tab (placed by Reports/Demo, NOT inside the
  admin.js-owned #teachersList, to avoid re-render clobbering).
- Reads teachers from /users (role teacher/admin); dropdown to grant + a list to
  revoke; writes settings/aiWritingAccess.teacherUids. Link to open the
  corrector. Verified in harness: grant saves [t2], lists it, revoke -> [].

### Usage reports - reports-admin.js ?v=7 -> ?v=8
- Loads /aiUsage once. KPI "AI writing analyses"; chart "Writing AI analyses by
  teacher"; Excel gains an "AI usage" sheet (Date/Teacher/Email/Depth/Rubric/
  Essay chars). Verified: KPI=3, chart shows both teachers, workbook = 16 sheets
  incl AI usage with 3 rows + correct header/first row.
- service-worker v87 -> v88.

## REMAINING (next step) - wire the corrector to the live function
y/lingualab-write/ is a standalone staging page with NO firebase. To make a
teacher actually run an analysis: add firebase (app/auth/functions compat) +
init to lingualab-write/index.html, and wire corRun to
firebase.functions().httpsCallable('analyzeWriting')({essay,rubric,depth,task})
-> renderCorrection(correction, essay). Then the /aiUsage records + all the
reporting above light up. Deferred so it gets its own careful pass.

## USER ACTIONS to activate
1. Create a Gemini API key (Google AI Studio).
2. cd functions ; firebase functions:config:set gemini.key="AIza..."
3. firebase deploy --only functions:analyzeWriting,firestore:rules,hosting
Grant teachers in Admin > Writing AI. Cost: Gemini Flash is very cheap; only
enabled teachers can call it; every call is logged.

## Addendum - functions.config() is deprecated (shuts down Mar 2027)
- functions:config:set errored ("Action required before March 2027"). Migrated
  analyzeWriting from functions.config().gemini.key to Secret Manager:
  runWith({ secrets: ['GEMINI_KEY'] }) + process.env.GEMINI_KEY (model via
  optional process.env.GEMINI_MODEL, default gemini-2.0-flash).
- CORRECTED activation steps:
    firebase functions:secrets:set GEMINI_KEY      (prompts, value not echoed)
    firebase deploy --only functions:analyzeWriting,firestore:rules,hosting
  (deploy grants the function's SA access to the secret - accept the prompt.)
- The user already has a Firebase-auto-created Gemini key (Tier 1 · Prepay) - no
  need to create a new one; just paste it into the secrets:set prompt.

## Addendum 2 - corrector WIRED to live analyzeWriting (task done)
- User confirmed deploy complete (secret GEMINI_KEY v2 + access granted +
  analyzeWriting created + rules + hosting). Then wired the front end:
- y/lingualab-write/index.html: added firebase app/auth/functions compat (10.7.1,
  same integrity tags as the dashboard) + inline initializeApp with the app
  config. corrector.js ?v=2 -> ?v=3.
- y/lingualab-write/js/corrector.js: run() now -> a pristine sample essay still
  uses its pre-baked correction (instant/offline); ANY other essay calls
  firebase.functions().httpsCallable('analyzeWriting')({essay,rubric,depth,task})
  and renders the returned correction via the existing renderCorrection. Loading
  state on the button, sign-in prompt if no auth, permission-denied hint if the
  teacher is not enabled.
- CSP already allows cloudfunctions.net; auth persists cross-tab (same origin),
  so opening the corrector from the dashboard link carries the session.
- service-worker v88 -> v89.
- Verified on the REAL page (static-y, stubbed callable): firebase loads, sample
  renders, a custom essay -> calls analyzeWriting with correct payload
  (depth=deep/rubric=essay/task), live correction renders, note clears; not
  signed in -> sign-in prompt; ZERO console errors.

## DEPLOY (one more hosting deploy for the corrector wiring)
    firebase deploy --only hosting
(The function + rules + secret are already live from the user's deploy.)
Then: Admin > Writing AI -> grant a teacher -> that teacher opens the corrector,
pastes an essay, clicks Analyze -> live feedback + a row in /aiUsage + Reports.
